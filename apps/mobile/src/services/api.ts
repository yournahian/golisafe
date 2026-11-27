import type {
  CreateHazardRequest,
  HazardRecord,
  SafeRouteOption,
} from '../../../../packages/shared/api-contract';
import { getDeviceHash } from './deviceHash';
import {
  enqueueOfflineReport,
  flushOfflineQueue,
  getCachedHazards,
  saveCachedHazards,
} from './offlineQueue';

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

function pointToSegmentDistanceMeters(
  pLat: number,
  pLng: number,
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
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

function pointToPolylineDistanceMeters(
  pLat: number,
  pLng: number,
  coords: Array<[number, number]>,
): number {
  if (coords.length === 0) return 99999;
  if (coords.length === 1) {
    return haversineMeters(pLat, pLng, coords[0][0], coords[0][1]);
  }
  let minD = Number.POSITIVE_INFINITY;
  for (let i = 0; i < coords.length - 1; i++) {
    const d = pointToSegmentDistanceMeters(
      pLat,
      pLng,
      coords[i][0],
      coords[i][1],
      coords[i + 1][0],
      coords[i + 1][1],
    );
    if (d < minD) minD = d;
  }
  return minD;
}

function scorePolylineRisk(
  coords: Array<[number, number]>,
  hazards: HazardRecord[],
): { riskScore: number; hazardsNearRoute: number; blockingHazards: HazardRecord[] } {
  let riskScore = 0;
  let hazardsNearRoute = 0;
  const blockingHazards: HazardRecord[] = [];

  const startPt = coords[0];
  const endPt = coords[coords.length - 1];

  for (const hazard of hazards) {
    if (hazard.status === 'resolved' || hazard.status === 'expired') continue;
    if (
      endPt &&
      haversineMeters(hazard.latitude, hazard.longitude, endPt[0], endPt[1]) < 15
    ) {
      continue;
    }
    if (
      startPt &&
      haversineMeters(hazard.latitude, hazard.longitude, startPt[0], startPt[1]) < 15
    ) {
      continue;
    }

    const minDistance = pointToPolylineDistanceMeters(
      hazard.latitude,
      hazard.longitude,
      coords,
    );

    // Tight street-level hit radius (<= 18m) so side-alley hazards don't penalize main roads
    if (minDistance <= 18) {
      hazardsNearRoute += 1;
      blockingHazards.push(hazard);
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

  return { riskScore, hazardsNearRoute, blockingHazards };
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
    if (Array.isArray(data)) {
      await saveCachedHazards(data);
      // Opportunistically flush any pending offline reports now that API is reachable
      flushOfflineQueue(API_BASE_URL).catch(() => {});
      return data;
    }
    return await getCachedHazards();
  } catch {
    return await getCachedHazards();
  }
}

export async function createHazard(
  payload: CreateHazardPayload,
): Promise<HazardRecord> {
  const deviceHash = await getDeviceHash();
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

  try {
    const response = await fetch(`${API_BASE_URL}/hazards`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-device-hash': deviceHash,
      },
      body: JSON.stringify(bodyPayload),
    });

    if (response.ok) {
      return response.json();
    }

    // Surface backend anti-spam / duplicate / validation rejections (4xx) directly
    if (response.status >= 400 && response.status < 500) {
      let message = `Failed to submit hazard: HTTP ${response.status}`;
      try {
        const errJson = await response.json();
        if (typeof errJson?.error === 'string' && errJson.error.trim()) {
          message = errJson.error;
        }
      } catch {
        // Keep default message
      }
      throw new Error(message);
    }

    // 5xx server error -> queue offline for automatic retry
    const queued = await enqueueOfflineReport(payload);
    return {
      id: queued.id,
      category: payload.category,
      severity: payload.severity ?? 'Medium',
      latitude: payload.latitude,
      longitude: payload.longitude,
      landmark_context: payload.landmark_context,
      sub_tag: payload.sub_tag,
      image_url: payload.image_url ?? null,
      reported_by: payload.reported_by ?? null,
      status: 'pending',
      confirmations: 1,
      resolved_count: 0,
      created_at: queued.queuedAt,
    };
  } catch (err) {
    // Re-throw explicit 4xx validation/rate-limit/duplicate errors
    if (
      err instanceof Error &&
      (err.message.includes('Failed to submit hazard: HTTP 4') ||
        err.message.toLowerCase().includes('rate limit') ||
        err.message.toLowerCase().includes('duplicate') ||
        err.message.toLowerCase().includes('invalid'))
    ) {
      throw err;
    }

    // Network unreachable -> enqueue in offline queue (NFR-20)
    const queued = await enqueueOfflineReport(payload);
    return {
      id: queued.id,
      category: payload.category,
      severity: payload.severity ?? 'Medium',
      latitude: payload.latitude,
      longitude: payload.longitude,
      landmark_context: payload.landmark_context,
      sub_tag: payload.sub_tag,
      image_url: payload.image_url ?? null,
      reported_by: payload.reported_by ?? null,
      status: 'pending',
      confirmations: 1,
      resolved_count: 0,
      created_at: queued.queuedAt,
    };
  }
}

