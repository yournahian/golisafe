import { Router, Request, Response } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Types aligned with packages/shared/api-contract.ts
export type HazardCategory =
  | 'pothole_manhole'
  | 'waterlogging'
  | 'unlit_alley'
  | 'unsafe_footbridge'
  | 'extortion_spot';

export type HazardSeverity = 'Low' | 'Medium' | 'Critical';

export interface HazardRecord {
  id: string;
  category: HazardCategory;
  severity: HazardSeverity;
  latitude: number;
  longitude: number;
  landmark_context?: string;
  sub_tag?: string;
  status: 'active' | 'crowd_verified' | 'resolved' | 'expired';
  confirmations?: number;
  resolved_count?: number;
  expires_at?: string;
  image_url?: string;
  reported_by?: string;
  created_at: string;
}

export interface CreateHazardRequest {
  category: HazardCategory;
  severity?: HazardSeverity;
  latitude: number;
  longitude: number;
  landmark_context?: string;
  sub_tag?: string;
  image_url?: string;
  reported_by?: string;
}

export const VALID_CATEGORIES: readonly HazardCategory[] = [
  'pothole_manhole',
  'waterlogging',
  'unlit_alley',
  'unsafe_footbridge',
  'extortion_spot',
] as const;

export const VALID_SEVERITIES: readonly HazardSeverity[] = [
  'Low',
  'Medium',
  'Critical',
] as const;

const router = Router();

let supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (supabaseClient) {
    return supabaseClient;
  }

  // Attempt to use the shared configured client from ../config/supabase if available
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const supabaseModule = require('../config/supabase');
    if (supabaseModule?.supabase) {
      supabaseClient = supabaseModule.supabase as SupabaseClient;
      return supabaseClient;
    }
  } catch {
    // Fall back to direct initialization if config module fails or is unavailable
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return null;
  }

  try {
    supabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    return supabaseClient;
  } catch {
    return null;
  }
}

export const BASE_COLUMNS =
  'id, category, severity, latitude, longitude, landmark_context, sub_tag, status, created_at';
export const CONFIRM_COLUMNS = `${BASE_COLUMNS}, confirmations`;
export const FULL_COLUMNS = `${CONFIRM_COLUMNS}, resolved_count`;
export const EXTENDED_COLUMNS = `${FULL_COLUMNS}, expires_at, image_url, reported_by`;

export function isMissingColumnError(error: any): boolean {
  if (!error) return false;
  const message = String(error.message || '').toLowerCase();
  const code = String(error.code || '');
  return (
    message.includes('confirmations') ||
    message.includes('resolved_count') ||
    message.includes('expires_at') ||
    message.includes('image_url') ||
    message.includes('reported_by') ||
    code === '42703' ||
    code === 'PGRST204'
  );
}

export function normalizeSeverity(severity?: string): HazardSeverity | null {
  if (!severity) return null;
  const s = severity.trim().toLowerCase();
  if (s === 'low') return 'Low';
  if (s === 'medium') return 'Medium';
  if (s === 'high' || s === 'critical') return 'Critical';
  return null;
}

/**
 * Automatically filters out hazards that are expired, resolved, or past their expires_at TTL.
 */
export function filterActiveAndUnexpired(hazards: HazardRecord[]): HazardRecord[] {
  const now = Date.now();
  return hazards.filter((h) => {
    if (h.status === 'resolved' || (h.status as string) === 'expired') {
      return false;
    }
    if (h.expires_at) {
      const exp = new Date(h.expires_at).getTime();
      if (!isNaN(exp) && exp < now) {
        return false;
      }
    }
    return true;
  });
}

export function filterMockHazards(
  isVerifiedOnly: boolean,
  normalizedSeverity: HazardSeverity | null
): HazardRecord[] {
  let activeMocks = filterActiveAndUnexpired(mockHazards);
  if (isVerifiedOnly) {
    activeMocks = activeMocks.filter((h) => h.status === 'crowd_verified');
  } else {
    activeMocks = activeMocks.filter(
      (h) => h.status === 'active' || h.status === 'crowd_verified'
    );
  }

  if (normalizedSeverity) {
    activeMocks = activeMocks.filter(
      (h) => h.severity.toLowerCase() === normalizedSeverity.toLowerCase()
    );
  }

  return activeMocks;
}

