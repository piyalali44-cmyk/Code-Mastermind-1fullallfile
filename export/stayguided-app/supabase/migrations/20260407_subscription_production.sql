-- ═══════════════════════════════════════════════════════════════════════════
-- SUBSCRIPTION SYSTEM — PRODUCTION SCHEMA ENHANCEMENTS
-- Run this in Supabase SQL Editor after 20260401_complete_setup.sql
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. ADD MISSING COLUMNS TO subscriptions TABLE ──────────────────────────

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS store            TEXT DEFAULT 'manual'
    CHECK (store IN ('google_play', 'app_store', 'manual', 'admin', 'promo')),
  ADD COLUMN IF NOT EXISTS product_id       TEXT,
  ADD COLUMN IF NOT EXISTS purchase_token   TEXT,
  ADD COLUMN IF NOT EXISTS original_transaction_id TEXT,
  ADD COLUMN IF NOT EXISTS auto_renew       BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS cancel_reason    TEXT;

-- Back-fill existing rows: set store from provider column
UPDATE public.subscriptions
SET store = CASE
  WHEN provider = 'admin'  THEN 'admin'
  WHEN provider = 'manual' THEN 'manual'
  WHEN provider = 'promo'  THEN 'promo'
  ELSE 'manual'
END
WHERE store IS NULL OR store = 'manual';

-- ─── 2. PURCHASE EVENTS LOG TABLE ───────────────────────────────────────────
-- Logs every purchase attempt (success and failure) for audit trail

