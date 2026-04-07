-- ============================================================
-- fix_duplicates.sql
-- Run this in Supabase Dashboard → SQL Editor
-- Removes actual duplicate rows from database tables
-- Safe to run multiple times (idempotent)
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- 1. SERIES — remove exact duplicate rows (same id, keep oldest)
-- ──────────────────────────────────────────────────────────────
DELETE FROM series
WHERE ctid NOT IN (
  SELECT MIN(ctid)
  FROM series
  GROUP BY id
);

-- ──────────────────────────────────────────────────────────────
-- 2. EPISODES — remove duplicate rows (same id, keep oldest)
-- ──────────────────────────────────────────────────────────────
DELETE FROM episodes
WHERE ctid NOT IN (
  SELECT MIN(ctid)
  FROM episodes
  GROUP BY id
);

-- ──────────────────────────────────────────────────────────────
-- 3. RECITERS — remove duplicate rows (same id, keep oldest)
-- ──────────────────────────────────────────────────────────────
DELETE FROM reciters
WHERE ctid NOT IN (
  SELECT MIN(ctid)
  FROM reciters
  GROUP BY id
);

-- ──────────────────────────────────────────────────────────────
-- 4. CATEGORIES — remove duplicate rows (same id, keep oldest)
-- ──────────────────────────────────────────────────────────────
DELETE FROM categories
WHERE ctid NOT IN (
  SELECT MIN(ctid)
  FROM categories
  GROUP BY id
);

-- ──────────────────────────────────────────────────────────────
-- 5. LISTENING HISTORY — remove exact duplicate sessions
--    (same user + content + listened_at, keep one)
-- ──────────────────────────────────────────────────────────────
DELETE FROM listening_history
WHERE ctid NOT IN (
  SELECT MIN(ctid)
  FROM listening_history
  GROUP BY user_id, content_id, content_type, listened_at
);

-- ──────────────────────────────────────────────────────────────
-- 6. CHAPTERS — remove duplicate rows (same id, keep oldest)
-- ──────────────────────────────────────────────────────────────
DELETE FROM chapters
WHERE ctid NOT IN (
  SELECT MIN(ctid)
  FROM chapters
  GROUP BY id
);

-- ──────────────────────────────────────────────────────────────
-- 7. Verification — check remaining counts after cleanup
-- ──────────────────────────────────────────────────────────────
SELECT
  'series'            AS table_name, COUNT(*) AS total_rows,
  COUNT(DISTINCT id)  AS unique_ids,
  COUNT(*) - COUNT(DISTINCT id) AS duplicates_remaining
FROM series
UNION ALL
SELECT
  'episodes', COUNT(*), COUNT(DISTINCT id),
  COUNT(*) - COUNT(DISTINCT id)
FROM episodes
UNION ALL
SELECT
  'reciters', COUNT(*), COUNT(DISTINCT id),
  COUNT(*) - COUNT(DISTINCT id)
FROM reciters
UNION ALL
SELECT
  'categories', COUNT(*), COUNT(DISTINCT id),
  COUNT(*) - COUNT(DISTINCT id)
FROM categories
ORDER BY table_name;
