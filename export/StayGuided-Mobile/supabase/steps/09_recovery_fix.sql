-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  StayGuided Me — RECOVERY FIX (run once after initial setup)   ║
-- ║  Fixes: missing public read policies, missing user profiles,   ║
-- ║         admin users view, and get_all_users_admin function     ║
-- ║  ✅ Safe to run multiple times (idempotent)                    ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- ═══════════════════════════════════════════════════════════════════
-- FIX 1: PUBLIC READ POLICIES FOR CONTENT TABLES
-- (Without these, only admins can see series/episodes/categories)
-- ═══════════════════════════════════════════════════════════════════

-- Categories: everyone can read active categories
DROP POLICY IF EXISTS "Public reads active categories" ON public.categories;
CREATE POLICY "Public reads active categories" ON public.categories
  FOR SELECT TO anon, authenticated USING (is_active = true);

-- Reciters: everyone can read active reciters
DROP POLICY IF EXISTS "Public reads active reciters" ON public.reciters;
CREATE POLICY "Public reads active reciters" ON public.reciters
  FOR SELECT TO anon, authenticated USING (is_active = true);

-- Series: everyone can read published series
DROP POLICY IF EXISTS "Public reads published series" ON public.series;
CREATE POLICY "Public reads published series" ON public.series
  FOR SELECT TO anon, authenticated USING (pub_status = 'published');

-- Episodes: everyone can read ALL episodes belonging to a published series
-- (Episode pub_status is secondary — if the series is published, all its episodes are visible)
DROP POLICY IF EXISTS "Public reads published episodes" ON public.episodes;
CREATE POLICY "Public reads published episodes" ON public.episodes
  FOR SELECT TO anon, authenticated USING (
    EXISTS (
      SELECT 1 FROM public.series
      WHERE series.id = episodes.series_id
        AND series.pub_status = 'published'
    )
  );

-- Journey chapters: everyone can read published chapters
DROP POLICY IF EXISTS "Public reads published journey chapters" ON public.journey_chapters;
CREATE POLICY "Public reads published journey chapters" ON public.journey_chapters
  FOR SELECT TO anon, authenticated USING (is_published = true);

-- Badges: everyone can read badges
DROP POLICY IF EXISTS "Public reads badges" ON public.badges;
CREATE POLICY "Public reads badges" ON public.badges
  FOR SELECT TO anon, authenticated USING (true);

-- App settings: everyone can read settings
DROP POLICY IF EXISTS "Public reads app settings" ON public.app_settings;
CREATE POLICY "Public reads app settings" ON public.app_settings
  FOR SELECT TO anon, authenticated USING (true);

-- Feature flags: everyone can read feature flags
DROP POLICY IF EXISTS "Public reads feature flags" ON public.feature_flags;
CREATE POLICY "Public reads feature flags" ON public.feature_flags
  FOR SELECT TO anon, authenticated USING (true);

-- Popup notices: authenticated users can read active popups
DROP POLICY IF EXISTS "Users read active popups" ON public.popup_notices;
CREATE POLICY "Users read active popups" ON public.popup_notices
  FOR SELECT TO anon, authenticated USING (is_active = true);

-- Donation settings: everyone can read
DROP POLICY IF EXISTS "Public reads donation settings" ON public.donation_settings;
CREATE POLICY "Public reads donation settings" ON public.donation_settings
  FOR SELECT TO anon, authenticated USING (true);

-- Notifications: users can read their own notifications
DROP POLICY IF EXISTS "Users read own notifications" ON public.notifications;
CREATE POLICY "Users read own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════════
-- FIX 2: BACKFILL PROFILES FOR ALL EXISTING AUTH USERS
-- (DB wipe deleted profiles; trigger only fires for NEW signups)
-- ═══════════════════════════════════════════════════════════════════

INSERT INTO public.profiles (id, display_name, email, avatar_url, referral_code)
SELECT
  au.id,
  COALESCE(au.raw_user_meta_data->>'display_name', split_part(au.email, '@', 1)),
  au.email,
  au.raw_user_meta_data->>'avatar_url',
  'SG' || upper(substring(replace(au.id::text, '-', ''), 1, 6))
FROM auth.users au
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = au.id);

-- Backfill user_settings, user_xp, user_streaks for all profiles
INSERT INTO public.user_settings (user_id)
SELECT id FROM public.profiles
WHERE id NOT IN (SELECT user_id FROM public.user_settings)
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.user_xp (user_id)
SELECT id FROM public.profiles
WHERE id NOT IN (SELECT user_id FROM public.user_xp)
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.user_streaks (user_id)
SELECT id FROM public.profiles
WHERE id NOT IN (SELECT user_id FROM public.user_streaks)
ON CONFLICT (user_id) DO NOTHING;

-- Ensure admin role is set
UPDATE public.profiles
SET role = 'super_admin'
WHERE email = 'imranrir46@gmail.com';