async function fetchHazardById(supabase: SupabaseClient, hazardId: string) {
  let hasConfirmationsColumn = true;
  let hasResolvedCountColumn = true;

  let result: any = await supabase
    .from('hazards')
    .select(EXTENDED_COLUMNS)
    .eq('id', hazardId)
    .maybeSingle();

  if (result.error && isMissingColumnError(result.error)) {
    result = await supabase
      .from('hazards')
      .select(FULL_COLUMNS)
      .eq('id', hazardId)
      .maybeSingle();

    if (result.error && isMissingColumnError(result.error)) {
      hasResolvedCountColumn = false;
      result = await supabase
        .from('hazards')
        .select(CONFIRM_COLUMNS)
        .eq('id', hazardId)
        .maybeSingle();

      if (result.error && isMissingColumnError(result.error)) {
        hasConfirmationsColumn = false;
        result = await supabase
          .from('hazards')
          .select(BASE_COLUMNS)
          .eq('id', hazardId)
          .maybeSingle();
      }
    }
  }

  return {
    data: result.data as any,
    error: result.error as any,
    hasConfirmationsColumn,
    hasResolvedCountColumn,
  };
}

async function applyHazardUpdate(
  supabase: SupabaseClient,
  hazardId: string,
  primaryPayload: Record<string, any>,
  statusOnlyPayload: Record<string, any>,
  usePrimaryColumns: boolean,
  existingRecord: any,
  mergedDefaults: Pick<HazardRecord, 'confirmations' | 'resolved_count' | 'status'>
): Promise<{ data?: HazardRecord; error?: any }> {
  if (usePrimaryColumns) {
    const updateResult: any = await supabase
      .from('hazards')
      .update(primaryPayload)
      .eq('id', hazardId)
      .select(FULL_COLUMNS)
      .single();

    if (!updateResult.error) {
      return { data: updateResult.data as HazardRecord };
    }
    if (!isMissingColumnError(updateResult.error)) {
      return { error: updateResult.error };
    }
  }

  if (Object.keys(statusOnlyPayload).length > 0) {
    const fallbackUpdate: any = await supabase
      .from('hazards')
      .update(statusOnlyPayload)
      .eq('id', hazardId)
      .select(BASE_COLUMNS)
      .single();

    if (fallbackUpdate.error) {
      return { error: fallbackUpdate.error };
    }

    return {
      data: {
        ...(fallbackUpdate.data as HazardRecord),
        confirmations: mergedDefaults.confirmations,
        resolved_count: mergedDefaults.resolved_count,
      },
    };
  }

  return {
    data: {
      ...(existingRecord as HazardRecord),
      ...mergedDefaults,
    },
  };
}

