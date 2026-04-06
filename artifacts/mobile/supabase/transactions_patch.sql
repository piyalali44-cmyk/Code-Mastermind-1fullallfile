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
