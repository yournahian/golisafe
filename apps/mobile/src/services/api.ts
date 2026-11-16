import type {
  CreateHazardRequest,
  HazardRecord,
} from '../../../../packages/shared/api-contract';

export interface Hazard extends HazardRecord {
  resolved_count?: number;
  expires_at?: string;
}

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || 'http://192.168.0.110:4000/api';

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

export async function confirmHazard(id: string): Promise<Hazard> {
  const response = await fetch(
    `${API_BASE_URL}/hazards/${encodeURIComponent(id)}/confirm`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to confirm hazard: HTTP ${response.status}`);
  }

  return response.json();
}

export async function resolveHazard(id: string): Promise<Hazard> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/hazards/${encodeURIComponent(id)}/resolve`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
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
      status: 'active',
      resolved_count: 1,
      created_at: new Date().toISOString(),
    };
  }
}