// In-memory fallback mock hazards matching database/02_seed_dhaka_hazards.sql
// Used when Supabase is unconfigured or unavailable during live demo presentations.
export const DEFAULT_MOCK_HAZARDS: HazardRecord[] = [
  {
    id: 'd0000000-0000-0000-0000-000000000001',
    category: 'pothole_manhole',
    severity: 'Critical',
    latitude: 23.7561,
    longitude: 90.3752,
    landmark_context: 'Dhanmondi 27, near Rapa Plaza',
    sub_tag: 'Open manhole without cover',
    status: 'crowd_verified',
    confirmations: 5,
    resolved_count: 0,
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: 'd0000000-0000-0000-0000-000000000002',
    category: 'waterlogging',
    severity: 'Critical',
    latitude: 23.8069,
    longitude: 90.3687,
    landmark_context: 'Mirpur 10 Circle, opposite Shah Ali Plaza',
    sub_tag: 'Knee-deep rainwater',
    status: 'active',
    confirmations: 2,
    resolved_count: 0,
    created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
  },
  {
    id: 'd0000000-0000-0000-0000-000000000003',
    category: 'unsafe_footbridge',
    severity: 'Critical',
    latitude: 23.7572,
    longitude: 90.3899,
    landmark_context: 'Farmgate Footbridge near Ananda Cinema',
    sub_tag: 'Broken steps and unlit stairs',
    status: 'crowd_verified',
    confirmations: 6,
    resolved_count: 0,
    created_at: new Date(Date.now() - 3600000 * 6).toISOString(),
  },
  {
    id: 'd0000000-0000-0000-0000-000000000004',
    category: 'unlit_alley',
    severity: 'Medium',
    latitude: 23.7784,
    longitude: 90.3984,
    landmark_context: 'Underneath Mohakhali Flyover, Amtoli side',
    sub_tag: 'Broken streetlights',
    status: 'active',
    confirmations: 1,
    resolved_count: 0,
    created_at: new Date(Date.now() - 3600000 * 8).toISOString(),
  },
  {
    id: 'd0000000-0000-0000-0000-000000000005',
    category: 'waterlogging',
    severity: 'Medium',
    latitude: 23.7805,
    longitude: 90.4266,
    landmark_context: 'Middle Badda Link Road',
    sub_tag: 'Drain overflow',
    status: 'active',
    confirmations: 2,
    resolved_count: 0,
    created_at: new Date(Date.now() - 3600000 * 10).toISOString(),
  },
  {
    id: 'd0000000-0000-0000-0000-000000000006',
    category: 'extortion_spot',
    severity: 'Medium',
    latitude: 23.7389,
    longitude: 90.3958,
    landmark_context: 'Shahbagh Mor near Public Library gate',
    sub_tag: 'Illegal street toll',
    status: 'active',
    confirmations: 1,
    resolved_count: 0,
    created_at: new Date(Date.now() - 3600000 * 12).toISOString(),
  },
  {
    id: 'd0000000-0000-0000-0000-000000000007',
    category: 'pothole_manhole',
    severity: 'Medium',
    latitude: 23.733,
    longitude: 90.4172,
    landmark_context: 'Motijheel Shapla Chattar service lane',
    sub_tag: 'Deep pothole',
    status: 'active',
    confirmations: 2,
    resolved_count: 0,
    created_at: new Date(Date.now() - 3600000 * 14).toISOString(),
  },
  {
    id: 'd0000000-0000-0000-0000-000000000008',
    category: 'unlit_alley',
    severity: 'Low',
    latitude: 23.8759,
    longitude: 90.3795,
    landmark_context: 'Uttara Sector 7, Road 12',
    sub_tag: 'Dim street lighting',
    status: 'resolved',
    confirmations: 1,
    resolved_count: 2,
    created_at: new Date(Date.now() - 3600000 * 16).toISOString(),
  },
  {
    id: 'd0000000-0000-0000-0000-000000000009',
    category: 'extortion_spot',
    severity: 'Critical',
    latitude: 23.7654,
    longitude: 90.3587,
    landmark_context: 'Mohammadpur Town Hall Market approach',
    sub_tag: 'Late-night toll collection',
    status: 'crowd_verified',
    confirmations: 4,
    resolved_count: 0,
    created_at: new Date(Date.now() - 3600000 * 18).toISOString(),
  },
  {
    id: 'd0000000-0000-0000-0000-000000000010',
    category: 'unsafe_footbridge',
    severity: 'Low',
    latitude: 23.7937,
    longitude: 90.4066,
    landmark_context: 'Banani Kakoli Footbridge',
    sub_tag: 'Slippery tiles when wet',
    status: 'active',
    confirmations: 1,
    resolved_count: 0,
    created_at: new Date(Date.now() - 3600000 * 20).toISOString(),
  },
  {
    id: 'd0000000-0000-0000-0000-000000000011',
    category: 'pothole_manhole',
    severity: 'Critical',
    latitude: 23.7104,
    longitude: 90.435,
    landmark_context: 'Jatrabari Flyover ramp, Demra side',
    sub_tag: 'Collapsed asphalt',
    status: 'crowd_verified',
    confirmations: 3,
    resolved_count: 0,
    created_at: new Date(Date.now() - 3600000 * 22).toISOString(),
  },
  {
    id: 'd0000000-0000-0000-0000-000000000012',
    category: 'unlit_alley',
    severity: 'Medium',
    latitude: 23.7647,
    longitude: 90.3886,
    landmark_context: 'Bijoy Sarani side lane toward Tejgaon',
    sub_tag: 'Dark pedestrian stretch',
    status: 'active',
    confirmations: 2,
    resolved_count: 0,
    created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
  },
];

export let mockHazards: HazardRecord[] = [...DEFAULT_MOCK_HAZARDS];

/**
 * Helper to update mock hazards in memory for confirm action.
 */
function confirmMockHazard(hazardId: string, res: Response, trustWeight = 1) {
  const index = mockHazards.findIndex((h) => h.id === hazardId);
  if (index === -1) {
    return res.status(404).json({ error: 'Hazard not found' });
  }

  const existing = mockHazards[index];
  const newConfirmations = (existing.confirmations || 1) + trustWeight;
  const updatedHazard: HazardRecord = {
    ...existing,
    confirmations: newConfirmations,
    status: newConfirmations >= 3 ? 'crowd_verified' : existing.status,
  };

  mockHazards[index] = updatedHazard;
  return res.status(200).json(updatedHazard);
}

