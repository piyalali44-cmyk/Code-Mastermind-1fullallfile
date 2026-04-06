-- Enable Supabase Realtime for all tables that need live updates
-- Run this in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/tkruzfskhtcazjxdracm/sql

-- Content tables (admin edits → mobile app sees immediately)
ALTER PUBLICATION supabase_realtime ADD TABLE categories;
ALTER PUBLICATION supabase_realtime ADD TABLE series;
ALTER PUBLICATION supabase_realtime ADD TABLE episodes;

-- User data tables (mobile writes → admin sees immediately)
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE user_xp;
ALTER PUBLICATION supabase_realtime ADD TABLE user_streaks;
ALTER PUBLICATION supabase_realtime ADD TABLE subscriptions;

-- App config tables (admin changes → mobile picks up instantly)
ALTER PUBLICATION supabase_realtime ADD TABLE app_settings;
ALTER PUBLICATION supabase_realtime ADD TABLE feature_flags;
ALTER PUBLICATION supabase_realtime ADD TABLE popup_notices;

-- Notifications (admin sends → mobile receives)
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- Favourites, bookmarks (for cross-device sync)
ALTER PUBLICATION supabase_realtime ADD TABLE favourites;
ALTER PUBLICATION supabase_realtime ADD TABLE bookmarks;

-- Listening progress (for cross-device sync)
ALTER PUBLICATION supabase_realtime ADD TABLE listening_progress;

-- Quizzes (admin creates/edits → mobile sees)
ALTER PUBLICATION supabase_realtime ADD TABLE quizzes;
ALTER PUBLICATION supabase_realtime ADD TABLE quiz_questions;

-- Admin activity log (for admin dashboard)
ALTER PUBLICATION supabase_realtime ADD TABLE admin_activity_log;

-- Donations (for admin dashboard)
ALTER PUBLICATION supabase_realtime ADD TABLE donations;

-- Reciters
ALTER PUBLICATION supabase_realtime ADD TABLE reciters;
