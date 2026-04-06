-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║  StayGuided Me — TRANSACTIONS PAGE PATCH                              ║
-- ║  Run in: Supabase Dashboard → SQL Editor → New Query                  ║
-- ║  Safe to re-run — uses ON CONFLICT DO NOTHING / CREATE OR REPLACE     ║
-- ╚════════════════════════════════════════════════════════════════════════╝

-- ─── 1. Add lifetime_price_usd to app_settings if missing ─────────────────
INSERT INTO public.app_settings (key, value, description, type)
VALUES ('lifetime_price_usd', '49.99', 'Lifetime subscription price (USD)', 'number')
ON CONFLICT (key) DO NOTHING;

-- ─── 2. Ensure admin can read ALL subscriptions (idempotent) ──────────────
DROP POLICY IF EXISTS "Admin reads subscriptions"   ON public.subscriptions;
DROP POLICY IF EXISTS "Admins manage subscriptions"  ON public.subscriptions;

CREATE POLICY "Admins manage subscriptions"
  ON public.subscriptions FOR ALL
  TO authenticated
  USING    (public.is_admin())
  WITH CHECK (public.is_admin());

-- ─── 3. Ensure admin can read ALL profiles (for user name/email join) ─────
DROP POLICY IF EXISTS "Admins manage any profile"   ON public.profiles;

CREATE POLICY "Admins manage any profile"
  ON public.profiles FOR ALL
  TO authenticated
  USING    (public.is_admin())
  WITH CHECK (public.is_admin());

-- ─── 4. Ensure admin can read app_settings ────────────────────────────────
DROP POLICY IF EXISTS "Admins manage app_settings"  ON public.app_settings;

CREATE POLICY "Admins manage app_settings"
  ON public.app_settings FOR ALL
  TO authenticated
  USING    (public.is_admin())
  WITH CHECK (public.is_admin());

-- Done ✓
SELECT 'transactions_patch applied successfully' AS result;
-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║  StayGuided Me — REFERRAL SPEED PATCH                                 ║
-- ║  Run in: Supabase Dashboard → SQL Editor → New Query                  ║
-- ║  Optimizes referral code redemption from ~10 DB calls → 1 RPC call   ║
-- ╚════════════════════════════════════════════════════════════════════════╝

-- ─── 1. Functional index on referral_code (case-insensitive fast lookup) ─────
-- Speeds up: WHERE upper(referral_code) = upper(p_code)
CREATE INDEX IF NOT EXISTS idx_profiles_referral_code_upper
  ON public.profiles (upper(referral_code));

-- Also index the plain column for exact-match lookups
CREATE INDEX IF NOT EXISTS idx_profiles_referral_code
  ON public.profiles (referral_code)
  WHERE referral_code IS NOT NULL;

-- ─── 2. Ensure all referral codes are stored uppercase ────────────────────────
UPDATE public.profiles
SET referral_code = upper(referral_code)
WHERE referral_code IS NOT NULL
  AND referral_code != upper(referral_code);

-- ─── 3. Index on referrals.referred_id for duplicate-check query ─────────────
CREATE INDEX IF NOT EXISTS idx_referrals_referred_id
  ON public.referrals (referred_id);

-- ─── 4. Replace apply_referral_code with optimised version ───────────────────
-- Changes: uses upper(referral_code) = upper(p_code) to hit the new index,
-- and awards XP using atomic ON CONFLICT DO UPDATE (single upsert per user).
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

  -- Uses idx_profiles_referral_code_upper index — no full scan
  SELECT id INTO v_referrer_id
  FROM public.profiles
  WHERE upper(referral_code) = v_clean_code
    AND id != v_caller
  LIMIT 1;

  IF v_referrer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_code');
  END IF;

  -- Uses idx_referrals_referred_id index
  IF EXISTS (SELECT 1 FROM public.referrals WHERE referred_id = v_caller LIMIT 1) THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_used');
  END IF;

  -- Insert referral record
  INSERT INTO public.referrals (referrer_id, referred_id, code_used, xp_awarded_referrer, xp_awarded_referred)
  VALUES (v_referrer_id, v_caller, v_clean_code, 500, 100)
  ON CONFLICT (referred_id) DO NOTHING;

  -- Check if insert actually happened (in case of race condition)
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_used');
  END IF;

  -- Award XP to referrer (atomic upsert — no separate select needed)
  INSERT INTO public.user_xp (user_id, total_xp, level, updated_at)
  VALUES (v_referrer_id, 500, 2, NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    total_xp   = public.user_xp.total_xp + 500,
    level      = GREATEST(1, FLOOR((public.user_xp.total_xp + 500)::FLOAT / 500)::INTEGER + 1),
    updated_at = NOW();

  INSERT INTO public.daily_xp_log (user_id, xp_amount, reason)
  VALUES (v_referrer_id, 500, 'referral_friend_joined');

  -- Award XP to referred user
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

-- ─── 5. Service-role-safe version (for API server calls) ─────────────────────
-- Same logic but takes p_user_id explicitly (auth.uid() is null for service role).
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

-- ─── 6. Grant execute permissions ─────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.apply_referral_code(TEXT)          TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_referral_by_id(TEXT, UUID) TO service_role;

-- Done ✓
SELECT 'referral_speed_patch applied — referral redemption now uses 1 DB call' AS result;
