import { createClient } from "@supabase/supabase-js";
import { getPgPool } from "./pgClient.js";

export async function ensureLikesCommentsTables(): Promise<void> {
  const pool = getPgPool();
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS content_likes (
        id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id      TEXT NOT NULL,
        content_type TEXT NOT NULL,
        content_id   TEXT NOT NULL,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (user_id, content_type, content_id)
      );

      CREATE TABLE IF NOT EXISTS content_comments (
        id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id      TEXT NOT NULL,
        content_type TEXT NOT NULL,
        content_id   TEXT NOT NULL,
        body         TEXT NOT NULL,
        is_deleted   BOOLEAN NOT NULL DEFAULT false,
        is_flagged   BOOLEAN NOT NULL DEFAULT false,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS comment_blocked_users (
        user_id    TEXT PRIMARY KEY,
        blocked_by TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS comment_user_profiles (
        user_id      TEXT PRIMARY KEY,
        display_name TEXT,
        email        TEXT,
        updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    console.log("[initDb] content_likes / content_comments / comment_blocked_users ready");
  } catch (err: any) {
    console.warn("[initDb] ensureLikesCommentsTables:", err.message);
  }
}

const SUPABASE_URL = "https://tkruzfskhtcazjxdracm.supabase.co";
const SUPABASE_SERVICE_KEY = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";

export async function seedRateLimitDefaults(): Promise<void> {
  if (!SUPABASE_SERVICE_KEY) return;

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const defaults = [
    {
      key: "otp_rate_limit_enabled",
      value: "true",
      type: "boolean",
      description: "Enable custom OTP rate limiting",
    },
    {
      key: "otp_max_attempts",
      value: "5",
      type: "number",
      description: "Max OTP sends per time window",
    },
    {
      key: "otp_window_minutes",
      value: "60",
      type: "number",
      description: "Time window in minutes for OTP rate limit",
    },
    {
      key: "otp_block_duration_minutes",
      value: "60",
      type: "number",
      description: "Block duration in minutes after limit exceeded",
    },
    {
      key: "subscription_enabled",
      value: "true",
      type: "boolean",
      description: "Whether subscription/paywall is active in the mobile app",
    },
  ];

  const { data: existing } = await admin
    .from("app_settings")
    .select("key")
    .in(
      "key",
      defaults.map((d) => d.key)
    );

  const existingKeys = new Set((existing ?? []).map((r: { key: string }) => r.key));
  const toInsert = defaults.filter((d) => !existingKeys.has(d.key));

  if (toInsert.length === 0) {
    console.log("[initDb] Rate limit defaults already seeded");
    return;
  }

  const { error } = await admin.from("app_settings").insert(toInsert);
  if (error) {
    console.warn("[initDb] Failed to seed rate limit defaults:", error.message);
  } else {
    console.log(`[initDb] Seeded ${toInsert.length} rate limit default(s)`);
  }
}
