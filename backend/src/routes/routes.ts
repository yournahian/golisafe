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
 * Calculates risk score and count of hazards within 150m of a polyline.
 * Critical / High = +30, Medium = +15, Low = +5
 */
function evaluateRouteRisk(
  coords: Array<[number, number]>,
  activeHazards: HazardRecord[]
): { riskScore: number; hazardsNearRoute: number } {
  let riskScore = 0;
  let hazardsNearRoute = 0;

  for (const hazard of activeHazards) {
    let minDistance = Infinity;
    for (const [lat, lng] of coords) {
      const d = haversineDistanceMeters(hazard.latitude, hazard.longitude, lat, lng);
      if (d < minDistance) {
        minDistance = d;
      }
    }

    if (minDistance <= 150) {
      hazardsNearRoute++;
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

  return { riskScore, hazardsNearRoute };
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
 * Generates real street-following left/right side-street bypass routes via OSRM
 * when the direct route passes near hazards or when OSRM only returned 1 route.
 */
async function generateRealStreetDetours(
  sLat: number,
  sLng: number,
  eLat: number,
  eLng: number,
  activeHazards: HazardRecord[]
): Promise<
  Array<{
    coordinates: Array<[number, number]>;
    distanceMeters: number;
    durationSeconds: number;
    riskScore: number;
    hazardsNearRoute: number;
  }>
> {
  const midLat = (sLat + eLat) / 2;
  const midLng = (sLng + eLng) / 2;
  const dLat = eLat - sLat;
  const dLng = eLng - sLng;
  const len = Math.sqrt(dLat * dLat + dLng * dLng) || 0.002;
  // ~140m–180m perpendicular offset into parallel goli/street
  const offsetDeg = Math.min(0.0022, Math.max(0.0013, len * 0.45));
  const perpLat = (-dLng / len) * offsetDeg;
  const perpLng = (dLat / len) * offsetDeg;

  const [leftRoute, rightRoute] = await Promise.all([
    fetchOsrmViaRoute(
      sLat,
      sLng,
      Number((midLat + perpLat).toFixed(6)),
      Number((midLng + perpLng).toFixed(6)),
      eLat,
      eLng,
      activeHazards
    ),
    fetchOsrmViaRoute(
      sLat,
      sLng,
      Number((midLat - perpLat).toFixed(6)),
      Number((midLng - perpLng).toFixed(6)),
      eLat,
      eLng,
      activeHazards
    ),
  ]);

  return [leftRoute, rightRoute].filter(
    (r): r is NonNullable<typeof r> => r !== null
  );
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

  // If OSRM returned 1 route OR the primary route hits hazards, query real adjacent-street OSRM bypasses
  if (
    evaluatedRoutes.length === 1 ||
    (evaluatedRoutes.length > 0 &&
      evaluatedRoutes.every((r) => r.riskScore > 0))
  ) {
    const streetDetours = await generateRealStreetDetours(
      sLat,
      sLng,
      eLat,
      eLng,
      activeHazards
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

  // Sort and select up to 2 distinct real street options: 'Safest Route' and 'Fastest Route'
  const options: RouteOption[] = [];

  // 1. Safest Route (lowest riskScore, then shortest duration)
  const safestCandidate = [...evaluatedRoutes].sort(
    (a, b) => a.riskScore - b.riskScore || a.durationSeconds - b.durationSeconds
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

  // 2. Fastest Route (shortest durationSeconds that differs from safest)
  const remaining = evaluatedRoutes.filter(
    (r) =>
      r !== safestCandidate &&
      (Math.abs(r.distanceMeters - safestCandidate.distanceMeters) > 15 ||
        r.riskScore !== safestCandidate.riskScore)
  );

  if (remaining.length > 0) {
    const fastestCandidate = remaining.sort(
      (a, b) => a.durationSeconds - b.durationSeconds || a.riskScore - b.riskScore
    )[0];

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
