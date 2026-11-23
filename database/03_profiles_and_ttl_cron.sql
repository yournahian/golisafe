-- 1. Ensure hazards status constraint supports lifecycle statuses including 'expired'
ALTER TABLE hazards DROP CONSTRAINT IF EXISTS hazards_status_check;
ALTER TABLE hazards ADD CONSTRAINT hazards_status_check CHECK (
  status IN ('active', 'pending', 'verified', 'crowd_verified', 'resolved', 'expired')
);

-- 2. Create user profiles table with trust score & report counter
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY,
  email TEXT,
  display_name TEXT,
  trust_score INT DEFAULT 10,
  reports_count INT DEFAULT 0,
  is_trusted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security on profiles (backend service_role bypasses RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 3. Idempotent SQL function to expire old hazards past their TTL
CREATE OR REPLACE FUNCTION public.expire_old_hazards()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.hazards
  SET status = 'expired'
  WHERE expires_at < NOW()
    AND status IN ('active', 'pending', 'crowd_verified');
END;
$$;

-- 4. Safely schedule hourly pg_cron job if pg_cron extension is enabled
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire-old-hazards-hourly') THEN
      PERFORM cron.schedule(
        'expire-old-hazards-hourly',
        '0 * * * *',
        $cron$SELECT public.expire_old_hazards();$cron$
      );
    END IF;
  END IF;
END;
$$;

-- 5. Create public Supabase Storage bucket 'hazard-images'
-- Dashboard alternative: Storage -> New bucket -> Name: 'hazard-images' -> Public: ON
INSERT INTO storage.buckets (id, name, public)
VALUES ('hazard-images', 'hazard-images', TRUE)
ON CONFLICT (id) DO UPDATE SET public = TRUE;