/**
 * Helper to update mock hazards in memory for resolve action.
 */
function resolveMockHazard(
  hazardId: string,
  res: Response,
  existingRecord?: any,
  nextResolvedCount?: number,
  nextStatus?: 'active' | 'crowd_verified' | 'resolved',
  trustWeight = 1
) {
  const index = mockHazards.findIndex((h) => h.id === hazardId);
  if (index !== -1) {
    const existing = mockHazards[index];
    const nextResolved =
      nextResolvedCount ?? (existing.resolved_count || 0) + trustWeight;
    const status = nextStatus ?? (nextResolved >= 2 ? 'resolved' : existing.status);
    const updatedHazard: HazardRecord = {
      ...existing,
      resolved_count: nextResolved,
      status,
    };
    mockHazards[index] = updatedHazard;
    return res.status(200).json(updatedHazard);
  }

  if (existingRecord) {
    const nextResolved =
      nextResolvedCount ?? (existingRecord.resolved_count || 0) + trustWeight;
    const status =
      nextStatus ?? (nextResolved >= 2 ? 'resolved' : (existingRecord.status || 'active'));
    const updatedHazard: HazardRecord = {
      ...existingRecord,
      resolved_count: nextResolved,
      status,
    };
    mockHazards.unshift(updatedHazard);
    return res.status(200).json(updatedHazard);
  }

  return res.status(404).json({ error: 'Hazard not found' });
}

const handleConfirmHazard = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id || typeof id !== 'string' || id.trim() === '') {
      return res.status(400).json({ error: 'Hazard ID is required.' });
    }

    const hazardId = id.trim();
    const rawWeight = req.body?.trustWeight;
    const trustWeight =
      typeof rawWeight === 'number' && !isNaN(rawWeight) && rawWeight > 0
        ? Math.round(rawWeight)
        : 1;

    const supabase = getSupabaseClient();

    if (supabase) {
      try {
        const fetched = await fetchHazardById(supabase, hazardId);

        if (fetched.error) {
          if (fetched.error.code === '22P02') {
            return confirmMockHazard(hazardId, res, trustWeight);
          }
          const mockMatch = mockHazards.find((h) => h.id === hazardId);
          if (mockMatch) {
            return confirmMockHazard(hazardId, res, trustWeight);
          }
          return res.status(500).json({ error: fetched.error.message });
        }

        const existingRecord = fetched.data;
        if (!existingRecord) {
          const mockMatch = mockHazards.find((h) => h.id === hazardId);
          if (mockMatch) {
            return confirmMockHazard(hazardId, res, trustWeight);
          }
          return res.status(404).json({ error: 'Hazard not found' });
        }

        const newConfirmations = (existingRecord.confirmations || 1) + trustWeight;
        const shouldVerify = newConfirmations >= 3;
        const statusOnlyPayload: Record<string, any> = shouldVerify
          ? { status: 'crowd_verified' }
          : {};
        const primaryPayload: Record<string, any> = {
          confirmations: newConfirmations,
          ...statusOnlyPayload,
        };

        const updated = await applyHazardUpdate(
          supabase,
          hazardId,
          primaryPayload,
          statusOnlyPayload,
          fetched.hasConfirmationsColumn,
          existingRecord,
          {
            confirmations: newConfirmations,
            resolved_count: existingRecord.resolved_count ?? 0,
            status: shouldVerify
              ? 'crowd_verified'
              : (existingRecord.status as HazardRecord['status']),
          }
        );

        if (updated.error) {
          return res.status(500).json({ error: updated.error.message });
        }

        return res.status(200).json(updated.data);
      } catch (err: unknown) {
        const mockMatch = mockHazards.find((h) => h.id === hazardId);
        if (mockMatch) {
          return confirmMockHazard(hazardId, res, trustWeight);
        }
        const message =
          err instanceof Error ? err.message : 'Internal server error';
        return res.status(500).json({ error: message });
      }
    }

    return confirmMockHazard(hazardId, res, trustWeight);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Internal server error';
    return res.status(500).json({ error: message });
  }
};

