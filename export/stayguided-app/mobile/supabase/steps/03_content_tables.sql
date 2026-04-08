-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  StayGuided Me — Step 3 of 8                                    ║
-- ║  CONTENT TABLES                                                 ║
-- ║  ✅ Depends on: Step 2 (profiles, badges)                       ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- ═══════════════════════════════════════════════════════════════════
-- PART 3: CONTENT TABLES (admin panel manages these)
-- ═══════════════════════════════════════════════════════════════════

-- ─── CATEGORIES ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.categories (
  id                UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name              TEXT NOT NULL,
  name_arabic       TEXT,
  slug              TEXT UNIQUE NOT NULL,
  icon_url          TEXT,
  cover_url         TEXT,
  description       TEXT,
  order_index       INTEGER DEFAULT 0,
  is_active         BOOLEAN DEFAULT true,
  guest_access      BOOLEAN DEFAULT false,
  free_user_access  BOOLEAN DEFAULT true,
  premium_required  BOOLEAN DEFAULT false,
  show_in_home      BOOLEAN DEFAULT true,
  is_featured       BOOLEAN DEFAULT false,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Categories readable by all" ON public.categories FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DROP POLICY IF EXISTS "Service role manages categories" ON public.categories;
CREATE POLICY "Service role manages categories" ON public.categories
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── RECITERS ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reciters (
  id                    UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name_english          TEXT NOT NULL,
  name_arabic           TEXT,
  photo_url             TEXT,
  bio                   TEXT,
  streaming_source_id   TEXT,
  download_source_id    TEXT,
  api_reciter_id        TEXT,
  streaming_bitrate     INTEGER DEFAULT 128,
  download_bitrate      INTEGER DEFAULT 192,
  supports_ayah_level   BOOLEAN DEFAULT false,
  timing_source         TEXT,
  fallback_reciter_id   UUID REFERENCES public.reciters(id),
  is_active             BOOLEAN DEFAULT true,
  is_default            BOOLEAN DEFAULT false,
  order_index           INTEGER DEFAULT 0,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.reciters ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Reciters readable by all" ON public.reciters FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DROP POLICY IF EXISTS "Service role manages reciters" ON public.reciters;
CREATE POLICY "Service role manages reciters" ON public.reciters
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── SERIES ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.series (
  id                   UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title                TEXT NOT NULL,
  cover_url            TEXT,
  banner_url           TEXT,
  category_id          UUID REFERENCES public.categories(id),
  language             TEXT DEFAULT 'en',
  description          TEXT,
  short_summary        TEXT,
  tags                 TEXT[],
  is_premium           BOOLEAN DEFAULT false,
  is_featured          BOOLEAN DEFAULT false,
  pub_status           TEXT DEFAULT 'draft' CHECK (pub_status IN ('draft','under_review','approved','scheduled','published','unpublished')),
  scheduled_publish_at TIMESTAMPTZ,
  episode_count        INTEGER DEFAULT 0,
  total_duration       INTEGER DEFAULT 0,
  play_count           INTEGER DEFAULT 0,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.series ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Series readable by all" ON public.series FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DROP POLICY IF EXISTS "Service role manages series" ON public.series;
CREATE POLICY "Service role manages series" ON public.series
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── EPISODES ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.episodes (
  id                   UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  series_id            UUID REFERENCES public.series(id) ON DELETE CASCADE,
  episode_number       INTEGER NOT NULL DEFAULT 1,
  title                TEXT NOT NULL,
  short_summary        TEXT,
  description          TEXT,
  audio_url            TEXT,
  duration             INTEGER DEFAULT 0,
  transcript           TEXT,
  episode_references   TEXT,
  key_lessons          TEXT,
  is_premium           BOOLEAN DEFAULT false,
  pub_status           TEXT DEFAULT 'published' CHECK (pub_status IN ('draft','under_review','approved','scheduled','published','unpublished')),
  scheduled_publish_at TIMESTAMPTZ,
  language             TEXT DEFAULT 'en',
  cover_override_url   TEXT,
  play_count           INTEGER DEFAULT 0,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.episodes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Episodes readable by all" ON public.episodes FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DROP POLICY IF EXISTS "Service role manages episodes" ON public.episodes;
CREATE POLICY "Service role manages episodes" ON public.episodes
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── CONTENT REPORTS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.content_reports (
  id           UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  content_id   TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('episode','series')),
  reporter_id  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason       TEXT NOT NULL CHECK (reason IN ('incorrect_info','poor_audio','misleading','inappropriate','copyright','other')),
  description  TEXT,
  status       TEXT DEFAULT 'pending' CHECK (status IN ('pending','reviewing','resolved','dismissed')),
  reviewed_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users can create reports" ON public.content_reports
    FOR INSERT WITH CHECK (auth.uid() = reporter_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Users see own reports" ON public.content_reports
    FOR SELECT USING (auth.uid() = reporter_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DROP POLICY IF EXISTS "Service role manages reports" ON public.content_reports;
CREATE POLICY "Service role manages reports" ON public.content_reports
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── JOURNEY CHAPTERS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.journey_chapters (
  id                  UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  chapter_number      INTEGER NOT NULL,
  title               TEXT NOT NULL,
  subtitle            TEXT,
  era_label           TEXT,
  description         TEXT,
  cover_url           TEXT,
  series_id           UUID REFERENCES public.series(id),
  is_published        BOOLEAN DEFAULT false,
  show_coming_soon    BOOLEAN DEFAULT true,
  estimated_release   TEXT,
  order_index         INTEGER DEFAULT 0,
  episode_count       INTEGER DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(chapter_number)
);
ALTER TABLE public.journey_chapters ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Journey chapters readable by all" ON public.journey_chapters FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DROP POLICY IF EXISTS "Service role manages journey chapters" ON public.journey_chapters;
CREATE POLICY "Service role manages journey chapters" ON public.journey_chapters
  FOR ALL TO service_role USING (true) WITH CHECK (true);


SELECT '✅ Step 3 done: Content Tables' AS result;
