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

// In-memory sliding window rate limiter: max 3 reports per 10 minutes per device (FR-02, NFR-08)
export const reportRateLimitMap = new Map<string, number[]>();
export const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
export const RATE_LIMIT_MAX_REPORTS = 3;

export function checkRateLimit(deviceToken: string): boolean {
  const now = Date.now();
  const existing = reportRateLimitMap.get(deviceToken) || [];
  const valid = existing.filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS);

  if (valid.length >= RATE_LIMIT_MAX_REPORTS) {
    reportRateLimitMap.set(deviceToken, valid);
    return false;
  }

  valid.push(now);
  reportRateLimitMap.set(deviceToken, valid);
  return true;
}

const SPAM_PATTERNS = [
  /(.)\1{6,}/, // 7+ repeating characters
  /\b(viagra|casino|crypto|lottery|free money|click here|sex|porn|nude)\b/i,
  /\b(bal|chuda|magi|khanki|shala|bokachoda)\b/i,
];

export function isSpamOrAbusive(text?: string | null): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  for (const pattern of SPAM_PATTERNS) {
    if (pattern.test(trimmed)) {
      return true;
    }
  }
  return false;
}

export function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
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
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

const router = Router();

let supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (supabaseClient) {
    return supabaseClient;
  }

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
 * Automatically filters out hazards that are expired or resolved (FR-24, NFR-21).
 * Structural hazards ('pothole_manhole', 'unsafe_footbridge') persist until resolved.
 * Temporary hazards ('waterlogging', 'extortion_spot', 'unlit_alley') expire on read if expires_at is past.
 */
