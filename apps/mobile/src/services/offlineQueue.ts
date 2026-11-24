import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  CreateHazardRequest,
  HazardRecord,
} from '../../../../packages/shared/api-contract';
import { getDeviceHash } from './deviceHash';

const CACHED_HAZARDS_KEY = 'golisafe:cached_hazards:v1';
const OFFLINE_REPORT_QUEUE_KEY = 'golisafe:offline_report_queue:v1';

const DEFAULT_API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || 'http://192.168.0.110:4000/api';

export interface OfflineHazardPayload extends CreateHazardRequest {
  image_url?: string | null;
  reported_by?: string | null;
}

export interface QueuedHazardReport {
  id: string;
  payload: OfflineHazardPayload;
  queuedAt: string;
}

/**
 * NFR-10: Persist latest fetched hazards locally in AsyncStorage for offline map viewing.
 */
export async function saveCachedHazards(
  hazards: HazardRecord[],
): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHED_HAZARDS_KEY, JSON.stringify(hazards));
  } catch {
    // Non-fatal storage error
  }
}

/**
 * NFR-10: Retrieve cached hazards when the device is offline or backend is unreachable.
 */
export async function getCachedHazards(): Promise<HazardRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(CACHED_HAZARDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as HazardRecord[]) : [];
  } catch {
    return [];
  }
}

/**
 * NFR-20: Read pending offline hazard reports waiting to sync.
 */
export async function getOfflineQueue(): Promise<QueuedHazardReport[]> {
  try {
    const raw = await AsyncStorage.getItem(OFFLINE_REPORT_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as QueuedHazardReport[]) : [];
  } catch {
    return [];
  }
}

export async function getOfflineQueueCount(): Promise<number> {
  const queue = await getOfflineQueue();
  return queue.length;
}

/**
 * NFR-20: Queue a failed POST /api/hazards submission locally for later auto-sync.
 */
export async function enqueueOfflineReport(
  payload: OfflineHazardPayload,
): Promise<QueuedHazardReport> {
  const item: QueuedHazardReport = {
    id: `offline-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    payload,
    queuedAt: new Date().toISOString(),
  };

  try {
    const existing = await getOfflineQueue();
    const updated = [...existing, item];
    await AsyncStorage.setItem(
      OFFLINE_REPORT_QUEUE_KEY,
      JSON.stringify(updated),
    );
  } catch {
    // Ignore storage write failure
  }

  return item;
}

/**
 * NFR-20: Flush queued offline reports to POST /api/hazards when connectivity returns.
 */
export async function flushOfflineQueue(
  apiBaseUrl: string = DEFAULT_API_BASE_URL,
): Promise<{ synced: HazardRecord[]; remaining: number }> {
  const queue = await getOfflineQueue();
  if (queue.length === 0) {
    return { synced: [], remaining: 0 };
  }

  const deviceHash = await getDeviceHash();
  const synced: HazardRecord[] = [];
  const stillPending: QueuedHazardReport[] = [];

  for (const item of queue) {
    try {
      const bodyPayload: Record<string, unknown> = {
        category: item.payload.category,
        severity: item.payload.severity,
        latitude: item.payload.latitude,
        longitude: item.payload.longitude,
        landmark_context: item.payload.landmark_context,
        sub_tag: item.payload.sub_tag,
      };
      if (item.payload.image_url) {
        bodyPayload.image_url = item.payload.image_url;
      }
      if (item.payload.reported_by) {
        bodyPayload.reported_by = item.payload.reported_by;
      }

      const response = await fetch(`${apiBaseUrl}/hazards`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-device-hash': deviceHash,
        },
        body: JSON.stringify(bodyPayload),
      });

      if (response.ok) {
        const created = (await response.json()) as HazardRecord;
        synced.push(created);
      } else if (response.status >= 400 && response.status < 500) {
        // Drop permanent client/duplicate rejections (400, 409) instead of infinite retry;
        // retain 429 rate-limit for later retry.
        if (response.status === 429) {
          stillPending.push(item);
        }
      } else {
        stillPending.push(item);
      }
    } catch {
      stillPending.push(item);
    }
  }

  try {
    await AsyncStorage.setItem(
      OFFLINE_REPORT_QUEUE_KEY,
      JSON.stringify(stillPending),
    );
  } catch {
    // Non-fatal
  }

  return { synced, remaining: stillPending.length };
}
