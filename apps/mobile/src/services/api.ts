import type {
  CreateHazardRequest,
  HazardRecord,
} from '../../../../packages/shared/api-contract';

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || 'http://192.168.0.110:4000/api';

export async function fetchHazards(): Promise<HazardRecord[]> {
  const url = `${API_BASE_URL}/hazards`;
  console.log('[GoliSafe API] Fetching hazards from:', url);
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    const list = Array.isArray(data) ? data : [];
    console.log(`[GoliSafe API] Loaded ${list.length} hazards from backend`);
    return list;
  } catch (error) {
    console.log('[GoliSafe API] Error fetching hazards:', error);
    return [];
  }
}

export async function submitHazard(
  payload: CreateHazardRequest,
): Promise<HazardRecord> {
  const response = await fetch(`${API_BASE_URL}/hazards`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Failed to submit hazard: HTTP ${response.status}`);
  }

  return response.json();
}

export async function confirmHazard(id: string): Promise<HazardRecord> {
  const url = `${API_BASE_URL}/hazards/${encodeURIComponent(id)}/confirm`;
  console.log('[GoliSafe API] Confirming hazard at:', url);
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to confirm hazard: HTTP ${response.status}`);
  }

  return response.json();
}

