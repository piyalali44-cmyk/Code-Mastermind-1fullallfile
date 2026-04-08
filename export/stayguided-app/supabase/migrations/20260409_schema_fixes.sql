-- ═══════════════════════════════════════════════════════════════════════════
-- Schema Fixes — profiles.first_active_at + master_patches update
-- Run this in Supabase SQL Editor (Project → SQL Editor → New query → Run)
-- Safe to re-run — uses IF NOT EXISTS
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Add first_active_at column (tracks when user first opened the app)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_active_at TIMESTAMPTZ;

-- 2. Re-create the self-healing RPC with this column included
--    (This updates stayguided_apply_patches() to include first_active_at
--     so the API server no longer warns on startup)
CREATE OR REPLACE FUNCTION public.stayguided_apply_patches()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $outer$
BEGIN
  ALTER TABLE public.episodes        ADD COLUMN IF NOT EXISTS image_url           TEXT;
  ALTER TABLE public.episodes        ADD COLUMN IF NOT EXISTS access_tier         TEXT DEFAULT 'free';
  ALTER TABLE public.series          ADD COLUMN IF NOT EXISTS access_tier         TEXT DEFAULT 'free';
  ALTER TABLE public.push_campaigns  ADD COLUMN IF NOT EXISTS image_url           TEXT;
  ALTER TABLE public.notifications   ADD COLUMN IF NOT EXISTS image_url           TEXT;
  ALTER TABLE public.profiles        ADD COLUMN IF NOT EXISTS push_token          TEXT;
  ALTER TABLE public.profiles        ADD COLUMN IF NOT EXISTS first_active_at     TIMESTAMPTZ;
  ALTER TABLE public.subscriptions   ADD COLUMN IF NOT EXISTS store               TEXT;
  ALTER TABLE public.subscriptions   ADD COLUMN IF NOT EXISTS product_id          TEXT;
  ALTER TABLE public.subscriptions   ADD COLUMN IF NOT EXISTS original_transaction_id TEXT;

  UPDATE public.episodes SET access_tier = 'premium' WHERE is_premium = true AND access_tier = 'free';
  UPDATE public.series   SET access_tier = 'premium' WHERE is_premium = true AND access_tier = 'free';

  CREATE INDEX IF NOT EXISTS idx_subscriptions_store          ON public.subscriptions (store);
  CREATE INDEX IF NOT EXISTS idx_episodes_access_tier         ON public.episodes (access_tier);
  CREATE INDEX IF NOT EXISTS idx_series_access_tier           ON public.series (access_tier);
  CREATE INDEX IF NOT EXISTS idx_profiles_referral_code_upper ON public.profiles (upper(referral_code));
  CREATE INDEX IF NOT EXISTS idx_profiles_referral_code       ON public.profiles (referral_code) WHERE referral_code IS NOT NULL;
  CREATE INDEX IF NOT EXISTS idx_referrals_referred_id        ON public.referrals (referred_id);

  UPDATE public.profiles SET referral_code = upper(referral_code)
  WHERE referral_code IS NOT NULL AND referral_code != upper(referral_code);

  CREATE TABLE IF NOT EXISTS public.coupon_codes (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code                    TEXT NOT NULL UNIQUE,
    coupon_type             TEXT NOT NULL DEFAULT 'percentage',
    discount_value          NUMERIC(10,2) DEFAULT 0,
    free_days               INTEGER,
    xp_bonus                INTEGER,
    description             TEXT,
    applies_to_weekly       BOOLEAN DEFAULT TRUE,
    applies_to_monthly      BOOLEAN DEFAULT TRUE,
    max_total_uses          INTEGER,
    max_uses_per_user       INTEGER DEFAULT 1,
    new_users_only          BOOLEAN DEFAULT FALSE,
    first_subscription_only BOOLEAN DEFAULT FALSE,
    influencer_name         TEXT,
    redemption_count        INTEGER NOT NULL DEFAULT 0,
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    expires_at              TIMESTAMPTZ,
    created_by              UUID REFERENCES public.profiles(id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  ALTER TABLE public.coupon_codes ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.coupon_codes ADD COLUMN IF NOT EXISTS xp_bonus                INTEGER;
  ALTER TABLE public.coupon_codes ADD COLUMN IF NOT EXISTS free_days               INTEGER;
  ALTER TABLE public.coupon_codes ADD COLUMN IF NOT EXISTS applies_to_weekly       BOOLEAN DEFAULT TRUE;
  ALTER TABLE public.coupon_codes ADD COLUMN IF NOT EXISTS applies_to_monthly      BOOLEAN DEFAULT TRUE;
  ALTER TABLE public.coupon_codes ADD COLUMN IF NOT EXISTS first_subscription_only BOOLEAN DEFAULT FALSE;
  ALTER TABLE public.coupon_codes ADD COLUMN IF NOT EXISTS influencer_name         TEXT;

  CREATE TABLE IF NOT EXISTS public.coupon_redemptions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coupon_id   UUID NOT NULL REFERENCES public.coupon_codes(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES public.profiles(id)     ON DELETE CASCADE,
    redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (coupon_id, user_id)
  );
  ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;

  EXECUTE $exec$
    CREATE OR REPLACE FUNCTION public.is_admin()
    RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
      SELECT EXISTS (SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('super_admin','admin','editor','content','support'))
    $$
  $exec$;

  DROP POLICY IF EXISTS "Admins manage subscriptions" ON public.subscriptions;
  CREATE POLICY "Admins manage subscriptions"   ON public.subscriptions   FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
  DROP POLICY IF EXISTS "Admins manage any profile"   ON public.profiles;
  CREATE POLICY "Admins manage any profile"     ON public.profiles        FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
  DROP POLICY IF EXISTS "Admins manage app_settings"  ON public.app_settings;
  CREATE POLICY "Admins manage app_settings"    ON public.app_settings    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
  DROP POLICY IF EXISTS "Admins manage any xp"        ON public.user_xp;
  CREATE POLICY "Admins manage any xp"          ON public.user_xp         FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
  DROP POLICY IF EXISTS "Admins manage any badges"    ON public.user_badges;
  CREATE POLICY "Admins manage any badges"      ON public.user_badges     FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
  DROP POLICY IF EXISTS "Admins manage xp log"        ON public.daily_xp_log;
  CREATE POLICY "Admins manage xp log"          ON public.daily_xp_log   FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
  DROP POLICY IF EXISTS "Admins manage coupons"       ON public.coupon_codes;
  CREATE POLICY "Admins manage coupons"         ON public.coupon_codes    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
  DROP POLICY IF EXISTS "Coupons readable by authed"  ON public.coupon_codes;
  CREATE POLICY "Coupons readable by authed"    ON public.coupon_codes    FOR SELECT TO authenticated USING (is_active = TRUE AND (expires_at IS NULL OR expires_at > NOW()));
  DROP POLICY IF EXISTS "Users view own redemptions"  ON public.coupon_redemptions;
  CREATE POLICY "Users view own redemptions"    ON public.coupon_redemptions FOR SELECT TO authenticated USING (auth.uid() = user_id);
  DROP POLICY IF EXISTS "Admins manage redemptions"   ON public.coupon_redemptions;
  CREATE POLICY "Admins manage redemptions"     ON public.coupon_redemptions FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
  DROP POLICY IF EXISTS "Admins view referrals"       ON public.referrals;
  CREATE POLICY "Admins view referrals"         ON public.referrals       FOR SELECT TO authenticated USING (public.is_admin());

  GRANT SELECT, INSERT, UPDATE ON public.coupon_codes       TO authenticated;
  GRANT SELECT, INSERT         ON public.coupon_redemptions TO authenticated;
  GRANT SELECT, INSERT, UPDATE ON public.user_xp            TO authenticated;
  GRANT SELECT, INSERT, DELETE ON public.user_badges        TO authenticated;
  GRANT SELECT, INSERT         ON public.daily_xp_log       TO authenticated;
  GRANT SELECT, INSERT, UPDATE ON public.subscriptions      TO authenticated;

  INSERT INTO public.badges (slug, name, description, icon, xp_reward) VALUES
    ('hadith_start', 'Hadith Seeker',  'First hadith episode completed',  '📜', 15),
    ('hadith_10',    'Hadith Student', 'Completed 10 hadith episodes',    '📚', 75),
    ('hadith_40',    'Hadith Scholar', 'Completed 40 hadith episodes',    '🏛️', 300)
  ON CONFLICT (slug) DO NOTHING;

  INSERT INTO public.app_settings (key, value, description, type)
  VALUES ('lifetime_price_usd', '49.99', 'Lifetime subscription price (USD)', 'number')
  ON CONFLICT (key) DO NOTHING;

  NOTIFY pgrst, 'reload schema';
  RETURN jsonb_build_object('ok', true, 'applied_at', NOW()::text);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM, 'state', SQLSTATE);
END;
$outer$;

GRANT EXECUTE ON FUNCTION public.stayguided_apply_patches() TO service_role;

NOTIFY pgrst, 'reload schema';

SELECT 'Schema fix applied: profiles.first_active_at added and RPC updated ✓' AS result;
