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

function getSupabaseClient(): SupabaseClient {
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
    throw new Error(
      'Missing required Supabase environment variables: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'
    );
  }

  supabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return supabaseClient;
}

/**
 * GET /api/hazards
 * Query active hazards ('active' or 'crowd_verified') ordered by created_at DESC.
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('hazards')
      .select(
        'id, category, severity, latitude, longitude, landmark_context, sub_tag, status, created_at'
      )
      .in('status', ['active', 'crowd_verified'])
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json((data as HazardRecord[]) ?? []);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Internal server error';
    return res.status(500).json({ error: message });
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
    const { data, error } = await supabase
      .from('hazards')
      .insert({
        category,
        severity: resolvedSeverity,
        latitude,
        longitude,
        landmark_context: landmark_context || null,
        sub_tag: sub_tag || null,
        status: 'active',
      })
      .select(
        'id, category, severity, latitude, longitude, landmark_context, sub_tag, status, created_at'
      )
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(201).json(data as HazardRecord);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Internal server error';
    return res.status(500).json({ error: message });
  }
});

export default router;
