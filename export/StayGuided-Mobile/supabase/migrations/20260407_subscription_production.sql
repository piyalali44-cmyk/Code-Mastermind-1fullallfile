-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║  StayGuided Me — SUBSCRIPTION PRODUCTION COLUMNS                      ║
-- ║  Run in: Supabase Dashboard → SQL Editor → New Query                  ║
-- ║  Safe to re-run — uses ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT ║
-- ╚════════════════════════════════════════════════════════════════════════╝

-- ─── 1. Add store column (App Store / Google Play / stripe / manual) ──────────
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS store TEXT;

-- ─── 2. Add product_id column (SKU from the store) ────────────────────────────
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS product_id TEXT;

-- ─── 3. Add original_transaction_id (for Apple receipt chain) ─────────────────
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS original_transaction_id TEXT;

-- ─── 4. Index on store for fast filtering in admin panel ──────────────────────
CREATE INDEX IF NOT EXISTS idx_subscriptions_store
  ON public.subscriptions (store);

-- ─── 5. Ensure lifetime_price_usd exists in app_settings ─────────────────────
INSERT INTO public.app_settings (key, value, description, type)
VALUES ('lifetime_price_usd', '49.99', 'Lifetime subscription price (USD)', 'number')
ON CONFLICT (key) DO NOTHING;

SELECT 'subscription_production migration applied' AS result;
