-- ╔════════════════════════════════════════════════════════════════════╗
-- ║  StayGuided Me — COMPLETE DATABASE SETUP (FINAL)                  ║
-- ║  Combines full_setup.sql + all migration patches                  ║
-- ║  Run this ONCE in Supabase Dashboard → SQL Editor → New Query     ║
-- ║  Safe to re-run — everything is idempotent (IF NOT EXISTS, etc.)  ║
-- ║  Project: tkruzfskhtcazjxdracm                                    ║
-- ╚════════════════════════════════════════════════════════════════════╝

-- ═══════════════════════════════════════════════════════════════════
-- PART 1: EXTENSIONS & STORAGE
-- ═══════════════════════════════════════════════════════════════════
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ─── STORAGE: AVATARS BUCKET ────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880,
  ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/gif'];

DROP POLICY IF EXISTS "Avatar images are publicly readable" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own avatar" ON storage.objects;

CREATE POLICY "Avatar images are publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

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

-- ─── STORAGE: CONTENT-ASSETS BUCKET ──────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'content-assets',
  'content-assets',
  true,
  5242880,
  ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/gif','image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/gif','image/svg+xml'];

DROP POLICY IF EXISTS "Content assets are publicly readable" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload content assets" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update content assets" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete content assets" ON storage.objects;

CREATE POLICY "Content assets are publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'content-assets');

CREATE POLICY "Admins can upload content assets"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'content-assets'
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin', 'editor', 'content')
      AND is_active = true
    )
  );

CREATE POLICY "Admins can update content assets"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'content-assets'
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin', 'editor', 'content')
      AND is_active = true
    )
  );

CREATE POLICY "Admins can delete content assets"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'content-assets'
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin', 'editor', 'content')
      AND is_active = true
    )
  );

-- ═══════════════════════════════════════════════════════════════════
-- PART 2: CORE USER TABLES (mobile app)
-- ═══════════════════════════════════════════════════════════════════

-- ─── PROFILES ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id                      UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  display_name            TEXT,
  email                   TEXT,
  avatar_url              TEXT,
  bio                     TEXT,
  country                 TEXT,
  referral_code           TEXT UNIQUE,
  joined_at               TIMESTAMPTZ DEFAULT NOW(),
  subscription_tier       TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free','premium')),
  subscription_expires_at TIMESTAMPTZ,
  is_active               BOOLEAN DEFAULT true,
  role                    TEXT DEFAULT 'user' CHECK (role IN ('user','support','content','editor','admin','super_admin')),
  is_blocked              BOOLEAN DEFAULT false,
  blocked_reason          TEXT,
  last_active_at          TIMESTAMPTZ,
  login_provider          TEXT DEFAULT 'email',
  total_listening_hours   NUMERIC(10,2) DEFAULT 0,
  push_token              TEXT,
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Public profiles are viewable" ON public.profiles FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- If upgrading an existing database, add push_token column if missing
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS push_token TEXT;

-- ─── USER SETTINGS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  quran_reciter TEXT DEFAULT 'ar.alafasy',
  quran_translation_edition TEXT DEFAULT 'en.asad',
  quran_show_arabic BOOLEAN DEFAULT true,
  quran_show_translation BOOLEAN DEFAULT true,
  autoplay BOOLEAN DEFAULT true,
  background_play BOOLEAN DEFAULT true,
  download_wifi_only BOOLEAN DEFAULT true,
  notifications_enabled BOOLEAN DEFAULT true,
  streak_reminder BOOLEAN DEFAULT true,
  auto_scroll               BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users manage own settings" ON public.user_settings FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── XP & LEVELS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_xp (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  total_xp INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.user_xp ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "XP readable by all" ON public.user_xp FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Users manage own xp" ON public.user_xp FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── STREAKS ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_streaks (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_activity_date DATE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.user_streaks ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Streaks readable by all" ON public.user_streaks FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Users manage own streaks" ON public.user_streaks FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── BADGES ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.badges (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  xp_reward INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_badges (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id UUID REFERENCES public.badges(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, badge_id)
);
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "User badges readable by all" ON public.user_badges FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Users earn own badges" ON public.user_badges FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── LISTENING PROGRESS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.listening_progress (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('surah', 'episode')),
  content_id TEXT NOT NULL,
  position_ms INTEGER DEFAULT 0,
  duration_ms INTEGER DEFAULT 0,
  completed BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, content_type, content_id)
);
ALTER TABLE public.listening_progress ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users manage own progress" ON public.listening_progress FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── LISTENING HISTORY ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.listening_history (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('surah', 'episode')),
  content_id TEXT NOT NULL,
  series_id TEXT,
  title TEXT NOT NULL,
  series_name TEXT,
  duration_ms INTEGER DEFAULT 0,
  listened_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.listening_history ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users manage own history" ON public.listening_history FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── FAVOURITES ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.favourites (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('surah', 'episode', 'series')),
  content_id TEXT NOT NULL,
  title TEXT NOT NULL,
  series_name TEXT,
  cover_color TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, content_type, content_id)
);
ALTER TABLE public.favourites ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users manage own favourites" ON public.favourites FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── BOOKMARKS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bookmarks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('surah', 'episode', 'series')),
  content_id TEXT NOT NULL,
  title TEXT NOT NULL,
  series_name TEXT,
  cover_color TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, content_type, content_id)
);
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users manage own bookmarks" ON public.bookmarks FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── DOWNLOADS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.downloads (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('surah', 'episode')),
  content_id TEXT NOT NULL,
  title TEXT NOT NULL,
  file_size_bytes INTEGER,
  downloaded_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, content_type, content_id)
);
ALTER TABLE public.downloads ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users manage own downloads" ON public.downloads FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── JOURNEY PROGRESS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.journey_progress (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  chapter_id TEXT NOT NULL,
  chapter_number INTEGER NOT NULL,
  progress_pct INTEGER DEFAULT 0 CHECK (progress_pct >= 0 AND progress_pct <= 100),
  completed BOOLEAN DEFAULT false,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, chapter_id)
);
ALTER TABLE public.journey_progress ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users manage own journey" ON public.journey_progress FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── DAILY XP LOG ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.daily_xp_log (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  xp_amount INTEGER NOT NULL,
  reason TEXT,
  earned_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.daily_xp_log ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users view own xp log" ON public.daily_xp_log FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Users insert own xp log" ON public.daily_xp_log FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── NOTIFICATIONS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  type TEXT DEFAULT 'general',
  is_read BOOLEAN DEFAULT false,
  action_type TEXT,
  action_payload JSONB,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
