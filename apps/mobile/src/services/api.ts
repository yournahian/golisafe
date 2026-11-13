import type {
  CreateHazardRequest,
  HazardRecord,
} from '../../../../packages/shared/api-contract';

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:4000/api';

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

