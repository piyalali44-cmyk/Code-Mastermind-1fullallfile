-- =============================================================================
-- FIX: Redeem Code System (Coupons + Referrals)
-- Run this in Supabase SQL Editor
-- =============================================================================

-- ─── 1. redeem_code() ─────────────────────────────────────────────────────────
-- Called by the API server with service_role to validate & redeem coupon codes.
-- Returns JSONB: { success, type?, xp_bonus?, free_days?, description?, error? }
-- If code is not a coupon, returns { success: false, error: "not_a_coupon" }
-- so the API can fall through to the referral-code check.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.redeem_code(p_code TEXT, p_user_id UUID)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_coupon          public.coupon_codes%ROWTYPE;
  v_already_used    BOOLEAN;
  v_xp_award        INTEGER := 0;
  v_free_days       INTEGER := 0;
BEGIN
  -- ── 1. Look up coupon (case-insensitive) ────────────────────────────────────
  SELECT * INTO v_coupon
  FROM public.coupon_codes
  WHERE upper(trim(code)) = upper(trim(p_code));

  IF NOT FOUND THEN
    -- Not a coupon at all — caller will try referral logic
    RETURN jsonb_build_object('success', false, 'error', 'not_a_coupon');
  END IF;

  -- ── 2. Validate ─────────────────────────────────────────────────────────────
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

  -- ── 3. Check per-user usage ─────────────────────────────────────────────────
  SELECT EXISTS(
    SELECT 1 FROM public.coupon_redemptions
    WHERE coupon_id = v_coupon.id AND user_id = p_user_id
  ) INTO v_already_used;

  IF v_already_used THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_used');
  END IF;

  -- ── 4. Record redemption ────────────────────────────────────────────────────
  INSERT INTO public.coupon_redemptions (coupon_id, user_id)
  VALUES (v_coupon.id, p_user_id);

  UPDATE public.coupon_codes
  SET redemption_count = redemption_count + 1
  WHERE id = v_coupon.id;

  -- ── 5. Determine reward ─────────────────────────────────────────────────────
  CASE v_coupon.coupon_type
    WHEN 'free_days' THEN
      v_free_days := GREATEST(1, COALESCE(v_coupon.discount_value::INTEGER, 7));
      v_xp_award  := v_free_days * 20;  -- 20 XP per free day
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

  -- ── 6. Award XP ─────────────────────────────────────────────────────────────
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

  -- ── 7. Return result ────────────────────────────────────────────────────────
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

-- =============================================================================
-- 2. Ensure referral_code backfill is complete for all existing users
-- =============================================================================
UPDATE public.profiles
SET referral_code = 'SG' || upper(substring(replace(id::text, '-', ''), 1, 6))
WHERE referral_code IS NULL;

-- =============================================================================
-- 3. Ensure user_xp rows exist for all users (needed for XP awards)
-- =============================================================================
INSERT INTO public.user_xp (user_id)
SELECT id FROM public.profiles
WHERE id NOT IN (SELECT user_id FROM public.user_xp)
ON CONFLICT (user_id) DO NOTHING;

-- =============================================================================
-- 4. Grant service_role full access to coupon_redemptions
-- (for API server using service_role key)
-- =============================================================================
DROP POLICY IF EXISTS "Service role manages redemptions" ON public.coupon_redemptions;
CREATE POLICY "Service role manages redemptions" ON public.coupon_redemptions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role manages coupons" ON public.coupon_codes;
CREATE POLICY "Service role manages coupons" ON public.coupon_codes
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Allow authenticated users to view their own redemptions
DO $$ BEGIN
  CREATE POLICY "Users view own redemptions" ON public.coupon_redemptions
    FOR SELECT TO authenticated USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- DONE. Verify with:
-- SELECT redeem_code('TESTCODE', auth.uid());
-- =============================================================================
