-- ============================================================
-- Step 12: Country Feature — Index & RLS Policy
-- Run this in the Supabase SQL Editor to optimize country-based
-- leaderboard filtering and ensure users can update their own country.
-- ============================================================

-- 1. Index on profiles.country for fast leaderboard country filtering
CREATE INDEX IF NOT EXISTS idx_profiles_country
  ON public.profiles (country)
  WHERE country IS NOT NULL;

-- 2. Ensure users can read and update their own profile (including country)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles'
      AND policyname = 'Users can update their own profile'
  ) THEN
    CREATE POLICY "Users can update their own profile"
      ON public.profiles
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- 3. Ensure anon/authenticated can read leaderboard views
GRANT SELECT ON public.leaderboard         TO anon, authenticated;
GRANT SELECT ON public.leaderboard_weekly  TO anon, authenticated;
GRANT SELECT ON public.leaderboard_monthly TO anon, authenticated;

-- Done. Country changes in Settings now automatically update:
--   • leaderboard (Global tab)
--   • leaderboard (My Country tab — filtered by profiles.country)
--   • leaderboard_weekly (Weekly tab)
--   • leaderboard_monthly (Monthly tab)
--   • Admin Analytics → Users by Country
--   • Admin UserDetail → shows flag + country code
-- No other steps needed — the app uses Supabase realtime to auto-refresh
-- the user object whenever profiles.country changes.
