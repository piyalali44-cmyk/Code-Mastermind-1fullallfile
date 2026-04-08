-- ============================================================
-- Migration: Sample Quiz Data
-- Project  : StayGuided Me (Supabase: tkruzfskhtcazjxdracm)
-- Date     : 2026-04-07
-- Run AFTER 20260407_quiz_system.sql
-- Safe to re-run — uses INSERT ... ON CONFLICT DO NOTHING
-- ============================================================

-- ─── QUIZ 1: Pillars of Islam ─────────────────────────────────────────────────
WITH inserted_quiz AS (
  INSERT INTO public.quizzes (title, description, category, is_active, pass_percentage, xp_reward)
  VALUES (
    'Pillars of Islam',
    'Test your knowledge of the five fundamental pillars of Islam.',
    'Islamic Foundations',
    true,
    60,
    50
  )
  ON CONFLICT DO NOTHING
  RETURNING id
)
INSERT INTO public.quiz_questions (quiz_id, question, options, correct_index, explanation, sort_order)
SELECT
  inserted_quiz.id,
  q.question,
  q.options::jsonb,
  q.correct_index,
  q.explanation,
  q.sort_order
FROM inserted_quiz,
(VALUES
  (
    'How many pillars are there in Islam?',
    '["3","4","5","6"]',
    2,
    'There are 5 pillars of Islam: Shahada, Salah, Zakat, Sawm, and Hajj.',
    1
  ),
  (
    'What is the first pillar of Islam?',
    '["Salah (Prayer)","Shahada (Declaration of Faith)","Zakat (Charity)","Sawm (Fasting)"]',
    1,
    'The Shahada is the declaration of faith: There is no god but Allah and Muhammad is His messenger.',
    2
  ),
  (
    'How many times a day do Muslims pray?',
    '["3","4","5","6"]',
    2,
    'Muslims pray 5 times a day: Fajr, Dhuhr, Asr, Maghrib, and Isha.',
    3
  ),
  (
    'What is Zakat in Islam?',
    '["Fasting during Ramadan","Pilgrimage to Mecca","Obligatory annual charity","Daily prayer"]',
    2,
    'Zakat is the obligatory giving of a set proportion of one''s wealth to charity — typically 2.5% of savings.',
    4
  ),
  (
    'Which month do Muslims fast in?',
    '["Shawwal","Dhul Hijjah","Rajab","Ramadan"]',
    3,
    'Muslims fast during the month of Ramadan, the 9th month of the Islamic calendar.',
    5
  )
) AS q(question, options, correct_index, explanation, sort_order);


-- ─── QUIZ 2: Prophets of Islam ────────────────────────────────────────────────
WITH inserted_quiz AS (
  INSERT INTO public.quizzes (title, description, category, is_active, pass_percentage, xp_reward)
  VALUES (
    'Prophets of Islam',
    'How well do you know the prophets mentioned in Islam?',
    'Prophets & Stories',
    true,
    60,
    75
  )
  ON CONFLICT DO NOTHING
  RETURNING id
)
INSERT INTO public.quiz_questions (quiz_id, question, options, correct_index, explanation, sort_order)
SELECT
  inserted_quiz.id,
  q.question,
  q.options::jsonb,
  q.correct_index,
  q.explanation,
  q.sort_order
FROM inserted_quiz,
(VALUES
  (
    'Who is considered the final Prophet in Islam?',
    '["Prophet Isa (AS)","Prophet Ibrahim (AS)","Prophet Muhammad (SAW)","Prophet Musa (AS)"]',
    2,
    'Prophet Muhammad (SAW) is the final and last prophet sent by Allah.',
    1
  ),
  (
    'Which prophet is known as Khalilullah (Friend of Allah)?',
    '["Prophet Musa (AS)","Prophet Ibrahim (AS)","Prophet Isa (AS)","Prophet Nuh (AS)"]',
    1,
    'Prophet Ibrahim (AS) is known as Khalilullah — the Friend of Allah.',
    2
  ),
  (
    'How many prophets are mentioned by name in the Quran?',
    '["10","15","25","40"]',
    2,
    '25 prophets are mentioned by name in the Holy Quran.',
    3
  ),
  (
    'Which prophet built the Kaaba?',
    '["Prophet Muhammad (SAW)","Prophet Adam (AS)","Prophet Ibrahim (AS)","Prophet Ismail (AS)"]',
    2,
    'Prophet Ibrahim (AS) and his son Prophet Ismail (AS) together rebuilt the Kaaba in Mecca.',
    4
  )
) AS q(question, options, correct_index, explanation, sort_order);


-- ─── QUIZ 3: The Quran ────────────────────────────────────────────────────────
WITH inserted_quiz AS (
  INSERT INTO public.quizzes (title, description, category, is_active, pass_percentage, xp_reward)
  VALUES (
    'The Holy Quran',
    'Basic knowledge quiz about the Holy Quran.',
    'Quran',
    true,
    60,
    60
  )
  ON CONFLICT DO NOTHING
  RETURNING id
)
INSERT INTO public.quiz_questions (quiz_id, question, options, correct_index, explanation, sort_order)
SELECT
  inserted_quiz.id,
  q.question,
  q.options::jsonb,
  q.correct_index,
  q.explanation,
  q.sort_order
FROM inserted_quiz,
(VALUES
  (
    'How many surahs (chapters) are in the Quran?',
    '["100","110","114","120"]',
    2,
    'The Holy Quran contains 114 surahs (chapters).',
    1
  ),
  (
    'What is the first surah of the Quran?',
    '["Al-Baqarah","Al-Fatiha","Al-Ikhlas","Al-Nas"]',
    1,
    'Al-Fatiha (The Opening) is the first surah of the Quran and is recited in every unit of prayer.',
    2
  ),
  (
    'Which is the longest surah in the Quran?',
    '["Al-Imran","Al-Fatiha","Al-Baqarah","An-Nisa"]',
    2,
    'Al-Baqarah (The Cow) is the longest surah in the Quran with 286 verses.',
    3
  ),
  (
    'In how many years was the Quran revealed?',
    '["10 years","15 years","23 years","30 years"]',
    2,
    'The Quran was revealed to Prophet Muhammad (SAW) over a period of approximately 23 years.',
    4
  ),
  (
    'What is the shortest surah in the Quran?',
    '["Al-Ikhlas","Al-Falaq","Al-Nas","Al-Kawthar"]',
    3,
    'Al-Kawthar (The Abundance) is the shortest surah with only 3 verses.',
    5
  )
) AS q(question, options, correct_index, explanation, sort_order);


SELECT 'Sample quiz data inserted successfully' AS result;
