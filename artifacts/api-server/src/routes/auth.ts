import { Router, type IRouter } from "express";
import { createClient } from "@supabase/supabase-js";

const router: IRouter = Router();

const SUPABASE_URL = "https://tkruzfskhtcazjxdracm.supabase.co";
const SUPABASE_SERVICE_KEY = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";
const SUPABASE_ANON_KEY = process.env["SUPABASE_ANON_KEY"] ?? SUPABASE_SERVICE_KEY;

function getAdminClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ─── Custom In-Memory OTP Rate Limiter ────────────────────────────────────────
// Config is fetched from app_settings (Supabase) and cached for 5 minutes.
// Attempt tracking is kept in memory per (identifier, otpType) key.

interface RateLimitConfig {
  enabled: boolean;
  maxAttempts: number;
  windowMs: number;
  blockMs: number;
}

interface AttemptRecord {
  timestamps: number[];
  blockedUntil?: number;
}

let cachedConfig: RateLimitConfig | null = null;
let cacheExpiresAt = 0;

const attemptStore = new Map<string, AttemptRecord>();

async function getRateLimitConfig(): Promise<RateLimitConfig> {
  const now = Date.now();
  if (cachedConfig && now < cacheExpiresAt) return cachedConfig;

  const defaults: RateLimitConfig = {
    enabled: true,
    maxAttempts: 5,
    windowMs: 60 * 60 * 1000,
    blockMs: 60 * 60 * 1000,
  };

  try {
    const admin = getAdminClient();
    const { data } = await admin
      .from("app_settings")
      .select("key,value")
      .in("key", [
        "otp_rate_limit_enabled",
        "otp_max_attempts",
        "otp_window_minutes",
        "otp_block_duration_minutes",
      ]);

    if (!data || data.length === 0) {
      cachedConfig = defaults;
      cacheExpiresAt = now + 5 * 60 * 1000;
      return cachedConfig;
    }

    const map: Record<string, string> = {};
    data.forEach((r: { key: string; value: unknown }) => {
      const v = r.value;
      map[r.key] = typeof v === "string" ? v.replace(/^"|"$/g, "") : String(v);
    });

    cachedConfig = {
      enabled: (map["otp_rate_limit_enabled"] ?? "true") !== "false",
      maxAttempts: Math.max(1, parseInt(map["otp_max_attempts"] ?? "5", 10) || 5),
      windowMs: Math.max(60_000, (parseInt(map["otp_window_minutes"] ?? "60", 10) || 60) * 60_000),
      blockMs: Math.max(60_000, (parseInt(map["otp_block_duration_minutes"] ?? "60", 10) || 60) * 60_000),
    };
    cacheExpiresAt = now + 5 * 60 * 1000;
    console.log("[rate-limit] Config refreshed:", cachedConfig);
  } catch (err) {
    console.warn("[rate-limit] Could not fetch config, using defaults:", err);
    cachedConfig = defaults;
    cacheExpiresAt = now + 60_000;
  }

  return cachedConfig;
}

function storeKey(identifier: string, otpType: string) {
  return `${otpType}:${identifier}`;
}

async function checkRateLimit(
  identifier: string,
  otpType: string
): Promise<{ allowed: boolean; retryAfter?: number }> {
  const config = await getRateLimitConfig();
  if (!config.enabled) return { allowed: true };

  const key = storeKey(identifier, otpType);
  const now = Date.now();
  const record: AttemptRecord = attemptStore.get(key) ?? { timestamps: [] };

  if (record.blockedUntil && now < record.blockedUntil) {
    const retryAfter = Math.ceil((record.blockedUntil - now) / 1000);
    return { allowed: false, retryAfter };
  }

  const windowStart = now - config.windowMs;
  record.timestamps = record.timestamps.filter((t) => t > windowStart);

  if (record.timestamps.length >= config.maxAttempts) {
    record.blockedUntil = now + config.blockMs;
    attemptStore.set(key, record);
    const retryAfter = Math.ceil(config.blockMs / 1000);
    return { allowed: false, retryAfter };
  }

  record.timestamps.push(now);
  attemptStore.set(key, record);

  try {
    const admin = getAdminClient();
    admin
      .from("otp_rate_limit_log")
      .insert({ identifier, otp_type: otpType })
      .then(() => {}, (e) => console.warn("[rate-limit] log insert failed:", e));
  } catch (_) {}

  return { allowed: true };
}

// Periodically clean up expired in-memory records (every 10 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of attemptStore.entries()) {
    const allExpired = record.timestamps.every(
      (t) => t < now - 24 * 60 * 60 * 1000
    );
    const blockExpired = !record.blockedUntil || record.blockedUntil < now;
    if (allExpired && blockExpired) attemptStore.delete(key);
  }
}, 10 * 60 * 1000);

