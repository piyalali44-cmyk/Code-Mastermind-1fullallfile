-- ╔══════════════════════════════════════════════════════════════════════════════╗
-- ║  StayGuided Me — MASTER MIGRATION                                            ║
-- ║  Combines: fix_redeem_system + fix_library_tables + fix_admin_permissions     ║
-- ║  Run once in: Supabase Dashboard → SQL Editor → New Query                    ║
-- ║  Safe to re-run — uses IF NOT EXISTS / CREATE OR REPLACE / ON CONFLICT       ║
-- ╚══════════════════════════════════════════════════════════════════════════════╝

-- ═══════════════════════════════════════════════════════════════════════════════
-- PART 1: LIBRARY TABLES (favourites, bookmarks, downloads)
-- ═══════════════════════════════════════════════════════════════════════════════

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
  id               UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content_type     TEXT NOT NULL CHECK (content_type IN ('surah', 'episode')),
  content_id       TEXT NOT NULL,
  title            TEXT NOT NULL DEFAULT '',
  file_size_bytes  INTEGER,
  downloaded_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, content_type, content_id)
);
ALTER TABLE public.downloads ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users manage own downloads" ON public.downloads
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
GRANT ALL ON public.downloads TO authenticated;
GRANT ALL ON public.downloads TO service_role;

-- ═══════════════════════════════════════════════════════════════════════════════
-- PART 2: COUPON CODES TABLE FIX (ensure coupon_type column exists)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Ensure coupon_codes table has coupon_type column (rename from "type" if needed)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='coupon_codes' AND column_name='type')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='coupon_codes' AND column_name='coupon_type') THEN
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

-- ═══════════════════════════════════════════════════════════════════════════════
-- PART 3: COUPON REDEMPTIONS TABLE
-- ═══════════════════════════════════════════════════════════════════════════════

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
DROP POLICY IF EXISTS "Service role manages redemptions" ON public.coupon_redemptions;
CREATE POLICY "Users view own redemptions"
  ON public.coupon_redemptions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Admins manage redemptions"
  ON public.coupon_redemptions FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Service role manages redemptions"
  ON public.coupon_redemptions FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════════════════════
-- PART 4: ADMIN RLS POLICIES
-- ═══════════════════════════════════════════════════════════════════════════════

-- user_xp
DROP POLICY IF EXISTS "Admins manage any xp" ON public.user_xp;
DROP POLICY IF EXISTS "Admins manage xp"     ON public.user_xp;
CREATE POLICY "Admins manage any xp"
  ON public.user_xp FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- user_badges
DROP POLICY IF EXISTS "Admins manage any badges" ON public.user_badges;
DROP POLICY IF EXISTS "Admins delete badges"     ON public.user_badges;
CREATE POLICY "Admins manage any badges"
  ON public.user_badges FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- daily_xp_log
DROP POLICY IF EXISTS "Admins manage xp log" ON public.daily_xp_log;
CREATE POLICY "Admins manage xp log"
  ON public.daily_xp_log FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- subscriptions
DROP POLICY IF EXISTS "Admins manage subscriptions" ON public.subscriptions;
CREATE POLICY "Admins manage subscriptions"
  ON public.subscriptions FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- profiles
DROP POLICY IF EXISTS "Admins manage any profile" ON public.profiles;
CREATE POLICY "Admins manage any profile"
  ON public.profiles FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- referrals
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins view referrals" ON public.referrals;
CREATE POLICY "Admins view referrals"
  ON public.referrals FOR SELECT TO authenticated
  USING (public.is_admin());

-- ═══════════════════════════════════════════════════════════════════════════════
-- PART 5: SECURITY DEFINER FUNCTIONS
-- ═══════════════════════════════════════════════════════════════════════════════

-- admin_award_xp: Award XP to any user (bypasses RLS)
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
    updated_at = NOW();
  INSERT INTO public.daily_xp_log (user_id, xp_amount, reason)
  VALUES (p_user_id, p_amount, p_reason);
  RETURN jsonb_build_object('success', true, 'new_xp', v_new, 'level', v_level);
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_award_xp TO authenticated;

-- admin_grant_badge: Award badge to any user (bypasses RLS)
CREATE OR REPLACE FUNCTION public.admin_grant_badge(
  p_user_id UUID,
  p_badge_id UUID
)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  INSERT INTO public.user_badges (user_id, badge_id)
  VALUES (p_user_id, p_badge_id)
  ON CONFLICT (user_id, badge_id) DO NOTHING;
  RETURN jsonb_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_grant_badge TO authenticated;

-- redeem_code: Validate and apply a coupon code
CREATE OR REPLACE FUNCTION public.redeem_code(p_code TEXT, p_user_id UUID)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_coupon       public.coupon_codes%ROWTYPE;
  v_already_used BOOLEAN;
  v_xp_award     INTEGER := 0;
  v_free_days    INTEGER := 0;
