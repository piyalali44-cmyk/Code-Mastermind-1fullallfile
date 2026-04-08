-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  StayGuided Me — Step 7 of 8                                    ║
-- ║  is_admin() FUNCTION + PERMISSION GRANTS + RLS POLICIES         ║
-- ║  ✅ Depends on: Step 6                                          ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- ═══════════════════════════════════════════════════════════════════
-- PART 7: is_admin() FUNCTION + PERMISSION GRANTS
-- ═══════════════════════════════════════════════════════════════════

GRANT USAGE ON SCHEMA public TO service_role, anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'super_admin', 'editor', 'content', 'support')
  );
$$;

GRANT SELECT ON ALL TABLES    IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES       IN SCHEMA public TO service_role;
GRANT USAGE ON ALL SEQUENCES  IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES    IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "Postgres full access to user_xp" ON public.user_xp;
CREATE POLICY "Postgres full access to user_xp" ON public.user_xp
  FOR ALL TO postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Postgres full access to xp log" ON public.daily_xp_log;
CREATE POLICY "Postgres full access to xp log" ON public.daily_xp_log
  FOR ALL TO postgres USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Postgres full access to referrals" ON public.referrals;
CREATE POLICY "Postgres full access to referrals" ON public.referrals
  FOR ALL TO postgres USING (true) WITH CHECK (true);

GRANT SELECT ON public.leaderboard         TO anon, authenticated;
GRANT SELECT ON public.leaderboard_weekly  TO anon, authenticated;
GRANT SELECT ON public.leaderboard_monthly TO anon, authenticated;
GRANT SELECT ON public.admin_users_view    TO service_role;
REVOKE SELECT ON public.admin_users_view   FROM anon, authenticated;

-- Admin-only function to list all auth users (with profile data merged)
-- Only accessible to admins; uses SECURITY DEFINER to access auth.users
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

GRANT INSERT, UPDATE ON public.profiles           TO authenticated;
GRANT INSERT, UPDATE ON public.user_settings      TO authenticated;
GRANT INSERT, UPDATE ON public.user_xp            TO authenticated;
GRANT INSERT, UPDATE ON public.user_streaks       TO authenticated;
GRANT INSERT ON public.user_badges                TO authenticated;
GRANT INSERT ON public.referrals                  TO authenticated;
GRANT ALL ON public.listening_progress            TO authenticated;
GRANT ALL ON public.listening_history             TO authenticated;
GRANT ALL ON public.favourites                    TO authenticated;
GRANT ALL ON public.bookmarks                     TO authenticated;
GRANT ALL ON public.downloads                     TO authenticated;
GRANT ALL ON public.journey_progress              TO authenticated;
GRANT INSERT ON public.daily_xp_log              TO authenticated;
GRANT ALL ON public.notifications                 TO authenticated;
GRANT INSERT ON public.content_reports            TO authenticated;

GRANT INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.reciters TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.series TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.episodes TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.journey_chapters TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.feature_flags TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.content_reports TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.feed_widgets TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.quizzes TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.quiz_questions TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.admin_activity_log TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.coupon_codes TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.coupon_redemptions TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.popup_notices TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.push_campaigns TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.donation_settings TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.api_sources TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.admin_notes TO authenticated;

-- ═══════════════════════════════════════════════════════════════════
-- PUBLIC READ POLICIES (content visible to all users, including guests)
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

-- Episodes: everyone can read published episodes
DROP POLICY IF EXISTS "Public reads published episodes" ON public.episodes;
CREATE POLICY "Public reads published episodes" ON public.episodes
  FOR SELECT TO anon, authenticated USING (pub_status = 'published');

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

-- API sources: authenticated can read active sources
DROP POLICY IF EXISTS "Public reads active api sources" ON public.api_sources;
CREATE POLICY "Public reads active api sources" ON public.api_sources
  FOR SELECT TO authenticated USING (is_active = true);

-- Notifications: users can read their own notifications
DROP POLICY IF EXISTS "Users read own notifications" ON public.notifications;
CREATE POLICY "Users read own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════════
-- ADMIN RLS POLICIES
-- ═══════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Admin manages categories" ON public.categories;
CREATE POLICY "Admin manages categories" ON public.categories
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admin manages reciters" ON public.reciters;
CREATE POLICY "Admin manages reciters" ON public.reciters
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admin manages series" ON public.series;
CREATE POLICY "Admin manages series" ON public.series
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admin manages episodes" ON public.episodes;
CREATE POLICY "Admin manages episodes" ON public.episodes
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admin manages journey chapters" ON public.journey_chapters;
CREATE POLICY "Admin manages journey chapters" ON public.journey_chapters
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admin manages app settings" ON public.app_settings;
CREATE POLICY "Admin manages app settings" ON public.app_settings
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admin manages feature flags" ON public.feature_flags;
CREATE POLICY "Admin manages feature flags" ON public.feature_flags
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admin manages reports" ON public.content_reports;
CREATE POLICY "Admin manages reports" ON public.content_reports
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admin manages feed widgets" ON public.feed_widgets;
CREATE POLICY "Admin manages feed widgets" ON public.feed_widgets
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admin manages quizzes" ON public.quizzes;
CREATE POLICY "Admin manages quizzes" ON public.quizzes
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admin manages quiz questions" ON public.quiz_questions;
CREATE POLICY "Admin manages quiz questions" ON public.quiz_questions
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admin manages activity log" ON public.admin_activity_log;
CREATE POLICY "Admin manages activity log" ON public.admin_activity_log
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admin manages coupons" ON public.coupon_codes;
CREATE POLICY "Admin manages coupons" ON public.coupon_codes
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admin manages redemptions" ON public.coupon_redemptions;
CREATE POLICY "Admin manages redemptions" ON public.coupon_redemptions
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admin manages popups" ON public.popup_notices;
CREATE POLICY "Admin manages popups" ON public.popup_notices
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admin manages push campaigns" ON public.push_campaigns;
CREATE POLICY "Admin manages push campaigns" ON public.push_campaigns
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admin manages donation settings" ON public.donation_settings;
CREATE POLICY "Admin manages donation settings" ON public.donation_settings
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admin manages api sources" ON public.api_sources;
CREATE POLICY "Admin manages api sources" ON public.api_sources
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admin manages admin notes" ON public.admin_notes;
CREATE POLICY "Admin manages admin notes" ON public.admin_notes
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admin manages notifications" ON public.notifications;
CREATE POLICY "Admin manages notifications" ON public.notifications
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admin manages profiles" ON public.profiles;
CREATE POLICY "Admin manages profiles" ON public.profiles
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admin reads subscriptions" ON public.subscriptions;
CREATE POLICY "Admin reads subscriptions" ON public.subscriptions
  FOR SELECT TO authenticated USING (is_admin());


SELECT '✅ Step 7 done: Permissions, Grants & Admin RLS' AS result;
