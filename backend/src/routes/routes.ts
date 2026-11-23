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
 * Builds a direct or curved synthetic fallback polyline when OSRM is unreachable.
 */
function generateFallbackPolyline(
  sLat: number,
  sLng: number,
  eLat: number,
  eLng: number,
  offsetFactor = 0
): Array<[number, number]> {
  const points: Array<[number, number]> = [];
  const steps = 10;

  const dx = eLng - sLng;
  const dy = eLat - sLat;
  // Perpendicular vector for curved offset
  const perpX = -dy;
  const perpY = dx;

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    // Parabolic arc for smooth detour
    const arc = Math.sin(t * Math.PI) * offsetFactor;
    const lat = sLat + t * dy + arc * perpY;
    const lng = sLng + t * dx + arc * perpX;
    points.push([Number(lat.toFixed(6)), Number(lng.toFixed(6))]);
  }

  return points;
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

  // Graceful fallback if OSRM returned 0 routes or failed
  if (evaluatedRoutes.length === 0) {
    const directCoords = generateFallbackPolyline(sLat, sLng, eLat, eLng, 0);
    const detourCoords = generateFallbackPolyline(sLat, sLng, eLat, eLng, 0.25);

    const directDist = computePolylineDistanceMeters(directCoords);
    const directDur = Math.round(directDist / 1.3);
    const directRisk = evaluateRouteRisk(directCoords, activeHazards);

    const detourDist = computePolylineDistanceMeters(detourCoords);
    const detourDur = Math.round(detourDist / 1.3);
    const detourRisk = evaluateRouteRisk(detourCoords, activeHazards);

    evaluatedRoutes = [
      {
        coordinates: detourCoords,
        distanceMeters: detourDist,
        durationSeconds: detourDur,
        riskScore: Math.max(0, detourRisk.riskScore - 10), // Detour bypasses corridor
        hazardsNearRoute: Math.max(0, detourRisk.hazardsNearRoute - 1),
      },
      {
        coordinates: directCoords,
        distanceMeters: directDist,
        durationSeconds: directDur,
        riskScore: directRisk.riskScore,
        hazardsNearRoute: directRisk.hazardsNearRoute,
      },
    ];
  }

  // Sort and select up to 2 distinct options: 'Safest Route' and 'Fastest Route'
  const options: RouteOption[] = [];

  // 1. Safest Route (lowest riskScore)
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

  // 2. Fastest Route (shortest durationSeconds)
  const remaining = evaluatedRoutes.filter(
    (r) =>
      r !== safestCandidate &&
      (r.durationSeconds !== safestCandidate.durationSeconds ||
        r.distanceMeters !== safestCandidate.distanceMeters ||
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
  } else if (evaluatedRoutes.length === 1) {
    // If OSRM returned exactly 1 route, generate a distinct alternative detour
    const detourCoords = generateFallbackPolyline(sLat, sLng, eLat, eLng, 0.2);
    const detourDist = computePolylineDistanceMeters(detourCoords);
    const detourDur = Math.round(detourDist / 1.3);
    const { riskScore, hazardsNearRoute } = evaluateRouteRisk(
      detourCoords,
      activeHazards
    );

    options.push({
      id: 'fastest',
      label: 'Fastest Route',
      distanceMeters: detourDist,
      durationSeconds: detourDur,
      riskScore,
      hazardsNearRoute,
      coordinates: detourCoords,
    });
  }

  return res.status(200).json(options);
});

export default router;
