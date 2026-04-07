-- ============================================================
-- Migration: Quiz System (Quizzes, Questions, Attempts)
-- Project  : StayGuided Me (Supabase: tkruzfskhtcazjxdracm)
-- Date     : 2026-04-07
-- Safe to run multiple times (fully idempotent).
-- Run this in Supabase Dashboard → SQL Editor.
-- ============================================================

-- ─── 1. QUIZZES TABLE ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.quizzes (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title           TEXT NOT NULL,
  description     TEXT,
  category        TEXT,
  episode_id      UUID REFERENCES public.episodes(id) ON DELETE SET NULL,
  series_id       UUID REFERENCES public.series(id) ON DELETE SET NULL,
  is_active       BOOLEAN DEFAULT true NOT NULL,
  pass_percentage INTEGER DEFAULT 60 NOT NULL,
  xp_reward       INTEGER DEFAULT 50 NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at      TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_quizzes_is_active ON public.quizzes (is_active);
CREATE INDEX IF NOT EXISTS idx_quizzes_episode   ON public.quizzes (episode_id) WHERE episode_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quizzes_series    ON public.quizzes (series_id)  WHERE series_id  IS NOT NULL;

ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;

-- Everyone can read active quizzes
DROP POLICY IF EXISTS "quizzes_select_all"   ON public.quizzes;
CREATE POLICY "quizzes_select_all"
  ON public.quizzes FOR SELECT
  USING (true);

-- Admins can insert / update / delete
DROP POLICY IF EXISTS "quizzes_admin_all"    ON public.quizzes;
CREATE POLICY "quizzes_admin_all"
  ON public.quizzes FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Service role has full access
DROP POLICY IF EXISTS "quizzes_service_role" ON public.quizzes;
CREATE POLICY "quizzes_service_role"
  ON public.quizzes FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- ─── 2. QUIZ QUESTIONS TABLE ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.quiz_questions (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id       UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  question      TEXT NOT NULL,
  options       JSONB NOT NULL DEFAULT '[]'::jsonb,
  correct_index INTEGER NOT NULL DEFAULT 0,
  explanation   TEXT,
  sort_order    INTEGER DEFAULT 0 NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz ON public.quiz_questions (quiz_id);

ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;

-- Everyone can read quiz questions
DROP POLICY IF EXISTS "quiz_questions_select_all"   ON public.quiz_questions;
CREATE POLICY "quiz_questions_select_all"
  ON public.quiz_questions FOR SELECT
  USING (true);

-- Admins can insert / update / delete
DROP POLICY IF EXISTS "quiz_questions_admin_all"    ON public.quiz_questions;
CREATE POLICY "quiz_questions_admin_all"
  ON public.quiz_questions FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Service role has full access
DROP POLICY IF EXISTS "quiz_questions_service_role" ON public.quiz_questions;
CREATE POLICY "quiz_questions_service_role"
  ON public.quiz_questions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- ─── 3. QUIZ ATTEMPTS TABLE ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.quiz_attempts (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quiz_id         UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  score           INTEGER NOT NULL DEFAULT 0,
  total_questions INTEGER NOT NULL DEFAULT 0,
  percentage      INTEGER NOT NULL DEFAULT 0,
  passed          BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user ON public.quiz_attempts (user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz ON public.quiz_attempts (quiz_id);

ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;

-- Users read their own attempts
DROP POLICY IF EXISTS "quiz_attempts_select_own"  ON public.quiz_attempts;
CREATE POLICY "quiz_attempts_select_own"
  ON public.quiz_attempts FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users insert their own attempts
DROP POLICY IF EXISTS "quiz_attempts_insert_own"  ON public.quiz_attempts;
CREATE POLICY "quiz_attempts_insert_own"
  ON public.quiz_attempts FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Admins can read all attempts
DROP POLICY IF EXISTS "quiz_attempts_admin_all"   ON public.quiz_attempts;
CREATE POLICY "quiz_attempts_admin_all"
  ON public.quiz_attempts FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Service role has full access
DROP POLICY IF EXISTS "quiz_attempts_service_role" ON public.quiz_attempts;
CREATE POLICY "quiz_attempts_service_role"
  ON public.quiz_attempts FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- ─── 4. ENSURE quiz_mode IS IN feature_flags ──────────────────────────────────
INSERT INTO public.feature_flags (key, name, description, section, is_enabled, rollout_pct)
VALUES ('quiz_mode', 'Quiz Mode', 'Post-episode knowledge quizzes', 'gamification', true, 100)
ON CONFLICT (key) DO UPDATE
  SET is_enabled  = true,
      rollout_pct = 100,
      updated_at  = now();


-- ─── 5. ADD ADMIN WRITE POLICY TO feature_flags ───────────────────────────────
-- (Allows admin panel to toggle feature flags directly)
DROP POLICY IF EXISTS "feature_flags_admin_all"    ON public.feature_flags;
CREATE POLICY "feature_flags_admin_all"
  ON public.feature_flags FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


-- ─── 6. ADD ADMIN WRITE POLICY TO app_settings ────────────────────────────────
DROP POLICY IF EXISTS "app_settings_admin_all"     ON public.app_settings;
CREATE POLICY "app_settings_admin_all"
  ON public.app_settings FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


SELECT 'Quiz system migration completed successfully' AS result;
