-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║  StayGuided Me — MASTER PATCH FILE                                    ║
-- ║  Consolidates all incremental patches after complete_setup.sql        ║
-- ║  Safe to re-run — all statements are idempotent                       ║
-- ║  Run in: Supabase Dashboard → SQL Editor → New Query                  ║
-- ╚════════════════════════════════════════════════════════════════════════╝

-- ═══════════════════════════════════════════════════════════════════════════
-- PART 1: LIBRARY TABLES (favourites / bookmarks / downloads / user_settings)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.favourites (
  id           UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('surah', 'episode', 'series')),
  content_id   TEXT NOT NULL,
  title        TEXT NOT NULL DEFAULT '',
  series_name  TEXT,
  cover_color  TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, content_type, content_id)
);
ALTER TABLE public.favourites ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users manage own favourites" ON public.favourites
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
GRANT ALL ON public.favourites TO authenticated;
GRANT ALL ON public.favourites TO service_role;

CREATE TABLE IF NOT EXISTS public.bookmarks (
  id           UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('surah', 'episode', 'series')),
  content_id   TEXT NOT NULL,
  title        TEXT NOT NULL DEFAULT '',
  series_name  TEXT,
  cover_color  TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, content_type, content_id)
);
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users manage own bookmarks" ON public.bookmarks
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
GRANT ALL ON public.bookmarks TO authenticated;
GRANT ALL ON public.bookmarks TO service_role;

CREATE TABLE IF NOT EXISTS public.downloads (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content_type    TEXT NOT NULL CHECK (content_type IN ('surah', 'episode')),
  content_id      TEXT NOT NULL,
  title           TEXT NOT NULL DEFAULT '',
  file_size_bytes INTEGER,
  downloaded_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, content_type, content_id)
);
ALTER TABLE public.downloads ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users manage own downloads" ON public.downloads
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
GRANT ALL ON public.downloads TO authenticated;
GRANT ALL ON public.downloads TO service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- PART 2: SUBSCRIPTION PRODUCTION COLUMNS
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS store TEXT;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS product_id TEXT;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS original_transaction_id TEXT;

CREATE INDEX IF NOT EXISTS idx_subscriptions_store
  ON public.subscriptions (store);

INSERT INTO public.app_settings (key, value, description, type)
VALUES ('lifetime_price_usd', '49.99', 'Lifetime subscription price (USD)', 'number')
ON CONFLICT (key) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- PART 3: IMAGE URL COLUMNS + HADITH BADGES
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.episodes        ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.push_campaigns  ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.notifications   ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.profiles        ADD COLUMN IF NOT EXISTS push_token TEXT;

INSERT INTO public.badges (slug, name, description, icon, xp_reward) VALUES
  ('hadith_start', 'Hadith Seeker',  'First hadith episode completed',    '📜', 15),
  ('hadith_10',    'Hadith Student', 'Completed 10 hadith episodes',      '📚', 75),
  ('hadith_40',    'Hadith Scholar', 'Completed 40 hadith episodes',      '🏛️', 300)
ON CONFLICT (slug) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- PART 4: REFERRAL SPEED INDEXES
-- ═══════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_profiles_referral_code_upper
  ON public.profiles (upper(referral_code));

CREATE INDEX IF NOT EXISTS idx_profiles_referral_code
  ON public.profiles (referral_code)
  WHERE referral_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_referrals_referred_id
  ON public.referrals (referred_id);

-- Normalise all referral codes to uppercase
UPDATE public.profiles
SET referral_code = upper(referral_code)
WHERE referral_code IS NOT NULL
  AND referral_code != upper(referral_code);

-- ═══════════════════════════════════════════════════════════════════════════
-- PART 5: is_admin() HELPER + ADMIN RLS POLICIES
-- ═══════════════════════════════════════════════════════════════════════════

-- Ensure is_admin() exists before any policy that depends on it.
-- Returns true when the calling user has an admin-level role in profiles.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin', 'editor', 'content', 'support')
  )
$$;

DROP POLICY IF EXISTS "Admins manage subscriptions"  ON public.subscriptions;
CREATE POLICY "Admins manage subscriptions"
  ON public.subscriptions FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins manage any profile"    ON public.profiles;
