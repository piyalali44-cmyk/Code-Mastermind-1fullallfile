-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  StayGuided Me — Step 4 of 8                                    ║
-- ║  ADMIN PANEL TABLES                                             ║
-- ║  ✅ Depends on: Step 3 (episodes, series, categories)           ║
-- ╚══════════════════════════════════════════════════════════════════╝

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


SELECT '✅ Step 4 done: Admin Panel Tables' AS result;
