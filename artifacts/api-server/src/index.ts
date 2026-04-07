import app from "./app";
import { logger } from "./lib/logger";
import { seedRateLimitDefaults, ensureLikesCommentsTables } from "./lib/initDb";

// ── Environment validation ────────────────────────────────────────────────────
const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Validate Supabase configuration and log status
const supabaseUrl = process.env["SUPABASE_URL"] ?? "https://tkruzfskhtcazjxdracm.supabase.co";
const supabaseAnonKey = process.env["SUPABASE_ANON_KEY"] ?? process.env["EXPO_PUBLIC_SUPABASE_ANON_KEY"] ?? "";
const supabaseServiceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";
const databaseUrl = process.env["DATABASE_URL"] ?? "";

const missingVars: string[] = [];
if (!supabaseAnonKey) missingVars.push("SUPABASE_ANON_KEY");
if (!supabaseServiceKey) missingVars.push("SUPABASE_SERVICE_ROLE_KEY");
if (!databaseUrl) missingVars.push("DATABASE_URL");

if (missingVars.length > 0) {
  logger.warn({ missingVars }, "Missing environment variables — some API features may be degraded");
} else {
  logger.info(
    {
      supabaseUrl,
      hasAnonKey: !!supabaseAnonKey,
      hasServiceKey: !!supabaseServiceKey,
      hasDatabase: !!databaseUrl,
    },
    "Supabase configuration loaded",
  );
}

// ── Start server ─────────────────────────────────────────────────────────────
app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  seedRateLimitDefaults().catch((e) =>
    logger.warn({ err: e }, "Could not seed rate limit defaults"),
  );

  ensureLikesCommentsTables().catch((e) =>
    logger.warn({ err: e }, "Could not ensure likes/comments tables"),
  );
});
