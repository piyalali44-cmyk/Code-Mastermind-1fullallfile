-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  StayGuided Me — Step 5 of 8                                    ║
-- ║  VIEWS, TRIGGERS & FUNCTIONS                                    ║
-- ║  ✅ Depends on: Step 4                                          ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- ═══════════════════════════════════════════════════════════════════
-- PART 5: VIEWS & FUNCTIONS
-- ═══════════════════════════════════════════════════════════════════

-- ─── LEADERBOARD VIEW (all-time) ─────────────────────────────────
DROP VIEW IF EXISTS public.leaderboard CASCADE;
CREATE OR REPLACE VIEW public.leaderboard AS
SELECT
  p.id,
  p.display_name,
  p.avatar_url,
  p.country,
  COALESCE(x.total_xp, 0)       AS total_xp,
  COALESCE(x.level, 1)          AS level,
  COALESCE(s.current_streak, 0) AS current_streak,
  RANK() OVER (ORDER BY COALESCE(x.total_xp, 0) DESC) AS rank
FROM public.profiles p
LEFT JOIN public.user_xp x      ON p.id = x.user_id
LEFT JOIN public.user_streaks s ON p.id = s.user_id
WHERE p.is_active = true
  AND p.display_name IS NOT NULL
ORDER BY total_xp DESC;

-- ─── LEADERBOARD VIEW (weekly) ───────────────────────────────────
DROP VIEW IF EXISTS public.leaderboard_weekly CASCADE;
CREATE OR REPLACE VIEW public.leaderboard_weekly AS
SELECT
  p.id,
  p.display_name,
  p.avatar_url,
  p.country,
  COALESCE(SUM(d.xp_amount), 0)::INTEGER AS weekly_xp,
  RANK() OVER (ORDER BY COALESCE(SUM(d.xp_amount), 0) DESC) AS rank
FROM public.profiles p
LEFT JOIN public.daily_xp_log d
  ON p.id = d.user_id
  AND d.earned_at >= date_trunc('week', NOW() AT TIME ZONE 'UTC')
WHERE p.is_active = true
  AND p.display_name IS NOT NULL
GROUP BY p.id, p.display_name, p.avatar_url, p.country
ORDER BY weekly_xp DESC;

-- ─── LEADERBOARD VIEW (monthly) ──────────────────────────────────
DROP VIEW IF EXISTS public.leaderboard_monthly CASCADE;
CREATE OR REPLACE VIEW public.leaderboard_monthly AS
SELECT
  p.id,
  p.display_name,
  p.avatar_url,
  p.country,
  COALESCE(SUM(d.xp_amount), 0)::INTEGER AS monthly_xp,
  RANK() OVER (ORDER BY COALESCE(SUM(d.xp_amount), 0) DESC) AS rank
FROM public.profiles p
LEFT JOIN public.daily_xp_log d
  ON p.id = d.user_id
  AND d.earned_at >= date_trunc('month', NOW() AT TIME ZONE 'UTC')
WHERE p.is_active = true
  AND p.display_name IS NOT NULL
GROUP BY p.id, p.display_name, p.avatar_url, p.country
ORDER BY monthly_xp DESC;

-- ─── ADMIN USERS VIEW (service_role only) ────────────────────────
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

-- ─── PROTECT ROLE COLUMN FROM SELF-PROMOTION ────────────────────────
CREATE OR REPLACE FUNCTION public.protect_role_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    ) THEN
      NEW.role := OLD.role;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_role_update ON public.profiles;
CREATE TRIGGER protect_role_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_role_column();

