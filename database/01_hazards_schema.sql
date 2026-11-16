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
  confirmations INT DEFAULT 1,
  resolved_count INT DEFAULT 0,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '12 hours'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migration helper for existing databases
ALTER TABLE hazards ADD COLUMN IF NOT EXISTS confirmations INT DEFAULT 1;

-- Create spatial GIST index on geography location column
CREATE INDEX IF NOT EXISTS idx_hazards_location ON hazards USING GIST (location);

-- Lifecycle & TTL migration helpers
ALTER TABLE hazards ADD COLUMN IF NOT EXISTS resolved_count INT DEFAULT 0;
ALTER TABLE hazards ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '12 hours');