export const submitHazard = createHazard;

export interface HazardVoteOptions {
  trustWeight?: number;
  userLat?: number;
  userLng?: number;
  demoBypass?: boolean;
}

function normalizeVoteBody(
  trustWeightOrOptions: number | HazardVoteOptions = 1,
): {
  trustWeight: number;
  userLat?: number;
  userLng?: number;
  demoBypass?: boolean;
} {
  if (typeof trustWeightOrOptions === 'number') {
    return { trustWeight: trustWeightOrOptions };
  }
  return {
    trustWeight: trustWeightOrOptions.trustWeight ?? 1,
    userLat: trustWeightOrOptions.userLat,
    userLng: trustWeightOrOptions.userLng,
    demoBypass: trustWeightOrOptions.demoBypass,
  };
}

export async function confirmHazard(
  id: string,
  trustWeightOrOptions: number | HazardVoteOptions = 1,
): Promise<Hazard> {
  const deviceHash = await getDeviceHash();
  const body = normalizeVoteBody(trustWeightOrOptions);
  const response = await fetch(
    `${API_BASE_URL}/hazards/${encodeURIComponent(id)}/confirm`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-device-hash': deviceHash,
      },
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) {
    let message = `Failed to confirm hazard: HTTP ${response.status}`;
    try {
      const errJson = await response.json();
      if (typeof errJson?.error === 'string' && errJson.error.trim()) {
        message = errJson.error;
      }
    } catch {
      // Keep default error message
    }
    throw new Error(message);
  }

  return response.json();
}

export async function resolveHazard(
  id: string,
  trustWeightOrOptions: number | HazardVoteOptions = 1,
): Promise<Hazard> {
  const deviceHash = await getDeviceHash();
  const body = normalizeVoteBody(trustWeightOrOptions);
  try {
    const response = await fetch(
      `${API_BASE_URL}/hazards/${encodeURIComponent(id)}/resolve`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-device-hash': deviceHash,
        },
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      let message = `Failed to resolve hazard: HTTP ${response.status}`;
      try {
        const errJson = await response.json();
        if (typeof errJson?.error === 'string' && errJson.error.trim()) {
          message = errJson.error;
        }
      } catch {
        // Keep default error message
      }
      if (response.status >= 400 && response.status < 500) {
        throw new Error(message);
      }
      throw new Error(message);
    }

    return response.json();
  } catch (err) {
    if (
      err instanceof Error &&
      (err.message.toLowerCase().includes('150m') ||
        err.message.toLowerCase().includes('already voted') ||
        err.message.toLowerCase().includes('demo mode'))
    ) {
      throw err;
    }
    const weight = body.trustWeight ?? 1;
    return {
      id,
      category: 'pothole_manhole',
      severity: 'Low',
      latitude: 23.7806,
      longitude: 90.407,
      status: weight >= 3 ? 'resolved' : 'active',
      resolved_count: weight,
      created_at: new Date().toISOString(),
    };
  }
}

export interface DeviceTrustProfile {
  trust_score: number;
  is_trusted: boolean;
  spam_strikes: number;
}