DO $$ BEGIN
  ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS action_type TEXT;
  ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS action_payload JSONB;
  ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS image_url TEXT;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users manage own notifications" ON public.notifications FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── SUBSCRIPTIONS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  plan TEXT NOT NULL CHECK (plan IN ('weekly', 'monthly', 'lifetime')),
  status TEXT NOT NULL CHECK (status IN ('active', 'cancelled', 'expired', 'trial')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  provider TEXT DEFAULT 'manual',
  provider_subscription_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users view own subscription" ON public.subscriptions FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Ensure 'lifetime' plan is always allowed (idempotent patch)
ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plan_check;
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_plan_check CHECK (plan IN ('weekly', 'monthly', 'lifetime'));

-- ─── REFERRALS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  referrer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  code_used TEXT NOT NULL,
  xp_awarded_referrer INTEGER DEFAULT 500,
  xp_awarded_referred INTEGER DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users view own referrals" ON public.referrals FOR SELECT USING (auth.uid() = referrer_id OR auth.uid() = referred_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Users insert referrals" ON public.referrals FOR INSERT WITH CHECK (auth.uid() = referred_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

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

-- ═══════════════════════════════════════════════════════════════════
-- PART 4: ADMIN PANEL TABLES
-- ═══════════════════════════════════════════════════════════════════

-- ─── FEED WIDGETS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.feed_widgets (
  id               UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  zone             TEXT NOT NULL,
  widget_type      TEXT NOT NULL,
  title            TEXT,
  content          JSONB DEFAULT '{}',
  is_active        BOOLEAN DEFAULT true,
  priority         INTEGER DEFAULT 0,
  target_user_type TEXT DEFAULT 'all' CHECK (target_user_type IN ('all','guest','free','premium')),
  target_country   TEXT,
  target_language  TEXT,
  target_platform  TEXT CHECK (target_platform IN ('all','ios','android') OR target_platform IS NULL),
  starts_at        TIMESTAMPTZ,
  ends_at          TIMESTAMPTZ,
  created_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.feed_widgets ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Feed widgets readable by all" ON public.feed_widgets FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DROP POLICY IF EXISTS "Service role manages feed widgets" ON public.feed_widgets;
CREATE POLICY "Service role manages feed widgets" ON public.feed_widgets
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── QUIZZES ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.quizzes (
  id             UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title          TEXT NOT NULL,
  description    TEXT,
  category       TEXT,
  episode_id     UUID REFERENCES public.episodes(id) ON DELETE SET NULL,
  series_id      UUID REFERENCES public.series(id) ON DELETE SET NULL,
  is_active      BOOLEAN DEFAULT true,
  pass_percentage INTEGER DEFAULT 60,
  xp_reward      INTEGER DEFAULT 50,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Quizzes readable by all" ON public.quizzes FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DROP POLICY IF EXISTS "Service role manages quizzes" ON public.quizzes;
CREATE POLICY "Service role manages quizzes" ON public.quizzes
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.quiz_questions (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  quiz_id       UUID REFERENCES public.quizzes(id) ON DELETE CASCADE,
  question      TEXT NOT NULL,
  options       JSONB NOT NULL DEFAULT '[]',
  correct_index INTEGER NOT NULL DEFAULT 0,
  explanation   TEXT,
  sort_order    INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Quiz questions readable by all" ON public.quiz_questions FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DROP POLICY IF EXISTS "Service role manages quiz questions" ON public.quiz_questions;
CREATE POLICY "Service role manages quiz questions" ON public.quiz_questions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── APP SETTINGS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.app_settings (
  key          TEXT PRIMARY KEY,
  value        JSONB NOT NULL,
  description  TEXT,
  type         TEXT DEFAULT 'string' CHECK (type IN ('string','boolean','number','json')),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "App settings readable by authenticated" ON public.app_settings FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "App settings readable by anon" ON public.app_settings FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DROP POLICY IF EXISTS "Service role manages app settings" ON public.app_settings;
CREATE POLICY "Service role manages app settings" ON public.app_settings
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── ADMIN ACTIVITY LOG ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_activity_log (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  admin_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  entity_type TEXT,
  entity_id   TEXT,
  details     JSONB DEFAULT '{}',
  ip_address  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.admin_activity_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role manages activity log" ON public.admin_activity_log;
CREATE POLICY "Service role manages activity log" ON public.admin_activity_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── COUPON CODES ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.coupon_codes (
  id                     UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  code                   TEXT UNIQUE NOT NULL,
  description            TEXT,
  coupon_type            TEXT DEFAULT 'percentage' CHECK (coupon_type IN ('percentage','fixed','free_days','free_period','price_override','influencer')),
  discount_value         NUMERIC(10,2) DEFAULT 0,
  applies_to_monthly     BOOLEAN DEFAULT true,
  applies_to_weekly      BOOLEAN DEFAULT true,
  max_total_uses         INTEGER,
  max_uses_per_user      INTEGER DEFAULT 1,
  new_users_only         BOOLEAN DEFAULT false,
  first_subscription_only BOOLEAN DEFAULT false,
  is_active              BOOLEAN DEFAULT true,
  expires_at             TIMESTAMPTZ,
  influencer_name        TEXT,
  redemption_count       INTEGER DEFAULT 0,
  created_by             UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at             TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.coupon_codes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Active coupons readable by authenticated" ON public.coupon_codes
    FOR SELECT TO authenticated USING (is_active = true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DROP POLICY IF EXISTS "Service role manages coupons" ON public.coupon_codes;
CREATE POLICY "Service role manages coupons" ON public.coupon_codes
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── COUPON REDEMPTIONS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.coupon_redemptions (
  id         UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  coupon_id  UUID REFERENCES public.coupon_codes(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  redeemed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(coupon_id, user_id)
);
ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role manages redemptions" ON public.coupon_redemptions;
CREATE POLICY "Service role manages redemptions" ON public.coupon_redemptions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── FEATURE FLAGS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.feature_flags (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  key         TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  description TEXT,
  section     TEXT DEFAULT 'general',
  is_enabled  BOOLEAN DEFAULT false,
  rollout_pct INTEGER DEFAULT 100 CHECK (rollout_pct >= 0 AND rollout_pct <= 100),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Feature flags readable by authenticated" ON public.feature_flags
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Feature flags readable by anon" ON public.feature_flags
    FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DROP POLICY IF EXISTS "Service role manages feature flags" ON public.feature_flags;
CREATE POLICY "Service role manages feature flags" ON public.feature_flags
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── POPUP NOTICES ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.popup_notices (
  id               UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title            TEXT NOT NULL,
  body             TEXT,
  type             TEXT DEFAULT 'info' CHECK (type IN ('info','warning','success','promo','ramadan')),
  cta_label        TEXT,
  cta_action       TEXT,
  cta_url          TEXT,
  is_active        BOOLEAN DEFAULT false,
  target_audience  TEXT DEFAULT 'all' CHECK (target_audience IN ('all','guest','free','premium')),
  target_countries TEXT[],
  starts_at        TIMESTAMPTZ,
  ends_at          TIMESTAMPTZ,
  created_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.popup_notices ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Active popups readable by authenticated" ON public.popup_notices
    FOR SELECT TO authenticated USING (is_active = true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DROP POLICY IF EXISTS "Service role manages popups" ON public.popup_notices;
CREATE POLICY "Service role manages popups" ON public.popup_notices
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── PUSH CAMPAIGNS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.push_campaigns (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title           TEXT NOT NULL,
  body            TEXT NOT NULL,
  image_url       TEXT,
  deep_link       TEXT,
  target_type     TEXT DEFAULT 'all' CHECK (target_type IN ('all','free','premium','specific')),
  target_user_ids UUID[],
  scheduled_at    TIMESTAMPTZ,
  sent_at         TIMESTAMPTZ,
  status          TEXT DEFAULT 'draft' CHECK (status IN ('draft','scheduled','sending','sent','failed','cancelled')),
  sent_count      INTEGER DEFAULT 0,
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
DO $$ BEGIN
  ALTER TABLE public.push_campaigns ADD COLUMN IF NOT EXISTS image_url TEXT;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
ALTER TABLE public.push_campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role manages push campaigns" ON public.push_campaigns;
CREATE POLICY "Service role manages push campaigns" ON public.push_campaigns
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── DONATION SETTINGS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.donation_settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.donation_settings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Donation settings readable by all" ON public.donation_settings FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DROP POLICY IF EXISTS "Service role manages donation settings" ON public.donation_settings;
CREATE POLICY "Service role manages donation settings" ON public.donation_settings
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── API SOURCES ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.api_sources (
  id             UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name           TEXT NOT NULL,
  type           TEXT NOT NULL CHECK (type IN ('quran_audio','quran_text','translation','tafsir','hadith','prayer_times')),
  base_url       TEXT NOT NULL,
  api_key_masked TEXT,
  is_active      BOOLEAN DEFAULT true,
  is_primary     BOOLEAN DEFAULT false,
  priority       INTEGER DEFAULT 0,
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.api_sources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role manages api sources" ON public.api_sources;
CREATE POLICY "Service role manages api sources" ON public.api_sources
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── ADMIN NOTES ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_notes (
  id         UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  note       TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.admin_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role manages admin notes" ON public.admin_notes;
CREATE POLICY "Service role manages admin notes" ON public.admin_notes
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════════
-- PART 5: VIEWS & FUNCTIONS
-- ═══════════════════════════════════════════════════════════════════

-- ─── LEADERBOARD VIEW (all-time) ─────────────────────────────────
DROP VIEW IF EXISTS public.leaderboard CASCADE;
CREATE OR REPLACE VIEW public.leaderboard AS
SELECT
  p.id,
  p.display_name,
  p.avatar_url,
  p.country,
  COALESCE(x.total_xp, 0)       AS total_xp,
  COALESCE(x.level, 1)          AS level,
  COALESCE(s.current_streak, 0) AS current_streak,
  RANK() OVER (ORDER BY COALESCE(x.total_xp, 0) DESC) AS rank
FROM public.profiles p
LEFT JOIN public.user_xp x      ON p.id = x.user_id
LEFT JOIN public.user_streaks s ON p.id = s.user_id
WHERE p.is_active = true
  AND p.display_name IS NOT NULL
ORDER BY total_xp DESC;

-- ─── LEADERBOARD VIEW (weekly) ───────────────────────────────────
DROP VIEW IF EXISTS public.leaderboard_weekly CASCADE;
CREATE OR REPLACE VIEW public.leaderboard_weekly AS
SELECT
  p.id,
  p.display_name,
  p.avatar_url,
  p.country,
  COALESCE(SUM(d.xp_amount), 0)::INTEGER AS weekly_xp,
  RANK() OVER (ORDER BY COALESCE(SUM(d.xp_amount), 0) DESC) AS rank
FROM public.profiles p
LEFT JOIN public.daily_xp_log d
  ON p.id = d.user_id
  AND d.earned_at >= date_trunc('week', NOW() AT TIME ZONE 'UTC')
WHERE p.is_active = true
  AND p.display_name IS NOT NULL
GROUP BY p.id, p.display_name, p.avatar_url, p.country
ORDER BY weekly_xp DESC;

-- ─── LEADERBOARD VIEW (monthly) ──────────────────────────────────
DROP VIEW IF EXISTS public.leaderboard_monthly CASCADE;
CREATE OR REPLACE VIEW public.leaderboard_monthly AS
SELECT
  p.id,
  p.display_name,
  p.avatar_url,
  p.country,
  COALESCE(SUM(d.xp_amount), 0)::INTEGER AS monthly_xp,
  RANK() OVER (ORDER BY COALESCE(SUM(d.xp_amount), 0) DESC) AS rank
FROM public.profiles p
LEFT JOIN public.daily_xp_log d
  ON p.id = d.user_id
  AND d.earned_at >= date_trunc('month', NOW() AT TIME ZONE 'UTC')
WHERE p.is_active = true
  AND p.display_name IS NOT NULL
GROUP BY p.id, p.display_name, p.avatar_url, p.country
ORDER BY monthly_xp DESC;

-- ─── ADMIN USERS VIEW (service_role only) ────────────────────────
DROP VIEW IF EXISTS public.admin_users_view;
CREATE VIEW public.admin_users_view
WITH (security_invoker = false)
AS
SELECT
  COALESCE(p.id, au.id)                         AS id,
  p.display_name,
  p.avatar_url,
  p.bio,
  p.country,
  p.referral_code,
  p.joined_at,
  COALESCE(p.subscription_tier, 'free')          AS subscription_tier,
  p.subscription_expires_at,
  COALESCE(p.is_active, true)                    AS is_active,
  COALESCE(p.role, 'user')                       AS role,
  COALESCE(p.is_blocked, false)                  AS is_blocked,
  p.blocked_reason,
  p.last_active_at,
  p.login_provider,
  COALESCE(p.total_listening_hours, 0)           AS total_listening_hours,
  p.push_token,
  COALESCE(au.email, p.email)                    AS email,
  au.created_at                                  AS auth_created_at,
  au.last_sign_in_at
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id;

-- ─── PROTECT ROLE COLUMN FROM SELF-PROMOTION ────────────────────────
CREATE OR REPLACE FUNCTION public.protect_role_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    ) THEN
      NEW.role := OLD.role;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_role_update ON public.profiles;
CREATE TRIGGER protect_role_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_role_column();

-- ─── AUTO-PROFILE TRIGGER ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, email, avatar_url, referral_code)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url',
    'SG' || upper(substring(replace(NEW.id::text, '-', ''), 1, 6))
  )
  ON CONFLICT (id) DO UPDATE SET
    display_name  = COALESCE(EXCLUDED.display_name, public.profiles.display_name),
    email         = COALESCE(EXCLUDED.email, public.profiles.email),
    avatar_url    = COALESCE(EXCLUDED.avatar_url,   public.profiles.avatar_url),
    referral_code = COALESCE(public.profiles.referral_code, EXCLUDED.referral_code);

  INSERT INTO public.user_settings (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.user_xp (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.user_streaks (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── HELPER: Log admin activity ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.log_admin_action(
  p_admin_id   UUID,
  p_action     TEXT,
  p_entity_type TEXT DEFAULT NULL,
  p_entity_id  TEXT DEFAULT NULL,
  p_details    JSONB DEFAULT '{}'
)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.admin_activity_log (admin_id, action, entity_type, entity_id, details)
  VALUES (p_admin_id, p_action, p_entity_type, p_entity_id, p_details);
END;
$$;

-- ─── HELPER: Block/unblock user ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_block_user(
  p_user_id UUID,
  p_reason  TEXT DEFAULT NULL
)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  UPDATE public.profiles
  SET is_blocked = true, blocked_reason = p_reason
  WHERE id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_unblock_user(p_user_id UUID)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  UPDATE public.profiles
  SET is_blocked = false, blocked_reason = NULL
  WHERE id = p_user_id;
END;
$$;

-- ─── HELPER: Grant/revoke premium ────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_grant_premium(
  p_user_id    UUID,
  p_days       INTEGER DEFAULT 30,
  p_plan       TEXT DEFAULT 'weekly'
)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_expires TIMESTAMPTZ;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  IF p_plan = 'lifetime' THEN
    v_expires := NULL;
  ELSE
    v_expires := NOW() + (p_days || ' days')::INTERVAL;
  END IF;

  UPDATE public.profiles
  SET subscription_tier = 'premium',
      subscription_expires_at = v_expires
  WHERE id = p_user_id;

  INSERT INTO public.subscriptions (user_id, plan, status, started_at, expires_at, provider)
  VALUES (p_user_id, p_plan, 'active', NOW(), v_expires, 'admin')
  ON CONFLICT (user_id) DO UPDATE SET
    plan = EXCLUDED.plan,
    status = 'active',
    expires_at = EXCLUDED.expires_at,
    provider = 'admin',
    updated_at = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_revoke_premium(p_user_id UUID)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  UPDATE public.profiles
  SET subscription_tier = 'free',
      subscription_expires_at = NULL
  WHERE id = p_user_id;

  UPDATE public.subscriptions
  SET status = 'cancelled', updated_at = NOW()
  WHERE user_id = p_user_id AND status = 'active';
END;
$$;

-- ─── BADGE AWARD FUNCTION ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.award_badge(p_user_id UUID, p_badge_slug TEXT)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_badge_id  UUID;
  v_xp_reward INTEGER;
BEGIN
  SELECT id, xp_reward INTO v_badge_id, v_xp_reward
  FROM public.badges WHERE slug = p_badge_slug;

  IF v_badge_id IS NULL THEN RETURN; END IF;

  INSERT INTO public.user_badges (user_id, badge_id)
  VALUES (p_user_id, v_badge_id)
  ON CONFLICT DO NOTHING;

  IF FOUND THEN
    INSERT INTO public.daily_xp_log (user_id, xp_amount, reason)
    VALUES (p_user_id, v_xp_reward, 'badge:' || p_badge_slug);

    INSERT INTO public.user_xp (user_id, total_xp, level, updated_at)
    VALUES (p_user_id, v_xp_reward, 1, NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      total_xp   = public.user_xp.total_xp + v_xp_reward,
      level      = GREATEST(1, FLOOR((public.user_xp.total_xp + v_xp_reward)::FLOAT / 500)::INTEGER + 1),
      updated_at = NOW();
  END IF;
END;
$$;

-- ─── CHECK AND AWARD BADGES FUNCTION ───────────────────────────────
CREATE OR REPLACE FUNCTION public.check_and_award_badges(p_user_id UUID)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_xp                INTEGER;
  v_level             INTEGER;
  v_streak            INTEGER;
  v_episode_count     INTEGER;
  v_surah_count       INTEGER;
  v_journey_started   INTEGER;
  v_journey_completed INTEGER;
  v_hadith_count      INTEGER;
BEGIN
  SELECT COALESCE(total_xp, 0), COALESCE(level, 1) INTO v_xp, v_level
  FROM public.user_xp WHERE user_id = p_user_id;

  SELECT COALESCE(current_streak, 0) INTO v_streak
  FROM public.user_streaks WHERE user_id = p_user_id;

  SELECT COUNT(*) INTO v_episode_count
  FROM public.listening_progress
  WHERE user_id = p_user_id AND content_type = 'episode' AND completed = true;

  SELECT COUNT(*) INTO v_surah_count
  FROM public.listening_progress
  WHERE user_id = p_user_id AND content_type = 'surah' AND completed = true;

  SELECT COUNT(*) INTO v_journey_started
  FROM public.journey_progress
  WHERE user_id = p_user_id;

  SELECT COUNT(*) INTO v_journey_completed
  FROM public.journey_progress
  WHERE user_id = p_user_id AND completed = true;

  SELECT COUNT(*) INTO v_hadith_count
  FROM public.listening_progress lp
  JOIN public.episodes e ON e.id::text = lp.content_id
  JOIN public.series s ON s.id = e.series_id
  JOIN public.categories c ON c.id = s.category_id
  WHERE lp.user_id = p_user_id
    AND lp.content_type = 'episode'
    AND lp.completed = true
    AND c.slug = 'hadith';

  IF v_episode_count     >= 1   THEN PERFORM public.award_badge(p_user_id, 'first_listen');    END IF;
  IF v_surah_count       >= 1   THEN PERFORM public.award_badge(p_user_id, 'quran_start');     END IF;
  IF v_surah_count       >= 114 THEN PERFORM public.award_badge(p_user_id, 'quran_complete');  END IF;
  IF v_streak            >= 3   THEN PERFORM public.award_badge(p_user_id, 'streak_3');        END IF;
  IF v_streak            >= 7   THEN PERFORM public.award_badge(p_user_id, 'streak_7');        END IF;
  IF v_streak            >= 30  THEN PERFORM public.award_badge(p_user_id, 'streak_30');       END IF;
  IF v_level             >= 5   THEN PERFORM public.award_badge(p_user_id, 'level_5');         END IF;
  IF v_level             >= 10  THEN PERFORM public.award_badge(p_user_id, 'level_10');        END IF;
  IF v_journey_started   >= 1   THEN PERFORM public.award_badge(p_user_id, 'journey_start');   END IF;
  IF v_journey_completed >= 20  THEN PERFORM public.award_badge(p_user_id, 'journey_complete');END IF;
  IF v_hadith_count      >= 1   THEN PERFORM public.award_badge(p_user_id, 'hadith_start');    END IF;
  IF v_hadith_count      >= 10  THEN PERFORM public.award_badge(p_user_id, 'hadith_10');       END IF;
  IF v_hadith_count      >= 40  THEN PERFORM public.award_badge(p_user_id, 'hadith_40');       END IF;
END;
$$;

-- ─── APPLY REFERRAL CODE FUNCTION ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.apply_referral_code(p_code TEXT)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_referrer_id UUID;
  v_caller      UUID := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT id INTO v_referrer_id
  FROM public.profiles
  WHERE upper(trim(referral_code)) = upper(trim(p_code))
    AND id != v_caller;

  IF v_referrer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_code');
  END IF;

  IF EXISTS (SELECT 1 FROM public.referrals WHERE referred_id = v_caller) THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_used');
  END IF;

  INSERT INTO public.referrals (referrer_id, referred_id, code_used, xp_awarded_referrer, xp_awarded_referred)
  VALUES (v_referrer_id, v_caller, upper(trim(p_code)), 500, 100);

  INSERT INTO public.daily_xp_log (user_id, xp_amount, reason)
  VALUES (v_referrer_id, 500, 'referral_friend_joined');

  INSERT INTO public.user_xp (user_id, total_xp, level, updated_at)
  VALUES (v_referrer_id, 500, 2, NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    total_xp   = public.user_xp.total_xp + 500,
    level      = GREATEST(1, FLOOR((public.user_xp.total_xp + 500)::FLOAT / 500)::INTEGER + 1),
    updated_at = NOW();

  INSERT INTO public.daily_xp_log (user_id, xp_amount, reason)
  VALUES (v_caller, 100, 'referral_bonus');

  INSERT INTO public.user_xp (user_id, total_xp, level, updated_at)
  VALUES (v_caller, 100, 1, NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    total_xp   = public.user_xp.total_xp + 100,
    level      = GREATEST(1, FLOOR((public.user_xp.total_xp + 100)::FLOAT / 500)::INTEGER + 1),
    updated_at = NOW();

  RETURN jsonb_build_object('success', true, 'xp_bonus', 100);
END;
$$;

-- ─── BACKFILL: ensure every existing user has all support rows ──────
INSERT INTO public.user_xp (user_id)
SELECT id FROM public.profiles
WHERE id NOT IN (SELECT user_id FROM public.user_xp)
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.user_streaks (user_id)
SELECT id FROM public.profiles
WHERE id NOT IN (SELECT user_id FROM public.user_streaks)
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.user_settings (user_id)
SELECT id FROM public.profiles
WHERE id NOT IN (SELECT user_id FROM public.user_settings)
ON CONFLICT (user_id) DO NOTHING;

UPDATE public.profiles
SET referral_code = 'SG' || upper(substring(replace(id::text, '-', ''), 1, 6))
WHERE referral_code IS NULL;

-- ═══════════════════════════════════════════════════════════════════
-- PART 6: SEED DATA
-- ═══════════════════════════════════════════════════════════════════

-- ─── BADGES ───────────────────────────────────────────────────────
INSERT INTO public.badges (slug, name, description, icon, xp_reward) VALUES
  ('first_listen',      'First Listen',        'Completed your first audio session',   '🎧', 10),
  ('quran_start',       'Quran Journey Begins','Listened to your first surah',          '📖', 15),
  ('streak_3',          '3-Day Streak',        'Listened 3 days in a row',              '🔥', 25),
  ('streak_7',          'Week Warrior',        'Listened 7 days in a row',              '⚡', 50),
  ('streak_30',         'Month Master',        'Listened 30 days in a row',             '🏆', 200),
  ('journey_start',     'Journey Begins',      'Started the Islamic Journey',           '🗺️', 20),
  ('journey_complete',  'Journey Complete',    'Completed all 20 chapters',             '✨', 500),
  ('level_5',           'Rising Scholar',      'Reached Level 5',                       '🌟', 100),
  ('level_10',          'Dedicated Learner',   'Reached Level 10',                      '💎', 250),
  ('quran_complete',    'Khatam',              'Listened to all 114 Surahs',            '🕌', 1000),
  ('hadith_start',      'Hadith Seeker',       'First hadith episode completed',        '📜', 15),
  ('hadith_10',         'Hadith Student',      'Completed 10 hadith episodes',          '📚', 75),
  ('hadith_40',         'Hadith Scholar',      'Completed 40 hadith episodes',          '🏛️', 300)
ON CONFLICT (slug) DO NOTHING;

-- ─── CATEGORIES ───────────────────────────────────────────────────
INSERT INTO public.categories (name, name_arabic, slug, icon_url, order_index, is_active, guest_access, free_user_access, show_in_home, is_featured)
VALUES
  ('Seerah', 'السيرة', 'seerah', NULL, 1, true, true, true, true, true),
  ('Prophets', 'الأنبياء', 'prophets', NULL, 2, true, true, true, true, true),
  ('Qur''an', 'القرآن', 'quran', NULL, 3, true, true, true, true, true),
  ('Sahaba', 'الصحابة', 'sahaba', NULL, 4, true, true, true, true, false),
  ('History', 'التاريخ', 'history', NULL, 5, true, true, true, true, false),
  ('Fiqh', 'الفقه', 'fiqh', NULL, 6, true, true, true, true, false),
  ('Hadith', 'الحديث', 'hadith', NULL, 7, true, true, true, true, false),
  ('Tafseer', 'التفسير', 'tafseer', NULL, 8, true, true, true, true, false),
  ('Aqeedah', 'العقيدة', 'aqeedah', NULL, 9, true, true, true, false, false),
  ('Duas & Adhkar', 'الأدعية والأذكار', 'duas-adhkar', NULL, 10, true, true, true, true, false),
  ('Islamic History', 'التاريخ الإسلامي', 'islamic-history', NULL, 11, true, true, true, true, true),
  ('Tafsir', 'التفسير', 'tafsir', NULL, 12, true, true, true, true, false),
  ('Duas', 'الأدعية', 'duas', NULL, 13, true, true, true, true, false)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  name_arabic = EXCLUDED.name_arabic,
  order_index = EXCLUDED.order_index,
  is_active = EXCLUDED.is_active,
  guest_access = EXCLUDED.guest_access,
  free_user_access = EXCLUDED.free_user_access,
  show_in_home = EXCLUDED.show_in_home,
  is_featured = EXCLUDED.is_featured;

-- ─── RECITERS (25 well-known Quran reciters) ──────────────────────
INSERT INTO public.reciters (name_english, name_arabic, api_reciter_id, bio, streaming_bitrate, download_bitrate, supports_ayah_level, is_active, is_default, order_index)
VALUES
  ('Mishary Rashid Alafasy', 'مشاري راشد العفاسي', 'ar.alafasy', 'Kuwaiti imam and Quran reciter, known for his beautiful melodic voice.', 128, 192, true, true, true, 1),
  ('Abdul Rahman Al-Sudais', 'عبدالرحمن السديس', 'ar.abdurrahmaansudais', 'Imam of Masjid al-Haram, Makkah. One of the most recognized voices.', 128, 192, true, true, false, 2),
  ('Abdul Basit Abdus Samad', 'عبدالباسط عبدالصمد', 'ar.abdulbasitmurattal', 'Egyptian Quran reciter, widely considered one of the greatest of all time.', 128, 192, true, true, false, 3),
  ('Mahmoud Khalil Al-Hussary', 'محمود خليل الحصري', 'ar.husary', 'Egyptian hafiz, pioneer of recorded Quran recitation.', 128, 192, true, true, false, 4),
  ('Saud Al-Shuraim', 'سعود الشريم', 'ar.saoodshuraym', 'Former imam of Masjid al-Haram. Known for powerful emotional recitation.', 128, 192, true, true, false, 5),
  ('Maher Al-Muaiqly', 'ماهر المعيقلي', 'ar.mahermuaiqly', 'Imam of Masjid al-Haram. Known for clear and melodious recitation.', 128, 192, true, true, false, 6),
  ('Saad Al-Ghamdi', 'سعد الغامدي', 'ar.saadalghamidi', 'Saudi reciter known for his distinct soothing style.', 128, 192, true, true, false, 7),
  ('Ahmed Al-Ajmi', 'أحمد العجمي', 'ar.ahmedajamy', 'Saudi imam known for emotional Taraweeh prayers.', 128, 192, true, true, false, 8),
  ('Yasser Al-Dosari', 'ياسر الدوسري', 'ar.yasserdossari', 'Saudi imam known for beautiful and emotional recitation.', 128, 192, true, true, false, 9),
  ('Hani Ar-Rifai', 'هاني الرفاعي', 'ar.haborning', 'Saudi reciter known for melodic and touching recitation style.', 128, 192, false, true, false, 10),
  ('Abu Bakr Al-Shatri', 'أبو بكر الشاطري', 'ar.shaatree', 'Saudi reciter, former imam of Masjid al-Haram during Ramadan.', 128, 192, false, true, false, 11),
  ('Muhammad Ayyub', 'محمد أيوب', 'ar.muhammadayyoub', 'Former imam of Masjid an-Nabawi. Known for precise tajweed.', 128, 192, true, true, false, 12),
  ('Abdullah Basfar', 'عبدالله بصفر', 'ar.abdullahbasfar', 'Saudi reciter and professor of Islamic Studies.', 128, 192, false, true, false, 13),
  ('Nasser Al-Qatami', 'ناصر القطامي', 'ar.naborning', 'Saudi imam known for emotional and powerful recitation.', 128, 192, false, true, false, 14),
  ('Fares Abbad', 'فارس عباد', 'ar.faborning', 'Saudi reciter known for his soothing voice.', 128, 192, false, true, false, 15),
  ('Muhammad Al-Luhaidan', 'محمد اللحيدان', 'ar.muhammadluhaidan', 'Saudi imam known for very emotional recitation.', 128, 192, false, true, false, 16),
  ('Ali Al-Hudhaify', 'علي الحذيفي', 'ar.hudhaify', 'Former imam of Masjid an-Nabawi. Known for precise tajweed.', 128, 192, true, true, false, 17),
  ('Ibrahim Al-Akhdar', 'إبراهيم الأخضر', 'ar.ibrahimakhdar', 'Saudi reciter and educator.', 128, 192, false, true, false, 18),
  ('Bandar Baleela', 'بندر بليلة', 'ar.baborning', 'Imam of Masjid al-Haram. Known for his distinct powerful voice.', 128, 192, false, true, false, 19),
  ('Khalifa Al-Tunaiji', 'خليفة الطنيجي', 'ar.khalifaaltunaiji', 'Emirati reciter with unique style.', 128, 192, false, true, false, 20),
  ('Idris Abkar', 'إدريس أبكر', 'ar.idrisabkar', 'Emirati imam with emotional recitation.', 128, 192, false, true, false, 21),
  ('Abdulmohsin Al-Qasim', 'عبدالمحسن القاسم', 'ar.abdulmohsinqasim', 'Imam of Masjid an-Nabawi. Known for calm recitation.', 128, 192, false, true, false, 22),
  ('Yusuf bin Noah Ahmad', 'يوسف بن نوح أحمد', 'ar.yusufbinoahmad', 'Melodious and serene recitation style.', 128, 192, false, true, false, 23),
  ('Abdul Basit (Mujawwad)', 'عبدالباسط عبدالصمد (مجود)', 'ar.abdulsamad', 'Mujawwad style by Abdul Basit Abdus Samad.', 128, 192, false, true, false, 24),
  ('Al-Hussary (Muallim)', 'الحصري (معلم)', 'ar.husarymuallim', 'Teaching recitation with pauses for learners.', 128, 192, true, true, false, 25)
ON CONFLICT DO NOTHING;

-- ─── JOURNEY CHAPTERS (20-chapter Islamic history) ────────────────
INSERT INTO public.journey_chapters (chapter_number, title, subtitle, era_label, is_published, show_coming_soon, order_index)
VALUES
  (1,  'The Creation & Early Prophets',    'Adam, Nuh, Ibrahim ع', 'Pre-Islamic Era',       true,  false, 1),
  (2,  'Prophet Ibrahim & His Legacy',     'The Father of Monotheism', 'Pre-Islamic Era',   true,  false, 2),
  (3,  'Musa & Bani Israel',               'The Exodus & the Torah',   'Pre-Islamic Era',   true,  false, 3),
  (4,  'Isa ibn Maryam',                   'The Messiah in Islam',     'Pre-Islamic Era',   true,  false, 4),
  (5,  'Arabia Before Islam',              'The Age of Ignorance',     'Pre-Islamic Era',   true,  false, 5),
  (6,  'Birth of the Prophet ﷺ',          'The Year of the Elephant', '570 CE',            true,  false, 6),
  (7,  'The First Revelation',             'Iqra — Read',              '610 CE',            true,  false, 7),
  (8,  'The Meccan Period',                'Persecution & Patience',   '610–622 CE',        true,  false, 8),
  (9,  'The Hijra',                        'Migration to Madinah',     '622 CE',            true,  false, 9),
  (10, 'Building the Islamic State',       'Madinah Society',          '622–625 CE',        true,  false, 10),
  (11, 'The Battle of Badr',               'The First Great Victory',  '624 CE',            true,  false, 11),
  (12, 'Uhud & Its Lessons',               'Trials & Steadfastness',   '625 CE',            true,  false, 12),
  (13, 'The Battle of the Trench',         'Alliance & Betrayal',      '627 CE',            false, true,  13),
  (14, 'Treaty of Hudaybiyyah',            'The Apparent Defeat',      '628 CE',            false, true,  14),
  (15, 'Conquest of Makkah',              'The Bloodless Victory',    '630 CE',            false, true,  15),
  (16, 'The Farewell Pilgrimage',          'Final Sermon of the Prophet ﷺ', '632 CE',      false, true,  16),
  (17, 'The Rightly-Guided Caliphs',       'Abu Bakr, Umar, Uthman, Ali', '632–661 CE',    false, true,  17),
  (18, 'The Umayyad Caliphate',            'Expansion & Challenges',   '661–750 CE',        false, true,  18),
  (19, 'The Abbasid Golden Age',           'Science, Art & Learning',  '750–1258 CE',       false, true,  19),
  (20, 'Islam''s Global Legacy',           'The Message for All Time', 'Present Day',       false, true,  20)
ON CONFLICT (chapter_number) DO NOTHING;

-- ─── SERIES (linked to categories) ────────────────────────────────
DO $$
DECLARE
  v_seerah_id UUID; v_prophets_id UUID; v_quran_id UUID;
  v_sahaba_id UUID; v_history_id UUID; v_fiqh_id UUID;
  v_hadith_id UUID; v_tafseer_id UUID;
BEGIN
  SELECT id INTO v_seerah_id   FROM public.categories WHERE slug = 'seerah';
  SELECT id INTO v_prophets_id FROM public.categories WHERE slug = 'prophets';
  SELECT id INTO v_quran_id    FROM public.categories WHERE slug = 'quran';
  SELECT id INTO v_sahaba_id   FROM public.categories WHERE slug = 'sahaba';
  SELECT id INTO v_history_id  FROM public.categories WHERE slug = 'history';
  SELECT id INTO v_fiqh_id     FROM public.categories WHERE slug = 'fiqh';
  SELECT id INTO v_hadith_id   FROM public.categories WHERE slug = 'hadith';
  SELECT id INTO v_tafseer_id  FROM public.categories WHERE slug = 'tafseer';

  INSERT INTO public.series (title, category_id, description, pub_status, is_featured, episode_count)
  VALUES
    ('The Life of the Prophet ﷺ', v_seerah_id, 'A comprehensive journey through the life of Prophet Muhammad ﷺ from birth to passing.', 'published', true, 48),
    ('Stories of the Prophets', v_prophets_id, 'Learn about all the Prophets mentioned in the Quran — from Adam (AS) to Isa (AS).', 'published', true, 32),
    ('Companions of the Prophet ﷺ', v_sahaba_id, 'Inspiring stories of the Sahaba who gave everything for Islam.', 'published', true, 24),
    ('Islamic History: The Golden Age', v_history_id, 'From the Rightly Guided Caliphs to the great Muslim empires.', 'published', false, 20),
    ('Qur''anic Stories', v_quran_id, 'Stories mentioned in the Quran — lessons and wisdoms from divine revelation.', 'published', true, 16),
    ('Pillars of Islam', v_fiqh_id, 'A detailed guide to the five pillars — Shahada, Salah, Zakah, Sawm, and Hajj.', 'published', false, 15),
    ('40 Hadith of Imam Nawawi', v_hadith_id, 'Deep dive into the 40 most important hadiths compiled by Imam An-Nawawi.', 'published', false, 40),
    ('Tafseer of Juz Amma', v_tafseer_id, 'Detailed explanation and context of the 30th part of the Quran.', 'published', false, 37),
    ('Women in Islam', v_seerah_id, 'Stories of the great women in Islamic history — Khadijah, Aisha, Fatimah, and more.', 'published', false, 12),
    ('The Hereafter Series', v_quran_id, 'What happens after death? A journey through Barzakh, Day of Judgment, and beyond.', 'published', false, 10)
  ON CONFLICT DO NOTHING;
END $$;

-- ─── SAMPLE EPISODES (for first 3 series) ─────────────────────────
DO $$
DECLARE v1 UUID; v2 UUID; v3 UUID;
BEGIN
  SELECT id INTO v1 FROM public.series WHERE title = 'The Life of the Prophet ﷺ' LIMIT 1;
  SELECT id INTO v2 FROM public.series WHERE title = 'Stories of the Prophets' LIMIT 1;
  SELECT id INTO v3 FROM public.series WHERE title = 'Companions of the Prophet ﷺ' LIMIT 1;

  IF v1 IS NOT NULL THEN
    INSERT INTO public.episodes (series_id, episode_number, title, duration, pub_status) VALUES
      (v1,1,'Arabia Before Islam',1800,'published'),(v1,2,'The Year of the Elephant',1500,'published'),
      (v1,3,'Birth of the Prophet ﷺ',1620,'published'),(v1,4,'Early Childhood & Halimah',1440,'published'),
      (v1,5,'Youth of Muhammad ﷺ',1380,'published'),(v1,6,'Marriage to Khadijah (RA)',1560,'published'),
      (v1,7,'The First Revelation',1740,'published'),(v1,8,'The Secret Call to Islam',1500,'published'),
      (v1,9,'Public Dawah Begins',1680,'published'),(v1,10,'Persecution of Early Muslims',1800,'published'),
      (v1,11,'Migration to Abyssinia',1560,'published'),(v1,12,'The Boycott of Banu Hashim',1440,'published'),
      (v1,13,'Year of Sorrow',1320,'published'),(v1,14,'Al-Isra wal Mi''raj',1860,'published'),
      (v1,15,'The Hijrah to Madinah',1740,'published')
    ON CONFLICT DO NOTHING;
  END IF;

  IF v2 IS NOT NULL THEN
    INSERT INTO public.episodes (series_id, episode_number, title, duration, pub_status) VALUES
      (v2,1,'Adam (AS) — The First Human',1500,'published'),(v2,2,'Idris (AS) — The Scholar',1200,'published'),
      (v2,3,'Nuh (AS) — The Great Flood',1680,'published'),(v2,4,'Hud (AS) — The People of Ad',1440,'published'),
      (v2,5,'Salih (AS) — The She-Camel',1380,'published'),(v2,6,'Ibrahim (AS) — The Friend of Allah',1920,'published'),
      (v2,7,'Ismail (AS) — The Sacrifice',1500,'published'),(v2,8,'Ishaq & Yaqub (AS)',1320,'published'),
      (v2,9,'Yusuf (AS) — The Beautiful Story',2100,'published'),(v2,10,'Musa (AS) — Part 1: Pharaoh',1800,'published'),
      (v2,11,'Musa (AS) — Part 2: Exodus',1740,'published'),(v2,12,'Dawud & Sulayman (AS)',1620,'published'),
      (v2,13,'Yunus (AS) — The Whale',1380,'published'),(v2,14,'Isa (AS) — Son of Maryam',1800,'published')
    ON CONFLICT DO NOTHING;
  END IF;

  IF v3 IS NOT NULL THEN
    INSERT INTO public.episodes (series_id, episode_number, title, duration, pub_status) VALUES
      (v3,1,'Abu Bakr As-Siddiq (RA)',1800,'published'),(v3,2,'Umar ibn Al-Khattab (RA)',1920,'published'),
      (v3,3,'Uthman ibn Affan (RA)',1680,'published'),(v3,4,'Ali ibn Abi Talib (RA)',1740,'published'),
      (v3,5,'Khadijah bint Khuwaylid (RA)',1560,'published'),(v3,6,'Bilal ibn Rabah (RA)',1500,'published'),
      (v3,7,'Khalid ibn Al-Walid (RA)',1620,'published'),(v3,8,'Abdur Rahman ibn Awf (RA)',1440,'published'),
      (v3,9,'Salman Al-Farisi (RA)',1500,'published'),(v3,10,'Aisha bint Abu Bakr (RA)',1680,'published')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ─── APP SETTINGS (all default values) ────────────────────────────
INSERT INTO public.app_settings (key, value, description, type) VALUES
  ('guest_can_listen',        'true',  'Allow guest users to listen to content', 'boolean'),
  ('guest_can_browse',        'true',  'Allow guest users to browse the app',    'boolean'),
  ('guest_episode_limit',     '3',     'Max episodes a guest can play per session', 'number'),
  ('guest_prompt_register',   'true',  'Show register prompt after guest limit', 'boolean'),
  ('default_reciter',         '"ar.alafasy"', 'Default Qur''an reciter ID',       'string'),
  ('default_translation',     '"en.asad"',    'Default translation edition',      'string'),
  ('show_arabic_default',     'true',         'Show Arabic text by default',      'boolean'),
  ('show_translation_default','true',         'Show translation by default',      'boolean'),
  ('quran_streaming_quality', '"128kbps"',    'Streaming audio quality',          'string'),
  ('quran_download_quality',  '"192kbps"',    'Download audio quality',           'string'),
  ('weekly_price_usd',         '0.99',         'Weekly subscription price (USD)',   'number'),
  ('monthly_price_usd',        '4.99',         'Monthly subscription price (USD)', 'number'),
  ('trial_days',              '7',            'Free trial duration in days',      'number'),
  ('trial_enabled',           'false',        'Enable free trial for new users',  'boolean'),
  ('max_downloads_free',      '5',            'Max downloads for free users',     'number'),
  ('max_downloads_premium',   '500',          'Max downloads for premium users',  'number'),
  ('download_wifi_only_default','true',       'Default wifi-only download setting','boolean'),
  ('download_expiry_days',    '30',           'Days before downloads expire',     'number'),
  ('xp_per_episode',          '10',           'XP awarded per episode completed', 'number'),
  ('xp_per_surah',            '15',           'XP awarded per surah completed',   'number'),
  ('xp_daily_login',          '5',            'XP awarded for daily login',       'number'),
  ('xp_streak_multiplier',    '1.5',          'XP multiplier for active streaks', 'number'),
  ('streak_grace_hours',      '24',           'Grace period for streak (hours)',  'number'),
  ('referrer_xp_reward',      '500',          'XP reward for referring a friend', 'number'),
  ('referred_xp_reward',      '100',          'XP reward for being referred',     'number'),
  ('app_name',                '"StayGuided Me"', 'App display name',              'string'),
  ('guest_access_enabled',    'true',            'Allow guest access to the app', 'boolean'),
  ('maintenance_mode',        'false',           'Enable maintenance mode',       'boolean'),
  ('maintenance_message',     '"We are performing scheduled maintenance. Please check back soon."', 'Maintenance message', 'string'),
  ('force_update_version',    '"0"',             'Force update for versions below this', 'string'),
  ('ramadan_mode',            'false',           'Enable Ramadan UI mode',        'boolean'),
  ('referral_enabled',        'true',            'Enable referral program',       'boolean'),
  ('referral_code_prefix',    '"SG"',            'Prefix for referral codes',     'string'),
  ('max_referrals_per_user',  '50',              'Max referrals per user',        'number')
ON CONFLICT (key) DO NOTHING;

-- ─── FEATURE FLAGS ────────────────────────────────────────────────
INSERT INTO public.feature_flags (key, name, description, section, is_enabled, rollout_pct) VALUES
  ('social_sharing',       'Social Sharing',           'Share episodes to WhatsApp / Twitter', 'content',        true,  100),
  ('quran_word_by_word',   'Quran Word-by-Word',       'Highlight each word as it plays',      'quran',          false, 0),
  ('quiz_mode',            'Quiz Mode',                'Post-episode knowledge quizzes',        'gamification',   false, 0),
  ('journey_mode',         'Islamic Journey',          '20-chapter guided Islamic journey',     'content',        true,  100),
  ('referral_program',     'Referral Program',         'Refer friends to earn XP',             'growth',         true,  100),
  ('leaderboard',          'Leaderboard',              'Global XP leaderboard',                'gamification',   true,  100),
  ('streak_notifications', 'Streak Notifications',     'Daily streak reminder notifications',  'notifications',  true,  100),
  ('offline_downloads',    'Offline Downloads',        'Download episodes for offline play',   'premium',        true,  100),
  ('dark_mode_toggle',     'Dark Mode Toggle',         'Allow users to switch to light mode',  'appearance',     false, 0),
  ('push_notifications',   'Push Notifications',       'Allow push notifications via FCM',     'notifications',  true,  100),
  ('guest_mode',           'Guest Mode',               'Allow unauthenticated app access',     'access',         true,  100),
  ('donation_banner',      'Donation Banner',          'Show donation CTA to free users',      'monetization',   false, 0),
  ('ramadan_features',     'Ramadan Features',         'Ramadan countdown and special content','seasonal',       false, 0),
  ('analytics_events',     'Analytics Event Tracking', 'Track detailed user events',           'analytics',      true,  100),
  ('quran_player',         'Quran Player',             'Enable built-in Quran audio player',  'content',        true,  100),
  ('bookmarks',            'Bookmarks',                'Allow users to bookmark episodes',    'content',        true,  100),
  ('playback_speed',       'Playback Speed',           'Allow adjusting playback speed',      'content',        true,  100),
  ('in_app_purchases',     'In-App Purchases',         'Enable in-app purchase flows',        'monetization',   false, 0),
  ('prayer_times',         'Prayer Times',             'Show prayer times feature',           'content',        true,  100),
  ('streak_tracking',      'Streak Tracking',          'Track daily listening streaks',       'gamification',   true,  100),
  ('referral_system',      'Referral System',          'Enable referral program with XP',     'growth',         true,  100)
ON CONFLICT (key) DO UPDATE SET
  is_enabled = EXCLUDED.is_enabled,
  description = EXCLUDED.description,
  name = EXCLUDED.name,
  section = EXCLUDED.section,
  rollout_pct = EXCLUDED.rollout_pct;

-- ─── DONATION SETTINGS ───────────────────────────────────────────
INSERT INTO public.donation_settings (key, value) VALUES
  ('donation_enabled',     'false'),
  ('donation_url',         '"https://www.launchgood.com"'),
  ('donation_message',     '"Support Islamic content development"'),
  ('donation_amounts_usd', '[2, 5, 10, 25, 50]'),
  ('donation_currency',    '"USD"'),
  ('show_in_profile',      'true'),
  ('show_in_player',       'false')
ON CONFLICT (key) DO NOTHING;

-- ─── API SOURCES ──────────────────────────────────────────────────
INSERT INTO public.api_sources (name, type, base_url, is_active, is_primary, priority) VALUES
  ('Al-Quran Cloud',   'quran_audio',   'https://api.alquran.cloud/v1',      true,  true,  1),
  ('Quran.com API',    'quran_text',    'https://api.quran.com/api/v4',      true,  true,  1),
  ('Quran.com Audio',  'quran_audio',   'https://audio.qurancdn.com',        true,  false, 2),
  ('MP3Quran.net',     'quran_audio',   'https://www.mp3quran.net/api',      true,  false, 3),
  ('Aladhan.com',      'prayer_times',  'https://api.aladhan.com/v1',        true,  true,  1)
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════
-- PART 7: is_admin() FUNCTION + PERMISSION GRANTS
-- ═══════════════════════════════════════════════════════════════════

GRANT USAGE ON SCHEMA public TO service_role, anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'super_admin', 'editor', 'content', 'support')
  );
$$;

GRANT SELECT ON ALL TABLES    IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES       IN SCHEMA public TO service_role;
GRANT USAGE ON ALL SEQUENCES  IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES    IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "Postgres full access to user_xp" ON public.user_xp;
CREATE POLICY "Postgres full access to user_xp" ON public.user_xp
  FOR ALL TO postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Postgres full access to xp log" ON public.daily_xp_log;
CREATE POLICY "Postgres full access to xp log" ON public.daily_xp_log
  FOR ALL TO postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Postgres full access to referrals" ON public.referrals;
CREATE POLICY "Postgres full access to referrals" ON public.referrals
  FOR ALL TO postgres USING (true) WITH CHECK (true);

GRANT SELECT ON public.leaderboard         TO anon, authenticated;
GRANT SELECT ON public.leaderboard_weekly  TO anon, authenticated;
GRANT SELECT ON public.leaderboard_monthly TO anon, authenticated;
GRANT SELECT ON public.admin_users_view    TO service_role;
REVOKE SELECT ON public.admin_users_view   FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_all_users_admin(
  p_search      TEXT    DEFAULT NULL,
  p_tier        TEXT    DEFAULT NULL,
  p_status      TEXT    DEFAULT NULL,
  p_limit       INTEGER DEFAULT 25,
  p_offset      INTEGER DEFAULT 0
)
RETURNS TABLE (
  id                    UUID,
  display_name          TEXT,
  avatar_url            TEXT,
  country               TEXT,
  email                 TEXT,
  subscription_tier     TEXT,
  is_blocked            BOOLEAN,
  role                  TEXT,
  last_active_at        TIMESTAMPTZ,
  joined_at             TIMESTAMPTZ,
  auth_created_at       TIMESTAMPTZ,
  last_sign_in_at       TIMESTAMPTZ,
  total_listening_hours NUMERIC,
  push_token            TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;
  RETURN QUERY
  SELECT v.id, v.display_name, v.avatar_url, v.country, v.email,
         v.subscription_tier, v.is_blocked, v.role, v.last_active_at,
         v.joined_at, v.auth_created_at, v.last_sign_in_at,
         v.total_listening_hours, v.push_token
  FROM public.admin_users_view v
  WHERE
    (p_search IS NULL OR p_search = '' OR
      v.display_name ILIKE '%' || p_search || '%' OR
      v.email ILIKE '%' || p_search || '%')
    AND (p_tier IS NULL OR p_tier = 'all' OR v.subscription_tier = p_tier)
    AND (p_status IS NULL OR p_status = 'all' OR
      (p_status = 'blocked' AND v.is_blocked = true) OR
      (p_status = 'active' AND v.is_blocked = false))
  ORDER BY v.auth_created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_all_users_admin TO authenticated;

GRANT INSERT, UPDATE ON public.profiles           TO authenticated;
GRANT INSERT, UPDATE ON public.user_settings      TO authenticated;
GRANT INSERT, UPDATE ON public.user_xp            TO authenticated;
GRANT INSERT, UPDATE ON public.user_streaks       TO authenticated;
GRANT INSERT ON public.user_badges                TO authenticated;
GRANT INSERT ON public.referrals                  TO authenticated;
GRANT ALL ON public.listening_progress            TO authenticated;
GRANT ALL ON public.listening_history             TO authenticated;
GRANT ALL ON public.favourites                    TO authenticated;
GRANT ALL ON public.bookmarks                     TO authenticated;
GRANT ALL ON public.downloads                     TO authenticated;
GRANT ALL ON public.journey_progress              TO authenticated;
GRANT INSERT ON public.daily_xp_log              TO authenticated;
GRANT ALL ON public.notifications                 TO authenticated;
GRANT INSERT ON public.content_reports            TO authenticated;

GRANT INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.reciters TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.series TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.episodes TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.journey_chapters TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.feature_flags TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.content_reports TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.feed_widgets TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.quizzes TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.quiz_questions TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.admin_activity_log TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.coupon_codes TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.coupon_redemptions TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.popup_notices TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.push_campaigns TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.donation_settings TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.api_sources TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.admin_notes TO authenticated;

-- ── PUBLIC READ POLICIES ─────────────────────────────────────────
DROP POLICY IF EXISTS "Public reads active categories" ON public.categories;
CREATE POLICY "Public reads active categories" ON public.categories
  FOR SELECT TO anon, authenticated USING (is_active = true);
DROP POLICY IF EXISTS "Public reads active reciters" ON public.reciters;
CREATE POLICY "Public reads active reciters" ON public.reciters
  FOR SELECT TO anon, authenticated USING (is_active = true);
DROP POLICY IF EXISTS "Public reads published series" ON public.series;
CREATE POLICY "Public reads published series" ON public.series
  FOR SELECT TO anon, authenticated USING (pub_status = 'published');
DROP POLICY IF EXISTS "Public reads published episodes" ON public.episodes;
CREATE POLICY "Public reads published episodes" ON public.episodes
  FOR SELECT TO anon, authenticated USING (
    EXISTS (
      SELECT 1 FROM public.series
      WHERE series.id = episodes.series_id
        AND series.pub_status = 'published'
    )
  );
DROP POLICY IF EXISTS "Public reads published journey chapters" ON public.journey_chapters;
CREATE POLICY "Public reads published journey chapters" ON public.journey_chapters
  FOR SELECT TO anon, authenticated USING (is_published = true);
DROP POLICY IF EXISTS "Public reads badges" ON public.badges;
CREATE POLICY "Public reads badges" ON public.badges
  FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Public reads app settings" ON public.app_settings;
CREATE POLICY "Public reads app settings" ON public.app_settings
  FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Public reads feature flags" ON public.feature_flags;
CREATE POLICY "Public reads feature flags" ON public.feature_flags
  FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Users read active popups" ON public.popup_notices;
CREATE POLICY "Users read active popups" ON public.popup_notices
  FOR SELECT TO anon, authenticated USING (is_active = true);
DROP POLICY IF EXISTS "Public reads donation settings" ON public.donation_settings;
CREATE POLICY "Public reads donation settings" ON public.donation_settings
  FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Users read own notifications" ON public.notifications;
CREATE POLICY "Users read own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ── ADMIN RLS POLICIES ───────────────────────────────────────────
DROP POLICY IF EXISTS "Admin manages categories" ON public.categories;
CREATE POLICY "Admin manages categories" ON public.categories
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admin manages reciters" ON public.reciters;
CREATE POLICY "Admin manages reciters" ON public.reciters
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admin manages series" ON public.series;
CREATE POLICY "Admin manages series" ON public.series
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admin manages episodes" ON public.episodes;
CREATE POLICY "Admin manages episodes" ON public.episodes
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admin manages journey chapters" ON public.journey_chapters;
CREATE POLICY "Admin manages journey chapters" ON public.journey_chapters
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admin manages app settings" ON public.app_settings;
CREATE POLICY "Admin manages app settings" ON public.app_settings
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admin manages feature flags" ON public.feature_flags;
CREATE POLICY "Admin manages feature flags" ON public.feature_flags
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admin manages reports" ON public.content_reports;
CREATE POLICY "Admin manages reports" ON public.content_reports
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admin manages feed widgets" ON public.feed_widgets;
CREATE POLICY "Admin manages feed widgets" ON public.feed_widgets
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admin manages quizzes" ON public.quizzes;
CREATE POLICY "Admin manages quizzes" ON public.quizzes
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admin manages quiz questions" ON public.quiz_questions;
CREATE POLICY "Admin manages quiz questions" ON public.quiz_questions
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admin manages activity log" ON public.admin_activity_log;
CREATE POLICY "Admin manages activity log" ON public.admin_activity_log
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admin manages coupons" ON public.coupon_codes;
CREATE POLICY "Admin manages coupons" ON public.coupon_codes
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admin manages redemptions" ON public.coupon_redemptions;
CREATE POLICY "Admin manages redemptions" ON public.coupon_redemptions
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admin manages popups" ON public.popup_notices;
CREATE POLICY "Admin manages popups" ON public.popup_notices
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admin manages push campaigns" ON public.push_campaigns;
CREATE POLICY "Admin manages push campaigns" ON public.push_campaigns
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admin manages donation settings" ON public.donation_settings;
CREATE POLICY "Admin manages donation settings" ON public.donation_settings
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admin manages api sources" ON public.api_sources;
CREATE POLICY "Admin manages api sources" ON public.api_sources
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admin manages admin notes" ON public.admin_notes;
CREATE POLICY "Admin manages admin notes" ON public.admin_notes
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admin manages notifications" ON public.notifications;
CREATE POLICY "Admin manages notifications" ON public.notifications
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admin manages profiles" ON public.profiles;
CREATE POLICY "Admin manages profiles" ON public.profiles
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admin reads subscriptions" ON public.subscriptions;
CREATE POLICY "Admin reads subscriptions" ON public.subscriptions
  FOR SELECT TO authenticated USING (is_admin());

-- ═══════════════════════════════════════════════════════════════════
-- PART 8: PROFILE BACKFILL + ADMIN USER PROMOTION
-- ═══════════════════════════════════════════════════════════════════

-- Backfill profiles for ALL existing auth users (trigger only fires for new signups)
INSERT INTO public.profiles (id, display_name, email, avatar_url, referral_code)
SELECT
  au.id,
  COALESCE(au.raw_user_meta_data->>'display_name', split_part(au.email, '@', 1)),
  au.email,
  au.raw_user_meta_data->>'avatar_url',
  'SG' || upper(substring(replace(au.id::text, '-', ''), 1, 6))
FROM auth.users au
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = au.id);

INSERT INTO public.user_settings (user_id)
SELECT id FROM public.profiles WHERE id NOT IN (SELECT user_id FROM public.user_settings)
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.user_xp (user_id)
SELECT id FROM public.profiles WHERE id NOT IN (SELECT user_id FROM public.user_xp)
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.user_streaks (user_id)
SELECT id FROM public.profiles WHERE id NOT IN (SELECT user_id FROM public.user_streaks)
ON CONFLICT (user_id) DO NOTHING;

-- Promote admin user
UPDATE public.profiles SET role = 'super_admin' WHERE email = 'imranrir46@gmail.com';
INSERT INTO public.profiles (id, display_name, email, role)
SELECT id, split_part(email, '@', 1), email, 'super_admin'
FROM auth.users WHERE email = 'imranrir46@gmail.com'
ON CONFLICT (id) DO UPDATE SET role = 'super_admin';

-- ═══════════════════════════════════════════════════════════════════
-- DONE! StayGuided Me — Complete setup applied successfully.
-- ═══════════════════════════════════════════════════════════════════
--
-- STEPS AFTER RUNNING THIS FILE:
--
--   1. Make sure imranrir46@gmail.com exists in Supabase
--      Authentication > Users. If not, create them first, then
--      re-run this file.
--
--   2. Go to Authentication > Email Templates > Reset Password:
--      The app uses a 6-digit OTP code flow. The default Supabase template
--      sends a click-through magic link via {{ .ConfirmationURL }}, which
--      will NOT work with the in-app code entry screen.
--
--      REQUIRED CHANGE — replace the magic link with the raw token:
--        Find:    {{ .ConfirmationURL }}
--        Replace: {{ .Token }}
--
--      Example subject:  Your StayGuided Me password reset code
--      Example body:
--        Your password reset code is: {{ .Token }}
--        This code expires in 1 hour.
--
--   3. Open the Admin Panel and sign in with imranrir46@gmail.com
--
-- WHAT'S INCLUDED vs. OLDER FILES:
--   - full_setup.sql       ← base schema (superseded by this file)
--   - migration_patch.sql  ← patches (superseded by this file)
--   - complete_setup.sql   ← THIS FILE (use this one only)
--
-- KEY DIFFERENCES FROM OLDER FILES:
--   - profiles.push_token column included natively (+ ALTER IF NOT EXISTS
--     for safety on existing databases)
--   - episodes.pub_status defaults to 'published' (was 'draft')
--   - admin_users_view now includes push_token column
--   - subscriptions 'lifetime' plan constraint applied inline
--   - notifications table now includes action_type TEXT and action_payload JSONB
--     (required for in-app notification routing; ALTER IF NOT EXISTS for safety)
--
-- ═══════════════════════════════════════════════════════════════════
SELECT 'StayGuided Me — complete_setup.sql finished successfully!' AS result;
