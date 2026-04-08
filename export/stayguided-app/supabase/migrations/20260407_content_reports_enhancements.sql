-- ═══════════════════════════════════════════════════════════════════════════
-- CONTENT REPORTS ENHANCEMENTS
-- Run in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Add admin_note column for admin internal notes
ALTER TABLE public.content_reports
  ADD COLUMN IF NOT EXISTS admin_note TEXT;

-- 2. Add content_title for display (populated by mobile on submit)
ALTER TABLE public.content_reports
  ADD COLUMN IF NOT EXISTS content_title TEXT;

-- 3. Extend content_type to support 'surah' (Qur'an reports)
ALTER TABLE public.content_reports
  DROP CONSTRAINT IF EXISTS content_reports_content_type_check;
ALTER TABLE public.content_reports
  ADD CONSTRAINT content_reports_content_type_check
  CHECK (content_type IN ('episode', 'series', 'surah'));

-- 4. Fix SELECT policy so admins can see ALL reports
--    (existing "Users see own reports" only shows own reports)
DROP POLICY IF EXISTS "Admin manages reports"    ON public.content_reports;
DROP POLICY IF EXISTS "Admins view all reports"  ON public.content_reports;
DROP POLICY IF EXISTS "Admins update reports"    ON public.content_reports;
DROP POLICY IF EXISTS "Admins delete reports"    ON public.content_reports;
DROP POLICY IF EXISTS "Users see own reports"    ON public.content_reports;

CREATE POLICY "Admins view all reports" ON public.content_reports
  FOR SELECT USING (
    auth.uid() = reporter_id
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins update reports" ON public.content_reports
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins delete reports" ON public.content_reports
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 5. Grant UPDATE to authenticated (admins need it via RLS, service_role already has it)
GRANT SELECT, INSERT, UPDATE ON public.content_reports TO authenticated;

-- 6. Enable Realtime for content_reports (safe if already added)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'content_reports'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.content_reports;
  END IF;
END $$;
