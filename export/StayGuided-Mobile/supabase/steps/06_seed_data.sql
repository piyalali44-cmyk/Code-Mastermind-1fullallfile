-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  StayGuided Me — Step 6 of 8                                    ║
-- ║  SEED DATA                                                      ║
-- ║  (badges, categories, reciters, series, episodes, settings)     ║
-- ║  ✅ Depends on: Step 5                                          ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- ═══════════════════════════════════════════════════════════════════
-- PART 6: SEED DATA
-- ═══════════════════════════════════════════════════════════════════

-- ─── BADGES ───────────────────────────────────────────────────────
INSERT INTO public.badges (slug, name, description, icon, xp_reward) VALUES
  ('first_listen',      'First Listen',        'Completed your first audio session',   '🎧', 10),
  ('quran_start',       'Quran Journey Begins','Listened to your first surah',          '📖', 15),
  ('streak_3',          '3-Day Streak',        'Listened 3 days in a row',              '🔥', 25),
  ('streak_7',          'Week Warrior',        'Listened 7 days in a row',              '⚡', 50),
  ('streak_30',         'Month Master',        'Listened 30 days in a row',             '🏆', 200),
  ('journey_start',     'Journey Begins',      'Started the Islamic Journey',           '🗺️', 20),
  ('journey_complete',  'Journey Complete',    'Completed all 20 chapters',             '✨', 500),
  ('level_5',           'Rising Scholar',      'Reached Level 5',                       '🌟', 100),
  ('level_10',          'Dedicated Learner',   'Reached Level 10',                      '💎', 250),
  ('quran_complete',    'Khatam',              'Listened to all 114 Surahs',            '🕌', 1000),
  ('hadith_start',      'Hadith Seeker',       'First hadith episode completed',        '📜', 15),
  ('hadith_10',         'Hadith Student',      'Completed 10 hadith episodes',          '📚', 75),
  ('hadith_40',         'Hadith Scholar',      'Completed 40 hadith episodes',          '🏛️', 300)
ON CONFLICT (slug) DO NOTHING;

-- ─── CATEGORIES ───────────────────────────────────────────────────
INSERT INTO public.categories (name, name_arabic, slug, icon_url, order_index, is_active, guest_access, free_user_access, show_in_home, is_featured)
VALUES
  ('Seerah', 'السيرة', 'seerah', NULL, 1, true, true, true, true, true),
  ('Prophets', 'الأنبياء', 'prophets', NULL, 2, true, true, true, true, true),
  ('Qur''an', 'القرآن', 'quran', NULL, 3, true, true, true, true, true),
  ('Sahaba', 'الصحابة', 'sahaba', NULL, 4, true, true, true, true, false),
  ('History', 'التاريخ', 'history', NULL, 5, true, true, true, true, false),
  ('Fiqh', 'الفقه', 'fiqh', NULL, 6, true, true, true, true, false),
  ('Hadith', 'الحديث', 'hadith', NULL, 7, true, true, true, true, false),
  ('Tafseer', 'التفسير', 'tafseer', NULL, 8, true, true, true, true, false),
  ('Aqeedah', 'العقيدة', 'aqeedah', NULL, 9, true, true, true, false, false),
  ('Duas & Adhkar', 'الأدعية والأذكار', 'duas-adhkar', NULL, 10, true, true, true, true, false),
  ('Islamic History', 'التاريخ الإسلامي', 'islamic-history', NULL, 11, true, true, true, true, true),
  ('Tafsir', 'التفسير', 'tafsir', NULL, 12, true, true, true, true, false),
  ('Duas', 'الأدعية', 'duas', NULL, 13, true, true, true, true, false)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  name_arabic = EXCLUDED.name_arabic,
  order_index = EXCLUDED.order_index,
  is_active = EXCLUDED.is_active,
  guest_access = EXCLUDED.guest_access,
  free_user_access = EXCLUDED.free_user_access,
  show_in_home = EXCLUDED.show_in_home,
  is_featured = EXCLUDED.is_featured;

