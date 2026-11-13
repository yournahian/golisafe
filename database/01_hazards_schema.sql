-- Enable PostGIS extension for geospatial queries
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create hazards table matching HazardRecord in packages/shared/api-contract.ts
CREATE TABLE IF NOT EXISTS hazards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL CHECK (
    category IN (
      'pothole_manhole',
      'waterlogging',
      'unlit_alley',
      'unsafe_footbridge',
      'extortion_spot'
    )
  ),
  severity TEXT NOT NULL DEFAULT 'Medium' CHECK (
    severity IN ('Low', 'Medium', 'Critical')
  ),
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  location GEOGRAPHY(POINT, 4326) GENERATED ALWAYS AS (
    ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
  ) STORED,
  landmark_context TEXT,
  sub_tag TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (
    status IN ('active', 'crowd_verified', 'resolved')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create spatial GIST index on geography location column
CREATE INDEX IF NOT EXISTS idx_hazards_location ON hazards USING GIST (location);