// ─── POST /auth/forgot-password ───────────────────────────────────────────────
// Sends a password-reset email containing a 6-digit OTP code.
// The Supabase "Reset Password" email template must use {{ .Token }}.
router.post("/auth/forgot-password", async (req, res) => {
  try {
    const { email } = req.body as { email?: string };
    if (!email) {
      res.status(400).json({ error: "email is required" });
      return;
    }
    if (!SUPABASE_SERVICE_KEY) {
      res.status(500).json({ error: "Server misconfiguration: missing service key" });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    const { allowed, retryAfter } = await checkRateLimit(normalizedEmail, "forgot_password");
    if (!allowed) {
      const minutes = Math.ceil((retryAfter ?? 3600) / 60);
      res.status(429).json({
        error: `অনেক বেশি OTP পাঠানো হয়েছে। ${minutes} মিনিট পর আবার চেষ্টা করুন।`,
        retryAfter: retryAfter ?? 3600,
      });
      return;
    }

    const admin = getAdminClient();
    const { error } = await admin.auth.resetPasswordForEmail(normalizedEmail);

    if (error) {
      console.error("[forgot-password]", error.message);
      if (
        error.message.toLowerCase().includes("rate limit") ||
        error.message.toLowerCase().includes("too many")
      ) {
        res.status(429).json({
          error: "অনেক বেশি reset email পাঠানো হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।",
          retryAfter: 3600,
        });
        return;
      }
    }
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Internal server error" });
  }
});

// ─── POST /auth/verify-otp ────────────────────────────────────────────────────
// Verifies a Supabase OTP (recovery or signup) server-side and returns
// access_token + refresh_token so the mobile client can set the session.
router.post("/auth/verify-otp", async (req, res) => {
  try {
    const { email, token, type } = req.body as {
      email?: string;
      token?: string;
      type?: string;
    };

    if (!email || !token || !type) {
      res.status(400).json({ error: "email, token and type are required" });
      return;
    }

    if (!SUPABASE_SERVICE_KEY) {
      res.status(500).json({ error: "Server misconfiguration: missing service key" });
      return;
    }

    const response = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type,
        token: token.trim(),
        email: email.trim().toLowerCase(),
        gotrue_meta_security: {},
      }),
    });

    const data = (await response.json()) as any;

    if (!response.ok) {
      const msg: string =
        data?.msg ??
        data?.message ??
        "Invalid or expired code. Please request a new one.";
      res.status(400).json({ error: msg });
      return;
    }

    res.json({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Internal server error" });
  }
});

// ─── POST /auth/signup ────────────────────────────────────────────────────────
router.post("/auth/signup", async (req, res) => {
  try {
    const { email, password, name } = req.body as {
      email?: string;
      password?: string;
      name?: string;
    };

    if (!email || !password || !name) {
      res.status(400).json({ error: "email, password and name are required" });
      return;
    }
    if (!SUPABASE_SERVICE_KEY) {
      res.status(500).json({ error: "Server misconfiguration: missing service key" });
      return;
    }

    const admin = getAdminClient();
    const { data, error } = await admin.auth.admin.createUser({
      email: email.trim(),
      password,
      email_confirm: true,
      user_metadata: { display_name: name.trim() },
    });

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    const userId = data.user?.id;
    if (userId) {
      const referralCode = "SG" + userId.replace(/-/g, "").substring(0, 6).toUpperCase();
      Promise.all([
        admin.from("profiles").upsert({
          id: userId,
          display_name: name.trim(),
          email: email.trim(),
          referral_code: referralCode,
        }, { onConflict: "id", ignoreDuplicates: true }),
        admin.from("user_xp").upsert(
          { user_id: userId, total_xp: 0, level: 1 },
          { onConflict: "user_id", ignoreDuplicates: true }
        ),
        admin.from("user_streaks").upsert(
          { user_id: userId },
          { onConflict: "user_id", ignoreDuplicates: true }
        ),
        admin.from("user_settings").upsert(
          { user_id: userId },
          { onConflict: "user_id", ignoreDuplicates: true }
        ),
      ]).catch((e) => console.error("[signup] Row init error:", e?.message));
    }

    res.json({ userId, email: data.user?.email });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Internal server error" });
  }
});

// ─── GET /auth/rate-limit-config ─────────────────────────────────────────────
// Returns current rate limit config (for admin panel display/verification).
router.get("/auth/rate-limit-config", async (req, res) => {
  try {
    const config = await getRateLimitConfig();
    res.json({
      enabled: config.enabled,
      maxAttempts: config.maxAttempts,
      windowMinutes: Math.round(config.windowMs / 60_000),
      blockMinutes: Math.round(config.blockMs / 60_000),
      cacheExpiresAt: new Date(cacheExpiresAt).toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Internal server error" });
  }
});

export default router;