-- ─── RECITERS (25 well-known Quran reciters) ──────────────────────
INSERT INTO public.reciters (name_english, name_arabic, api_reciter_id, bio, streaming_bitrate, download_bitrate, supports_ayah_level, is_active, is_default, order_index)
VALUES
  ('Mishary Rashid Alafasy', 'مشاري راشد العفاسي', 'ar.alafasy', 'Kuwaiti imam and Quran reciter, known for his beautiful melodic voice.', 128, 192, true, true, true, 1),
  ('Abdul Rahman Al-Sudais', 'عبدالرحمن السديس', 'ar.abdurrahmaansudais', 'Imam of Masjid al-Haram, Makkah. One of the most recognized voices.', 128, 192, true, true, false, 2),
  ('Abdul Basit Abdus Samad', 'عبدالباسط عبدالصمد', 'ar.abdulbasitmurattal', 'Egyptian Quran reciter, widely considered one of the greatest of all time.', 128, 192, true, true, false, 3),
  ('Mahmoud Khalil Al-Hussary', 'محمود خليل الحصري', 'ar.husary', 'Egyptian hafiz, pioneer of recorded Quran recitation.', 128, 192, true, true, false, 4),
  ('Saud Al-Shuraim', 'سعود الشريم', 'ar.saoodshuraym', 'Former imam of Masjid al-Haram. Known for powerful emotional recitation.', 128, 192, true, true, false, 5),
  ('Maher Al-Muaiqly', 'ماهر المعيقلي', 'ar.mahermuaiqly', 'Imam of Masjid al-Haram. Known for clear and melodious recitation.', 128, 192, true, true, false, 6),
  ('Saad Al-Ghamdi', 'سعد الغامدي', 'ar.saadalghamidi', 'Saudi reciter known for his distinct soothing style.', 128, 192, true, true, false, 7),
  ('Ahmed Al-Ajmi', 'أحمد العجمي', 'ar.ahmedajamy', 'Saudi imam known for emotional Taraweeh prayers.', 128, 192, true, true, false, 8),
  ('Yasser Al-Dosari', 'ياسر الدوسري', 'ar.yasserdossari', 'Saudi imam known for beautiful and emotional recitation.', 128, 192, true, true, false, 9),
  ('Hani Ar-Rifai', 'هاني الرفاعي', 'ar.haborning', 'Saudi reciter known for melodic and touching recitation style.', 128, 192, false, true, false, 10),
  ('Abu Bakr Al-Shatri', 'أبو بكر الشاطري', 'ar.shaatree', 'Saudi reciter, former imam of Masjid al-Haram during Ramadan.', 128, 192, false, true, false, 11),
  ('Muhammad Ayyub', 'محمد أيوب', 'ar.muhammadayyoub', 'Former imam of Masjid an-Nabawi. Known for precise tajweed.', 128, 192, true, true, false, 12),
  ('Abdullah Basfar', 'عبدالله بصفر', 'ar.abdullahbasfar', 'Saudi reciter and professor of Islamic Studies.', 128, 192, false, true, false, 13),
  ('Nasser Al-Qatami', 'ناصر القطامي', 'ar.naborning', 'Saudi imam known for emotional and powerful recitation.', 128, 192, false, true, false, 14),
  ('Fares Abbad', 'فارس عباد', 'ar.faborning', 'Saudi reciter known for his soothing voice.', 128, 192, false, true, false, 15),
  ('Muhammad Al-Luhaidan', 'محمد اللحيدان', 'ar.muhammadluhaidan', 'Saudi imam known for very emotional recitation.', 128, 192, false, true, false, 16),
  ('Ali Al-Hudhaify', 'علي الحذيفي', 'ar.hudhaify', 'Former imam of Masjid an-Nabawi. Known for precise tajweed.', 128, 192, true, true, false, 17),
  ('Ibrahim Al-Akhdar', 'إبراهيم الأخضر', 'ar.ibrahimakhdar', 'Saudi reciter and educator.', 128, 192, false, true, false, 18),
  ('Bandar Baleela', 'بندر بليلة', 'ar.baborning', 'Imam of Masjid al-Haram. Known for his distinct powerful voice.', 128, 192, false, true, false, 19),
  ('Khalifa Al-Tunaiji', 'خليفة الطنيجي', 'ar.khalifaaltunaiji', 'Emirati reciter with unique style.', 128, 192, false, true, false, 20),
  ('Idris Abkar', 'إدريس أبكر', 'ar.idrisabkar', 'Emirati imam with emotional recitation.', 128, 192, false, true, false, 21),
  ('Abdulmohsin Al-Qasim', 'عبدالمحسن القاسم', 'ar.abdulmohsinqasim', 'Imam of Masjid an-Nabawi. Known for calm recitation.', 128, 192, false, true, false, 22),
  ('Yusuf bin Noah Ahmad', 'يوسف بن نوح أحمد', 'ar.yusufbinoahmad', 'Melodious and serene recitation style.', 128, 192, false, true, false, 23),
  ('Abdul Basit (Mujawwad)', 'عبدالباسط عبدالصمد (مجود)', 'ar.abdulsamad', 'Mujawwad style by Abdul Basit Abdus Samad.', 128, 192, false, true, false, 24),
  ('Al-Hussary (Muallim)', 'الحصري (معلم)', 'ar.husarymuallim', 'Teaching recitation with pauses for learners.', 128, 192, true, true, false, 25)
