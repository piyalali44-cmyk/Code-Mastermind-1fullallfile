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

// ── Statement categorisation ──────────────────────────────────────────────────

const DDL_KEYWORDS = [
  /^\s*(CREATE|ALTER|DROP|GRANT|REVOKE|NOTIFY|DO\b)/i,
  /^\s*NOTIFY\b/i,
];

function isDDL(stmt: string): boolean {
  return DDL_KEYWORDS.some((re) => re.test(stmt));
}

/**
 * Split a SQL file into individual statements separated by semicolons,
 * skipping blank lines and comment-only blocks.
 */
function splitStatements(sql: string): string[] {
  const raw = sql.split(/;\s*\n/);
  return raw
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !/^(--.*)$/.test(s));
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

export async function applySchemaPatches(): Promise<void> {
  if (!SUPABASE_SERVICE_KEY && !SUPABASE_ACCESS_TOKEN) {
    console.warn("[migrations] No credentials available — skipping schema patches");
    return;
  }

  // ── 1. Load consolidated patch file ────────────────────────────────────────
  let patchSQL = "";
  try {
    patchSQL = readFileSync(MASTER_PATCHES_PATH, "utf-8");
  } catch {
    console.warn("[migrations] Could not read master_patches.sql — skipping DDL");
  }

  // ── 2. Execute DDL statements via Management API ────────────────────────────
  let ddlOk = 0, ddlSkipped = 0, ddlFailed = 0;

  if (patchSQL && SUPABASE_ACCESS_TOKEN) {
    const statements = splitStatements(patchSQL);
    const ddlStatements = statements.filter(isDDL);

    for (const stmt of ddlStatements) {
      const result = await runDDLViaManagementAPI(stmt + ";");
      if (result === "ok")           ddlOk++;
      else if (result === "skipped") ddlSkipped++;
      else                           ddlFailed++;
    }

    if (_managementApiFailed) {
      console.warn(
        "[migrations] Supabase Management API returned 401 — " +
        "SUPABASE_ACCESS_TOKEN must be a personal access token from " +
        "supabase.com/dashboard/account/tokens (NOT the service-role key).\n" +
        "DDL patches not applied. Run artifacts/mobile/supabase/master_patches.sql " +
        "in the Supabase Dashboard → SQL Editor to apply missing schema changes."
      );
    } else if (ddlOk > 0 || ddlFailed > 0) {
      console.log(
        `[migrations] DDL complete: ${ddlOk} applied, ${ddlFailed} failed, ${ddlSkipped} skipped`
      );
    }
  } else if (!SUPABASE_ACCESS_TOKEN) {
    console.warn(
      "[migrations] SUPABASE_ACCESS_TOKEN not set — DDL patches skipped.\n" +
      "Run artifacts/mobile/supabase/master_patches.sql in Supabase Dashboard → SQL Editor."
    );
  }

  // ── 3. Always run data operations via admin client ──────────────────────────
  await seedBadges().catch((e) => console.warn("[migrations/seed] Badges:", e.message));
  await seedSettings().catch((e) => console.warn("[migrations/seed] Settings:", e.message));
  await normaliseReferralCodes().catch(() => {});

  // ── 4. Report schema status ─────────────────────────────────────────────────
  const missing = await getMissingColumns().catch(() => [] as string[]);
  if (missing.length === 0) {
    console.log("[migrations] Schema check passed — all required columns present");
  } else {
    console.warn(
      `[migrations] Missing columns: ${missing.join(", ")}.\n` +
      "Run artifacts/mobile/supabase/master_patches.sql in Supabase Dashboard → SQL Editor."
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
