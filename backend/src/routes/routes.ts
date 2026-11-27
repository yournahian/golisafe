import { Router, Request, Response } from 'express';
import {
  getSupabaseClient,
  DEFAULT_MOCK_HAZARDS,
  HazardRecord,
  HazardSeverity,
} from './hazards';

export interface RouteOption {
  id: string;
  label: 'Safest Route' | 'Fastest Route' | string;
  distanceMeters: number;
  durationSeconds: number;
  riskScore: number;
  hazardsNearRoute: number;
  coordinates: Array<[number, number]>; // [lat, lng]
}

const router = Router();

/**
 * Computes Haversine distance in meters between two [lat, lng] coordinates.
 */
function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Computes total polyline distance in meters for [lat, lng] coordinates.
 */
function computePolylineDistanceMeters(coords: Array<[number, number]>): number {
  let total = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    total += haversineDistanceMeters(
      coords[i][0],
      coords[i][1],
      coords[i + 1][0],
      coords[i + 1][1]
    );
  }
  return Math.round(total);
}

/**
 * Fetches active hazards from Supabase or returns in-memory mock fallback.
 */
async function getActiveHazards(): Promise<HazardRecord[]> {
  const now = Date.now();
  try {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data, error } = await supabase
        .from('hazards')
        .select(
          'id, category, severity, latitude, longitude, landmark_context, sub_tag, status, created_at, confirmations, resolved_count, expires_at'
        )
        .in('status', ['active', 'crowd_verified']);

      if (!error && Array.isArray(data)) {
        return (data as HazardRecord[]).filter((h) => {
          if (h.status === 'resolved' || (h.status as any) === 'expired') {
            return false;
          }
          if (h.expires_at) {
            const exp = new Date(h.expires_at).getTime();
            if (!isNaN(exp) && exp < now) return false;
          }
          return true;
        });
      }
    }
  } catch {
    // ignore and fallback
  }

  return DEFAULT_MOCK_HAZARDS.filter((h) => {
    if (h.status === 'resolved' || (h.status as any) === 'expired') return false;
    if (h.expires_at) {
      const exp = new Date(h.expires_at).getTime();
      if (!isNaN(exp) && exp < now) return false;
    }
    return h.status === 'active' || h.status === 'crowd_verified';
  });
}

/**
 * Computes exact perpendicular distance in meters from point (pLat, pLng)
 * to line segment (aLat, aLng) -> (bLat, bLng) using local equirectangular projection.
 */
function pointToSegmentDistanceMeters(
  pLat: number,
  pLng: number,
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number
): number {
  const cosLat = Math.cos(((aLat + bLat) * 0.5 * Math.PI) / 180);
  const metersPerDegLat = 111320;
  const metersPerDegLng = 111320 * cosLat;

  const ax = (aLng - pLng) * metersPerDegLng;
  const ay = (aLat - pLat) * metersPerDegLat;
  const bx = (bLng - pLng) * metersPerDegLng;
  const by = (bLat - pLat) * metersPerDegLat;

  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;

  if (lenSq < 1e-6) {
    return Math.round(Math.sqrt(ax * ax + ay * ay));
  }

  let t = -(ax * dx + ay * dy) / lenSq;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;

  const closestX = ax + t * dx;
  const closestY = ay + t * dy;
  return Math.round(Math.sqrt(closestX * closestX + closestY * closestY));
}

/**
 * Computes minimum distance in meters from a point to a polyline (checking all segments).
 */
function pointToPolylineDistanceMeters(
  pLat: number,
  pLng: number,
  coords: Array<[number, number]>
): number {
  if (coords.length === 0) return 99999;
  if (coords.length === 1) {
    return haversineDistanceMeters(pLat, pLng, coords[0][0], coords[0][1]);
  }
  let minD = Infinity;
  for (let i = 0; i < coords.length - 1; i++) {
    const d = pointToSegmentDistanceMeters(
      pLat,
      pLng,
      coords[i][0],
      coords[i][1],
      coords[i + 1][0],
      coords[i + 1][1]
    );
    if (d < minD) minD = d;
  }
  return minD;
}

