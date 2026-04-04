-- ╔══════════════════════════════════════════════════════════════╗
-- ║  StayGuided Me — EPISODE FIX                               ║
-- ║  Fixes: wrong episode counts, wrong durations,             ║
-- ║         episodes not showing from admin panel              ║
-- ║  ✅ Safe to run multiple times                              ║
-- ╚══════════════════════════════════════════════════════════════╝

-- STEP 1: Fix episodes RLS policy
-- Allow ALL episodes of published series to be visible
-- (previously only 'published' episodes were visible — blocking admin-added episodes)
DROP POLICY IF EXISTS "Public reads published episodes" ON public.episodes;
CREATE POLICY "Public reads published episodes" ON public.episodes
  FOR SELECT TO anon, authenticated USING (
    EXISTS (
      SELECT 1 FROM public.series
      WHERE series.id = episodes.series_id
        AND series.pub_status = 'published'
    )
  );

-- STEP 2: Recalculate episode_count and total_duration for ALL series
-- Syncs cached values with actual episode data in the database
UPDATE public.series s
SET
  episode_count = COALESCE((
    SELECT COUNT(*) FROM public.episodes e WHERE e.series_id = s.id
  ), 0),
  total_duration = COALESCE((
    SELECT SUM(COALESCE(e.duration, 0)) FROM public.episodes e WHERE e.series_id = s.id
  ), 0);

-- STEP 3: Add auto-sync trigger (keeps counts updated when episodes change)
CREATE OR REPLACE FUNCTION public.sync_series_episode_stats()
RETURNS TRIGGER AS $$
DECLARE
  target_series_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_series_id := OLD.series_id;
  ELSE
    target_series_id := NEW.series_id;
  END IF;

  UPDATE public.series
  SET
    episode_count = (SELECT COUNT(*) FROM public.episodes WHERE series_id = target_series_id),
    total_duration = COALESCE((SELECT SUM(COALESCE(duration,0)) FROM public.episodes WHERE series_id = target_series_id), 0)
  WHERE id = target_series_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_series_stats ON public.episodes;
CREATE TRIGGER trg_sync_series_stats
  AFTER INSERT OR UPDATE OR DELETE ON public.episodes
  FOR EACH ROW EXECUTE FUNCTION public.sync_series_episode_stats();

-- Show results
SELECT
  s.title,
  s.pub_status,
  s.episode_count,
  ROUND(s.total_duration / 60.0, 1) AS total_minutes,
  ROUND(s.total_duration / 3600.0, 2) AS total_hours
FROM public.series s
ORDER BY s.episode_count DESC;
