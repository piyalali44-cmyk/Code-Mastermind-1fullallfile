-- Ensure listened_at has a proper default on listening_history
ALTER TABLE listening_history
  ALTER COLUMN listened_at SET DEFAULT now();

-- Backfill any rows where listened_at is NULL
UPDATE listening_history
SET listened_at = now()
WHERE listened_at IS NULL;

-- Ensure quiz_mode flag exists
INSERT INTO feature_flags (key, name, description, section, is_enabled, rollout_pct)
VALUES (
  'quiz_mode',
  'Quiz Mode',
  'Show/hide the Islamic Knowledge Quiz feature in the mobile app',
  'gamification',
  false,
  100
)
ON CONFLICT (key) DO NOTHING;


-- Ensure listened_at has a default timestamp on listening_history
ALTER TABLE listening_history
  ALTER COLUMN listened_at SET DEFAULT now();

-- Backfill any rows where listened_at is NULL (set to created_at if exists, else now)
UPDATE listening_history
SET listened_at = COALESCE(created_at, now())
WHERE listened_at IS NULL;

-- Also ensure quiz_mode flag exists for the admin quiz toggle
INSERT INTO feature_flags (key, name, description, section, is_enabled, rollout_pct)
VALUES (
  'quiz_mode',
  'Quiz Mode',
  'Show/hide the Islamic Knowledge Quiz feature in the mobile app',
  'gamification',
  false,
  100
)
ON CONFLICT (key) DO NOTHING;