ON CONFLICT DO NOTHING;

-- ─── JOURNEY CHAPTERS (20-chapter Islamic history) ────────────────
INSERT INTO public.journey_chapters (chapter_number, title, subtitle, era_label, is_published, show_coming_soon, order_index)
VALUES
  (1,  'The Creation & Early Prophets',    'Adam, Nuh, Ibrahim ع', 'Pre-Islamic Era',       true,  false, 1),
  (2,  'Prophet Ibrahim & His Legacy',     'The Father of Monotheism', 'Pre-Islamic Era',   true,  false, 2),
  (3,  'Musa & Bani Israel',               'The Exodus & the Torah',   'Pre-Islamic Era',   true,  false, 3),
  (4,  'Isa ibn Maryam',                   'The Messiah in Islam',     'Pre-Islamic Era',   true,  false, 4),
  (5,  'Arabia Before Islam',              'The Age of Ignorance',     'Pre-Islamic Era',   true,  false, 5),
  (6,  'Birth of the Prophet ﷺ',          'The Year of the Elephant', '570 CE',            true,  false, 6),
  (7,  'The First Revelation',             'Iqra — Read',              '610 CE',            true,  false, 7),
  (8,  'The Meccan Period',                'Persecution & Patience',   '610–622 CE',        true,  false, 8),
  (9,  'The Hijra',                        'Migration to Madinah',     '622 CE',            true,  false, 9),
  (10, 'Building the Islamic State',       'Madinah Society',          '622–625 CE',        true,  false, 10),
  (11, 'The Battle of Badr',               'The First Great Victory',  '624 CE',            true,  false, 11),
  (12, 'Uhud & Its Lessons',               'Trials & Steadfastness',   '625 CE',            true,  false, 12),
  (13, 'The Battle of the Trench',         'Alliance & Betrayal',      '627 CE',            false, true,  13),
  (14, 'Treaty of Hudaybiyyah',            'The Apparent Defeat',      '628 CE',            false, true,  14),
  (15, 'Conquest of Makkah',              'The Bloodless Victory',    '630 CE',            false, true,  15),
  (16, 'The Farewell Pilgrimage',          'Final Sermon of the Prophet ﷺ', '632 CE',      false, true,  16),
  (17, 'The Rightly-Guided Caliphs',       'Abu Bakr, Umar, Uthman, Ali', '632–661 CE',    false, true,  17),
  (18, 'The Umayyad Caliphate',            'Expansion & Challenges',   '661–750 CE',        false, true,  18),
  (19, 'The Abbasid Golden Age',           'Science, Art & Learning',  '750–1258 CE',       false, true,  19),
  (20, 'Islam''s Global Legacy',           'The Message for All Time', 'Present Day',       false, true,  20)
ON CONFLICT (chapter_number) DO NOTHING;

-- ─── SERIES (linked to categories) ────────────────────────────────
DO $$
DECLARE
  v_seerah_id UUID; v_prophets_id UUID; v_quran_id UUID;
  v_sahaba_id UUID; v_history_id UUID; v_fiqh_id UUID;
  v_hadith_id UUID; v_tafseer_id UUID;
