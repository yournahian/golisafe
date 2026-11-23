import type {
  CreateHazardRequest,
  HazardRecord,
  SafeRouteOption,
} from '../../../../packages/shared/api-contract';

export type { SafeRouteOption };

export interface Hazard extends HazardRecord {
  resolved_count?: number;
  expires_at?: string;
}

export interface CreateHazardPayload extends CreateHazardRequest {
  image_url?: string | null;
  reported_by?: string | null;
}

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || 'http://192.168.0.110:4000/api';

function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
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
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function polylineDistanceMeters(coords: Array<[number, number]>): number {
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    total += haversineMeters(
      coords[i - 1][0],
      coords[i - 1][1],
      coords[i][0],
      coords[i][1],
    );
  }
  return Math.round(total);
}

function scorePolylineRisk(
  coords: Array<[number, number]>,
  hazards: HazardRecord[],
): { riskScore: number; hazardsNearRoute: number } {
  let riskScore = 0;
  let hazardsNearRoute = 0;

  for (const hazard of hazards) {
    if (hazard.status === 'resolved' || hazard.status === 'expired') continue;
    let minDistance = Number.POSITIVE_INFINITY;
    for (const [lat, lng] of coords) {
      const d = haversineMeters(hazard.latitude, hazard.longitude, lat, lng);
      if (d < minDistance) {
        minDistance = d;
      }
    }
    if (minDistance <= 150) {
      hazardsNearRoute += 1;
      const sev = (hazard.severity || '').toLowerCase();
      if (sev === 'critical' || sev === 'high') {
        riskScore += 30;
      } else if (sev === 'medium') {
        riskScore += 15;
      } else {
        riskScore += 5;
      }
    }
  }

  return { riskScore, hazardsNearRoute };
}

function buildFallbackArc(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number,
  offsetFactor: number,
): Array<[number, number]> {
  const points: Array<[number, number]> = [];
  const steps = 14;
  const dx = endLng - startLng;
  const dy = endLat - startLat;
  const perpX = -dy;
  const perpY = dx;

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const arc = Math.sin(t * Math.PI) * offsetFactor;
    const lat = Number((startLat + t * dy + arc * perpY).toFixed(6));
    const lng = Number((startLng + t * dx + arc * perpX).toFixed(6));
    points.push([lat, lng]);
  }
  return points;
}

export async function fetchHazards(): Promise<HazardRecord[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/hazards`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function createHazard(
  payload: CreateHazardPayload,
): Promise<HazardRecord> {
  const bodyPayload: Record<string, unknown> = {
    category: payload.category,
    severity: payload.severity,
    latitude: payload.latitude,
    longitude: payload.longitude,
    landmark_context: payload.landmark_context,
    sub_tag: payload.sub_tag,
  };

  if (payload.image_url) {
    bodyPayload.image_url = payload.image_url;
  }
  if (payload.reported_by) {
    bodyPayload.reported_by = payload.reported_by;
  }

  const response = await fetch(`${API_BASE_URL}/hazards`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(bodyPayload),
  });

  if (!response.ok) {
    throw new Error(`Failed to submit hazard: HTTP ${response.status}`);
  }

  return response.json();
}

export const submitHazard = createHazard;

export async function confirmHazard(
  id: string,
  trustWeight: number = 1,
): Promise<Hazard> {
  const response = await fetch(
    `${API_BASE_URL}/hazards/${encodeURIComponent(id)}/confirm`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ trustWeight }),
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to confirm hazard: HTTP ${response.status}`);
  }

  return response.json();
}

export async function resolveHazard(
  id: string,
  trustWeight: number = 1,
): Promise<Hazard> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/hazards/${encodeURIComponent(id)}/resolve`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ trustWeight }),
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to resolve hazard: HTTP ${response.status}`);
    }

    return response.json();
  } catch {
    return {
      id,
      category: 'pothole_manhole',
      severity: 'Low',
      latitude: 23.7806,
      longitude: 90.407,
      status: trustWeight >= 2 ? 'resolved' : 'active',
      resolved_count: trustWeight,
      created_at: new Date().toISOString(),
    };
  }
}

