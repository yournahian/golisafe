import type { HazardRecord } from '../../../../packages/shared/api-contract';
import { DHAKA_STREETS } from './mapConstants';

export type SafeRouteState = {
  targetLabel: string;
  durationMin: number;
  distanceKm: string;
  avoidedCount: number;
  coords: Array<[number, number]>;
};

export type TappedLocationState = {
  latitude: number;
  longitude: number;
  label: string;
  distanceText: string;
  coordLabel: string;
};

export function computeDistanceMeters(
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

export function resolveDhakaTappedLocation(
  latitude: number,
  longitude: number,
  userOrigin: { latitude: number; longitude: number },
): TappedLocationState {
  let nearest = DHAKA_STREETS[0];
  let minDistance = Number.POSITIVE_INFINITY;
  for (const item of DHAKA_STREETS) {
    const d = computeDistanceMeters(
      latitude,
      longitude,
      item.latitude,
      item.longitude,
    );
    if (d < minDistance) {
      minDistance = d;
      nearest = item;
    }
  }
  const distFromUser = computeDistanceMeters(
    userOrigin.latitude,
    userOrigin.longitude,
    latitude,
    longitude,
  );
  const distanceText =
    distFromUser < 1000
      ? `${Math.max(25, distFromUser)} m away`
      : `${(distFromUser / 1000).toFixed(1)} km away`;

  return {
    latitude,
    longitude,
    label: minDistance <= 600 ? nearest.label : 'Locating street…',
    distanceText,
    coordLabel: `${latitude.toFixed(4)}°N, ${longitude.toFixed(4)}°E`,
  };
}

/**
 * Fetches the exact real street / goli / neighborhood name from OpenStreetMap Nominatim
 * so tapped pins show the true road name (e.g., Zia Sarani Road / local goli) instead of
 * a distant static landmark.
 */
export async function reverseGeocodeOsm(
  latitude: number,
  longitude: number,
): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const url =
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2` +
      `&lat=${encodeURIComponent(String(latitude))}` +
      `&lon=${encodeURIComponent(String(longitude))}` +
      `&zoom=18&addressdetails=1`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'GoliSafe/1.0 (civic-safety-app)',
        'Accept-Language': 'en',
      },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    const addr = data?.address || {};
    const road =
      addr.road ||
      addr.pedestrian ||
      addr.footway ||
      addr.residential ||
      addr.path ||
      data?.name ||
      addr.quarter ||
      '';
    const area =
      addr.neighbourhood ||
      addr.suburb ||
      addr.city_district ||
      addr.town ||
      '';
    if (road && area && road.toLowerCase() !== area.toLowerCase()) {
      return `${road}, ${area}`;
    }
    if (road) return road;
    if (area) return area;
    if (typeof data?.display_name === 'string' && data.display_name.trim()) {
      return data.display_name.split(',').slice(0, 2).join(',').trim();
    }
    return null;
  } catch {
    return null;
  }
}

export function findNearbyCorridorHazards(
  userLat: number,
  userLng: number,
  destLat: number,
  destLng: number,
  hazards: HazardRecord[],
): HazardRecord[] {
  const dx = destLng - userLng;
  const dy = destLat - userLat;
  const segLenSq = dx * dx + dy * dy;
  if (segLenSq < 1e-9) return [];

  return hazards.filter((h) => {
    if (h.status === 'resolved') return false;
    const distToDest = computeDistanceMeters(
      h.latitude,
      h.longitude,
      destLat,
      destLng,
    );
    if (distToDest < 45) return false;

    const t = Math.max(
      0,
      Math.min(
        1,
        ((h.longitude - userLng) * dx + (h.latitude - userLat) * dy) / segLenSq,
      ),
    );
    const projLat = userLat + t * dy;
    const projLng = userLng + t * dx;
    const perpDist = computeDistanceMeters(
      h.latitude,
      h.longitude,
      projLat,
      projLng,
    );
    return perpDist <= 320;
  });
}

export function buildCurvedDetourPolyline(
  userLat: number,
  userLng: number,
  destLat: number,
  destLng: number,
  corridorHazards: HazardRecord[],
): Array<[number, number]> {
  const dLat = destLat - userLat;
  const dLng = destLng - userLng;
  const len = Math.sqrt(dLat * dLat + dLng * dLng) || 0.005;
  let perpLat = -dLng / len;
  let perpLng = dLat / len;

  if (corridorHazards.length > 0) {
    const avgHazardLat =
      corridorHazards.reduce((acc, h) => acc + h.latitude, 0) /
      corridorHazards.length;
    const avgHazardLng =
      corridorHazards.reduce((acc, h) => acc + h.longitude, 0) /
      corridorHazards.length;
    const midLat = (userLat + destLat) / 2;
    const midLng = (userLng + destLng) / 2;
    const dot =
      (avgHazardLat - midLat) * perpLat + (avgHazardLng - midLng) * perpLng;
    if (dot > 0) {
      perpLat = -perpLat;
      perpLng = -perpLng;
    }
  }

  const arcMagnitude = Math.min(0.0055, Math.max(0.0018, len * 0.26));
  const steps = 16;
  const points: Array<[number, number]> = [];

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const baseLat = userLat + dLat * t;
    const baseLng = userLng + dLng * t;
    const curve =
      Math.sin(Math.PI * t) * arcMagnitude +
      Math.sin(2 * Math.PI * t) * (arcMagnitude * 0.18);
    points.push([baseLat + perpLat * curve, baseLng + perpLng * curve]);
  }

  return points;
}

export function computePolylineDistanceMeters(
  coords: Array<[number, number]>,
): number {
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    total += computeDistanceMeters(
      coords[i - 1][0],
      coords[i - 1][1],
      coords[i][0],
      coords[i][1],
    );
  }
  return total;
}