BEGIN
  SELECT id INTO v_seerah_id   FROM public.categories WHERE slug = 'seerah';
  SELECT id INTO v_prophets_id FROM public.categories WHERE slug = 'prophets';
  SELECT id INTO v_quran_id    FROM public.categories WHERE slug = 'quran';
  SELECT id INTO v_sahaba_id   FROM public.categories WHERE slug = 'sahaba';
  SELECT id INTO v_history_id  FROM public.categories WHERE slug = 'history';
  SELECT id INTO v_fiqh_id     FROM public.categories WHERE slug = 'fiqh';
  SELECT id INTO v_hadith_id   FROM public.categories WHERE slug = 'hadith';
  SELECT id INTO v_tafseer_id  FROM public.categories WHERE slug = 'tafseer';

  INSERT INTO public.series (title, category_id, description, pub_status, is_featured, episode_count)
  VALUES
    ('The Life of the Prophet ﷺ', v_seerah_id, 'A comprehensive journey through the life of Prophet Muhammad ﷺ from birth to passing.', 'published', true, 48),
    ('Stories of the Prophets', v_prophets_id, 'Learn about all the Prophets mentioned in the Quran — from Adam (AS) to Isa (AS).', 'published', true, 32),
    ('Companions of the Prophet ﷺ', v_sahaba_id, 'Inspiring stories of the Sahaba who gave everything for Islam.', 'published', true, 24),
    ('Islamic History: The Golden Age', v_history_id, 'From the Rightly Guided Caliphs to the great Muslim empires.', 'published', false, 20),
    ('Qur''anic Stories', v_quran_id, 'Stories mentioned in the Quran — lessons and wisdoms from divine revelation.', 'published', true, 16),
    ('Pillars of Islam', v_fiqh_id, 'A detailed guide to the five pillars — Shahada, Salah, Zakah, Sawm, and Hajj.', 'published', false, 15),
    ('40 Hadith of Imam Nawawi', v_hadith_id, 'Deep dive into the 40 most important hadiths compiled by Imam An-Nawawi.', 'published', false, 40),
    ('Tafseer of Juz Amma', v_tafseer_id, 'Detailed explanation and context of the 30th part of the Quran.', 'published', false, 37),
    ('Women in Islam', v_seerah_id, 'Stories of the great women in Islamic history — Khadijah, Aisha, Fatimah, and more.', 'published', false, 12),
    ('The Hereafter Series', v_quran_id, 'What happens after death? A journey through Barzakh, Day of Judgment, and beyond.', 'published', false, 10)
  ON CONFLICT DO NOTHING;
END $$;

-- ─── SAMPLE EPISODES (for first 3 series) ─────────────────────────
DO $$
DECLARE v1 UUID; v2 UUID; v3 UUID;
BEGIN
  SELECT id INTO v1 FROM public.series WHERE title = 'The Life of the Prophet ﷺ' LIMIT 1;
  SELECT id INTO v2 FROM public.series WHERE title = 'Stories of the Prophets' LIMIT 1;
  SELECT id INTO v3 FROM public.series WHERE title = 'Companions of the Prophet ﷺ' LIMIT 1;

  IF v1 IS NOT NULL THEN
    INSERT INTO public.episodes (series_id, episode_number, title, duration, pub_status) VALUES
      (v1,1,'Arabia Before Islam',1800,'published'),(v1,2,'The Year of the Elephant',1500,'published'),
      (v1,3,'Birth of the Prophet ﷺ',1620,'published'),(v1,4,'Early Childhood & Halimah',1440,'published'),
      (v1,5,'Youth of Muhammad ﷺ',1380,'published'),(v1,6,'Marriage to Khadijah (RA)',1560,'published'),
      (v1,7,'The First Revelation',1740,'published'),(v1,8,'The Secret Call to Islam',1500,'published'),
      (v1,9,'Public Dawah Begins',1680,'published'),(v1,10,'Persecution of Early Muslims',1800,'published'),
      (v1,11,'Migration to Abyssinia',1560,'published'),(v1,12,'The Boycott of Banu Hashim',1440,'published'),
      (v1,13,'Year of Sorrow',1320,'published'),(v1,14,'Al-Isra wal Mi''raj',1860,'published'),
      (v1,15,'The Hijrah to Madinah',1740,'published')
    ON CONFLICT DO NOTHING;
  END IF;

  IF v2 IS NOT NULL THEN
    INSERT INTO public.episodes (series_id, episode_number, title, duration, pub_status) VALUES
      (v2,1,'Adam (AS) — The First Human',1500,'published'),(v2,2,'Idris (AS) — The Scholar',1200,'published'),
      (v2,3,'Nuh (AS) — The Great Flood',1680,'published'),(v2,4,'Hud (AS) — The People of Ad',1440,'published'),
      (v2,5,'Salih (AS) — The She-Camel',1380,'published'),(v2,6,'Ibrahim (AS) — The Friend of Allah',1920,'published'),
      (v2,7,'Ismail (AS) — The Sacrifice',1500,'published'),(v2,8,'Ishaq & Yaqub (AS)',1320,'published'),
      (v2,9,'Yusuf (AS) — The Beautiful Story',2100,'published'),(v2,10,'Musa (AS) — Part 1: Pharaoh',1800,'published'),
      (v2,11,'Musa (AS) — Part 2: Exodus',1740,'published'),(v2,12,'Dawud & Sulayman (AS)',1620,'published'),
      (v2,13,'Yunus (AS) — The Whale',1380,'published'),(v2,14,'Isa (AS) — Son of Maryam',1800,'published')
    ON CONFLICT DO NOTHING;
  END IF;

  IF v3 IS NOT NULL THEN
    INSERT INTO public.episodes (series_id, episode_number, title, duration, pub_status) VALUES
      (v3,1,'Abu Bakr As-Siddiq (RA)',1800,'published'),(v3,2,'Umar ibn Al-Khattab (RA)',1920,'published'),
      (v3,3,'Uthman ibn Affan (RA)',1680,'published'),(v3,4,'Ali ibn Abi Talib (RA)',1740,'published'),
      (v3,5,'Khadijah bint Khuwaylid (RA)',1560,'published'),(v3,6,'Bilal ibn Rabah (RA)',1500,'published'),
      (v3,7,'Khalid ibn Al-Walid (RA)',1620,'published'),(v3,8,'Abdur Rahman ibn Awf (RA)',1440,'published'),
      (v3,9,'Salman Al-Farisi (RA)',1500,'published'),(v3,10,'Aisha bint Abu Bakr (RA)',1680,'published')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ─── APP SETTINGS (all default values) ────────────────────────────