BEGIN
  SELECT * INTO v_coupon
  FROM public.coupon_codes
  WHERE upper(trim(code)) = upper(trim(p_code));

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_a_coupon');
  END IF;

  IF NOT v_coupon.is_active THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_code');
  END IF;

  IF v_coupon.expires_at IS NOT NULL AND v_coupon.expires_at < NOW() THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_code');
  END IF;

  IF v_coupon.max_total_uses IS NOT NULL
     AND v_coupon.redemption_count >= v_coupon.max_total_uses THEN
    RETURN jsonb_build_object('success', false, 'error', 'code_exhausted');
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.coupon_redemptions
    WHERE coupon_id = v_coupon.id AND user_id = p_user_id
  ) INTO v_already_used;

  IF v_already_used THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_used');
  END IF;

  -- Check new_users_only
  IF v_coupon.new_users_only THEN
    IF EXISTS (SELECT 1 FROM public.coupon_redemptions WHERE user_id = p_user_id)
       OR EXISTS (SELECT 1 FROM public.subscriptions WHERE user_id = p_user_id AND status = 'active') THEN
      RETURN jsonb_build_object('success', false, 'error', 'new_users_only');
    END IF;
  END IF;

  INSERT INTO public.coupon_redemptions (coupon_id, user_id)
  VALUES (v_coupon.id, p_user_id)
  ON CONFLICT (coupon_id, user_id) DO NOTHING;

  UPDATE public.coupon_codes
  SET redemption_count = redemption_count + 1
  WHERE id = v_coupon.id;

  CASE v_coupon.coupon_type
    WHEN 'free_days' THEN
      v_free_days := GREATEST(1, COALESCE(v_coupon.discount_value::INTEGER, 7));
      v_xp_award  := v_free_days * 20;
    WHEN 'free_period' THEN
      v_free_days := COALESCE(v_coupon.discount_value::INTEGER, 30);
      v_xp_award  := 200;
    WHEN 'influencer' THEN
      v_xp_award  := 300;
    WHEN 'percentage', 'fixed', 'price_override' THEN
      v_xp_award  := 50;
    ELSE
      v_xp_award  := 50;
  END CASE;

  IF v_xp_award > 0 THEN
    INSERT INTO public.user_xp (user_id, total_xp, level, updated_at)
    VALUES (p_user_id, v_xp_award, 1, NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      total_xp   = public.user_xp.total_xp + v_xp_award,
      level      = GREATEST(1, FLOOR((public.user_xp.total_xp + v_xp_award)::FLOAT / 500)::INTEGER + 1),
      updated_at = NOW();
    INSERT INTO public.daily_xp_log (user_id, xp_amount, reason)
    VALUES (p_user_id, v_xp_award, 'coupon_' || v_coupon.coupon_type);
  END IF;

  RETURN jsonb_build_object(
    'success',     true,
    'type',        v_coupon.coupon_type,
    'xp_bonus',    v_xp_award,
    'free_days',   CASE WHEN v_free_days > 0 THEN v_free_days ELSE NULL END,
    'description', v_coupon.description
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.redeem_code(TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.redeem_code(TEXT, UUID) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════
-- PART 6: ENSURE push_token COLUMN EXISTS ON PROFILES
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS push_token TEXT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- PART 7: BACKFILL REFERRAL CODES FOR EXISTING USERS
-- ═══════════════════════════════════════════════════════════════════════════════

UPDATE public.profiles
SET referral_code = 'SG' || upper(substring(replace(id::text, '-', ''), 1, 6))
WHERE referral_code IS NULL OR referral_code = '';

-- ═══════════════════════════════════════════════════════════════════════════════
-- PART 8: ENSURE user_xp ROWS FOR ALL EXISTING USERS
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT INTO public.user_xp (user_id)
SELECT id FROM public.profiles
WHERE id NOT IN (SELECT user_id FROM public.user_xp)
ON CONFLICT (user_id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════════
-- PART 9: TABLE GRANTS
-- ═══════════════════════════════════════════════════════════════════════════════

GRANT SELECT, INSERT, UPDATE ON public.coupon_codes       TO authenticated;
GRANT SELECT, INSERT         ON public.coupon_redemptions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.user_xp            TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.user_badges        TO authenticated;
GRANT SELECT, INSERT         ON public.daily_xp_log       TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.subscriptions      TO authenticated;
GRANT ALL                    ON public.favourites         TO authenticated;
GRANT ALL                    ON public.bookmarks          TO authenticated;
GRANT ALL                    ON public.downloads          TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════
-- DONE!
-- ═══════════════════════════════════════════════════════════════════════════════
SELECT 'master_migration.sql applied successfully ✓' AS status;