const handleResolveHazard = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id || typeof id !== 'string' || id.trim() === '') {
      return res.status(400).json({ error: 'Hazard ID is required.' });
    }

    const hazardId = id.trim();
    const rawWeight = req.body?.trustWeight;
    const trustWeight =
      typeof rawWeight === 'number' && !isNaN(rawWeight) && rawWeight > 0
        ? Math.round(rawWeight)
        : 1;

    const supabase = getSupabaseClient();

    if (supabase) {
      try {
        const fetched = await fetchHazardById(supabase, hazardId);

        if (fetched.error) {
          if (fetched.error.code === '22P02') {
            return resolveMockHazard(hazardId, res, undefined, undefined, undefined, trustWeight);
          }
          const mockMatch = mockHazards.find((h) => h.id === hazardId);
          if (mockMatch) {
            return resolveMockHazard(hazardId, res, undefined, undefined, undefined, trustWeight);
          }
          return res.status(500).json({ error: fetched.error.message });
        }

        const existingRecord = fetched.data;
        if (!existingRecord) {
          const mockMatch = mockHazards.find((h) => h.id === hazardId);
          if (mockMatch) {
            return resolveMockHazard(hazardId, res, undefined, undefined, undefined, trustWeight);
          }
          return res.status(404).json({ error: 'Hazard not found' });
        }

        const nextResolved = (existingRecord.resolved_count || 0) + trustWeight;
        const shouldResolve = nextResolved >= 2;
        const nextStatus: 'active' | 'crowd_verified' | 'resolved' = shouldResolve
          ? 'resolved'
          : existingRecord.status || 'active';
        const statusOnlyPayload: Record<string, any> = shouldResolve
          ? { status: 'resolved' }
          : {};
        const primaryPayload: Record<string, any> = {
          resolved_count: nextResolved,
          ...statusOnlyPayload,
        };

        const updated = await applyHazardUpdate(
          supabase,
          hazardId,
          primaryPayload,
          statusOnlyPayload,
          fetched.hasResolvedCountColumn,
          existingRecord,
          {
            confirmations: existingRecord.confirmations ?? 1,
            resolved_count: nextResolved,
            status: nextStatus,
          }
        );

        if (updated.error) {
          return resolveMockHazard(
            hazardId,
            res,
            existingRecord,
            nextResolved,
            nextStatus,
            trustWeight
          );
        }

        return res.status(200).json(updated.data);
      } catch (err: unknown) {
        const mockMatch = mockHazards.find((h) => h.id === hazardId);
        if (mockMatch) {
          return resolveMockHazard(hazardId, res, undefined, undefined, undefined, trustWeight);
        }
        const message =
          err instanceof Error ? err.message : 'Internal server error';
        return res.status(500).json({ error: message });
      }
    }

    return resolveMockHazard(hazardId, res, undefined, undefined, undefined, trustWeight);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Internal server error';
    return res.status(500).json({ error: message });
  }
};

/**
 * PATCH /api/hazards/:id/confirm
 * POST  /api/hazards/:id/confirm
 * Increment confirmation count by trustWeight (default 1) and promote to 'crowd_verified' at >= 3 confirmations.
 */
router.patch('/:id/confirm', handleConfirmHazard);
router.post('/:id/confirm', handleConfirmHazard);

/**
 * PATCH /api/hazards/:id/resolve
 * POST  /api/hazards/:id/resolve
 * Increment resolved_count by trustWeight (default 1); promote to 'resolved' at >= 2.
 */
router.patch('/:id/resolve', handleResolveHazard);
router.post('/:id/resolve', handleResolveHazard);

/**
 * GET /api/hazards
 * Query active hazards ('active' or 'crowd_verified') ordered by created_at DESC.
 * Automatically excludes hazards that are 'expired', 'resolved', or where 'expires_at' is in the past.
 */
router.get('/', async (req: Request, res: Response) => {
  const { severity, verified } = req.query;
  const normalizedSeverity = normalizeSeverity(
    typeof severity === 'string' ? severity : undefined
  );
  const isVerifiedOnly =
    typeof verified === 'string' && verified.trim().toLowerCase() === 'true';

  try {
    const supabase = getSupabaseClient();
    if (supabase) {
      for (const columns of [
        EXTENDED_COLUMNS,
        FULL_COLUMNS,
        CONFIRM_COLUMNS,
        BASE_COLUMNS,
      ]) {
        let query: any = supabase.from('hazards').select(columns);
        query = isVerifiedOnly
          ? query.eq('status', 'crowd_verified')
          : query.in('status', ['active', 'crowd_verified']);

        if (normalizedSeverity) {
          query = query.eq('severity', normalizedSeverity);
        }

        const result: any = await query.order('created_at', { ascending: false });
        if (!result.error && Array.isArray(result.data)) {
          // Lazy TTL enforcement: filter out past expires_at and resolved/expired statuses
          const unexpired = filterActiveAndUnexpired(result.data as HazardRecord[]);
          const mapped = unexpired.map((h) => ({
            ...h,
            confirmations: h.confirmations ?? 1,
            resolved_count: h.resolved_count ?? 0,
          }));
          return res.status(200).json(mapped);
        }

        if (!isMissingColumnError(result.error)) {
          break;
        }
      }
    }

    return res.status(200).json(filterMockHazards(isVerifiedOnly, normalizedSeverity));
  } catch {
    return res.status(200).json(filterMockHazards(isVerifiedOnly, normalizedSeverity));
  }
});

