-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║  StayGuided Me — QUIZ ATTEMPTS TABLE                                  ║
-- ║  Run in: Supabase Dashboard → SQL Editor → New Query                  ║
-- ║  Safe to re-run — uses IF NOT EXISTS                                  ║
-- ╚════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.quiz_attempts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quiz_id       UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  score         INTEGER NOT NULL DEFAULT 0,
  total_questions INTEGER NOT NULL DEFAULT 0,
  percentage    INTEGER NOT NULL DEFAULT 0,
  passed        BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user ON public.quiz_attempts (user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz ON public.quiz_attempts (quiz_id);

ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own attempts" ON public.quiz_attempts;
CREATE POLICY "Users read own attempts"
  ON public.quiz_attempts FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users insert own attempts" ON public.quiz_attempts;
CREATE POLICY "Users insert own attempts"
  ON public.quiz_attempts FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins manage quiz attempts" ON public.quiz_attempts;
CREATE POLICY "Admins manage quiz attempts"
  ON public.quiz_attempts FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

SELECT 'quiz_attempts table created successfully' AS result;