export function filterActiveAndUnexpired(hazards: HazardRecord[]): HazardRecord[] {
  const now = Date.now();
  return hazards.filter((h) => {
    if (h.status === 'resolved' || (h.status as string) === 'expired') {
      return false;
    }

    const isTemporary =
      h.category === 'waterlogging' ||
      h.category === 'extortion_spot' ||
      h.category === 'unlit_alley';

    if (isTemporary && h.expires_at) {
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

async function findRecentDuplicateHazard(
  supabase: SupabaseClient | null,
  category: HazardCategory,
  lat: number,
  lng: number
): Promise<HazardRecord | null> {
  const DUPLICATE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
  const DUPLICATE_DISTANCE_METERS = 20; // 20 meters
  const now = Date.now();

  // 1. Check in-memory store
  for (const h of mockHazards) {
    if (
      h.category === category &&
      h.status !== 'resolved' &&
      (h.status as any) !== 'expired'
    ) {
      const createdTime = new Date(h.created_at).getTime();
      if (!isNaN(createdTime) && now - createdTime <= DUPLICATE_WINDOW_MS) {
        const dist = haversineDistanceMeters(lat, lng, h.latitude, h.longitude);
        if (dist <= DUPLICATE_DISTANCE_METERS) {
          return h;
        }
      }
    }
  }

  // 2. Check Supabase if available
  if (supabase) {
    try {
      const fiveMinsAgo = new Date(now - DUPLICATE_WINDOW_MS).toISOString();
      const { data, error } = await supabase
        .from('hazards')
        .select(BASE_COLUMNS)
        .eq('category', category)
        .in('status', ['active', 'crowd_verified'])
        .gte('created_at', fiveMinsAgo);

      if (!error && Array.isArray(data)) {
        for (const h of data) {
          const dist = haversineDistanceMeters(lat, lng, h.latitude, h.longitude);
          if (dist <= DUPLICATE_DISTANCE_METERS) {
            return h as HazardRecord;
          }
        }
      }
    } catch {
      // ignore
    }
  }

  return null;
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
    resolved_count: 3,
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

// In-memory set for vote tracking fallback: `${hazardId}:${deviceHash}:${voteType}`
export const inMemoryVotes = new Set<string>();

// In-memory array for hazard history logging fallback
export interface HazardHistoryEntry {
  hazard_id: string;
  previous_status: string;
  new_status: string;
  changed_by?: string;
  created_at: string;
}
export const inMemoryHazardHistory: HazardHistoryEntry[] = [];

function toDbVoteType(voteType: 'confirm' | 'resolve'): 'still_there' | 'resolved' {
  return voteType === 'confirm' ? 'still_there' : 'resolved';
}

/**
 * Independent Vote Guard (FR-22, FR-23)
 * Tracks (hazard_id, device_hash, vote_type) in Supabase verification_votes
 * with fallback to in-memory set to prevent duplicate voting.
 */
async function hasDeviceVoted(
  supabase: SupabaseClient | null,
  hazardId: string,
  deviceHash: string,
  voteType: 'confirm' | 'resolve'
): Promise<boolean> {
  const dbVoteType = toDbVoteType(voteType);
  const voteKey = `${hazardId}:${deviceHash}:${dbVoteType}`;
  if (inMemoryVotes.has(voteKey)) {
    return true;
  }

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('verification_votes')
        .select('id')
        .eq('hazard_id', hazardId)
        .eq('device_hash', deviceHash)
        .eq('vote_type', dbVoteType)
        .maybeSingle();

      if (!error && data) {
        inMemoryVotes.add(voteKey);
        return true;
      }
    } catch {
      // In-memory fallback if table unavailable
    }
  }

  return false;
}

/**
 * Records a vote in verification_votes (Supabase + in-memory fallback).
 */
async function recordDeviceVote(
  supabase: SupabaseClient | null,
  hazardId: string,
  deviceHash: string,
  voteType: 'confirm' | 'resolve'
): Promise<void> {
  const dbVoteType = toDbVoteType(voteType);
  const voteKey = `${hazardId}:${deviceHash}:${dbVoteType}`;
  inMemoryVotes.add(voteKey);

  if (supabase) {
    try {
      await supabase.from('verification_votes').insert({
        hazard_id: hazardId,
        device_hash: deviceHash,
        vote_type: dbVoteType,
      });
    } catch {
      // Ignore if table unavailable
    }
  }
}

/**
 * Hazard History Logging:
 * Whenever a hazard's status changes (e.g. active -> crowd_verified or resolved),
 * insert an audit record into hazard_history (wrapped in try/catch so it never blocks the response).
 */
async function logHazardHistory(
  supabase: SupabaseClient | null,
  hazardId: string,
  previousStatus: string,
  newStatus: string,
  deviceHash?: string
): Promise<void> {
  if (previousStatus === newStatus) return;

  const entry: HazardHistoryEntry = {
    hazard_id: hazardId,
    previous_status: previousStatus,
    new_status: newStatus,
    changed_by: deviceHash || 'anonymous-device',
    created_at: new Date().toISOString(),
  };

  inMemoryHazardHistory.push(entry);

  if (supabase) {
    try {
      await supabase.from('hazard_history').insert({
        hazard_id: hazardId,
        previous_status: previousStatus,
        new_status: newStatus,
      });
    } catch {
      // Wrapped in try/catch so it never blocks the response
    }
  }
}

/**
 * Fetches hazard record for voting, checking Supabase first and falling back to in-memory mocks.
 */
async function getHazardRecordForVote(
  supabase: SupabaseClient | null,
  hazardId: string
): Promise<{
  data: any | null;
  error?: any;
  hasConfirmationsColumn?: boolean;
  hasResolvedCountColumn?: boolean;
}> {
  if (supabase) {
    try {
      const fetched = await fetchHazardById(supabase, hazardId);
      if (!fetched.error && fetched.data) {
        return {
          data: fetched.data,
          hasConfirmationsColumn: fetched.hasConfirmationsColumn,
          hasResolvedCountColumn: fetched.hasResolvedCountColumn,
        };
      }
      if (fetched.error && fetched.error.code !== '22P02') {
        const mockMatch = mockHazards.find((h) => h.id === hazardId);
        if (mockMatch) {
          return { data: mockMatch };
        }
        return { data: null, error: fetched.error };
      }
    } catch {
      // Fall through to mock search
    }
  }

  const mockMatch = mockHazards.find((h) => h.id === hazardId);
  return { data: mockMatch || null };
}

function confirmMockHazard(hazardId: string, trustWeight = 1): HazardRecord | null {
  const index = mockHazards.findIndex((h) => h.id === hazardId);
  if (index === -1) {
    return null;
  }

  const existing = mockHazards[index];
  const newConfirmations = (existing.confirmations || 1) + trustWeight;
  const updatedHazard: HazardRecord = {
    ...existing,
    confirmations: newConfirmations,
    status: newConfirmations >= 3 ? 'crowd_verified' : existing.status,
  };

  mockHazards[index] = updatedHazard;
  return updatedHazard;
}

function resolveMockHazard(
  hazardId: string,
  existingRecord?: any,
  nextResolvedCount?: number,
  nextStatus?: 'active' | 'crowd_verified' | 'resolved',
  trustWeight = 1
): HazardRecord | null {
  const index = mockHazards.findIndex((h) => h.id === hazardId);
  if (index !== -1) {
    const existing = mockHazards[index];
    const nextResolved =
      nextResolvedCount ?? (existing.resolved_count || 0) + trustWeight;
    const status = nextStatus ?? (nextResolved >= 3 ? 'resolved' : existing.status);
    const updatedHazard: HazardRecord = {
      ...existing,
      resolved_count: nextResolved,
      status,
    };
    mockHazards[index] = updatedHazard;
    return updatedHazard;
  }

  if (existingRecord) {
    const nextResolved =
      nextResolvedCount ?? (existingRecord.resolved_count || 0) + trustWeight;
    const status =
      nextStatus ?? (nextResolved >= 3 ? 'resolved' : (existingRecord.status || 'active'));
    const updatedHazard: HazardRecord = {
      ...existingRecord,
      resolved_count: nextResolved,
      status,
    };
    mockHazards.unshift(updatedHazard);
    return updatedHazard;
  }

  return null;
}

const handleConfirmHazard = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id || typeof id !== 'string' || id.trim() === '') {
      return res.status(400).json({ error: 'Hazard ID is required.' });
    }

    const hazardId = id.trim();
    const { userLat, userLng, demoBypass, trustWeight: rawWeight } = req.body || {};
    const isDemoBypass = demoBypass === true;

    const rawDeviceHash = req.headers['x-device-hash'];
    const deviceHash =
      typeof rawDeviceHash === 'string' && rawDeviceHash.trim()
        ? rawDeviceHash.trim()
        : (req.ip as string) || req.socket?.remoteAddress || 'anonymous-device';

    const trustWeight =
      typeof rawWeight === 'number' && !isNaN(rawWeight) && rawWeight > 0
        ? Math.round(rawWeight)
        : 1;

    const supabase = getSupabaseClient();

    // 1. Fetch hazard to verify existence and get coordinates & current status
    const recordResult = await getHazardRecordForVote(supabase, hazardId);
    if (recordResult.error && !recordResult.data) {
      return res.status(500).json({ error: recordResult.error.message });
    }
    if (!recordResult.data) {
      return res.status(404).json({ error: 'Hazard not found' });
    }

    const existingRecord = recordResult.data;

    // 2. 150m Proximity Check (FR-22)
    const userLatNum =
      typeof userLat === 'number'
        ? userLat
        : typeof userLat === 'string' && userLat.trim() !== ''
        ? Number(userLat)
        : NaN;

    const userLngNum =
      typeof userLng === 'number'
        ? userLng
        : typeof userLng === 'string' && userLng.trim() !== ''
        ? Number(userLng)
        : NaN;

    const hasUserCoords =
      !isNaN(userLatNum) &&
      isFinite(userLatNum) &&
      !isNaN(userLngNum) &&
      isFinite(userLngNum);

    if (hasUserCoords && !isDemoBypass) {
      const distance = haversineDistanceMeters(
        userLatNum,
        userLngNum,
        existingRecord.latitude,
        existingRecord.longitude
      );
      if (distance > 150) {
        return res.status(403).json({
          error:
            'You must be within 150m of the hazard to vote (enable Demo Mode for remote testing).',
        });
      }
    }

    // 3. Independent Vote Guard (FR-22, FR-23)
    if (!isDemoBypass) {
      const alreadyVoted = await hasDeviceVoted(
        supabase,
        hazardId,
        deviceHash,
        'confirm'
      );
      if (alreadyVoted) {
        return res.status(409).json({
          error: 'You have already voted on this hazard.',
        });
      }
    }

    const oldStatus: string = existingRecord.status;
    const newConfirmations = (existingRecord.confirmations || 1) + trustWeight;
    const shouldVerify = newConfirmations >= 3;
    const nextStatus: HazardRecord['status'] = shouldVerify
      ? 'crowd_verified'
      : (existingRecord.status as HazardRecord['status']);

    // 4. Update in Supabase or in-memory mock
    if (
      supabase &&
      typeof existingRecord.id === 'string' &&
      !existingRecord.id.startsWith('d0000000-')
    ) {
      try {
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
          recordResult.hasConfirmationsColumn ?? true,
          existingRecord,
          {
            confirmations: newConfirmations,
            resolved_count: existingRecord.resolved_count ?? 0,
            status: nextStatus,
          }
        );

        if (!updated.error && updated.data) {
          await recordDeviceVote(supabase, hazardId, deviceHash, 'confirm');
          if (oldStatus !== updated.data.status) {
            await logHazardHistory(
              supabase,
              hazardId,
              oldStatus,
              updated.data.status,
              deviceHash
            );
          }
          return res.status(200).json(updated.data);
        }
      } catch {
        // Fall back to mock update
      }
    }

    const mockResult = confirmMockHazard(hazardId, trustWeight);
    if (!mockResult) {
      return res.status(404).json({ error: 'Hazard not found' });
    }

    await recordDeviceVote(supabase, hazardId, deviceHash, 'confirm');
    if (oldStatus !== mockResult.status) {
      await logHazardHistory(
        supabase,
        hazardId,
        oldStatus,
        mockResult.status,
        deviceHash
      );
    }

    return res.status(200).json(mockResult);
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
    const { userLat, userLng, demoBypass, trustWeight: rawWeight } = req.body || {};
    const isDemoBypass = demoBypass === true;

    const rawDeviceHash = req.headers['x-device-hash'];
    const deviceHash =
      typeof rawDeviceHash === 'string' && rawDeviceHash.trim()
        ? rawDeviceHash.trim()
        : (req.ip as string) || req.socket?.remoteAddress || 'anonymous-device';

    const trustWeight =
      typeof rawWeight === 'number' && !isNaN(rawWeight) && rawWeight > 0
        ? Math.round(rawWeight)
        : 1;

    const supabase = getSupabaseClient();

    // 1. Fetch hazard to verify existence and get coordinates & current status
    const recordResult = await getHazardRecordForVote(supabase, hazardId);
    if (recordResult.error && !recordResult.data) {
      return res.status(500).json({ error: recordResult.error.message });
    }
    if (!recordResult.data) {
      return res.status(404).json({ error: 'Hazard not found' });
    }

    const existingRecord = recordResult.data;

    // 2. 150m Proximity Check (FR-22)
    const userLatNum =
      typeof userLat === 'number'
        ? userLat
        : typeof userLat === 'string' && userLat.trim() !== ''
        ? Number(userLat)
        : NaN;

    const userLngNum =
      typeof userLng === 'number'
        ? userLng
        : typeof userLng === 'string' && userLng.trim() !== ''
        ? Number(userLng)
        : NaN;

    const hasUserCoords =
      !isNaN(userLatNum) &&
      isFinite(userLatNum) &&
      !isNaN(userLngNum) &&
      isFinite(userLngNum);

    if (hasUserCoords && !isDemoBypass) {
      const distance = haversineDistanceMeters(
        userLatNum,
        userLngNum,
        existingRecord.latitude,
        existingRecord.longitude
      );
      if (distance > 150) {
        return res.status(403).json({
          error:
            'You must be within 150m of the hazard to vote (enable Demo Mode for remote testing).',
        });
      }
    }

    // 3. Independent Vote Guard (FR-22, FR-23)
    if (!isDemoBypass) {
      const alreadyVoted = await hasDeviceVoted(
        supabase,
        hazardId,
        deviceHash,
        'resolve'
      );
      if (alreadyVoted) {
        return res.status(409).json({
          error: 'You have already voted on this hazard.',
        });
      }
    }

    // FR-24 & NFR-21: Require at least 3 crowd consensus votes to de-escalate to resolved
    const oldStatus: string = existingRecord.status;
    const nextResolved = (existingRecord.resolved_count || 0) + trustWeight;
    const shouldResolve = nextResolved >= 3;
    const nextStatus: 'active' | 'crowd_verified' | 'resolved' = shouldResolve
      ? 'resolved'
      : existingRecord.status || 'active';

    // 4. Update in Supabase or in-memory mock
    if (
      supabase &&
      typeof existingRecord.id === 'string' &&
      !existingRecord.id.startsWith('d0000000-')
    ) {
      try {
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
          recordResult.hasResolvedCountColumn ?? true,
          existingRecord,
          {
            confirmations: existingRecord.confirmations ?? 1,
            resolved_count: nextResolved,
            status: nextStatus,
          }
        );

        if (!updated.error && updated.data) {
          await recordDeviceVote(supabase, hazardId, deviceHash, 'resolve');
          if (oldStatus !== updated.data.status) {
            await logHazardHistory(
              supabase,
              hazardId,
              oldStatus,
              updated.data.status,
              deviceHash
            );
          }
          return res.status(200).json(updated.data);
        }
      } catch {
        // Fall back to mock update
      }
    }

    const mockResult = resolveMockHazard(
      hazardId,
      existingRecord,
      nextResolved,
      nextStatus,
      trustWeight
    );

    if (!mockResult) {
      return res.status(404).json({ error: 'Hazard not found' });
    }

    await recordDeviceVote(supabase, hazardId, deviceHash, 'resolve');
    if (oldStatus !== mockResult.status) {
      await logHazardHistory(
        supabase,
        hazardId,
        oldStatus,
        mockResult.status,
        deviceHash
      );
    }

    return res.status(200).json(mockResult);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Internal server error';
    return res.status(500).json({ error: message });
  }
};

