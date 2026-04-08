-- ═══════════════════════════════════════════════════════════════════════════
-- MISSING FEATURE FLAGS — Seed all flags the mobile app references
-- Run this in Supabase SQL Editor after 20260401_complete_setup.sql
-- Safe to re-run — uses ON CONFLICT DO NOTHING
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO public.feature_flags (key, name, description, section, is_enabled, rollout_pct)
VALUES
  -- Gamification
  ('leaderboard',           'Leaderboard',            'Global, weekly & monthly XP leaderboard',          'gamification', true,  100),
  ('streak_tracking',       'Streak Tracking',        'Daily listening streak XP rewards',                'gamification', true,  100),
  ('streak_notifications',  'Streak Notifications',   'Local reminder when streak is at risk',            'gamification', true,  100),

  -- Content
  ('referral_program',      'Referral Program',       'Show referral code in profile + reward both users','content',      true,  100),
  ('referral_system',       'Referral System',        'Backend referral code processing',                 'content',      true,  100),
  ('bookmarks',             'Bookmarks',              'Let users bookmark series and surahs',             'content',      true,  100),
  ('offline_downloads',     'Offline Downloads',      'Download episodes for offline listening',          'content',      true,  100),
  ('playback_speed',        'Playback Speed',         'Speed control (0.5×–2×) in the audio player',     'content',      true,  100),
  ('guest_mode',            'Guest Mode',             'Allow unauthenticated browsing of free content',   'content',      true,  100),

  -- Quran
  ('quran_player',          'Quran Player',           'Full surah audio player with word highlighting',   'quran',        true,  100),

  -- Monetization
  ('in_app_purchases',      'In-App Purchases',       'Apple / Google Play subscription purchases',       'monetization', false, 0),
  ('donation_banner',       'Donation Banner',        'Show a donation CTA banner on the home screen',    'monetization', false, 0),

  -- App
  ('push_notifications',    'Push Notifications',     'Expo push notification delivery to users',         'app',          true,  100),
  ('dark_mode_toggle',      'Dark Mode Toggle',       'Let users switch between light and dark theme',    'app',          false, 0),
  ('analytics_events',      'Analytics Events',       'Log anonymous usage events for analytics',         'app',          true,  100),

  -- Future / Planned
  ('prayer_times',          'Prayer Times',           'Show daily Salah times based on user location',    'app',          true,  100),

  -- Growth
  ('rate_app',              'Rate the App',           'Show "Rate the App" button in Settings — links to App Store / Play Store review page', 'growth', true, 100)

ON CONFLICT (key) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- Summary of flags added (17 new flags):
--   leaderboard, streak_tracking, streak_notifications,
--   referral_program, referral_system, bookmarks, offline_downloads,
--   playback_speed, guest_mode, quran_player, in_app_purchases,
--   donation_banner, push_notifications, dark_mode_toggle,
--   analytics_events, prayer_times, rate_app
-- ═══════════════════════════════════════════════════════════════════════════
