-- ============================================================
-- 11_storage_public.sql
-- Make content-assets bucket public so mobile app can load images
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Create bucket if it doesn't exist (or make existing one public)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'content-assets',
  'content-assets',
  true,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE
  SET public = true,
      file_size_limit = 5242880;

-- 2. Drop old policies (ignore errors if they don't exist)
DROP POLICY IF EXISTS "Public read content-assets" ON storage.objects;
DROP POLICY IF EXISTS "Admins upload content-assets" ON storage.objects;
DROP POLICY IF EXISTS "Admins delete content-assets" ON storage.objects;

-- 3. Allow everyone (including mobile app) to read uploaded images
CREATE POLICY "Public read content-assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'content-assets');

-- 4. Allow authenticated admin users to upload
CREATE POLICY "Admins upload content-assets"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'content-assets'
    AND auth.role() = 'authenticated'
  );

-- 5. Allow authenticated admin users to delete
CREATE POLICY "Admins delete content-assets"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'content-assets'
    AND auth.role() = 'authenticated'
  );

-- Verify
SELECT id, name, public FROM storage.buckets WHERE id = 'content-assets';
