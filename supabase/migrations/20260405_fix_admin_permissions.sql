-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║  StayGuided Me — ADMIN PERMISSIONS & COUPON FIX                       ║
-- ║  Run in: Supabase Dashboard → SQL Editor → New Query                  ║
-- ║  Safe to re-run — all statements use CREATE OR REPLACE / IF NOT EXISTS ║
-- ╚════════════════════════════════════════════════════════════════════════╝

-- ═══════════════════════════════════════════════════════════════════
-- SECTION 1: Fix RLS — allow admins to manage any user's XP
-- ═══════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Admins manage any xp"     ON public.user_xp;
DROP POLICY IF EXISTS "Admins manage xp"          ON public.user_xp;

CREATE POLICY "Admins manage any xp"
  ON public.user_xp FOR ALL
  TO authenticated
  USING    (public.is_admin())
  WITH CHECK (public.is_admin());

-- ═══════════════════════════════════════════════════════════════════
-- SECTION 2: Fix RLS — allow admins to manage any user's badges
-- ═══════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Admins manage any badges"  ON public.user_badges;
DROP POLICY IF EXISTS "Admins delete badges"      ON public.user_badges;

CREATE POLICY "Admins manage any badges"
  ON public.user_badges FOR ALL
  TO authenticated
  USING    (public.is_admin())
  WITH CHECK (public.is_admin());

-- ═══════════════════════════════════════════════════════════════════
-- SECTION 3: Fix RLS — allow admins to insert/view any XP log entry
-- ═══════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Admins manage xp log"      ON public.daily_xp_log;

CREATE POLICY "Admins manage xp log"
  ON public.daily_xp_log FOR ALL
  TO authenticated
  USING    (public.is_admin())
  WITH CHECK (public.is_admin());

-- ═══════════════════════════════════════════════════════════════════
-- SECTION 4: Fix RLS — allow admins to manage subscriptions
-- ═══════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Admins manage subscriptions" ON public.subscriptions;

CREATE POLICY "Admins manage subscriptions"
  ON public.subscriptions FOR ALL
  TO authenticated
  USING    (public.is_admin())
  WITH CHECK (public.is_admin());

-- ═══════════════════════════════════════════════════════════════════
-- SECTION 5: Fix RLS — allow admins to manage profiles
-- ═══════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Admins manage any profile" ON public.profiles;

CREATE POLICY "Admins manage any profile"
  ON public.profiles FOR ALL
  TO authenticated
  USING    (public.is_admin())
  WITH CHECK (public.is_admin());

-- ═══════════════════════════════════════════════════════════════════
-- SECTION 6: SECURITY DEFINER — admin_award_xp
-- ═══════════════════════════════════════════════════════════════════

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

-- ═══════════════════════════════════════════════════════════════════
-- SECTION 7: SECURITY DEFINER — admin_award_badge
-- ═══════════════════════════════════════════════════════════════════

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

-- ═══════════════════════════════════════════════════════════════════
-- SECTION 8: SECURITY DEFINER — admin_revoke_badge
-- ═══════════════════════════════════════════════════════════════════

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

-- ═══════════════════════════════════════════════════════════════════
-- SECTION 9: coupon_codes table (if not already created)
-- ═══════════════════════════════════════════════════════════════════

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

-- Add missing columns if table already exists (idempotent)
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
  -- Rename 'type' to 'coupon_type' if old schema exists
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='coupon_codes' AND column_name='type') AND
     NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='coupon_codes' AND column_name='coupon_type') THEN
    ALTER TABLE public.coupon_codes RENAME COLUMN type TO coupon_type;
  END IF;
END $$;

ALTER TABLE public.coupon_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage coupons"     ON public.coupon_codes;
DROP POLICY IF EXISTS "Coupons readable by authed" ON public.coupon_codes;

