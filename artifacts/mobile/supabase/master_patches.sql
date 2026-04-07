-- master_patches.sql
-- Applied automatically by the API server on startup via the Management API.
-- All statements must be idempotent (use IF NOT EXISTS / OR REPLACE etc).

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS first_active_at TIMESTAMPTZ;