CREATE TABLE IF NOT EXISTS public.purchase_events (
  id                    UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id               UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type            TEXT NOT NULL CHECK (event_type IN (
                          'purchase_initiated', 'purchase_success', 'purchase_failed',
                          'purchase_cancelled', 'restore_success', 'restore_failed',
                          'subscription_expired', 'subscription_renewed',
                          'subscription_cancelled', 'refund_issued',
                          'admin_grant', 'admin_revoke', 'promo_applied'
                        )),
  plan                  TEXT,
  store                 TEXT,
  product_id            TEXT,
  purchase_token        TEXT,
  original_transaction_id TEXT,
  amount_usd            NUMERIC(10,2),
  error_message         TEXT,
  raw_payload           JSONB,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.purchase_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users view own purchase events"
    ON public.purchase_events FOR SELECT
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admin reads all purchase events"
    ON public.purchase_events FOR SELECT
    USING (public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Service role can insert events (via API server)
DO $$ BEGIN
  CREATE POLICY "Service role manages purchase events"
    ON public.purchase_events FOR ALL
    USING (true)
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 3. SUBSCRIPTION EXPIRY TRIGGER ─────────────────────────────────────────
-- Automatically marks subscriptions as expired when expires_at is in the past

CREATE OR REPLACE FUNCTION public.check_subscription_expiry()
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  -- Mark subscriptions as expired
  UPDATE public.subscriptions
  SET status = 'expired', updated_at = NOW()
  WHERE status = 'active'
    AND expires_at IS NOT NULL
    AND expires_at < NOW();

  -- Sync profiles: downgrade expired premium users to free
  UPDATE public.profiles p
  SET subscription_tier = 'free',
      subscription_expires_at = NULL
  FROM public.subscriptions s
  WHERE s.user_id = p.id
    AND s.status = 'expired'
    AND p.subscription_tier = 'premium'
    AND s.expires_at < NOW();

  -- Log expiry events
  INSERT INTO public.purchase_events (user_id, event_type, plan, store)
  SELECT s.user_id, 'subscription_expired', s.plan, s.store
  FROM public.subscriptions s
  WHERE s.status = 'expired'
    AND s.updated_at > NOW() - INTERVAL '1 minute'
  ON CONFLICT DO NOTHING;
END;
$$;

-- Trigger: auto-check expiry when ANY subscription row is read/updated
CREATE OR REPLACE FUNCTION public.trg_subscription_expiry_check()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  -- Expire if time has passed
  IF NEW.status = 'active'
     AND NEW.expires_at IS NOT NULL
     AND NEW.expires_at < NOW() THEN
    NEW.status := 'expired';
    NEW.updated_at := NOW();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS subscription_expiry_check ON public.subscriptions;
CREATE TRIGGER subscription_expiry_check
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.trg_subscription_expiry_check();

-- ─── 4. RLS: USERS CAN UPSERT THEIR OWN SUBSCRIPTION ───────────────────────
-- Needed for server-side IAP verification to write back to DB

DROP POLICY IF EXISTS "Users insert own subscription" ON public.subscriptions;
CREATE POLICY "Users insert own subscription"
  ON public.subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own subscription" ON public.subscriptions;
CREATE POLICY "Users update own subscription"
  ON public.subscriptions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── 5. GRANT/REVOKE: LOG EVENTS ────────────────────────────────────────────
-- Update admin_grant_premium to also log the event

CREATE OR REPLACE FUNCTION public.admin_grant_premium(
  p_user_id UUID,
  p_plan    TEXT DEFAULT 'monthly',
  p_days    INTEGER DEFAULT 30
)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_expires TIMESTAMPTZ;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  IF p_plan = 'lifetime' THEN
    v_expires := NULL;
  ELSE
    v_expires := NOW() + (p_days || ' days')::INTERVAL;
  END IF;

  UPDATE public.profiles
  SET subscription_tier = 'premium',
      subscription_expires_at = v_expires
  WHERE id = p_user_id;

  INSERT INTO public.subscriptions (user_id, plan, status, started_at, expires_at, provider, store)
  VALUES (p_user_id, p_plan, 'active', NOW(), v_expires, 'admin', 'admin')
  ON CONFLICT (user_id) DO UPDATE SET
    plan       = EXCLUDED.plan,
    status     = 'active',
    expires_at = EXCLUDED.expires_at,
    provider   = 'admin',
    store      = 'admin',
    updated_at = NOW();

  -- Log the event
  INSERT INTO public.purchase_events (user_id, event_type, plan, store)
  VALUES (p_user_id, 'admin_grant', p_plan, 'admin');
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_revoke_premium(p_user_id UUID)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  UPDATE public.profiles
  SET subscription_tier = 'free',
      subscription_expires_at = NULL
  WHERE id = p_user_id;

  UPDATE public.subscriptions
  SET status = 'cancelled', updated_at = NOW()
  WHERE user_id = p_user_id AND status = 'active';

  -- Log the event
  INSERT INTO public.purchase_events (user_id, event_type, plan, store)
  SELECT p_user_id, 'admin_revoke', plan, store
  FROM public.subscriptions
  WHERE user_id = p_user_id;
END;
$$;

-- ─── 6. PROMO CODE → PREMIUM: LOG EVENTS ────────────────────────────────────
-- When a free_days coupon is redeemed, log the event

CREATE OR REPLACE FUNCTION public.log_promo_subscription(
  p_user_id UUID,
  p_plan    TEXT,
  p_days    INTEGER,
  p_code    TEXT
)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_expires TIMESTAMPTZ;
BEGIN
  v_expires := NOW() + (p_days || ' days')::INTERVAL;

  INSERT INTO public.subscriptions (user_id, plan, status, started_at, expires_at, provider, store, product_id)
  VALUES (p_user_id, p_plan, 'active', NOW(), v_expires, 'promo', 'promo', p_code)
  ON CONFLICT (user_id) DO UPDATE SET
    plan       = EXCLUDED.plan,
    status     = 'active',
    expires_at = GREATEST(public.subscriptions.expires_at, EXCLUDED.expires_at),
    provider   = 'promo',
    store      = 'promo',
    updated_at = NOW();

  INSERT INTO public.purchase_events (user_id, event_type, plan, store, product_id)
  VALUES (p_user_id, 'promo_applied', p_plan, 'promo', p_code);
END;
$$;

-- ─── 7. SERVER-SIDE PURCHASE VERIFICATION FUNCTION ──────────────────────────
-- Called by API server after verifying receipt with Apple/Google

CREATE OR REPLACE FUNCTION public.record_verified_purchase(
  p_user_id                  UUID,
  p_plan                     TEXT,
  p_store                    TEXT,
  p_product_id               TEXT,
  p_purchase_token           TEXT,
  p_original_transaction_id  TEXT,
  p_expires_at               TIMESTAMPTZ,
  p_amount_usd               NUMERIC DEFAULT NULL
)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Upsert subscription
  INSERT INTO public.subscriptions (
    user_id, plan, status, started_at, expires_at,
    provider, store, product_id, purchase_token,
    original_transaction_id
  )
  VALUES (
    p_user_id, p_plan, 'active', NOW(), p_expires_at,
    p_store, p_store, p_product_id, p_purchase_token,
    p_original_transaction_id
  )
  ON CONFLICT (user_id) DO UPDATE SET
    plan                     = EXCLUDED.plan,
    status                   = 'active',
    expires_at               = EXCLUDED.expires_at,
    store                    = EXCLUDED.store,
    product_id               = EXCLUDED.product_id,
    purchase_token           = EXCLUDED.purchase_token,
    original_transaction_id  = COALESCE(EXCLUDED.original_transaction_id, public.subscriptions.original_transaction_id),
    updated_at               = NOW();

  -- Sync profile tier
  UPDATE public.profiles
  SET subscription_tier        = 'premium',
      subscription_expires_at  = p_expires_at
  WHERE id = p_user_id;

  -- Log the purchase event
  INSERT INTO public.purchase_events (
    user_id, event_type, plan, store, product_id,
    purchase_token, original_transaction_id, amount_usd
  )
  VALUES (
    p_user_id, 'purchase_success', p_plan, p_store, p_product_id,
    p_purchase_token, p_original_transaction_id, p_amount_usd
  );

  v_result := jsonb_build_object(
    'success',    true,
    'plan',       p_plan,
    'expires_at', p_expires_at,
    'is_premium', true
  );
  RETURN v_result;
END;
$$;

-- ─── 8. ADMIN: SUBSCRIPTION ANALYTICS VIEW ──────────────────────────────────

CREATE OR REPLACE VIEW public.admin_subscription_stats AS
SELECT
  COUNT(*) FILTER (WHERE s.status = 'active')                      AS active_count,
  COUNT(*) FILTER (WHERE s.status = 'expired')                     AS expired_count,
  COUNT(*) FILTER (WHERE s.status = 'cancelled')                   AS cancelled_count,
  COUNT(*) FILTER (WHERE s.plan = 'weekly'  AND s.status = 'active') AS active_weekly,
  COUNT(*) FILTER (WHERE s.plan = 'monthly' AND s.status = 'active') AS active_monthly,
  COUNT(*) FILTER (WHERE s.plan = 'lifetime')                      AS lifetime_count,
  COUNT(*) FILTER (WHERE s.store = 'google_play')                  AS from_google_play,
  COUNT(*) FILTER (WHERE s.store = 'app_store')                    AS from_app_store,
  COUNT(*) FILTER (WHERE s.store IN ('admin','promo'))              AS from_admin_promo,
  COUNT(*) FILTER (WHERE s.expires_at BETWEEN NOW() AND NOW() + INTERVAL '7 days'
                    AND s.status = 'active')                        AS expiring_this_week,
  SUM(pe.amount_usd) FILTER (WHERE pe.event_type = 'purchase_success') AS total_revenue_usd
FROM public.subscriptions s
LEFT JOIN public.purchase_events pe ON pe.user_id = s.user_id
  AND pe.event_type = 'purchase_success';

-- ─── 9. INDEXES ──────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_subscriptions_status_expires
  ON public.subscriptions (status, expires_at)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_purchase_events_user
  ON public.purchase_events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_purchase_events_type
  ON public.purchase_events (event_type, created_at DESC);

-- ─── 10. GRANTS ──────────────────────────────────────────────────────────────

GRANT SELECT ON public.purchase_events TO authenticated;
GRANT SELECT ON public.admin_subscription_stats TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_subscription_expiry() TO service_role;
GRANT EXECUTE ON FUNCTION public.record_verified_purchase(UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TIMESTAMPTZ,NUMERIC) TO service_role;
GRANT EXECUTE ON FUNCTION public.log_promo_subscription(UUID,TEXT,INTEGER,TEXT) TO service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- DONE. Summary of what this migration adds:
--
--  subscriptions table:
--    + store (google_play | app_store | manual | admin | promo)
--    + product_id  (e.g. premium_weekly, premium_monthly)
--    + purchase_token (Google Play purchase token)
--    + original_transaction_id (Apple original transaction ID)
--    + auto_renew (boolean)
--    + cancel_reason
--
--  New table:
--    purchase_events — full audit log of every purchase attempt
--
--  New functions:
--    check_subscription_expiry()         — run daily via cron or scheduled job
--    record_verified_purchase(...)       — called by API server after IAP verify
--    log_promo_subscription(...)         — called when promo code gives premium
--    admin_grant_premium (updated)       — now also logs to purchase_events
--    admin_revoke_premium (updated)      — now also logs to purchase_events
--
--  Trigger:
--    subscription_expiry_check          — auto-expires on UPDATE
--
--  View:
--    admin_subscription_stats           — real-time subscription analytics
--
--  RLS:
--    Users can INSERT and UPDATE their own subscription row
--    (needed for server-side IAP verification callback)
-- ═══════════════════════════════════════════════════════════════════════════
