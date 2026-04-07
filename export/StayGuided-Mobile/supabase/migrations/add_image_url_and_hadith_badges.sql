ALTER TABLE public.push_campaigns ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS image_url TEXT;

INSERT INTO public.badges (slug, name, description, icon, xp_reward) VALUES
  ('hadith_start', 'Hadith Seeker', 'First hadith episode completed', '📜', 15),
  ('hadith_10', 'Hadith Student', 'Completed 10 hadith episodes', '📚', 75),
  ('hadith_40', 'Hadith Scholar', 'Completed 40 hadith episodes', '🏛️', 300)
ON CONFLICT (slug) DO NOTHING;

CREATE OR REPLACE FUNCTION public.check_and_award_badges(p_user_id UUID)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $func$
DECLARE
  v_xp INTEGER; v_level INTEGER; v_streak INTEGER;
  v_episode_count INTEGER; v_surah_count INTEGER;
  v_journey_started INTEGER; v_journey_completed INTEGER;
  v_hadith_count INTEGER;
BEGIN
  SELECT COALESCE(total_xp, 0), COALESCE(level, 1) INTO v_xp, v_level
  FROM public.user_xp WHERE user_id = p_user_id;
  SELECT COALESCE(current_streak, 0) INTO v_streak
  FROM public.user_streaks WHERE user_id = p_user_id;
  SELECT COUNT(*) INTO v_episode_count FROM public.listening_progress
  WHERE user_id = p_user_id AND content_type = 'episode' AND completed = true;
  SELECT COUNT(*) INTO v_surah_count FROM public.listening_progress
  WHERE user_id = p_user_id AND content_type = 'surah' AND completed = true;
  SELECT COUNT(*) INTO v_journey_started FROM public.journey_progress WHERE user_id = p_user_id;
  SELECT COUNT(*) INTO v_journey_completed FROM public.journey_progress
  WHERE user_id = p_user_id AND completed = true;
  SELECT COUNT(*) INTO v_hadith_count
  FROM public.listening_progress lp
  JOIN public.episodes e ON e.id::text = lp.content_id
  JOIN public.series s ON s.id = e.series_id
  JOIN public.categories c ON c.id = s.category_id
  WHERE lp.user_id = p_user_id AND lp.content_type = 'episode'
    AND lp.completed = true AND c.slug = 'hadith';
  IF v_episode_count >= 1 THEN PERFORM public.award_badge(p_user_id, 'first_listen'); END IF;
  IF v_surah_count >= 1 THEN PERFORM public.award_badge(p_user_id, 'quran_start'); END IF;
  IF v_surah_count >= 114 THEN PERFORM public.award_badge(p_user_id, 'quran_complete'); END IF;
  IF v_streak >= 3 THEN PERFORM public.award_badge(p_user_id, 'streak_3'); END IF;
  IF v_streak >= 7 THEN PERFORM public.award_badge(p_user_id, 'streak_7'); END IF;
  IF v_streak >= 30 THEN PERFORM public.award_badge(p_user_id, 'streak_30'); END IF;
  IF v_level >= 5 THEN PERFORM public.award_badge(p_user_id, 'level_5'); END IF;
  IF v_level >= 10 THEN PERFORM public.award_badge(p_user_id, 'level_10'); END IF;
  IF v_journey_started >= 1 THEN PERFORM public.award_badge(p_user_id, 'journey_start'); END IF;
  IF v_journey_completed >= 20 THEN PERFORM public.award_badge(p_user_id, 'journey_complete'); END IF;
  IF v_hadith_count >= 1 THEN PERFORM public.award_badge(p_user_id, 'hadith_start'); END IF;
  IF v_hadith_count >= 10 THEN PERFORM public.award_badge(p_user_id, 'hadith_10'); END IF;
  IF v_hadith_count >= 40 THEN PERFORM public.award_badge(p_user_id, 'hadith_40'); END IF;
END;
$func$;

NOTIFY pgrst, 'reload schema';
