import {
  createClient,
  type RealtimeChannel,
  type SupabaseClient,
} from '@supabase/supabase-js';
import type { HazardRecord } from '../../../../packages/shared/api-contract';

export type HazardRealtimeEventType = 'INSERT' | 'UPDATE';

let realtimeClient: SupabaseClient | null = null;

function getRealtimeClient(): SupabaseClient | null {
  if (realtimeClient) {
    return realtimeClient;
  }

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  try {
    realtimeClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
    return realtimeClient;
  } catch {
    return null;
  }
}

function isValidHazardRow(row: unknown): row is HazardRecord {
  if (!row || typeof row !== 'object') return false;
  const candidate = row as Partial<HazardRecord>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.category === 'string' &&
    typeof candidate.latitude === 'number' &&
    typeof candidate.longitude === 'number'
  );
}

/**
 * Architecture Section 2.2: Subscribes to Supabase Realtime WebSocket
 * postgres_changes (INSERT, UPDATE) on the public `hazards` table so MapScreen
 * pins update live without manual refresh. Gracefully no-ops if env vars are unset.
 */
export function subscribeToHazardChanges(
  onHazardChange: (
    eventType: HazardRealtimeEventType,
    hazard: HazardRecord,
  ) => void,
): () => void {
  const client = getRealtimeClient();
  if (!client) {
    return () => {};
  }

  let channel: RealtimeChannel | null = null;

  try {
    channel = client
      .channel('golisafe-hazards-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'hazards' },
        (payload) => {
          if (isValidHazardRow(payload.new)) {
            onHazardChange('INSERT', payload.new);
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'hazards' },
        (payload) => {
          if (isValidHazardRow(payload.new)) {
            onHazardChange('UPDATE', payload.new);
          }
        },
      )
      .subscribe();
  } catch {
    return () => {};
  }

  return () => {
    if (channel) {
      try {
        client.removeChannel(channel);
      } catch {
        // Ignore cleanup errors
      }
    }
  };
}
