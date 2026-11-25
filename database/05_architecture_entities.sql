-- ============================================================================
-- 05_architecture_entities.sql
-- Core architecture entities (device_tokens, verification_votes, report_media,
-- hazard_history) and Supabase Realtime publication on hazards
-- ============================================================================

-- 1. Anonymous device rate-limiting / anti-abuse tokens
CREATE TABLE IF NOT EXISTS device_tokens (
  token_hash TEXT PRIMARY KEY,
  report_count INT DEFAULT 0,
  last_report_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days')
);

ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;

-- 2. Crowd-verification & resolution votes (deduplicated per device & vote type)
CREATE TABLE IF NOT EXISTS verification_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hazard_id UUID REFERENCES hazards(id) ON DELETE CASCADE,
  device_hash TEXT NOT NULL,
  vote_type TEXT CHECK (vote_type IN ('still_there', 'resolved')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (hazard_id, device_hash, vote_type)
);

CREATE INDEX IF NOT EXISTS idx_verification_votes_hazard_id
  ON verification_votes (hazard_id);

ALTER TABLE verification_votes ENABLE ROW LEVEL SECURITY;

-- 3. Attached photo & voice media metadata with 30-day purge TTL
CREATE TABLE IF NOT EXISTS report_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hazard_id UUID REFERENCES hazards(id) ON DELETE CASCADE,
  media_type TEXT CHECK (media_type IN ('photo', 'voice')),
  storage_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  purge_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days')
);

CREATE INDEX IF NOT EXISTS idx_report_media_hazard_id
  ON report_media (hazard_id);

ALTER TABLE report_media ENABLE ROW LEVEL SECURITY;

-- 4. Hazard lifecycle audit log
CREATE TABLE IF NOT EXISTS hazard_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hazard_id UUID REFERENCES hazards(id) ON DELETE CASCADE,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hazard_history_hazard_id
  ON hazard_history (hazard_id);

ALTER TABLE hazard_history ENABLE ROW LEVEL SECURITY;

-- 5. Safely enable Supabase Realtime on hazards table (idempotent)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'hazards'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE hazards;
    END IF;
  END IF;
END;
$$;

-- 6. FR-04: Device trust score & spam throttling columns on device_tokens (idempotent)
ALTER TABLE device_tokens ADD COLUMN IF NOT EXISTS trust_score INT DEFAULT 10;
ALTER TABLE device_tokens ADD COLUMN IF NOT EXISTS spam_strikes INT DEFAULT 0;