-- ═══════════════════════════════════════════════════════════════════
-- FIX 3: UPDATE admin_users_view TO SHOW ALL AUTH USERS
-- (Old view: profiles LEFT JOIN auth.users → only shows profiles)
-- (New view: auth.users LEFT JOIN profiles  → shows ALL users)
-- Note: must DROP first because column types are changing
-- ═══════════════════════════════════════════════════════════════════

DROP VIEW IF EXISTS public.admin_users_view;
CREATE VIEW public.admin_users_view
WITH (security_invoker = false)
AS
SELECT
  COALESCE(p.id, au.id)                         AS id,
  p.display_name,
  p.avatar_url,
  p.bio,
  p.country,
  p.referral_code,
  p.joined_at,
  COALESCE(p.subscription_tier, 'free')          AS subscription_tier,
  p.subscription_expires_at,
  COALESCE(p.is_active, true)                    AS is_active,
  COALESCE(p.role, 'user')                       AS role,
  COALESCE(p.is_blocked, false)                  AS is_blocked,
  p.blocked_reason,
  p.last_active_at,
  p.login_provider,
  COALESCE(p.total_listening_hours, 0)           AS total_listening_hours,
  p.push_token,
  COALESCE(au.email, p.email)                    AS email,
  au.created_at                                  AS auth_created_at,
  au.last_sign_in_at
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id;

-- ═══════════════════════════════════════════════════════════════════
-- FIX 4: get_all_users_admin() FUNCTION FOR ADMIN PANEL
-- (Secure RPC — only admins can call it; returns all auth users)
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_all_users_admin(
  p_search      TEXT    DEFAULT NULL,
  p_tier        TEXT    DEFAULT NULL,
  p_status      TEXT    DEFAULT NULL,
  p_limit       INTEGER DEFAULT 25,
  p_offset      INTEGER DEFAULT 0
)
RETURNS TABLE (
  id                    UUID,
  display_name          TEXT,
  avatar_url            TEXT,
  country               TEXT,
  email                 TEXT,
  subscription_tier     TEXT,
  is_blocked            BOOLEAN,
  role                  TEXT,
  last_active_at        TIMESTAMPTZ,
  joined_at             TIMESTAMPTZ,
  auth_created_at       TIMESTAMPTZ,
  last_sign_in_at       TIMESTAMPTZ,
  total_listening_hours NUMERIC,
  push_token            TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  RETURN QUERY
  SELECT
    v.id,
    v.display_name,
    v.avatar_url,
    v.country,
    v.email,
    v.subscription_tier,
    v.is_blocked,
    v.role,
    v.last_active_at,
    v.joined_at,
    v.auth_created_at,
    v.last_sign_in_at,
    v.total_listening_hours,
    v.push_token
  FROM public.admin_users_view v
  WHERE
    (p_search IS NULL OR p_search = '' OR
      v.display_name ILIKE '%' || p_search || '%' OR
      v.email ILIKE '%' || p_search || '%')
    AND (p_tier IS NULL OR p_tier = 'all' OR v.subscription_tier = p_tier)
    AND (p_status IS NULL OR p_status = 'all' OR
      (p_status = 'blocked' AND v.is_blocked = true) OR
      (p_status = 'active' AND v.is_blocked = false))
  ORDER BY v.auth_created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_all_users_admin TO authenticated;

-- ═══════════════════════════════════════════════════════════════════
-- FIX 5: RECALCULATE episode_count AND total_duration FOR ALL SERIES
-- Syncs the cached values in the series table with actual episode data
-- ═══════════════════════════════════════════════════════════════════
UPDATE public.series s
SET
  episode_count = COALESCE((
    SELECT COUNT(*) FROM public.episodes e WHERE e.series_id = s.id
  ), 0),
  total_duration = COALESCE((
    SELECT SUM(e.duration) FROM public.episodes e WHERE e.series_id = s.id
  ), 0);

-- Create or replace trigger to keep these in sync automatically
CREATE OR REPLACE FUNCTION public.sync_series_episode_stats()
RETURNS TRIGGER AS $$
DECLARE
  target_series_id UUID;
BEGIN
  -- Determine which series_id was affected
  IF TG_OP = 'DELETE' THEN
    target_series_id := OLD.series_id;
  ELSE
    target_series_id := NEW.series_id;
  END IF;

  UPDATE public.series
  SET
    episode_count = (SELECT COUNT(*) FROM public.episodes WHERE series_id = target_series_id),
    total_duration = COALESCE((SELECT SUM(duration) FROM public.episodes WHERE series_id = target_series_id), 0)
  WHERE id = target_series_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_series_stats ON public.episodes;
CREATE TRIGGER trg_sync_series_stats
  AFTER INSERT OR UPDATE OR DELETE ON public.episodes
  FOR EACH ROW EXECUTE FUNCTION public.sync_series_episode_stats();

SELECT '✅ Recovery fix applied: public content policies, user backfill, admin view, function & episode stats synced!' AS result;
