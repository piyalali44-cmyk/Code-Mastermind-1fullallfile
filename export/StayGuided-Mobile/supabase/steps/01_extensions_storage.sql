-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  StayGuided Me — Step 1 of 8                                    ║
-- ║  EXTENSIONS + STORAGE BUCKETS + AVATAR POLICIES                 ║
-- ║  ✅ No table dependencies — safe to run first on a fresh DB     ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- ─── EXTENSIONS ───────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ─── STORAGE: AVATARS BUCKET ──────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars', 'avatars', true, 5242880,
  ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/gif'];

-- ─── STORAGE: CONTENT-ASSETS BUCKET ──────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'content-assets', 'content-assets', true, 5242880,
  ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/gif','image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/gif','image/svg+xml'];

-- ─── AVATAR POLICIES (only uses auth.uid(), no profiles table) ────
DROP POLICY IF EXISTS "Avatar images are publicly readable" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own avatar"         ON storage.objects;
DROP POLICY IF EXISTS "Users can update own avatar"         ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own avatar"         ON storage.objects;

CREATE POLICY "Avatar images are publicly readable"
  ON storage.objects FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid() IS NOT NULL
    AND auth.uid()::text = split_part(name, '/', 1)
  );

CREATE POLICY "Users can update own avatar"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND auth.uid() IS NOT NULL
    AND auth.uid()::text = split_part(name, '/', 1)
  );

CREATE POLICY "Users can delete own avatar"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND auth.uid() IS NOT NULL
    AND auth.uid()::text = split_part(name, '/', 1)
  );

-- ─── CONTENT-ASSETS: PUBLIC READ (no profiles dependency) ─────────
DROP POLICY IF EXISTS "Content assets are publicly readable" ON storage.objects;

CREATE POLICY "Content assets are publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'content-assets');

-- ⚠️  Admin write policies for content-assets are in Step 2
--     (they reference public.profiles which doesn't exist yet)

SELECT '✅ Step 1 done: Extensions, Storage Buckets & Avatar Policies' AS result;