/**
 * PATCH /api/hazards/:id/confirm
 * POST  /api/hazards/:id/confirm
 */
router.patch('/:id/confirm', handleConfirmHazard);
router.post('/:id/confirm', handleConfirmHazard);

/**
 * PATCH /api/hazards/:id/resolve
 * POST  /api/hazards/:id/resolve
 * Lifecycle rule: Promotes to 'resolved' at resolved_count >= 3 (FR-24, NFR-21).
 */
router.patch('/:id/resolve', handleResolveHazard);
router.post('/:id/resolve', handleResolveHazard);

/**
 * GET /api/hazards
 * Query active hazards ('active' or 'crowd_verified') ordered by created_at DESC.
 * Lazy TTL filtering: Excludes expired temporary hazards; structural hazards persist.
 */
router.get('/', async (req: Request, res: Response) => {
  const { severity, verified, lat, lng, radius } = req.query;
  const normalizedSeverity = normalizeSeverity(
    typeof severity === 'string' ? severity : undefined
  );
  const isVerifiedOnly =
    typeof verified === 'string' && verified.trim().toLowerCase() === 'true';

  const latNum =
    typeof lat === 'string' && lat.trim() !== '' ? Number(lat) : NaN;
  const lngNum =
    typeof lng === 'string' && lng.trim() !== '' ? Number(lng) : NaN;
  const radiusNum =
    typeof radius === 'string' && radius.trim() !== '' && Number(radius) > 0
      ? Math.round(Number(radius))
      : 2000;
  const hasSpatialParams =
    !isNaN(latNum) && isFinite(latNum) && !isNaN(lngNum) && isFinite(lngNum);

  try {
    const supabase = getSupabaseClient();
    if (supabase) {
      // NFR-15: Use PostGIS 2km spatial RPC when lat & lng query params are provided
      if (hasSpatialParams) {
        try {
          const rpcResult: any = await supabase.rpc('get_nearby_hazards', {
            user_lat: latNum,
            user_lng: lngNum,
            radius_meters: radiusNum,
          });
          if (!rpcResult.error && Array.isArray(rpcResult.data)) {
            let nearby = filterActiveAndUnexpired(rpcResult.data as HazardRecord[]);
            if (isVerifiedOnly) {
              nearby = nearby.filter((h) => h.status === 'crowd_verified');
            }
            if (normalizedSeverity) {
              nearby = nearby.filter(
                (h) => h.severity.toLowerCase() === normalizedSeverity.toLowerCase()
              );
            }
            const mapped = nearby.map((h) => ({
              ...h,
              confirmations: h.confirmations ?? 1,
              resolved_count: h.resolved_count ?? 0,
            }));
            return res.status(200).json(mapped);
          }
        } catch {
          // Fall back to standard query below if RPC fails or is unavailable
        }
      }

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
 * Creates a new hazard record with rate-limiting, anti-spam, and 20m duplicate checks.
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    // 1. Rate Limiting Check (FR-02, NFR-08: Max 3 reports per 10 minutes per device)
    const deviceToken =
      (req.headers['x-device-hash'] as string) ||
      req.ip ||
      req.socket.remoteAddress ||
      'anonymous-device';

    if (!checkRateLimit(deviceToken)) {
      return res.status(429).json({
        error:
          'Rate limit exceeded: maximum 3 hazard reports per 10 minutes allowed per device token.',
      });
    }

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

    // 2. Anti-Spam / Abusive Content Filter (FR-12)
    if (isSpamOrAbusive(landmark_context) || isSpamOrAbusive(sub_tag)) {
      return res.status(400).json({
        error:
          'Report rejected: content flagged as spam, repetitive gibberish, or abusive language.',
      });
    }

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

    // 3. Duplicate Check (FR-12: Reject duplicate of same category within 20m in last 5 minutes)
    const duplicate = await findRecentDuplicateHazard(
      supabase,
      category as HazardCategory,
      latitude,
      longitude
    );

    if (duplicate) {
      return res.status(409).json({
        error:
          'Duplicate report: an active hazard of the same category was already reported within 20 meters in the last 5 minutes.',
        existingHazardId: duplicate.id,
      });
    }

    // 4. Persistence into Supabase with multi-tier schema fallback
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
          // Best-effort persistence into device_tokens & report_media (never blocks response)
          try {
            const { data: existingToken } = await supabase
              .from('device_tokens')
              .select('report_count')
              .eq('token_hash', deviceToken)
              .maybeSingle();
            const nextTokenCount = ((existingToken as any)?.report_count ?? 0) + 1;
            await supabase.from('device_tokens').upsert(
              {
                token_hash: deviceToken,
                report_count: nextTokenCount,
                last_report_at: new Date().toISOString(),
              },
              { onConflict: 'token_hash' }
            );
          } catch {
            // Non-fatal if device_tokens table unavailable
          }

          if (image_url && typeof image_url === 'string' && image_url.trim()) {
            try {
              await supabase.from('report_media').insert({
                hazard_id: result.data.id,
                media_type: 'photo',
                storage_url: image_url.trim(),
              });
            } catch {
              // Non-fatal if report_media table unavailable
            }
          }

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

    // In-memory fallback if Supabase is offline
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