CREATE POLICY "Admins manage any profile"
  ON public.profiles FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins manage app_settings"   ON public.app_settings;
CREATE POLICY "Admins manage app_settings"
  ON public.app_settings FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins manage any xp"         ON public.user_xp;
CREATE POLICY "Admins manage any xp"
  ON public.user_xp FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins manage any badges"     ON public.user_badges;
CREATE POLICY "Admins manage any badges"
  ON public.user_badges FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins manage xp log"         ON public.daily_xp_log;
CREATE POLICY "Admins manage xp log"
  ON public.daily_xp_log FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ═══════════════════════════════════════════════════════════════════════════
-- PART 6: UPDATE check_and_award_badges FUNCTION (with Hadith support)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.check_and_award_badges(p_user_id UUID)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $func$
DECLARE
  v_xp INTEGER; v_level INTEGER; v_streak INTEGER;
  v_episode_count INTEGER; v_surah_count INTEGER;
  v_journey_started INTEGER; v_journey_completed INTEGER;
  v_hadith_count INTEGER;
BEGIN
  SELECT COALESCE(total_xp, 0), COALESCE(level, 1) INTO v_xp, v_level
  FROM public.user_xp WHERE user_id = p_user_id;
  SELECT COALESCE(current_streak, 0) INTO v_streak
  FROM public.user_streaks WHERE user_id = p_user_id;
  SELECT COUNT(*) INTO v_episode_count FROM public.listening_progress
  WHERE user_id = p_user_id AND content_type = 'episode' AND completed = true;
  SELECT COUNT(*) INTO v_surah_count FROM public.listening_progress
  WHERE user_id = p_user_id AND content_type = 'surah' AND completed = true;
  SELECT COUNT(*) INTO v_journey_started FROM public.journey_progress WHERE user_id = p_user_id;
  SELECT COUNT(*) INTO v_journey_completed FROM public.journey_progress
  WHERE user_id = p_user_id AND completed = true;
  SELECT COUNT(*) INTO v_hadith_count
  FROM public.listening_progress lp
  JOIN public.episodes e ON e.id::text = lp.content_id
  JOIN public.series s ON s.id = e.series_id
  JOIN public.categories c ON c.id = s.category_id
  WHERE lp.user_id = p_user_id AND lp.content_type = 'episode'
    AND lp.completed = true AND c.slug = 'hadith';
  IF v_episode_count >= 1  THEN PERFORM public.award_badge(p_user_id, 'first_listen');    END IF;
  IF v_surah_count >= 1    THEN PERFORM public.award_badge(p_user_id, 'quran_start');     END IF;
  IF v_surah_count >= 114  THEN PERFORM public.award_badge(p_user_id, 'quran_complete');  END IF;
  IF v_streak >= 3         THEN PERFORM public.award_badge(p_user_id, 'streak_3');        END IF;
  IF v_streak >= 7         THEN PERFORM public.award_badge(p_user_id, 'streak_7');        END IF;
  IF v_streak >= 30        THEN PERFORM public.award_badge(p_user_id, 'streak_30');       END IF;
  IF v_level >= 5          THEN PERFORM public.award_badge(p_user_id, 'level_5');         END IF;
  IF v_level >= 10         THEN PERFORM public.award_badge(p_user_id, 'level_10');        END IF;
  IF v_journey_started >= 1  THEN PERFORM public.award_badge(p_user_id, 'journey_start');    END IF;
  IF v_journey_completed >= 20 THEN PERFORM public.award_badge(p_user_id, 'journey_complete'); END IF;
  IF v_hadith_count >= 1   THEN PERFORM public.award_badge(p_user_id, 'hadith_start');    END IF;
  IF v_hadith_count >= 10  THEN PERFORM public.award_badge(p_user_id, 'hadith_10');       END IF;
  IF v_hadith_count >= 40  THEN PERFORM public.award_badge(p_user_id, 'hadith_40');       END IF;
END;
$func$;

NOTIFY pgrst, 'reload schema';

SELECT 'master_patches applied successfully' AS result;