/**
 * POST /api/hazards
 * Create a new hazard record with validation, saving optional image_url and reported_by.
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      category,
      severity,
      latitude,
      longitude,
      landmark_context,
      sub_tag,
      image_url,
      reported_by,
    } = req.body as Partial<CreateHazardRequest>;

    if (!category || !VALID_CATEGORIES.includes(category as HazardCategory)) {
      return res.status(400).json({
        error: `Invalid category. Category must be one of: ${VALID_CATEGORIES.join(
          ', '
        )}`,
      });
    }

    if (
      latitude === undefined ||
      latitude === null ||
      typeof latitude !== 'number' ||
      isNaN(latitude) ||
      !isFinite(latitude) ||
      longitude === undefined ||
      longitude === null ||
      typeof longitude !== 'number' ||
      isNaN(longitude) ||
      !isFinite(longitude)
    ) {
      return res.status(400).json({
        error: 'Latitude and longitude are required and must be valid numbers.',
      });
    }

    if (severity && !VALID_SEVERITIES.includes(severity as HazardSeverity)) {
      return res.status(400).json({
        error: `Invalid severity. Allowed values: ${VALID_SEVERITIES.join(', ')}`,
      });
    }

    const resolvedSeverity: HazardSeverity = severity || 'Medium';

    const supabase = getSupabaseClient();
    if (supabase) {
      const insertRecord: Record<string, any> = {
        category,
        severity: resolvedSeverity,
        latitude,
        longitude,
        landmark_context: landmark_context || null,
        sub_tag: sub_tag || null,
        image_url: image_url || null,
        reported_by: reported_by || null,
        status: 'active',
        confirmations: 1,
        resolved_count: 0,
      };

      const tiers: Array<{ columns: string; dropKeys?: string[] }> = [
        { columns: EXTENDED_COLUMNS },
        {
          columns: FULL_COLUMNS,
          dropKeys: ['image_url', 'reported_by', 'expires_at'],
        },
        {
          columns: CONFIRM_COLUMNS,
          dropKeys: ['image_url', 'reported_by', 'expires_at', 'resolved_count'],
        },
        {
          columns: BASE_COLUMNS,
          dropKeys: [
            'image_url',
            'reported_by',
            'expires_at',
            'resolved_count',
            'confirmations',
          ],
        },
      ];

      for (const tier of tiers) {
        if (tier.dropKeys) {
          for (const key of tier.dropKeys) {
            delete insertRecord[key];
          }
        }
        const result: any = await supabase
          .from('hazards')
          .insert(insertRecord)
          .select(tier.columns)
          .single();

        if (!result.error && result.data) {
          return res.status(201).json({
            ...result.data,
            confirmations: result.data.confirmations ?? 1,
            resolved_count: result.data.resolved_count ?? 0,
            image_url: result.data.image_url ?? image_url,
            reported_by: result.data.reported_by ?? reported_by,
          } as HazardRecord);
        }

        if (!isMissingColumnError(result.error)) {
          break;
        }
      }
    }

    const newHazard: HazardRecord = {
      id: `hazard-${Date.now()}`,
      category: category as HazardCategory,
      severity: resolvedSeverity,
      latitude,
      longitude,
      landmark_context: landmark_context || undefined,
      sub_tag: sub_tag || undefined,
      image_url: image_url || undefined,
      reported_by: reported_by || undefined,
      status: 'active',
      confirmations: 1,
      resolved_count: 0,
      created_at: new Date().toISOString(),
    };
    mockHazards.unshift(newHazard);
    return res.status(201).json(newHazard);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Internal server error';
    return res.status(500).json({ error: message });
  }
});

export default router;
