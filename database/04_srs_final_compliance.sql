-- ============================================================================
-- 04_srs_final_compliance.sql
-- SRS FR-24, NFR-15, NFR-21 & Public Storage Upload Policies
-- ============================================================================

-- 1. Update expire_old_hazards() per SRS FR-24 & NFR-21:
--    ONLY expire temporary hazards (waterlogging, extortion_spot, unlit_alley)
--    when expires_at < NOW(). Structural hazards (pothole_manhole,
--    unsafe_footbridge) remain active until community-resolved.
CREATE OR REPLACE FUNCTION public.expire_old_hazards()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.hazards
  SET status = 'expired'
  WHERE expires_at < NOW()
    AND status IN ('active', 'pending', 'crowd_verified')
    AND category IN ('waterlogging', 'extortion_spot', 'unlit_alley');
END;
$$;

-- 2. Idempotent PostGIS RPC function per SRS NFR-15:
--    Returns active hazards within radius_meters (default 2000m / 2km)
--    using ST_DWithin on the indexed geography location column.
CREATE OR REPLACE FUNCTION public.get_nearby_hazards(
  user_lat DOUBLE PRECISION,
  user_lng DOUBLE PRECISION,
  radius_meters INT DEFAULT 2000
)
RETURNS SETOF public.hazards
LANGUAGE sql
STABLE
AS $$
  SELECT h.*
  FROM public.hazards AS h
  WHERE h.status IN ('active', 'pending', 'verified', 'crowd_verified')
    AND ST_DWithin(
      h.location,
      ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
      radius_meters
    )
  ORDER BY ST_Distance(
    h.location,
    ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography
  ) ASC;
$$;

-- 3. Ensure public Supabase Storage bucket 'hazard-images' exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('hazard-images', 'hazard-images', TRUE)
ON CONFLICT (id) DO UPDATE SET public = TRUE;

-- 4. Idempotent Storage RLS policies on storage.objects for 'hazard-images'
--    Allow public SELECT and INSERT so mobile clients can upload/view photo
--    evidence directly without auth errors.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Public read access for hazard-images'
  ) THEN
    CREATE POLICY "Public read access for hazard-images"
      ON storage.objects
      FOR SELECT
      TO anon, authenticated
      USING (bucket_id = 'hazard-images');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Public upload access for hazard-images'
  ) THEN
    CREATE POLICY "Public upload access for hazard-images"
      ON storage.objects
      FOR INSERT
      TO anon, authenticated
      WITH CHECK (bucket_id = 'hazard-images');
  END IF;
END;
$$;
