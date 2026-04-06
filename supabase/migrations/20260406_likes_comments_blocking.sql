-- ============================================================
-- Migration: Likes, Comments, and Comment Blocking
-- Date: 2026-04-06
-- Project: StayGuided Me (Supabase: tkruzfskhtcazjxdracm)
-- ============================================================


-- ─── 1. CONTENT_LIKES ────────────────────────────────────────────────────────
-- Stores user likes on any content item (episode, surah, series).

CREATE TABLE IF NOT EXISTS public.content_likes (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_type  text NOT NULL CHECK (content_type IN ('episode', 'surah', 'series')),
  content_id    text NOT NULL,
  created_at    timestamptz DEFAULT now() NOT NULL,
  UNIQUE (user_id, content_type, content_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS content_likes_content_idx
  ON public.content_likes (content_type, content_id);
CREATE INDEX IF NOT EXISTS content_likes_user_idx
  ON public.content_likes (user_id);

-- Row Level Security
ALTER TABLE public.content_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read all likes"
  ON public.content_likes FOR SELECT USING (true);

CREATE POLICY "Users can like (insert own)"
  ON public.content_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike (delete own)"
  ON public.content_likes FOR DELETE
  USING (auth.uid() = user_id);

-- Realtime (idempotent — skip if already a member)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'content_likes'
  ) THEN
    ALTER publication supabase_realtime ADD TABLE public.content_likes;
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

-- Indexes
CREATE INDEX IF NOT EXISTS content_comments_content_idx
  ON public.content_comments (content_type, content_id);
CREATE INDEX IF NOT EXISTS content_comments_user_idx
  ON public.content_comments (user_id);
CREATE INDEX IF NOT EXISTS content_comments_not_deleted_idx
  ON public.content_comments (content_type, content_id)
  WHERE is_deleted = false;

-- Row Level Security
ALTER TABLE public.content_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read non-deleted comments"
  ON public.content_comments FOR SELECT
  USING (is_deleted = false);

CREATE POLICY "Users can insert own comments"
  ON public.content_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can soft-delete own comments"
  ON public.content_comments FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Realtime (idempotent — skip if already a member)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'content_comments'
  ) THEN
    ALTER publication supabase_realtime ADD TABLE public.content_comments;
  END IF;
END $$;


-- ─── 3. COMMENT_BLOCKED_USERS ────────────────────────────────────────────────
-- Admins can block specific users from posting new comments.

CREATE TABLE IF NOT EXISTS public.comment_blocked_users (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason      text,
  created_at  timestamptz DEFAULT now() NOT NULL,
  UNIQUE (user_id)
);

-- Index
CREATE INDEX IF NOT EXISTS comment_blocked_users_user_idx
  ON public.comment_blocked_users (user_id);

-- Row Level Security
ALTER TABLE public.comment_blocked_users ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can check if they are blocked (needed by mobile app)
CREATE POLICY "Users can read their own block status"
  ON public.comment_blocked_users FOR SELECT
  USING (auth.uid() = user_id);

-- Only service-role (admin panel) can insert / delete blocks
-- (No RLS INSERT/DELETE policies — admin uses service role key)


-- ─── HELPER: updated_at trigger for content_comments ─────────────────────────
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