INSERT INTO public.app_settings (key, value, description, type) VALUES
  ('guest_can_listen',        'true',  'Allow guest users to listen to content', 'boolean'),
  ('guest_can_browse',        'true',  'Allow guest users to browse the app',    'boolean'),
  ('guest_episode_limit',     '3',     'Max episodes a guest can play per session', 'number'),
  ('guest_prompt_register',   'true',  'Show register prompt after guest limit', 'boolean'),
  ('default_reciter',         '"ar.alafasy"', 'Default Qur''an reciter ID',       'string'),
  ('default_translation',     '"en.asad"',    'Default translation edition',      'string'),
  ('show_arabic_default',     'true',         'Show Arabic text by default',      'boolean'),
  ('show_translation_default','true',         'Show translation by default',      'boolean'),
  ('quran_streaming_quality', '"128kbps"',    'Streaming audio quality',          'string'),
  ('quran_download_quality',  '"192kbps"',    'Download audio quality',           'string'),
  ('weekly_price_usd',         '0.99',         'Weekly subscription price (USD)',   'number'),
  ('monthly_price_usd',        '4.99',         'Monthly subscription price (USD)', 'number'),
  ('trial_days',              '7',            'Free trial duration in days',      'number'),
  ('trial_enabled',           'false',        'Enable free trial for new users',  'boolean'),
  ('max_downloads_free',      '5',            'Max downloads for free users',     'number'),
  ('max_downloads_premium',   '500',          'Max downloads for premium users',  'number'),
  ('download_wifi_only_default','true',       'Default wifi-only download setting','boolean'),
  ('download_expiry_days',    '30',           'Days before downloads expire',     'number'),
  ('xp_per_episode',          '10',           'XP awarded per episode completed', 'number'),
  ('xp_per_surah',            '15',           'XP awarded per surah completed',   'number'),
  ('xp_daily_login',          '5',            'XP awarded for daily login',       'number'),
  ('xp_streak_multiplier',    '1.5',          'XP multiplier for active streaks', 'number'),
  ('streak_grace_hours',      '24',           'Grace period for streak (hours)',  'number'),
  ('referrer_xp_reward',      '500',          'XP reward for referring a friend', 'number'),
  ('referred_xp_reward',      '100',          'XP reward for being referred',     'number'),
  ('app_name',                '"StayGuided Me"', 'App display name',              'string'),
  ('guest_access_enabled',    'true',            'Allow guest access to the app', 'boolean'),
  ('maintenance_mode',        'false',           'Enable maintenance mode',       'boolean'),
  ('maintenance_message',     '"We are performing scheduled maintenance. Please check back soon."', 'Maintenance message', 'string'),
  ('force_update_version',    '"0"',             'Force update for versions below this', 'string'),
  ('ramadan_mode',            'false',           'Enable Ramadan UI mode',        'boolean'),
  ('referral_enabled',        'true',            'Enable referral program',       'boolean'),
  ('referral_code_prefix',    '"SG"',            'Prefix for referral codes',     'string'),
  ('max_referrals_per_user',  '50',              'Max referrals per user',        'number')
