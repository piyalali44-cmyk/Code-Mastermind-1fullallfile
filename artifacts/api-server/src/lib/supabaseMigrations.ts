/**
 * Supabase schema migration runner.
 *
 * Strategy:
 *  1. Load master_patches.sql (consolidated, idempotent patch set).
 *  2. Split into individual statements; categorise as DDL vs. DML.
 *  3. For DDL — attempt via the Supabase Management API.
 *     Requires SUPABASE_ACCESS_TOKEN to be a personal-access-token from
 *     supabase.com/dashboard/account/tokens (NOT the service-role key).
 *  4. For DML (INSERT … ON CONFLICT, UPDATE) — execute via the service-role
 *     Supabase JS client, which always works.
 *  5. Log a clear summary so operators know what was applied vs. what needs
 *     to be run manually in the Supabase SQL Editor.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SUPABASE_URL = process.env["SUPABASE_URL"] ?? "https://tkruzfskhtcazjxdracm.supabase.co";
const SUPABASE_SERVICE_KEY = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";
const SUPABASE_ACCESS_TOKEN = process.env["SUPABASE_ACCESS_TOKEN"] ?? "";
const PROJECT_REF =
  process.env["SUPABASE_PROJECT_ID"] ??
  process.env["EXPO_PUBLIC_SUPABASE_PROJECT_REF"] ??
  "tkruzfskhtcazjxdracm";

/**
 * Path to the consolidated idempotent patch file.
 * process.cwd() at runtime = /home/runner/workspace/artifacts/api-server/
 * (the directory where `node dist/index.mjs` is executed from)
 * So ../mobile/supabase/master_patches.sql → artifacts/mobile/supabase/master_patches.sql
 */
const MASTER_PATCHES_PATH = resolve(
  process.cwd(),
  "../mobile/supabase/master_patches.sql"
);

