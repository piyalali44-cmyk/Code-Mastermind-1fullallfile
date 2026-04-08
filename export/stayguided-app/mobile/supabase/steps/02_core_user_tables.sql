-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  StayGuided Me — Step 2 of 8                                    ║
-- ║  CORE USER TABLES + CONTENT-ASSETS ADMIN POLICIES               ║
-- ║  ✅ Depends on: Step 1                                          ║
-- ╚══════════════════════════════════════════════════════════════════╝

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


-- Safety: add auto_scroll if upgrading existing DB
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS auto_scroll BOOLEAN DEFAULT true;

-- ─── CONTENT-ASSETS ADMIN POLICIES (profiles table now exists) ─────
DROP POLICY IF EXISTS "Admins can upload content assets"  ON storage.objects;
DROP POLICY IF EXISTS "Admins can update content assets"  ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete content assets"  ON storage.objects;

CREATE POLICY "Admins can upload content assets"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'content-assets'
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin','super_admin','editor','content')
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
        AND role IN ('admin','super_admin','editor','content')
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
        AND role IN ('admin','super_admin','editor','content')
        AND is_active = true
    )
  );

SELECT '✅ Step 2 done: Core User Tables + Content-Asset Admin Policies' AS result;
