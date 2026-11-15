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
  status: 'active' | 'crowd_verified' | 'resolved';
  confirmations?: number;
  created_at: string;
}

export interface CreateHazardRequest {
  category: HazardCategory;
  severity?: HazardSeverity;
  latitude: number;
  longitude: number;
  landmark_context?: string;
  sub_tag?: string;
}

const VALID_CATEGORIES: readonly HazardCategory[] = [
  'pothole_manhole',
  'waterlogging',
  'unlit_alley',
  'unsafe_footbridge',
  'extortion_spot',
] as const;

const VALID_SEVERITIES: readonly HazardSeverity[] = [
  'Low',
  'Medium',
  'Critical',
] as const;

const router = Router();

let supabaseClient: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient | null {
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

/**
 * Check if a Supabase error is caused by a missing 'confirmations' column in the schema cache.
 */
function isMissingColumnError(error: any): boolean {
  if (!error) return false;
  const message = String(error.message || '').toLowerCase();
  const code = String(error.code || '');
  return (
    message.includes('confirmations') ||
    code === '42703' || // Postgres: undefined_column
    code === 'PGRST204' // PostgREST: column not found in schema cache
  );
}

// In-memory fallback mock hazards matching database/02_seed_dhaka_hazards.sql
// Used when Supabase is unconfigured or unavailable during live demo presentations.
const DEFAULT_MOCK_HAZARDS: HazardRecord[] = [
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
    created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
  },
];

let mockHazards: HazardRecord[] = [...DEFAULT_MOCK_HAZARDS];

/**
 * Helper to update mock hazards in memory.
 */
function confirmMockHazard(hazardId: string, res: Response) {
  const index = mockHazards.findIndex((h) => h.id === hazardId);
  if (index === -1) {
    return res.status(404).json({ error: 'Hazard not found' });
  }

  const existing = mockHazards[index];
  const newConfirmations = (existing.confirmations || 1) + 1;
  const updatedHazard: HazardRecord = {
    ...existing,
    confirmations: newConfirmations,
    status: newConfirmations >= 3 ? 'crowd_verified' : existing.status,
  };

  mockHazards[index] = updatedHazard;
  return res.status(200).json(updatedHazard);
}

/**
 * Shared confirmation handler for:
 * PATCH /api/hazards/:id/confirm
 * POST  /api/hazards/:id/confirm
 */
const handleConfirmHazard = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id || typeof id !== 'string' || id.trim() === '') {
      return res.status(400).json({ error: 'Hazard ID is required.' });
    }

    const hazardId = id.trim();
    const supabase = getSupabaseClient();

    if (supabase) {
      try {
        let existingRecord: any = null;
        let hasConfirmationsColumn = true;

        // Try selecting with confirmations column
        const fetchWithConfirmations = await supabase
          .from('hazards')
          .select(
            'id, category, severity, latitude, longitude, landmark_context, sub_tag, status, created_at, confirmations'
          )
          .eq('id', hazardId)
          .maybeSingle();

        if (fetchWithConfirmations.error) {
          if (isMissingColumnError(fetchWithConfirmations.error)) {
            hasConfirmationsColumn = false;
            // Retry select without confirmations column
            const fetchWithoutConfirmations = await supabase
              .from('hazards')
              .select(
                'id, category, severity, latitude, longitude, landmark_context, sub_tag, status, created_at'
              )
              .eq('id', hazardId)
              .maybeSingle();

            if (fetchWithoutConfirmations.error) {
              if (fetchWithoutConfirmations.error.code === '22P02') {
                return confirmMockHazard(hazardId, res);
              }
              return res
                .status(500)
                .json({ error: fetchWithoutConfirmations.error.message });
            }
            existingRecord = fetchWithoutConfirmations.data;
          } else if (fetchWithConfirmations.error.code === '22P02') {
            // Invalid UUID format for Postgres, check mock store
            return confirmMockHazard(hazardId, res);
          } else {
            // If Supabase encountered connection/network error, fallback to mock store if matched
            const mockMatch = mockHazards.find((h) => h.id === hazardId);
            if (mockMatch) {
              return confirmMockHazard(hazardId, res);
            }
            return res
              .status(500)
              .json({ error: fetchWithConfirmations.error.message });
          }
        } else {
          existingRecord = fetchWithConfirmations.data;
        }

        // If not found in Supabase, check mock store before returning 404
        if (!existingRecord) {
          const mockMatch = mockHazards.find((h) => h.id === hazardId);
          if (mockMatch) {
            return confirmMockHazard(hazardId, res);
          }
          return res.status(404).json({ error: 'Hazard not found' });
        }

        // Increment confirmations count by 1 (defaulting to (existing.confirmations || 1) + 1)
        const newConfirmations = (existingRecord.confirmations || 1) + 1;
        const shouldVerify = newConfirmations >= 3;

        if (hasConfirmationsColumn) {
          const updatePayload: Record<string, any> = {
            confirmations: newConfirmations,
          };
          if (shouldVerify) {
            updatePayload.status = 'crowd_verified';
          }

          const updateResult = await supabase
            .from('hazards')
            .update(updatePayload)
            .eq('id', hazardId)
            .select(
              'id, category, severity, latitude, longitude, landmark_context, sub_tag, status, created_at, confirmations'
            )
            .single();

          if (updateResult.error) {
            if (isMissingColumnError(updateResult.error)) {
              // Gracefully handle column missing during update
              const fallbackPayload: Record<string, any> = {};
              if (shouldVerify) {
                fallbackPayload.status = 'crowd_verified';
              }

              if (Object.keys(fallbackPayload).length > 0) {
                const fallbackUpdate = await supabase
                  .from('hazards')
                  .update(fallbackPayload)
                  .eq('id', hazardId)
                  .select(
                    'id, category, severity, latitude, longitude, landmark_context, sub_tag, status, created_at'
                  )
                  .single();

                if (fallbackUpdate.error) {
                  return res
                    .status(500)
                    .json({ error: fallbackUpdate.error.message });
                }

                const resultHazard: HazardRecord = {
                  ...(fallbackUpdate.data as HazardRecord),
                  confirmations: newConfirmations,
                };
                return res.status(200).json(resultHazard);
              }

              const resultHazard: HazardRecord = {
                ...(existingRecord as HazardRecord),
                confirmations: newConfirmations,
              };
              return res.status(200).json(resultHazard);
            }

            return res.status(500).json({ error: updateResult.error.message });
          }

          return res.status(200).json(updateResult.data as HazardRecord);
        } else {
          // Schema does not have confirmations column: update status if >= 3
          const fallbackPayload: Record<string, any> = {};
          if (shouldVerify) {
            fallbackPayload.status = 'crowd_verified';
          }

          if (Object.keys(fallbackPayload).length > 0) {
            const fallbackUpdate = await supabase
              .from('hazards')
              .update(fallbackPayload)
              .eq('id', hazardId)
              .select(
                'id, category, severity, latitude, longitude, landmark_context, sub_tag, status, created_at'
              )
              .single();

            if (fallbackUpdate.error) {
              return res
                .status(500)
                .json({ error: fallbackUpdate.error.message });
            }

            const resultHazard: HazardRecord = {
              ...(fallbackUpdate.data as HazardRecord),
              confirmations: newConfirmations,
            };
            return res.status(200).json(resultHazard);
          }

          const resultHazard: HazardRecord = {
            ...(existingRecord as HazardRecord),
            confirmations: newConfirmations,
          };
          return res.status(200).json(resultHazard);
        }
      } catch (err: unknown) {
        // Unexpected database error fallback
        const mockMatch = mockHazards.find((h) => h.id === hazardId);
        if (mockMatch) {
          return confirmMockHazard(hazardId, res);
        }
        const message =
          err instanceof Error ? err.message : 'Internal server error';
        return res.status(500).json({ error: message });
      }
    }

    // Supabase not configured: fallback to in-memory mock store
    return confirmMockHazard(hazardId, res);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Internal server error';
    return res.status(500).json({ error: message });
  }
};