CREATE POLICY "Admins manage coupons"
  ON public.coupon_codes FOR ALL
  TO authenticated
  USING    (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Coupons readable by authed"
  ON public.coupon_codes FOR SELECT
  TO authenticated
  USING (is_active = TRUE AND (expires_at IS NULL OR expires_at > NOW()));

-- ═══════════════════════════════════════════════════════════════════
-- SECTION 10: coupon_redemptions table
-- ═══════════════════════════════════════════════════════════════════

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
  ON public.coupon_redemptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins manage redemptions"
  ON public.coupon_redemptions FOR ALL
  TO authenticated
  USING    (public.is_admin())
  WITH CHECK (public.is_admin());

-- ═══════════════════════════════════════════════════════════════════
-- SECTION 11: SECURITY DEFINER — redeem_code (unified: referral OR coupon)
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.redeem_code(
  p_code    TEXT,
  p_user_id UUID
)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_coupon     RECORD;
  v_redemptions INTEGER;
  v_expires    TIMESTAMPTZ;
  v_new_xp     INTEGER;
  v_cur_xp     INTEGER;
  v_level      INTEGER;
BEGIN
  -- 1. Try coupon code first
  SELECT * INTO v_coupon
  FROM public.coupon_codes
  WHERE UPPER(code) = UPPER(p_code)
    AND is_active = TRUE
    AND (expires_at IS NULL OR expires_at > NOW())
  LIMIT 1;

  IF FOUND THEN
    -- Check total uses
    IF v_coupon.max_total_uses IS NOT NULL AND
       v_coupon.redemption_count >= v_coupon.max_total_uses THEN
      RETURN jsonb_build_object('success', FALSE, 'error', 'code_exhausted');
    END IF;

    -- Check per-user uses
    SELECT COUNT(*) INTO v_redemptions
    FROM public.coupon_redemptions
    WHERE coupon_id = v_coupon.id AND user_id = p_user_id;

    IF v_redemptions >= COALESCE(v_coupon.max_uses_per_user, 1) THEN
      RETURN jsonb_build_object('success', FALSE, 'error', 'already_used');
    END IF;

    -- New user only check
    IF v_coupon.new_users_only THEN
      IF EXISTS (SELECT 1 FROM public.coupon_redemptions WHERE user_id = p_user_id) OR
         EXISTS (SELECT 1 FROM public.subscriptions WHERE user_id = p_user_id AND status = 'active') THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'new_users_only');
      END IF;
    END IF;

    -- Record redemption
    INSERT INTO public.coupon_redemptions (coupon_id, user_id)
    VALUES (v_coupon.id, p_user_id)
    ON CONFLICT (coupon_id, user_id) DO NOTHING;

    -- Increment redemption count
    UPDATE public.coupon_codes
    SET redemption_count = redemption_count + 1,
        updated_at       = NOW()
    WHERE id = v_coupon.id;

    -- Apply reward based on coupon_type
    IF v_coupon.coupon_type = 'xp_bonus' AND COALESCE(v_coupon.xp_bonus, 0) > 0 THEN
      SELECT COALESCE(total_xp, 0) INTO v_cur_xp
      FROM public.user_xp WHERE user_id = p_user_id;

      v_new_xp := COALESCE(v_cur_xp, 0) + v_coupon.xp_bonus;
      v_level  := GREATEST(1, FLOOR(v_new_xp::FLOAT / 500)::INTEGER + 1);

      INSERT INTO public.user_xp (user_id, total_xp, level, updated_at)
      VALUES (p_user_id, v_new_xp, v_level, NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        total_xp = EXCLUDED.total_xp, level = EXCLUDED.level, updated_at = EXCLUDED.updated_at;

      INSERT INTO public.daily_xp_log (user_id, xp_amount, reason)
      VALUES (p_user_id, v_coupon.xp_bonus, 'Coupon redeemed: ' || v_coupon.code);

      RETURN jsonb_build_object(
        'success', TRUE, 'type', 'xp_bonus',
        'xp_bonus', v_coupon.xp_bonus, 'description', v_coupon.description
      );

    ELSIF v_coupon.coupon_type IN ('free_days', 'free_period') AND COALESCE(v_coupon.free_days, 0) > 0 THEN
      v_expires := NOW() + (v_coupon.free_days || ' days')::INTERVAL;
      UPDATE public.profiles
      SET subscription_tier = 'premium', subscription_expires_at = v_expires
      WHERE id = p_user_id;

      INSERT INTO public.subscriptions (user_id, plan, status, started_at, expires_at, provider)
      VALUES (p_user_id, 'coupon', 'active', NOW(), v_expires, 'coupon')
      ON CONFLICT (user_id) DO UPDATE SET
        plan = 'coupon', status = 'active',
        expires_at = GREATEST(EXCLUDED.expires_at,
                              COALESCE(public.subscriptions.expires_at, NOW())),
        provider = 'coupon', updated_at = NOW();

      RETURN jsonb_build_object(
        'success', TRUE, 'type', 'free_days',
        'free_days', v_coupon.free_days, 'description', v_coupon.description
      );

    ELSE
      -- Generic coupon (percentage, fixed, price_override, influencer)
      -- Record redemption but let the payment layer apply the discount
      RETURN jsonb_build_object(
        'success', TRUE, 'type', v_coupon.coupon_type,
        'discount_value', v_coupon.discount_value,
        'description', v_coupon.description
      );
    END IF;
  END IF;

  -- 2. Not a coupon — signal to caller to try referral route
  RETURN jsonb_build_object('success', FALSE, 'error', 'not_a_coupon');
END;
$$;

GRANT EXECUTE ON FUNCTION public.redeem_code TO authenticated;

-- ═══════════════════════════════════════════════════════════════════
-- SECTION 12: Ensure referrals table has correct RLS
-- (service_role from API server bypasses RLS, but just in case)
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service inserts referrals" ON public.referrals;

-- Keep existing policies and add admin access
DROP POLICY IF EXISTS "Admins view referrals"  ON public.referrals;
CREATE POLICY "Admins view referrals"
  ON public.referrals FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- ═══════════════════════════════════════════════════════════════════
-- SECTION 13: Grant table permissions
-- ═══════════════════════════════════════════════════════════════════

GRANT SELECT, INSERT, UPDATE ON public.coupon_codes        TO authenticated;
GRANT SELECT, INSERT         ON public.coupon_redemptions  TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.user_xp             TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.user_badges         TO authenticated;
GRANT SELECT, INSERT         ON public.daily_xp_log        TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.subscriptions       TO authenticated;

-- Done!
SELECT 'fix_admin_permissions.sql applied successfully' AS status;
