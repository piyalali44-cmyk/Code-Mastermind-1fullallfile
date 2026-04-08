-- ═══════════════════════════════════════════════════════════════════════════
-- Rate the App feature flag
-- Safe to re-run — uses ON CONFLICT DO NOTHING
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO public.feature_flags (key, name, description, section, is_enabled, rollout_pct)
VALUES
  ('rate_app', 'Rate the App',
   'Show "Rate the App" button in Settings — links to App Store / Play Store review page',
   'growth', true, 100)
ON CONFLICT (key) DO NOTHING;
