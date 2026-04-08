-- ============================================================
-- Migration: Likes, Comments & Comment Blocking
-- Project  : StayGuided Me (Supabase: tkruzfskhtcazjxdracm)
-- Date     : 2026-04-06
-- Safe to run multiple times (fully idempotent).
-- Run this in Supabase Dashboard → SQL Editor.
-- ============================================================


-- ─── 1. CONTENT_LIKES ────────────────────────────────────────────────────────
-- Stores one like per user per content item (episode, surah, series).

CREATE TABLE IF NOT EXISTS public.content_likes (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_type  text NOT NULL CHECK (content_type IN ('episode', 'surah', 'series')),
  content_id    text NOT NULL,
  created_at    timestamptz DEFAULT now() NOT NULL,
  UNIQUE (user_id, content_type, content_id)
);

CREATE INDEX IF NOT EXISTS content_likes_content_idx
  ON public.content_likes (content_type, content_id);
CREATE INDEX IF NOT EXISTS content_likes_user_idx
  ON public.content_likes (user_id);

ALTER TABLE public.content_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "content_likes_select_all"  ON public.content_likes;
DROP POLICY IF EXISTS "content_likes_insert_own"  ON public.content_likes;
DROP POLICY IF EXISTS "content_likes_delete_own"  ON public.content_likes;
-- Legacy names (drop in case they exist from a previous run)
DROP POLICY IF EXISTS "Users can read all likes"      ON public.content_likes;
DROP POLICY IF EXISTS "Users can like (insert own)"   ON public.content_likes;
DROP POLICY IF EXISTS "Users can unlike (delete own)" ON public.content_likes;

CREATE POLICY "content_likes_select_all"
  ON public.content_likes FOR SELECT USING (true);

CREATE POLICY "content_likes_insert_own"
  ON public.content_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "content_likes_delete_own"
  ON public.content_likes FOR DELETE
  USING (auth.uid() = user_id);

-- Grant table-level privileges to Supabase roles
-- (RLS policies are evaluated on top of these grants)
GRANT SELECT ON public.content_likes TO anon;
GRANT SELECT, INSERT, DELETE ON public.content_likes TO authenticated;

-- Enable realtime (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'content_likes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.content_likes;
  END IF;
END $$;


-- ─── 2. CONTENT_COMMENTS ─────────────────────────────────────────────────────
-- Stores user comments on any content item, with soft-delete and flagging.

CREATE TABLE IF NOT EXISTS public.content_comments (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_type  text NOT NULL CHECK (content_type IN ('episode', 'surah', 'series')),
  content_id    text NOT NULL,
  body          text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  is_deleted    boolean DEFAULT false NOT NULL,
  is_flagged    boolean DEFAULT false NOT NULL,
  created_at    timestamptz DEFAULT now() NOT NULL,
  updated_at    timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS content_comments_content_idx
  ON public.content_comments (content_type, content_id);
CREATE INDEX IF NOT EXISTS content_comments_user_idx
  ON public.content_comments (user_id);
CREATE INDEX IF NOT EXISTS content_comments_not_deleted_idx
  ON public.content_comments (content_type, content_id)
  WHERE is_deleted = false;

ALTER TABLE public.content_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "content_comments_select_active"    ON public.content_comments;
DROP POLICY IF EXISTS "content_comments_insert_own"       ON public.content_comments;
DROP POLICY IF EXISTS "content_comments_update_own"       ON public.content_comments;
-- Legacy names
DROP POLICY IF EXISTS "Anyone can read non-deleted comments"  ON public.content_comments;
DROP POLICY IF EXISTS "Users can insert own comments"         ON public.content_comments;
DROP POLICY IF EXISTS "Users can soft-delete own comments"    ON public.content_comments;

-- Mobile app: authenticated users can read non-deleted comments
CREATE POLICY "content_comments_select_active"
  ON public.content_comments FOR SELECT
  USING (is_deleted = false);

-- Authenticated users can post comments
CREATE POLICY "content_comments_insert_own"
  ON public.content_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can soft-delete (update) their own comments
-- Admin panel uses service-role key and bypasses RLS entirely
CREATE POLICY "content_comments_update_own"
  ON public.content_comments FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Grant table-level privileges
GRANT SELECT ON public.content_comments TO anon;
GRANT SELECT, INSERT, UPDATE ON public.content_comments TO authenticated;

-- Enable realtime (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'content_comments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.content_comments;
  END IF;
END $$;


-- ─── 3. COMMENT_BLOCKED_USERS ────────────────────────────────────────────────
-- Admin can block specific users from posting new comments.
-- Admin panel uses service-role key and therefore bypasses all RLS.

CREATE TABLE IF NOT EXISTS public.comment_blocked_users (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason      text,
  created_at  timestamptz DEFAULT now() NOT NULL,
  UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS comment_blocked_users_user_idx
  ON public.comment_blocked_users (user_id);

ALTER TABLE public.comment_blocked_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comment_blocked_select_own"         ON public.comment_blocked_users;
-- Legacy names
DROP POLICY IF EXISTS "Users can read their own block status" ON public.comment_blocked_users;

-- Mobile app: each user can only check whether THEY are blocked
CREATE POLICY "comment_blocked_select_own"
  ON public.comment_blocked_users FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT / UPDATE / DELETE done by admin via service-role key (no RLS needed)

-- Grant SELECT so authenticated users can check their own block status (RLS enforces the filter)
GRANT SELECT ON public.comment_blocked_users TO authenticated;


-- ─── 4. HELPER: updated_at trigger ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_content_comments_updated_at ON public.content_comments;
CREATE TRIGGER set_content_comments_updated_at
  BEFORE UPDATE ON public.content_comments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ─── 5. VERIFY (optional — shows table row counts after migration) ─────────────
-- SELECT 'content_likes'          AS tbl, COUNT(*) FROM public.content_likes
-- UNION ALL
-- SELECT 'content_comments'       AS tbl, COUNT(*) FROM public.content_comments
-- UNION ALL
-- SELECT 'comment_blocked_users'  AS tbl, COUNT(*) FROM public.comment_blocked_users;