function getAdmin() {
  if (!SUPABASE_SERVICE_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ── Statement splitting (dollar-quote aware) ──────────────────────────────────

const DDL_KEYWORDS = /^\s*(CREATE|ALTER|DROP|GRANT|REVOKE|NOTIFY|DO\b)/i;

function isDDL(stmt: string): boolean {
  return DDL_KEYWORDS.test(stmt);
}

/**
 * Split a SQL script into individual statements, correctly handling:
 *  - Dollar-quoted blocks: $$ ... $$ and $tag$ ... $tag$
 *  - Single-line comments (-- …)
 *  - Regular semicolon-terminated statements
 *
 * A semicolon only ends a statement when we are NOT inside a dollar-quoted block.
 */
function splitStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = "";
  let dollarTag: string | null = null; // non-null when inside $tag$...$tag$ block
  let i = 0;

  while (i < sql.length) {
    // Skip single-line comments when not in a dollar-quoted block
    if (dollarTag === null && sql[i] === "-" && sql[i + 1] === "-") {
      while (i < sql.length && sql[i] !== "\n") i++;
      current += "\n";
      continue;
    }

    // Detect start/end of a dollar-quoted block
    if (sql[i] === "$") {
      // Look ahead for matching $...$ tag
      const rest = sql.slice(i);
      const m = rest.match(/^\$([A-Za-z_]*)\$/);
      if (m) {
        const tag = m[0]; // e.g. "$$" or "$func$"
        if (dollarTag === null) {
          // Enter dollar-quoted block
          dollarTag = tag;
          current += tag;
          i += tag.length;
          continue;
        } else if (tag === dollarTag) {
          // Exit dollar-quoted block
          dollarTag = null;
          current += tag;
          i += tag.length;
          continue;
        }
      }
    }

    // Semicolon outside dollar-quoted block = statement boundary
    if (sql[i] === ";" && dollarTag === null) {
      const stmt = current.trim();
      if (stmt.length > 0 && !/^-/.test(stmt)) {
        statements.push(stmt);
      }
      current = "";
      i++;
      continue;
    }

    current += sql[i];
    i++;
  }

  // Capture any trailing statement without a trailing semicolon
  const trailing = current.trim();
  if (trailing.length > 0 && !/^-/.test(trailing)) {
    statements.push(trailing);
  }

  return statements;
}

// ── Management API executor ───────────────────────────────────────────────────

let _managementApiFailed = false;

async function runDDLViaManagementAPI(sql: string): Promise<"ok" | "skipped" | "error"> {
  if (!SUPABASE_ACCESS_TOKEN) return "skipped";
  if (_managementApiFailed) return "skipped";

  try {
    const resp = await fetch(
      `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SUPABASE_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: sql }),
      }
    );

    if (resp.ok) return "ok";

    if (resp.status === 401) {
      _managementApiFailed = true;
      return "skipped";
    }

    const text = await resp.text().catch(() => "");
    console.warn(`[migrations/ddl] (${resp.status}): ${text.slice(0, 150)}`);
    return "error";
  } catch (e: any) {
    console.warn("[migrations/ddl] Network error:", e.message);
    return "error";
  }
}

// ── Seed known-good data via structured client calls ─────────────────────────

async function seedBadges(): Promise<void> {
  const admin = getAdmin();
  if (!admin) return;

  const badges = [
    { slug: "hadith_start", name: "Hadith Seeker",  description: "First hadith episode completed",  icon: "📜", xp_reward: 15 },
    { slug: "hadith_10",    name: "Hadith Student", description: "Completed 10 hadith episodes",    icon: "📚", xp_reward: 75 },
    { slug: "hadith_40",    name: "Hadith Scholar", description: "Completed 40 hadith episodes",    icon: "🏛️", xp_reward: 300 },
  ];

  for (const badge of badges) {
    const { error } = await admin
      .from("badges")
      .upsert(badge, { onConflict: "slug", ignoreDuplicates: true });
    if (error) console.warn(`[migrations/seed] Badge (${badge.slug}):`, error.message);
  }
}

async function seedSettings(): Promise<void> {
  const admin = getAdmin();
  if (!admin) return;

  const settings = [
    { key: "lifetime_price_usd", value: "49.99", description: "Lifetime subscription price (USD)", type: "number" },
  ];

  for (const s of settings) {
    await admin.from("app_settings").upsert(s, { onConflict: "key", ignoreDuplicates: true });
  }
}

async function normaliseReferralCodes(): Promise<void> {
  const admin = getAdmin();
  if (!admin) return;

  // Fetch profiles with mixed-case referral codes and uppercase them individually.
  // This avoids raw SQL and works within RLS+service-role.
  try {
    const { data } = await admin
      .from("profiles")
      .select("id, referral_code")
      .not("referral_code", "is", null);

    if (!data) return;

    const toFix = data.filter(
      (p: { referral_code: string }) =>
        p.referral_code && p.referral_code !== p.referral_code.toUpperCase()
    );

    for (const p of toFix) {
      await admin
        .from("profiles")
        .update({ referral_code: p.referral_code.toUpperCase() })
        .eq("id", p.id);
    }

    if (toFix.length > 0) {
      console.log(`[migrations/seed] Normalised ${toFix.length} referral codes to uppercase`);
    }
  } catch {
    // Non-critical; skip silently
  }
}

// ── Schema status check ───────────────────────────────────────────────────────

interface ColumnCheck { table: string; column: string }

const REQUIRED_COLUMNS: ColumnCheck[] = [
  { table: "subscriptions", column: "store" },
  { table: "subscriptions", column: "product_id" },
  { table: "subscriptions", column: "original_transaction_id" },
  { table: "episodes",      column: "image_url" },
  { table: "profiles",      column: "push_token" },
];

async function getMissingColumns(): Promise<string[]> {
  const admin = getAdmin();
  if (!admin) return [];

  const missing: string[] = [];
  for (const { table, column } of REQUIRED_COLUMNS) {
    try {
      const { error } = await admin.from(table).select(column).limit(1);
      if (error && /column|does not exist|PGRST204/i.test(error.message + (error.code ?? ""))) {
        missing.push(`${table}.${column}`);
      }
    } catch {
      missing.push(`${table}.${column}`);
    }
  }
  return missing;
}

// ── Main entry points ─────────────────────────────────────────────────────────

/**
 * Try to call the `stayguided_apply_patches()` PostgreSQL function via the
 * service-role client. This function is defined in master_patches.sql (PART 7)
 * and runs all column/index additions idempotently inside the database, where
 * DDL permissions are not restricted.
 *
 * Returns:
 *  "ok"       – function ran successfully
 *  "missing"  – function does not exist (master_patches.sql not yet run)
 *  "error"    – function exists but returned an error
 */
async function runPatches_ViaRPC(): Promise<"ok" | "missing" | "error"> {
  const admin = getAdmin();
  if (!admin) return "missing";

  try {
    const { data, error } = await admin.rpc("stayguided_apply_patches");

    if (error) {
      // "Could not find the function" → not yet defined
      if (/Could not find|function.*does not exist/i.test(error.message)) {
        return "missing";
      }
      console.warn("[migrations/rpc] stayguided_apply_patches error:", error.message);
      return "error";
    }

    const result = data as { ok: boolean; error?: string; applied_at?: string } | null;
    if (result?.ok === false) {
      console.warn("[migrations/rpc] patch function reported failure:", result.error);
      return "error";
    }

    return "ok";
  } catch (e: any) {
    console.warn("[migrations/rpc] Unexpected error:", e.message);
    return "error";
  }
}

export async function applySchemaPatches(): Promise<void> {
  if (!SUPABASE_SERVICE_KEY && !SUPABASE_ACCESS_TOKEN) {
    console.warn("[migrations] No credentials available — skipping schema patches");
    return;
  }

  // ── 1. Try the RPC-based patch runner (self-healing after initial setup) ────
  //       stayguided_apply_patches() lives inside Supabase so it runs DDL with
  //       full database-level permissions, no personal access token needed.
  const rpcResult = await runPatches_ViaRPC();

  if (rpcResult === "ok") {
    console.log("[migrations] stayguided_apply_patches() RPC executed successfully");
    // RPC handles DML too (badges, settings, referral codes) so skip separate seeds
  } else {
    if (rpcResult === "missing") {
      // ── 2a. RPC not yet deployed → try Management API as fallback ─────────
      let patchSQL = "";
      try {
        patchSQL = readFileSync(MASTER_PATCHES_PATH, "utf-8");
      } catch {
        console.warn("[migrations] Could not read master_patches.sql");
      }

      if (patchSQL && SUPABASE_ACCESS_TOKEN) {
        const statements = splitStatements(patchSQL);
        const ddlStatements = statements.filter(isDDL);
        let ddlOk = 0, ddlFailed = 0;

        for (const stmt of ddlStatements) {
          const result = await runDDLViaManagementAPI(stmt + ";");
          if (result === "ok") ddlOk++;
          else if (result === "error") ddlFailed++;
        }

        if (_managementApiFailed) {
          console.warn(
            "[migrations] DDL skipped — SUPABASE_ACCESS_TOKEN is not a personal access token.\n" +
            "To enable self-healing migrations:\n" +
            "  1. Run artifacts/mobile/supabase/master_patches.sql in Supabase Dashboard → SQL Editor\n" +
            "  2. This creates stayguided_apply_patches() so future restarts apply patches automatically."
          );
        } else {
          console.log(`[migrations] Management API DDL: ${ddlOk} applied, ${ddlFailed} failed`);
        }
      } else {
        // No PAT either — log one-time setup instructions
        console.warn(
          "[migrations] Schema patches require one-time manual setup:\n" +
          "  Run artifacts/mobile/supabase/master_patches.sql in Supabase Dashboard → SQL Editor\n" +
          "  This installs stayguided_apply_patches() so all future restarts are automatic."
        );
      }
    }

    // ── 2b. Always run data-only seeds regardless of DDL outcome ─────────────
    await seedBadges().catch((e) => console.warn("[migrations/seed] Badges:", e.message));
    await seedSettings().catch((e) => console.warn("[migrations/seed] Settings:", e.message));
    await normaliseReferralCodes().catch(() => {});
  }

  // ── 3. Report schema status ─────────────────────────────────────────────────
  const missing = await getMissingColumns().catch(() => [] as string[]);
  if (missing.length === 0) {
    console.log("[migrations] Schema check passed — all required columns present");
  } else {
    console.warn(
      `[migrations] Missing columns: ${missing.join(", ")}.` +
      (rpcResult === "missing"
        ? " Run master_patches.sql in Supabase Dashboard to fix."
        : " Schema patch reported an error — check logs above.")
    );
  }
}

export async function getSchemaStatus(): Promise<{
  ok: boolean;
  missing: string[];
  message: string;
}> {
  const missing = await getMissingColumns().catch(() => [] as string[]);
  return {
    ok: missing.length === 0,
    missing,
    message:
      missing.length === 0
        ? "All required schema columns are present"
        : `Missing columns: ${missing.join(", ")}. Run master_patches.sql in Supabase Dashboard.`,
  };
}