/**
 * Calculates micro-hazard risk score and blocking hazards for a polyline.
 * Uses exact point-to-segment distance with a tight street-width hit radius (<= 18m)
 * so hazards inside an adjacent side alley (~25-35m away) do NOT falsely penalize
 * a clean main road, while hazards directly on the traversed street/alley are caught.
 */
function evaluateRouteRisk(
  coords: Array<[number, number]>,
  activeHazards: HazardRecord[]
): {
  riskScore: number;
  hazardsNearRoute: number;
  minClearanceMeters: number;
  blockingHazards: HazardRecord[];
} {
  let riskScore = 0;
  let hazardsNearRoute = 0;
  let minClearanceMeters = 99999;
  const blockingHazards: HazardRecord[] = [];

  const startPt = coords[0];
  const endPt = coords[coords.length - 1];

  for (const hazard of activeHazards) {
    // Ignore hazards sitting directly on the exact start or destination pin (< 15m)
    if (
      endPt &&
      haversineDistanceMeters(hazard.latitude, hazard.longitude, endPt[0], endPt[1]) < 15
    ) {
      continue;
    }
    if (
      startPt &&
      haversineDistanceMeters(hazard.latitude, hazard.longitude, startPt[0], startPt[1]) < 15
    ) {
      continue;
    }

    const minDistance = pointToPolylineDistanceMeters(
      hazard.latitude,
      hazard.longitude,
      coords
    );

    if (minDistance < minClearanceMeters) {
      minClearanceMeters = minDistance;
    }

    // Tight street-level direct hit (<= 18m): hazard is actually on this street/alley
    if (minDistance <= 18) {
      hazardsNearRoute++;
      blockingHazards.push(hazard);
      const sev = (hazard.severity || '').toString().toLowerCase();
      if (sev === 'critical' || sev === 'high') {
        riskScore += 30;
      } else if (sev === 'medium') {
        riskScore += 15;
      } else if (sev === 'low') {
        riskScore += 5;
      } else {
        riskScore += 10;
      }
    }
  }

  return { riskScore, hazardsNearRoute, minClearanceMeters, blockingHazards };
}

/**
 * Fetches a real road-following OSRM foot route through a perpendicular via-waypoint
 * so the Safest Route genuinely bypasses hazards along real adjacent streets/alleys.
 */