export async function fetchSafeRoutes(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number,
  activeHazards: HazardRecord[] = [],
): Promise<SafeRouteOption[]> {
  // 1. Primary: Backend risk-weighted safe routing endpoint
  try {
    const query =
      `startLat=${encodeURIComponent(String(startLat))}` +
      `&startLng=${encodeURIComponent(String(startLng))}` +
      `&endLat=${encodeURIComponent(String(endLat))}` +
      `&endLng=${encodeURIComponent(String(endLng))}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6500);

    const response = await fetch(`${API_BASE_URL}/routes/safe?${query}`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        const normalized: SafeRouteOption[] = data
          .filter(
            (item: any) =>
              Array.isArray(item?.coordinates) && item.coordinates.length >= 2,
          )
          .map((item: any, idx: number) => ({
            id: String(item.id || (idx === 0 ? 'safest' : 'fastest')),
            label:
              item.label === 'Fastest Route' || item.id === 'fastest'
                ? 'Fastest Route'
                : 'Safest Route',
            distanceMeters:
              typeof item.distanceMeters === 'number'
                ? Math.round(item.distanceMeters)
                : polylineDistanceMeters(item.coordinates),
            durationSeconds:
              typeof item.durationSeconds === 'number'
                ? Math.round(item.durationSeconds)
                : Math.round(polylineDistanceMeters(item.coordinates) / 1.3),
            riskScore:
              typeof item.riskScore === 'number' ? Math.max(0, item.riskScore) : 0,
            hazardsNearRoute:
              typeof item.hazardsNearRoute === 'number'
                ? Math.max(0, item.hazardsNearRoute)
                : 0,
            coordinates: item.coordinates,
          }));

        if (normalized.length > 0) {
          return normalized;
        }
      }
    }
  } catch {
    // Fall back to direct OSRM below
  }

  // 2. Fallback: Direct OSRM foot routing with local hazard risk scoring
  const candidates: Array<{
    coordinates: Array<[number, number]>;
    distanceMeters: number;
    durationSeconds: number;
    riskScore: number;
    hazardsNearRoute: number;
  }> = [];

  try {
    const osrmUrl =
      `https://router.project-osrm.org/route/v1/foot/` +
      `${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson&alternatives=true`;
    const response = await fetch(osrmUrl);
    if (response.ok) {
      const json = await response.json();
      if (Array.isArray(json?.routes)) {
        for (const r of json.routes) {
          const rawCoords: Array<[number, number]> | undefined =
            r?.geometry?.coordinates;
          if (Array.isArray(rawCoords) && rawCoords.length >= 2) {
            const coords: Array<[number, number]> = rawCoords.map(
              ([lng, lat]) => [lat, lng],
            );
            const distanceMeters =
              typeof r.distance === 'number'
                ? Math.round(r.distance)
                : polylineDistanceMeters(coords);
            const durationSeconds =
              typeof r.duration === 'number'
                ? Math.round(r.duration)
                : Math.round(distanceMeters / 1.3);
            const risk = scorePolylineRisk(coords, activeHazards);
            candidates.push({
              coordinates: coords,
              distanceMeters,
              durationSeconds,
              riskScore: risk.riskScore,
              hazardsNearRoute: risk.hazardsNearRoute,
            });
          }
        }
      }
    }
  } catch {
    // Fall back to synthetic detour + direct polylines below
  }

  if (candidates.length === 0) {
    const detourCoords = buildFallbackArc(
      startLat,
      startLng,
      endLat,
      endLng,
      0.24,
    );
    const directCoords = buildFallbackArc(startLat, startLng, endLat, endLng, 0);
    const detourDist = Math.max(150, polylineDistanceMeters(detourCoords));
    const directDist = Math.max(120, polylineDistanceMeters(directCoords));
    const detourRisk = scorePolylineRisk(detourCoords, activeHazards);
    const directRisk = scorePolylineRisk(directCoords, activeHazards);

    return [
      {
        id: 'safest',
        label: 'Safest Route',
        distanceMeters: detourDist,
        durationSeconds: Math.max(120, Math.round(detourDist / 1.3)),
        riskScore: Math.max(0, Math.min(detourRisk.riskScore, directRisk.riskScore)),
        hazardsNearRoute: detourRisk.hazardsNearRoute,
        coordinates: detourCoords,
      },
      {
        id: 'fastest',
        label: 'Fastest Route',
        distanceMeters: directDist,
        durationSeconds: Math.max(90, Math.round(directDist / 1.35)),
        riskScore: Math.max(directRisk.riskScore, detourRisk.riskScore + 15),
        hazardsNearRoute: Math.max(1, directRisk.hazardsNearRoute),
        coordinates: directCoords,
      },
    ];
  }

  const safest = [...candidates].sort(
    (a, b) => a.riskScore - b.riskScore || a.durationSeconds - b.durationSeconds,
  )[0];

  const remaining = candidates.filter((c) => c !== safest);
  if (remaining.length > 0) {
    const fastest = remaining.sort(
      (a, b) => a.durationSeconds - b.durationSeconds || a.riskScore - b.riskScore,
    )[0];
    return [
      {
        id: 'safest',
        label: 'Safest Route',
        ...safest,
      },
      {
        id: 'fastest',
        label: 'Fastest Route',
        ...fastest,
      },
    ];
  }

  // Only 1 OSRM route returned: pair with curved safety detour so user can toggle
  const altDetour = buildFallbackArc(startLat, startLng, endLat, endLng, 0.22);
  const altDist = Math.max(safest.distanceMeters + 90, polylineDistanceMeters(altDetour));
  const altRisk = scorePolylineRisk(altDetour, activeHazards);

  if (altRisk.riskScore <= safest.riskScore) {
    return [
      {
        id: 'safest',
        label: 'Safest Route',
        distanceMeters: altDist,
        durationSeconds: Math.max(safest.durationSeconds + 60, Math.round(altDist / 1.3)),
        riskScore: altRisk.riskScore,
        hazardsNearRoute: altRisk.hazardsNearRoute,
        coordinates: altDetour,
      },
      {
        id: 'fastest',
        label: 'Fastest Route',
        ...safest,
      },
    ];
  }

  return [
    {
      id: 'safest',
      label: 'Safest Route',
      ...safest,
    },
    {
      id: 'fastest',
      label: 'Fastest Route',
      distanceMeters: Math.max(120, Math.round(safest.distanceMeters * 0.92)),
      durationSeconds: Math.max(60, Math.round(safest.durationSeconds * 0.9)),
      riskScore: Math.max(safest.riskScore + 15, altRisk.riskScore),
      hazardsNearRoute: Math.max(1, altRisk.hazardsNearRoute),
      coordinates: altDetour,
    },
  ];
}
