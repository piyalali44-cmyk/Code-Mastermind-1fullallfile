-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  StayGuided Me — Step 8 of 8                                    ║
-- ║  ADMIN USER PROMOTION + PROFILE BACKFILL                        ║
-- ║  ⚠️  IMPORTANT: imranrir46@gmail.com must exist in              ║
-- ║     Supabase → Authentication → Users BEFORE running this!     ║
-- ║  ✅ Depends on: Step 7                                          ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- ═══════════════════════════════════════════════════════════════════
-- PART 8A: BACKFILL PROFILES FOR ALL EXISTING AUTH USERS
-- (Handles users who signed up before the DB was reset — trigger
--  only fires for NEW signups, so existing users need this backfill)
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

-- Also backfill user_settings, user_xp, user_streaks for all profiles
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

-- ═══════════════════════════════════════════════════════════════════
-- PART 8B: ADMIN USER PROMOTION
-- ═══════════════════════════════════════════════════════════════════
UPDATE public.profiles
SET role = 'super_admin'
WHERE email = 'imranrir46@gmail.com';

-- Fallback: insert admin profile if somehow still missing
INSERT INTO public.profiles (id, display_name, email, role)
SELECT id, split_part(email, '@', 1), email, 'super_admin'
FROM auth.users WHERE email = 'imranrir46@gmail.com'
ON CONFLICT (id) DO UPDATE SET role = 'super_admin';

-- ═══════════════════════════════════════════════════════════════════
-- DONE! StayGuided Me — Complete setup applied successfully.
-- ═══════════════════════════════════════════════════════════════════

SELECT '✅ Step 8 done: Profile Backfill + Admin Promotion — ALL SETUP COMPLETE!' AS result;