async function fetchOsrmViaRoute(
  sLat: number,
  sLng: number,
  viaLat: number,
  viaLng: number,
  eLat: number,
  eLng: number,
  activeHazards: HazardRecord[]
): Promise<{
  coordinates: Array<[number, number]>;
  distanceMeters: number;
  durationSeconds: number;
  riskScore: number;
  hazardsNearRoute: number;
} | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/foot/${sLng},${sLat};${viaLng},${viaLat};${eLng},${eLat}?overview=full&geometries=geojson`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const resp = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!resp.ok) return null;
    const json: any = await resp.json();
    const rawRoute = json?.routes?.[0];
    const rawCoords = rawRoute?.geometry?.coordinates;
    if (!Array.isArray(rawCoords) || rawCoords.length < 2) return null;
    const coords: Array<[number, number]> = rawCoords.map(
      ([lng, lat]: [number, number]) => [lat, lng]
    );
    const distanceMeters =
      typeof rawRoute.distance === 'number'
        ? Math.round(rawRoute.distance)
        : computePolylineDistanceMeters(coords);
    const durationSeconds =
      typeof rawRoute.duration === 'number'
        ? Math.round(rawRoute.duration)
        : Math.round(distanceMeters / 1.3);
    const { riskScore, hazardsNearRoute } = evaluateRouteRisk(
      coords,
      activeHazards
    );
    return {
      coordinates: coords,
      distanceMeters,
      durationSeconds,
      riskScore,
      hazardsNearRoute,
    };
  } catch {
    return null;
  }
}

/**
 * Generates real street-following side-street and block-wrap bypass routes via OSRM
 * ONLY when all direct routes hit a hazard (riskScore > 0).
 * Tests multiple perpendicular offsets (~85m, ~165m) plus far-side block-wrap corners
 * around the blocking hazard so dense Dhaka parallel alleys (like Shonir Akhra) are found.
 */
async function generateRealStreetDetours(
  sLat: number,
  sLng: number,
  eLat: number,
  eLng: number,
  activeHazards: HazardRecord[],
  blockingHazards: HazardRecord[] = []
): Promise<
  Array<{
    coordinates: Array<[number, number]>;
    distanceMeters: number;
    durationSeconds: number;
    riskScore: number;
    hazardsNearRoute: number;
  }>
> {
  const anchorLat =
    blockingHazards.length > 0
      ? blockingHazards[0].latitude
      : (sLat + eLat) / 2;
  const anchorLng =
    blockingHazards.length > 0
      ? blockingHazards[0].longitude
      : (sLng + eLng) / 2;

  const dLat = eLat - sLat;
  const dLng = eLng - sLng;
  const len = Math.sqrt(dLat * dLat + dLng * dLng) || 0.0015;
  const fwdLat = dLat / len;
  const fwdLng = dLng / len;
  const perpLatUnit = -fwdLng;
  const perpLngUnit = fwdLat;

  const nearOffset = 0.0008; // ~85m (adjacent parallel goli)
  const midOffset = Math.min(0.002, Math.max(0.0015, len * 0.45)); // ~165m
  const wrapPerp = 0.0009; // ~95m sideways off the blocked alley
  const wrapFwd = 0.0015; // ~165m past destination to catch eastern/far connector street

  const viaPoints: Array<[number, number]> = [
    // Adjacent parallel street left/right of blocking hazard
    [
      Number((anchorLat + perpLatUnit * nearOffset).toFixed(6)),
      Number((anchorLng + perpLngUnit * nearOffset).toFixed(6)),
    ],
    [
      Number((anchorLat - perpLatUnit * nearOffset).toFixed(6)),
      Number((anchorLng - perpLngUnit * nearOffset).toFixed(6)),
    ],
    // Wider parallel street left/right
    [
      Number((anchorLat + perpLatUnit * midOffset).toFixed(6)),
      Number((anchorLng + perpLngUnit * midOffset).toFixed(6)),
    ],
    [
      Number((anchorLat - perpLatUnit * midOffset).toFixed(6)),
      Number((anchorLng - perpLngUnit * midOffset).toFixed(6)),
    ],
    // Far-side block-wrap corners (enters destination from opposite end of the alley)
    [
      Number((eLat + perpLatUnit * wrapPerp + fwdLat * wrapFwd).toFixed(6)),
      Number((eLng + perpLngUnit * wrapPerp + fwdLng * wrapFwd).toFixed(6)),
    ],
    [
      Number((eLat - perpLatUnit * wrapPerp + fwdLat * wrapFwd).toFixed(6)),
      Number((eLng - perpLngUnit * wrapPerp + fwdLng * wrapFwd).toFixed(6)),
    ],
  ];

  const results = await Promise.all(
    viaPoints.map(([vLat, vLng]) =>
      fetchOsrmViaRoute(sLat, sLng, vLat, vLng, eLat, eLng, activeHazards)
    )
  );

  return results.filter((r): r is NonNullable<typeof r> => r !== null);
}

/**
 * GET /api/routes/safe
 * Accepts query params: startLat, startLng, endLat, endLng
 */
router.get('/safe', async (req: Request, res: Response) => {
  const sLat = parseFloat(req.query.startLat as string);
  const sLng = parseFloat(req.query.startLng as string);
  const eLat = parseFloat(req.query.endLat as string);
  const eLng = parseFloat(req.query.endLng as string);

  if (
    isNaN(sLat) ||
    !isFinite(sLat) ||
    isNaN(sLng) ||
    !isFinite(sLng) ||
    isNaN(eLat) ||
    !isFinite(eLat) ||
    isNaN(eLng) ||
    !isFinite(eLng)
  ) {
    return res.status(400).json({
      error:
        'startLat, startLng, endLat, and endLng are required and must be valid numbers.',
    });
  }

  const activeHazards = await getActiveHazards();
  const osrmUrl = `https://router.project-osrm.org/route/v1/foot/${sLng},${sLat};${eLng},${eLat}?overview=full&geometries=geojson&alternatives=true`;

  let evaluatedRoutes: Array<{
    coordinates: Array<[number, number]>;
    distanceMeters: number;
    durationSeconds: number;
    riskScore: number;
    hazardsNearRoute: number;
  }> = [];

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(osrmUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data: any = await response.json();
      if (Array.isArray(data.routes) && data.routes.length > 0) {
        for (const rawRoute of data.routes) {
          const rawCoords = rawRoute?.geometry?.coordinates;
          if (Array.isArray(rawCoords) && rawCoords.length >= 2) {
            // OSRM coordinates are [lng, lat]; convert to [lat, lng]
            const coords: Array<[number, number]> = rawCoords.map(([lng, lat]: [number, number]) => [
              lat,
              lng,
            ]);
            const distanceMeters =
              typeof rawRoute.distance === 'number'
                ? Math.round(rawRoute.distance)
                : computePolylineDistanceMeters(coords);
            const durationSeconds =
              typeof rawRoute.duration === 'number'
                ? Math.round(rawRoute.duration)
                : Math.round(distanceMeters / 1.3);

            const { riskScore, hazardsNearRoute } = evaluateRouteRisk(
              coords,
              activeHazards
            );

            evaluatedRoutes.push({
              coordinates: coords,
              distanceMeters,
              durationSeconds,
              riskScore,
              hazardsNearRoute,
            });
          }
        }
      }
    }
  } catch {
    // OSRM timed out or failed; will trigger fallback below
  }

  let blockingHazardsForDetour: HazardRecord[] = [];
  if (evaluatedRoutes.length > 0 && evaluatedRoutes.every((r) => r.riskScore > 0)) {
    const primaryRisk = evaluateRouteRisk(
      evaluatedRoutes[0].coordinates,
      activeHazards
    );
    blockingHazardsForDetour = primaryRisk.blockingHazards;
    const streetDetours = await generateRealStreetDetours(
      sLat,
      sLng,
      eLat,
      eLng,
      activeHazards,
      blockingHazardsForDetour
    );
    evaluatedRoutes.push(...streetDetours);
  }

  // Last-resort straight fallback ONLY if OSRM is completely unreachable
  if (evaluatedRoutes.length === 0) {
    const directCoords: Array<[number, number]> = [
      [sLat, sLng],
      [eLat, eLng],
    ];
    const directDist = Math.max(100, computePolylineDistanceMeters(directCoords));
    const directDur = Math.round(directDist / 1.3);
    const directRisk = evaluateRouteRisk(directCoords, activeHazards);
    evaluatedRoutes = [
      {
        coordinates: directCoords,
        distanceMeters: directDist,
        durationSeconds: directDur,
        riskScore: directRisk.riskScore,
        hazardsNearRoute: directRisk.hazardsNearRoute,
      },
    ];
  }

  // Sort and select Fastest Route (always shortest duration/distance) vs Safest Route (lowest risk)
  const options: RouteOption[] = [];

  // 1. Fastest Route = shortest durationSeconds (then shortest distanceMeters)
  const fastestCandidate = [...evaluatedRoutes].sort(
    (a, b) => a.durationSeconds - b.durationSeconds || a.distanceMeters - b.distanceMeters
  )[0];

  // 2. Safest Route = strictly lowest riskScore (tie-break: shortest duration)
  const safestCandidate = [...evaluatedRoutes].sort(
    (a, b) =>
      a.riskScore - b.riskScore ||
      a.hazardsNearRoute - b.hazardsNearRoute ||
      a.durationSeconds - b.durationSeconds
  )[0];

  options.push({
    id: 'safest',
    label: 'Safest Route',
    distanceMeters: safestCandidate.distanceMeters,
    durationSeconds: safestCandidate.durationSeconds,
    riskScore: safestCandidate.riskScore,
    hazardsNearRoute: safestCandidate.hazardsNearRoute,
    coordinates: safestCandidate.coordinates,
  });

  // Only include Fastest Route as a second toggle option if it is actually faster/shorter
  // than the Safest Route (never label a longer detour as "Fastest Route")
  if (
    fastestCandidate !== safestCandidate &&
    fastestCandidate.distanceMeters < safestCandidate.distanceMeters
  ) {
    options.push({
      id: 'fastest',
      label: 'Fastest Route',
      distanceMeters: fastestCandidate.distanceMeters,
      durationSeconds: fastestCandidate.durationSeconds,
      riskScore: fastestCandidate.riskScore,
      hazardsNearRoute: fastestCandidate.hazardsNearRoute,
      coordinates: fastestCandidate.coordinates,
    });
  }

  return res.status(200).json(options);
});

export default router;