ON CONFLICT (key) DO NOTHING;

-- ─── FEATURE FLAGS ────────────────────────────────────────────────
INSERT INTO public.feature_flags (key, name, description, section, is_enabled, rollout_pct) VALUES
  ('social_sharing',       'Social Sharing',           'Share episodes to WhatsApp / Twitter', 'content',        true,  100),
  ('quran_word_by_word',   'Quran Word-by-Word',       'Highlight each word as it plays',      'quran',          false, 0),
  ('quiz_mode',            'Quiz Mode',                'Post-episode knowledge quizzes',        'gamification',   false, 0),
  ('journey_mode',         'Islamic Journey',          '20-chapter guided Islamic journey',     'content',        true,  100),
  ('referral_program',     'Referral Program',         'Refer friends to earn XP',             'growth',         true,  100),
  ('leaderboard',          'Leaderboard',              'Global XP leaderboard',                'gamification',   true,  100),
  ('streak_notifications', 'Streak Notifications',     'Daily streak reminder notifications',  'notifications',  true,  100),
  ('offline_downloads',    'Offline Downloads',        'Download episodes for offline play',   'premium',        true,  100),
  ('dark_mode_toggle',     'Dark Mode Toggle',         'Allow users to switch to light mode',  'appearance',     false, 0),
  ('push_notifications',   'Push Notifications',       'Allow push notifications via FCM',     'notifications',  true,  100),
  ('guest_mode',           'Guest Mode',               'Allow unauthenticated app access',     'access',         true,  100),
  ('donation_banner',      'Donation Banner',          'Show donation CTA to free users',      'monetization',   false, 0),
  ('ramadan_features',     'Ramadan Features',         'Ramadan countdown and special content','seasonal',       false, 0),
  ('analytics_events',     'Analytics Event Tracking', 'Track detailed user events',           'analytics',      true,  100),
  ('quran_player',         'Quran Player',             'Enable built-in Quran audio player',  'content',        true,  100),
  ('bookmarks',            'Bookmarks',                'Allow users to bookmark episodes',    'content',        true,  100),
  ('playback_speed',       'Playback Speed',           'Allow adjusting playback speed',      'content',        true,  100),
  ('in_app_purchases',     'In-App Purchases',         'Enable in-app purchase flows',        'monetization',   false, 0),
  ('prayer_times',         'Prayer Times',             'Show prayer times feature',           'content',        true,  100),
  ('streak_tracking',      'Streak Tracking',          'Track daily listening streaks',       'gamification',   true,  100),
  ('referral_system',      'Referral System',          'Enable referral program with XP',     'growth',         true,  100)
ON CONFLICT (key) DO UPDATE SET
  is_enabled = EXCLUDED.is_enabled,
  description = EXCLUDED.description,
  name = EXCLUDED.name,
  section = EXCLUDED.section,
  rollout_pct = EXCLUDED.rollout_pct;

-- ─── DONATION SETTINGS ───────────────────────────────────────────
INSERT INTO public.donation_settings (key, value) VALUES
  ('donation_enabled',     'false'),
  ('donation_url',         '"https://www.launchgood.com"'),
  ('donation_message',     '"Support Islamic content development"'),
  ('donation_amounts_usd', '[2, 5, 10, 25, 50]'),
  ('donation_currency',    '"USD"'),
  ('show_in_profile',      'true'),
  ('show_in_player',       'false')
ON CONFLICT (key) DO NOTHING;

-- ─── API SOURCES ──────────────────────────────────────────────────
INSERT INTO public.api_sources (name, type, base_url, is_active, is_primary, priority) VALUES
  ('Al-Quran Cloud',   'quran_audio',   'https://api.alquran.cloud/v1',      true,  true,  1),
  ('Quran.com API',    'quran_text',    'https://api.quran.com/api/v4',      true,  true,  1),
  ('Quran.com Audio',  'quran_audio',   'https://audio.qurancdn.com',        true,  false, 2),
  ('MP3Quran.net',     'quran_audio',   'https://www.mp3quran.net/api',      true,  false, 3),
  ('Aladhan.com',      'prayer_times',  'https://api.aladhan.com/v1',        true,  true,  1)
ON CONFLICT DO NOTHING;


SELECT '✅ Step 6 done: Seed Data' AS result;
