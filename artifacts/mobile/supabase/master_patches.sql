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
-- PART 4.5: REFERRAL RPC FUNCTIONS
-- apply_referral_code  — called by authenticated mobile user
-- process_referral_by_id — called by API server (service role)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.apply_referral_code(p_code TEXT)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_referrer_id UUID;
  v_caller      UUID := auth.uid();
  v_clean_code  TEXT := upper(trim(p_code));
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;
  SELECT id INTO v_referrer_id
  FROM public.profiles
  WHERE upper(referral_code) = v_clean_code
    AND id != v_caller
  LIMIT 1;
  IF v_referrer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_code');
  END IF;
  IF EXISTS (SELECT 1 FROM public.referrals WHERE referred_id = v_caller LIMIT 1) THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_used');
  END IF;
  INSERT INTO public.referrals (referrer_id, referred_id, code_used, xp_awarded_referrer, xp_awarded_referred)
  VALUES (v_referrer_id, v_caller, v_clean_code, 500, 100)
  ON CONFLICT (referred_id) DO NOTHING;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_used');
  END IF;
  INSERT INTO public.user_xp (user_id, total_xp, level, updated_at)
  VALUES (v_referrer_id, 500, 2, NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    total_xp   = public.user_xp.total_xp + 500,
    level      = GREATEST(1, FLOOR((public.user_xp.total_xp + 500)::FLOAT / 500)::INTEGER + 1),
    updated_at = NOW();
  INSERT INTO public.daily_xp_log (user_id, xp_amount, reason)
  VALUES (v_referrer_id, 500, 'referral_friend_joined');
  INSERT INTO public.user_xp (user_id, total_xp, level, updated_at)
  VALUES (v_caller, 100, 1, NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    total_xp   = public.user_xp.total_xp + 100,
    level      = GREATEST(1, FLOOR((public.user_xp.total_xp + 100)::FLOAT / 500)::INTEGER + 1),
    updated_at = NOW();
  INSERT INTO public.daily_xp_log (user_id, xp_amount, reason)
  VALUES (v_caller, 100, 'referral_bonus');
  RETURN jsonb_build_object('success', true, 'xp_bonus', 100, 'type', 'referral');
END;
$$;

CREATE OR REPLACE FUNCTION public.process_referral_by_id(p_code TEXT, p_user_id UUID)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_referrer_id UUID;
  v_clean_code  TEXT := upper(trim(p_code));
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;
  SELECT id INTO v_referrer_id
  FROM public.profiles
  WHERE upper(referral_code) = v_clean_code
    AND id != p_user_id
  LIMIT 1;
  IF v_referrer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_code');
  END IF;
  IF EXISTS (SELECT 1 FROM public.referrals WHERE referred_id = p_user_id LIMIT 1) THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_used');
  END IF;
  INSERT INTO public.referrals (referrer_id, referred_id, code_used, xp_awarded_referrer, xp_awarded_referred)
  VALUES (v_referrer_id, p_user_id, v_clean_code, 500, 100)
  ON CONFLICT (referred_id) DO NOTHING;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_used');
  END IF;
  INSERT INTO public.user_xp (user_id, total_xp, level, updated_at)
  VALUES (v_referrer_id, 500, 2, NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    total_xp   = public.user_xp.total_xp + 500,
    level      = GREATEST(1, FLOOR((public.user_xp.total_xp + 500)::FLOAT / 500)::INTEGER + 1),
    updated_at = NOW();
  INSERT INTO public.daily_xp_log (user_id, xp_amount, reason)
  VALUES (v_referrer_id, 500, 'referral_friend_joined');
  INSERT INTO public.user_xp (user_id, total_xp, level, updated_at)
  VALUES (p_user_id, 100, 1, NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    total_xp   = public.user_xp.total_xp + 100,
    level      = GREATEST(1, FLOOR((public.user_xp.total_xp + 100)::FLOAT / 500)::INTEGER + 1),
    updated_at = NOW();
  INSERT INTO public.daily_xp_log (user_id, xp_amount, reason)
  VALUES (p_user_id, 100, 'referral_bonus');
  RETURN jsonb_build_object('success', true, 'xp_bonus', 100, 'type', 'referral');
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_referral_code(TEXT)          TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_referral_by_id(TEXT, UUID) TO service_role;

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
-- PART 5.5: ADMIN AWARD FUNCTIONS
-- admin_award_xp, admin_award_badge, admin_revoke_badge
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.admin_award_xp(
  p_user_id UUID,
  p_amount  INTEGER,
  p_reason  TEXT DEFAULT 'Admin manual award'
)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_cur   INTEGER;
  v_new   INTEGER;
  v_level INTEGER;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  SELECT COALESCE(total_xp, 0) INTO v_cur
  FROM public.user_xp WHERE user_id = p_user_id;
  v_new   := GREATEST(0, COALESCE(v_cur, 0) + p_amount);
  v_level := GREATEST(1, FLOOR(v_new::FLOAT / 500)::INTEGER + 1);
  INSERT INTO public.user_xp (user_id, total_xp, level, updated_at)
  VALUES (p_user_id, v_new, v_level, NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    total_xp   = EXCLUDED.total_xp,
    level      = EXCLUDED.level,
    updated_at = EXCLUDED.updated_at;
  INSERT INTO public.daily_xp_log (user_id, xp_amount, reason)
  VALUES (p_user_id, p_amount, p_reason);
  RETURN jsonb_build_object('total_xp', v_new, 'level', v_level);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_award_xp TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_award_badge(
  p_user_id  UUID,
  p_badge_id UUID
)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_badge  RECORD;
  v_cur    INTEGER;
  v_new    INTEGER;
  v_level  INTEGER;
  v_rows   BIGINT;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  SELECT * INTO v_badge FROM public.badges WHERE id = p_badge_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Badge not found: %', p_badge_id;
  END IF;
  INSERT INTO public.user_badges (user_id, badge_id)
  VALUES (p_user_id, p_badge_id)
  ON CONFLICT (user_id, badge_id) DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows > 0 AND COALESCE(v_badge.xp_reward, 0) > 0 THEN
    SELECT COALESCE(total_xp, 0) INTO v_cur
    FROM public.user_xp WHERE user_id = p_user_id;
    v_new   := COALESCE(v_cur, 0) + v_badge.xp_reward;
    v_level := GREATEST(1, FLOOR(v_new::FLOAT / 500)::INTEGER + 1);
    INSERT INTO public.user_xp (user_id, total_xp, level, updated_at)
    VALUES (p_user_id, v_new, v_level, NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      total_xp   = EXCLUDED.total_xp,
      level      = EXCLUDED.level,
      updated_at = EXCLUDED.updated_at;
    INSERT INTO public.daily_xp_log (user_id, xp_amount, reason)
    VALUES (p_user_id, v_badge.xp_reward, 'Badge awarded: ' || v_badge.name);
  END IF;
  RETURN jsonb_build_object(
    'badge_id',   p_badge_id,
    'badge_name', v_badge.name,
    'xp_reward',  COALESCE(v_badge.xp_reward, 0),
    'already_had', (v_rows = 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_award_badge TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_revoke_badge(
  p_user_id  UUID,
  p_badge_id UUID
)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  DELETE FROM public.user_badges
  WHERE user_id = p_user_id AND badge_id = p_badge_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_revoke_badge TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- PART 5.6: COUPON TABLES, RLS, AND REDEEM_CODE FUNCTION
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.coupon_codes (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                     TEXT NOT NULL UNIQUE,
  coupon_type              TEXT NOT NULL DEFAULT 'percentage'
                                CHECK (coupon_type IN ('percentage','fixed','free_days','free_period','price_override','influencer','xp_bonus')),
  discount_value           NUMERIC(10,2) DEFAULT 0,
  free_days                INTEGER,
  xp_bonus                 INTEGER,
  description              TEXT,
  applies_to_weekly        BOOLEAN DEFAULT TRUE,
  applies_to_monthly       BOOLEAN DEFAULT TRUE,
  max_total_uses           INTEGER,
  max_uses_per_user        INTEGER DEFAULT 1,
  new_users_only           BOOLEAN DEFAULT FALSE,
  first_subscription_only  BOOLEAN DEFAULT FALSE,
  influencer_name          TEXT,
  redemption_count         INTEGER NOT NULL DEFAULT 0,
  is_active                BOOLEAN NOT NULL DEFAULT TRUE,
  expires_at               TIMESTAMPTZ,
  created_by               UUID REFERENCES public.profiles(id),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='coupon_codes' AND column_name='xp_bonus') THEN
    ALTER TABLE public.coupon_codes ADD COLUMN xp_bonus INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='coupon_codes' AND column_name='free_days') THEN
    ALTER TABLE public.coupon_codes ADD COLUMN free_days INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='coupon_codes' AND column_name='applies_to_weekly') THEN
    ALTER TABLE public.coupon_codes ADD COLUMN applies_to_weekly BOOLEAN DEFAULT TRUE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='coupon_codes' AND column_name='applies_to_monthly') THEN
    ALTER TABLE public.coupon_codes ADD COLUMN applies_to_monthly BOOLEAN DEFAULT TRUE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='coupon_codes' AND column_name='first_subscription_only') THEN
    ALTER TABLE public.coupon_codes ADD COLUMN first_subscription_only BOOLEAN DEFAULT FALSE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='coupon_codes' AND column_name='influencer_name') THEN
    ALTER TABLE public.coupon_codes ADD COLUMN influencer_name TEXT;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='coupon_codes' AND column_name='type') AND
     NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='coupon_codes' AND column_name='coupon_type') THEN
    ALTER TABLE public.coupon_codes RENAME COLUMN type TO coupon_type;
  END IF;
END $$;

ALTER TABLE public.coupon_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage coupons"      ON public.coupon_codes;
DROP POLICY IF EXISTS "Coupons readable by authed" ON public.coupon_codes;

CREATE POLICY "Admins manage coupons"
  ON public.coupon_codes FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Coupons readable by authed"
  ON public.coupon_codes FOR SELECT TO authenticated
  USING (is_active = TRUE AND (expires_at IS NULL OR expires_at > NOW()));

CREATE TABLE IF NOT EXISTS public.coupon_redemptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id   UUID NOT NULL REFERENCES public.coupon_codes(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (coupon_id, user_id)
);

ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own redemptions" ON public.coupon_redemptions;
DROP POLICY IF EXISTS "Admins manage redemptions"  ON public.coupon_redemptions;

CREATE POLICY "Users view own redemptions"
  ON public.coupon_redemptions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins manage redemptions"
  ON public.coupon_redemptions FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.redeem_code(p_code TEXT, p_user_id UUID)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_coupon      RECORD;
  v_redemptions INTEGER;
  v_expires     TIMESTAMPTZ;
  v_new_xp      INTEGER;
  v_cur_xp      INTEGER;
  v_level       INTEGER;
BEGIN
  SELECT * INTO v_coupon
  FROM public.coupon_codes
  WHERE UPPER(code) = UPPER(p_code)
    AND is_active = TRUE
    AND (expires_at IS NULL OR expires_at > NOW())
  LIMIT 1;
  IF FOUND THEN
    IF v_coupon.max_total_uses IS NOT NULL AND
       v_coupon.redemption_count >= v_coupon.max_total_uses THEN
      RETURN jsonb_build_object('success', FALSE, 'error', 'code_exhausted');
    END IF;
    SELECT COUNT(*) INTO v_redemptions
    FROM public.coupon_redemptions
    WHERE coupon_id = v_coupon.id AND user_id = p_user_id;
    IF v_redemptions >= COALESCE(v_coupon.max_uses_per_user, 1) THEN
      RETURN jsonb_build_object('success', FALSE, 'error', 'already_used');
    END IF;
    IF v_coupon.new_users_only THEN
      IF EXISTS (SELECT 1 FROM public.coupon_redemptions WHERE user_id = p_user_id) OR
         EXISTS (SELECT 1 FROM public.subscriptions WHERE user_id = p_user_id AND status = 'active') THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'new_users_only');
      END IF;
    END IF;
    INSERT INTO public.coupon_redemptions (coupon_id, user_id)
    VALUES (v_coupon.id, p_user_id)
    ON CONFLICT (coupon_id, user_id) DO NOTHING;
    UPDATE public.coupon_codes
    SET redemption_count = redemption_count + 1, updated_at = NOW()
    WHERE id = v_coupon.id;
    IF v_coupon.coupon_type = 'xp_bonus' AND COALESCE(v_coupon.xp_bonus, 0) > 0 THEN
      SELECT COALESCE(total_xp, 0) INTO v_cur_xp FROM public.user_xp WHERE user_id = p_user_id;
      v_new_xp := COALESCE(v_cur_xp, 0) + v_coupon.xp_bonus;
      v_level  := GREATEST(1, FLOOR(v_new_xp::FLOAT / 500)::INTEGER + 1);
      INSERT INTO public.user_xp (user_id, total_xp, level, updated_at)
      VALUES (p_user_id, v_new_xp, v_level, NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        total_xp = EXCLUDED.total_xp, level = EXCLUDED.level, updated_at = EXCLUDED.updated_at;
      INSERT INTO public.daily_xp_log (user_id, xp_amount, reason)
      VALUES (p_user_id, v_coupon.xp_bonus, 'Coupon redeemed: ' || v_coupon.code);
      RETURN jsonb_build_object('success', TRUE, 'type', 'xp_bonus',
        'xp_bonus', v_coupon.xp_bonus, 'description', v_coupon.description);
    ELSIF v_coupon.coupon_type IN ('free_days', 'free_period') AND COALESCE(v_coupon.free_days, 0) > 0 THEN
      v_expires := NOW() + (v_coupon.free_days || ' days')::INTERVAL;
      UPDATE public.profiles
      SET subscription_tier = 'premium', subscription_expires_at = v_expires
      WHERE id = p_user_id;
      INSERT INTO public.subscriptions (user_id, plan, status, started_at, expires_at, provider)
      VALUES (p_user_id, 'coupon', 'active', NOW(), v_expires, 'coupon')
      ON CONFLICT (user_id) DO UPDATE SET
        plan = 'coupon', status = 'active',
        expires_at = GREATEST(EXCLUDED.expires_at, COALESCE(public.subscriptions.expires_at, NOW())),
        provider = 'coupon', updated_at = NOW();
      RETURN jsonb_build_object('success', TRUE, 'type', 'free_days',
        'free_days', v_coupon.free_days, 'description', v_coupon.description);
    ELSE
      RETURN jsonb_build_object('success', TRUE, 'type', v_coupon.coupon_type,
        'discount_value', v_coupon.discount_value, 'description', v_coupon.description);
    END IF;
  END IF;
  RETURN jsonb_build_object('success', FALSE, 'error', 'not_a_coupon');
END;
$$;

GRANT EXECUTE ON FUNCTION public.redeem_code TO authenticated;

-- Referrals RLS: admin visibility
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins view referrals" ON public.referrals;
CREATE POLICY "Admins view referrals"
  ON public.referrals FOR SELECT TO authenticated
  USING (public.is_admin());

-- Table-level grants for coupon and related tables
GRANT SELECT, INSERT, UPDATE ON public.coupon_codes        TO authenticated;
GRANT SELECT, INSERT         ON public.coupon_redemptions  TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.user_xp             TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.user_badges         TO authenticated;
GRANT SELECT, INSERT         ON public.daily_xp_log        TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.subscriptions       TO authenticated;

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

-- ═══════════════════════════════════════════════════════════════════════════
-- PART 7: stayguided_apply_patches() RPC
-- API server calls this at startup via service-role client.
-- After this file is run once in Supabase SQL Editor, every subsequent
-- API server restart is self-healing for column additions and indexes.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.stayguided_apply_patches()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Column additions (all idempotent: ADD COLUMN IF NOT EXISTS)
  ALTER TABLE public.episodes        ADD COLUMN IF NOT EXISTS image_url TEXT;
  ALTER TABLE public.push_campaigns  ADD COLUMN IF NOT EXISTS image_url TEXT;
  ALTER TABLE public.notifications   ADD COLUMN IF NOT EXISTS image_url TEXT;
  ALTER TABLE public.profiles        ADD COLUMN IF NOT EXISTS push_token TEXT;
  ALTER TABLE public.subscriptions   ADD COLUMN IF NOT EXISTS store TEXT;
  ALTER TABLE public.subscriptions   ADD COLUMN IF NOT EXISTS product_id TEXT;
  ALTER TABLE public.subscriptions   ADD COLUMN IF NOT EXISTS original_transaction_id TEXT;

  -- Indexes (all idempotent: CREATE INDEX IF NOT EXISTS)
  CREATE INDEX IF NOT EXISTS idx_subscriptions_store
    ON public.subscriptions (store);
  CREATE INDEX IF NOT EXISTS idx_profiles_referral_code_upper
    ON public.profiles (upper(referral_code));
  CREATE INDEX IF NOT EXISTS idx_profiles_referral_code
    ON public.profiles (referral_code)
    WHERE referral_code IS NOT NULL;
  CREATE INDEX IF NOT EXISTS idx_referrals_referred_id
    ON public.referrals (referred_id);

  -- Data normalisation: uppercase all referral codes
  UPDATE public.profiles
  SET referral_code = upper(referral_code)
  WHERE referral_code IS NOT NULL
    AND referral_code != upper(referral_code);

  -- Re-seed hadith badges (ON CONFLICT DO NOTHING = idempotent)
  INSERT INTO public.badges (slug, name, description, icon, xp_reward) VALUES
    ('hadith_start', 'Hadith Seeker',  'First hadith episode completed',  '📜', 15),
    ('hadith_10',    'Hadith Student', 'Completed 10 hadith episodes',    '📚', 75),
    ('hadith_40',    'Hadith Scholar', 'Completed 40 hadith episodes',    '🏛️', 300)
  ON CONFLICT (slug) DO NOTHING;

  -- Re-seed lifetime price setting (ON CONFLICT DO NOTHING = idempotent)
  INSERT INTO public.app_settings (key, value, description, type)
  VALUES ('lifetime_price_usd', '49.99', 'Lifetime subscription price (USD)', 'number')
  ON CONFLICT (key) DO NOTHING;

  RETURN jsonb_build_object('ok', true, 'applied_at', NOW()::text);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM, 'state', SQLSTATE);
END;
$$;

NOTIFY pgrst, 'reload schema';

SELECT 'master_patches applied successfully' AS result;