/**
 * PATCH /api/hazards/:id/confirm
 * POST  /api/hazards/:id/confirm
 * Increment confirmation count and promote to 'crowd_verified' at >= 3 confirmations.
 */
router.patch('/:id/confirm', handleConfirmHazard);
router.post('/:id/confirm', handleConfirmHazard);

/**
 * GET /api/hazards
 * Query active hazards ('active' or 'crowd_verified') ordered by created_at DESC.
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data, error } = await supabase
        .from('hazards')
        .select(
          'id, category, severity, latitude, longitude, landmark_context, sub_tag, status, created_at, confirmations'
        )
        .in('status', ['active', 'crowd_verified'])
        .order('created_at', { ascending: false });

      if (error) {
        if (isMissingColumnError(error)) {
          const fallback = await supabase
            .from('hazards')
            .select(
              'id, category, severity, latitude, longitude, landmark_context, sub_tag, status, created_at'
            )
            .in('status', ['active', 'crowd_verified'])
            .order('created_at', { ascending: false });

          if (!fallback.error && fallback.data) {
            const mapped = (fallback.data as HazardRecord[]).map((h) => ({
              ...h,
              confirmations: h.confirmations ?? 1,
            }));
            return res.status(200).json(mapped);
          }
        }
      } else if (data) {
        return res.status(200).json((data as HazardRecord[]) ?? []);
      }
    }

    // Mock fallback when Supabase is unconfigured or unavailable
    const activeMocks = mockHazards.filter(
      (h) => h.status === 'active' || h.status === 'crowd_verified'
    );
    return res.status(200).json(activeMocks);
  } catch (_err: unknown) {
    const activeMocks = mockHazards.filter(
      (h) => h.status === 'active' || h.status === 'crowd_verified'
    );
    return res.status(200).json(activeMocks);
  }
});

/**
 * POST /api/hazards
 * Create a new hazard record with validation.
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
    } = req.body as Partial<CreateHazardRequest>;

    // Validate category
    if (!category || !VALID_CATEGORIES.includes(category as HazardCategory)) {
      return res.status(400).json({
        error: `Invalid category. Category must be one of: ${VALID_CATEGORIES.join(
          ', '
        )}`,
      });
    }

    // Validate latitude and longitude
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

    // Validate severity if provided
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
        status: 'active',
        confirmations: 1,
      };

      let { data, error } = await supabase
        .from('hazards')
        .insert(insertRecord)
        .select(
          'id, category, severity, latitude, longitude, landmark_context, sub_tag, status, created_at, confirmations'
        )
        .single();

      if (error && isMissingColumnError(error)) {
        delete insertRecord.confirmations;
        const retry = await supabase
          .from('hazards')
          .insert(insertRecord)
          .select(
            'id, category, severity, latitude, longitude, landmark_context, sub_tag, status, created_at'
          )
          .single();

        if (!retry.error && retry.data) {
          return res
            .status(201)
            .json({ ...retry.data, confirmations: 1 } as HazardRecord);
        }
        error = retry.error;
      }

      if (!error && data) {
        return res.status(201).json(data as HazardRecord);
      }
    }

    // Mock store fallback if Supabase is unconfigured or query fails
    const newHazard: HazardRecord = {
      id: `hazard-${Date.now()}`,
      category: category as HazardCategory,
      severity: resolvedSeverity,
      latitude,
      longitude,
      landmark_context: landmark_context || undefined,
      sub_tag: sub_tag || undefined,
      status: 'active',
      confirmations: 1,
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