-- ─── AUTO-PROFILE TRIGGER ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, email, avatar_url, referral_code)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url',
    'SG' || upper(substring(replace(NEW.id::text, '-', ''), 1, 6))
  )
  ON CONFLICT (id) DO UPDATE SET
    display_name  = COALESCE(EXCLUDED.display_name, public.profiles.display_name),
    email         = COALESCE(EXCLUDED.email, public.profiles.email),
    avatar_url    = COALESCE(EXCLUDED.avatar_url,   public.profiles.avatar_url),
    referral_code = COALESCE(public.profiles.referral_code, EXCLUDED.referral_code);

  INSERT INTO public.user_settings (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.user_xp (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.user_streaks (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── HELPER: Log admin activity ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.log_admin_action(
  p_admin_id   UUID,
  p_action     TEXT,
  p_entity_type TEXT DEFAULT NULL,
  p_entity_id  TEXT DEFAULT NULL,
  p_details    JSONB DEFAULT '{}'
)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.admin_activity_log (admin_id, action, entity_type, entity_id, details)
  VALUES (p_admin_id, p_action, p_entity_type, p_entity_id, p_details);
END;
$$;

-- ─── HELPER: Block/unblock user ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_block_user(
  p_user_id UUID,
  p_reason  TEXT DEFAULT NULL
)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  UPDATE public.profiles
  SET is_blocked = true, blocked_reason = p_reason
  WHERE id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_unblock_user(p_user_id UUID)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  UPDATE public.profiles
  SET is_blocked = false, blocked_reason = NULL
  WHERE id = p_user_id;
END;
$$;

-- ─── HELPER: Grant/revoke premium ────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_grant_premium(
  p_user_id    UUID,
  p_days       INTEGER DEFAULT 30,
  p_plan       TEXT DEFAULT 'weekly'
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

  INSERT INTO public.subscriptions (user_id, plan, status, started_at, expires_at, provider)
  VALUES (p_user_id, p_plan, 'active', NOW(), v_expires, 'admin')
  ON CONFLICT (user_id) DO UPDATE SET
    plan = EXCLUDED.plan,
    status = 'active',
    expires_at = EXCLUDED.expires_at,
    provider = 'admin',
    updated_at = NOW();
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
END;
$$;

-- ─── BADGE AWARD FUNCTION ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.award_badge(p_user_id UUID, p_badge_slug TEXT)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_badge_id  UUID;
  v_xp_reward INTEGER;
BEGIN
  SELECT id, xp_reward INTO v_badge_id, v_xp_reward
  FROM public.badges WHERE slug = p_badge_slug;

  IF v_badge_id IS NULL THEN RETURN; END IF;

  INSERT INTO public.user_badges (user_id, badge_id)
  VALUES (p_user_id, v_badge_id)
  ON CONFLICT DO NOTHING;

  IF FOUND THEN
    INSERT INTO public.daily_xp_log (user_id, xp_amount, reason)
    VALUES (p_user_id, v_xp_reward, 'badge:' || p_badge_slug);

    INSERT INTO public.user_xp (user_id, total_xp, level, updated_at)
    VALUES (p_user_id, v_xp_reward, 1, NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      total_xp   = public.user_xp.total_xp + v_xp_reward,
      level      = GREATEST(1, FLOOR((public.user_xp.total_xp + v_xp_reward)::FLOAT / 500)::INTEGER + 1),
      updated_at = NOW();
  END IF;
END;
$$;

-- ─── CHECK AND AWARD BADGES FUNCTION ───────────────────────────────
CREATE OR REPLACE FUNCTION public.check_and_award_badges(p_user_id UUID)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_xp                INTEGER;
  v_level             INTEGER;
  v_streak            INTEGER;
  v_episode_count     INTEGER;
  v_surah_count       INTEGER;
  v_journey_started   INTEGER;
  v_journey_completed INTEGER;
  v_hadith_count      INTEGER;
BEGIN
  SELECT COALESCE(total_xp, 0), COALESCE(level, 1) INTO v_xp, v_level
  FROM public.user_xp WHERE user_id = p_user_id;

  SELECT COALESCE(current_streak, 0) INTO v_streak
  FROM public.user_streaks WHERE user_id = p_user_id;

  SELECT COUNT(*) INTO v_episode_count
  FROM public.listening_progress
  WHERE user_id = p_user_id AND content_type = 'episode' AND completed = true;

  SELECT COUNT(*) INTO v_surah_count
  FROM public.listening_progress
  WHERE user_id = p_user_id AND content_type = 'surah' AND completed = true;

  SELECT COUNT(*) INTO v_journey_started
  FROM public.journey_progress
  WHERE user_id = p_user_id;

  SELECT COUNT(*) INTO v_journey_completed
  FROM public.journey_progress
  WHERE user_id = p_user_id AND completed = true;

  SELECT COUNT(*) INTO v_hadith_count
  FROM public.listening_progress lp
  JOIN public.episodes e ON e.id::text = lp.content_id
  JOIN public.series s ON s.id = e.series_id
  JOIN public.categories c ON c.id = s.category_id
  WHERE lp.user_id = p_user_id
    AND lp.content_type = 'episode'
    AND lp.completed = true
    AND c.slug = 'hadith';

  IF v_episode_count     >= 1   THEN PERFORM public.award_badge(p_user_id, 'first_listen');    END IF;
  IF v_surah_count       >= 1   THEN PERFORM public.award_badge(p_user_id, 'quran_start');     END IF;
  IF v_surah_count       >= 114 THEN PERFORM public.award_badge(p_user_id, 'quran_complete');  END IF;
  IF v_streak            >= 3   THEN PERFORM public.award_badge(p_user_id, 'streak_3');        END IF;
  IF v_streak            >= 7   THEN PERFORM public.award_badge(p_user_id, 'streak_7');        END IF;
  IF v_streak            >= 30  THEN PERFORM public.award_badge(p_user_id, 'streak_30');       END IF;
  IF v_level             >= 5   THEN PERFORM public.award_badge(p_user_id, 'level_5');         END IF;
  IF v_level             >= 10  THEN PERFORM public.award_badge(p_user_id, 'level_10');        END IF;
  IF v_journey_started   >= 1   THEN PERFORM public.award_badge(p_user_id, 'journey_start');   END IF;
  IF v_journey_completed >= 20  THEN PERFORM public.award_badge(p_user_id, 'journey_complete');END IF;
  IF v_hadith_count      >= 1   THEN PERFORM public.award_badge(p_user_id, 'hadith_start');    END IF;
  IF v_hadith_count      >= 10  THEN PERFORM public.award_badge(p_user_id, 'hadith_10');       END IF;
  IF v_hadith_count      >= 40  THEN PERFORM public.award_badge(p_user_id, 'hadith_40');       END IF;
END;
$$;

-- ─── APPLY REFERRAL CODE FUNCTION ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.apply_referral_code(p_code TEXT)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_referrer_id UUID;
  v_caller      UUID := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT id INTO v_referrer_id
  FROM public.profiles
  WHERE upper(trim(referral_code)) = upper(trim(p_code))
    AND id != v_caller;

  IF v_referrer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_code');
  END IF;

  IF EXISTS (SELECT 1 FROM public.referrals WHERE referred_id = v_caller) THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_used');
  END IF;

  INSERT INTO public.referrals (referrer_id, referred_id, code_used, xp_awarded_referrer, xp_awarded_referred)
  VALUES (v_referrer_id, v_caller, upper(trim(p_code)), 500, 100);

  INSERT INTO public.daily_xp_log (user_id, xp_amount, reason)
  VALUES (v_referrer_id, 500, 'referral_friend_joined');

  INSERT INTO public.user_xp (user_id, total_xp, level, updated_at)
  VALUES (v_referrer_id, 500, 2, NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    total_xp   = public.user_xp.total_xp + 500,
    level      = GREATEST(1, FLOOR((public.user_xp.total_xp + 500)::FLOAT / 500)::INTEGER + 1),
    updated_at = NOW();

  INSERT INTO public.daily_xp_log (user_id, xp_amount, reason)
  VALUES (v_caller, 100, 'referral_bonus');

  INSERT INTO public.user_xp (user_id, total_xp, level, updated_at)
  VALUES (v_caller, 100, 1, NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    total_xp   = public.user_xp.total_xp + 100,
    level      = GREATEST(1, FLOOR((public.user_xp.total_xp + 100)::FLOAT / 500)::INTEGER + 1),
    updated_at = NOW();

  RETURN jsonb_build_object('success', true, 'xp_bonus', 100);
END;
$$;

-- ─── BACKFILL: ensure every existing user has all support rows ──────
INSERT INTO public.user_xp (user_id)
SELECT id FROM public.profiles
WHERE id NOT IN (SELECT user_id FROM public.user_xp)
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.user_streaks (user_id)
SELECT id FROM public.profiles
WHERE id NOT IN (SELECT user_id FROM public.user_streaks)
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.user_settings (user_id)
SELECT id FROM public.profiles
WHERE id NOT IN (SELECT user_id FROM public.user_settings)
ON CONFLICT (user_id) DO NOTHING;

UPDATE public.profiles
SET referral_code = 'SG' || upper(substring(replace(id::text, '-', ''), 1, 6))
WHERE referral_code IS NULL;


SELECT '✅ Step 5 done: Views, Triggers & Functions' AS result;