export async function fetchDeviceTrust(): Promise<DeviceTrustProfile> {
  try {
    const deviceHash = await getDeviceHash();
    const response = await fetch(`${API_BASE_URL}/hazards/trust`, {
      method: 'GET',
      headers: {
        'x-device-hash': deviceHash,
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    const trustScore =
      typeof data?.trust_score === 'number' ? data.trust_score : 10;
    return {
      trust_score: trustScore,
      is_trusted: Boolean(data?.is_trusted ?? trustScore >= 50),
      spam_strikes:
        typeof data?.spam_strikes === 'number' ? data.spam_strikes : 0,
    };
  } catch {
    return {
      trust_score: 10,
      is_trusted: false,
      spam_strikes: 0,
    };
  }
}

export async function syncOfflineReports(): Promise<{
  synced: HazardRecord[];
  remaining: number;
}> {
  return flushOfflineQueue(API_BASE_URL);
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

  // Fetch real street-following side-alley & block-wrap bypass routes ONLY when all direct routes hit a hazard
  const needsRealDetour =
    candidates.length > 0 && candidates.every((c) => c.riskScore > 0);

  if (needsRealDetour) {
    const primaryRisk = scorePolylineRisk(candidates[0].coordinates, activeHazards);
    const anchorLat =
      primaryRisk.blockingHazards.length > 0
        ? primaryRisk.blockingHazards[0].latitude
        : (startLat + endLat) / 2;
    const anchorLng =
      primaryRisk.blockingHazards.length > 0
        ? primaryRisk.blockingHazards[0].longitude
        : (startLng + endLng) / 2;

    const dLat = endLat - startLat;
    const dLng = endLng - startLng;
    const len = Math.sqrt(dLat * dLat + dLng * dLng) || 0.0015;
    const fwdLat = dLat / len;
    const fwdLng = dLng / len;
    const perpLatUnit = -fwdLng;
    const perpLngUnit = fwdLat;

    const nearOffset = 0.0008;
    const midOffset = Math.min(0.002, Math.max(0.0015, len * 0.45));
    const wrapPerp = 0.0009;
    const wrapFwd = 0.0015;

    const viaPoints: Array<[number, number]> = [
      [
        Number((anchorLat + perpLatUnit * nearOffset).toFixed(6)),
        Number((anchorLng + perpLngUnit * nearOffset).toFixed(6)),
      ],
      [
        Number((anchorLat - perpLatUnit * nearOffset).toFixed(6)),
        Number((anchorLng - perpLngUnit * nearOffset).toFixed(6)),
      ],
      [
        Number((anchorLat + perpLatUnit * midOffset).toFixed(6)),
        Number((anchorLng + perpLngUnit * midOffset).toFixed(6)),
      ],
      [
        Number((anchorLat - perpLatUnit * midOffset).toFixed(6)),
        Number((anchorLng - perpLngUnit * midOffset).toFixed(6)),
      ],
      [
        Number((endLat + perpLatUnit * wrapPerp + fwdLat * wrapFwd).toFixed(6)),
        Number((endLng + perpLngUnit * wrapPerp + fwdLng * wrapFwd).toFixed(6)),
      ],
      [
        Number((endLat - perpLatUnit * wrapPerp + fwdLat * wrapFwd).toFixed(6)),
        Number((endLng - perpLngUnit * wrapPerp + fwdLng * wrapFwd).toFixed(6)),
      ],
    ];

    const viaResults = await Promise.all(
      viaPoints.map(async ([vLat, vLng]) => {
        try {
          const viaUrl =
            `https://router.project-osrm.org/route/v1/foot/` +
            `${startLng},${startLat};${vLng},${vLat};${endLng},${endLat}?overview=full&geometries=geojson`;
          const resp = await fetch(viaUrl);
          if (!resp.ok) return null;
          const j = await resp.json();
          const r = j?.routes?.[0];
          const rawCoords: Array<[number, number]> | undefined =
            r?.geometry?.coordinates;
          if (!Array.isArray(rawCoords) || rawCoords.length < 2) return null;
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
          return {
            coordinates: coords,
            distanceMeters,
            durationSeconds,
            riskScore: risk.riskScore,
            hazardsNearRoute: risk.hazardsNearRoute,
          };
        } catch {
          return null;
        }
      }),
    );

    for (const vr of viaResults) {
      if (vr) candidates.push(vr);
    }
  }

  if (candidates.length === 0) {
    const directCoords: Array<[number, number]> = [
      [startLat, startLng],
      [endLat, endLng],
    ];
    const directDist = Math.max(100, polylineDistanceMeters(directCoords));
    const directRisk = scorePolylineRisk(directCoords, activeHazards);
    return [
      {
        id: 'safest',
        label: 'Safest Route',
        distanceMeters: directDist,
        durationSeconds: Math.max(60, Math.round(directDist / 1.3)),
        riskScore: directRisk.riskScore,
        hazardsNearRoute: directRisk.hazardsNearRoute,
        coordinates: directCoords,
      },
    ];
  }

  const fastest = [...candidates].sort(
    (a, b) => a.durationSeconds - b.durationSeconds || a.distanceMeters - b.distanceMeters,
  )[0];

  const safest = [...candidates].sort(
    (a, b) =>
      a.riskScore - b.riskScore ||
      a.hazardsNearRoute - b.hazardsNearRoute ||
      a.durationSeconds - b.durationSeconds,
  )[0];

  // Never label a longer detour as "Fastest Route"
  if (fastest !== safest && fastest.distanceMeters < safest.distanceMeters) {
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

  return [
    {
      id: 'safest',
      label: 'Safest Route',
      ...safest,
    },
  ];
}
