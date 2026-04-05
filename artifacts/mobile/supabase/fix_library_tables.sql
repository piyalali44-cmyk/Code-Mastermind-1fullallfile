-- Fix Library Tables: favourites, bookmarks, downloads
-- Run this in Supabase SQL Editor if library items aren't syncing

-- ─── FAVOURITES ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.favourites (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('surah', 'episode', 'series')),
  content_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  series_name TEXT,
  cover_color TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, content_type, content_id)
);
ALTER TABLE public.favourites ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users manage own favourites" ON public.favourites
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT ALL ON public.favourites TO authenticated;
GRANT ALL ON public.favourites TO service_role;

-- ─── BOOKMARKS ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bookmarks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('surah', 'episode', 'series')),
  content_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  series_name TEXT,
  cover_color TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, content_type, content_id)
);
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users manage own bookmarks" ON public.bookmarks
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT ALL ON public.bookmarks TO authenticated;
GRANT ALL ON public.bookmarks TO service_role;

-- ─── DOWNLOADS ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.downloads (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('surah', 'episode')),
  content_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  file_size_bytes INTEGER,
  downloaded_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, content_type, content_id)
);
ALTER TABLE public.downloads ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users manage own downloads" ON public.downloads
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT ALL ON public.downloads TO authenticated;
GRANT ALL ON public.downloads TO service_role;
