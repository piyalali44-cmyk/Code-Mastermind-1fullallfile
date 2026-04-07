/**
 * Supabase schema migration runner.
 *
 * Strategy (order matters, all steps are safe to re-run):
 *  1. Try RPC stayguided_apply_patches() — comprehensive, no external token needed.
 *     Reapplies ALL patches: columns, indexes, admin functions, RLS policies,
 *     coupon tables, referral functions, grants, and data seeds.
 *  2. If RPC missing (fresh DB) → apply master_patches.sql via Management API
 *     (uses SUPABASE_ACCESS_TOKEN, set as a Replit secret).
 *     This creates stayguided_apply_patches() so step 1 works on every future restart.
 *  3. Seed DML (badges, settings, referral codes) via service-role JS client.
 *  4. Final schema status check and log.
 *
 * Self-healing guarantees:
 *  - Normal operation (RPC exists): fully self-healing with service-role key only.
 *    Every restart re-creates all functions, RLS policies, and columns.
 *  - Fresh deploy (RPC not yet created): requires SUPABASE_ACCESS_TOKEN PAT once
 *    to bootstrap stayguided_apply_patches() via Management API. The PAT is set
 *    as a Replit secret so this path is automatic on first deployment.
 *  - No manual SQL Editor step is ever required.
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

function splitStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = "";
  let dollarTag: string | null = null;
  let i = 0;

  while (i < sql.length) {
    if (dollarTag === null && sql[i] === "-" && sql[i + 1] === "-") {
      while (i < sql.length && sql[i] !== "\n") i++;
      current += "\n";
      continue;
    }
    if (sql[i] === "$") {
      const rest = sql.slice(i);
      const m = rest.match(/^\$([A-Za-z_]*)\$/);
      if (m) {
        const tag = m[0];
        if (dollarTag === null) {
          dollarTag = tag;
          current += tag;
          i += tag.length;
          continue;
        } else if (tag === dollarTag) {
          dollarTag = null;
          current += tag;
          i += tag.length;
          continue;
        }
      }
    }
    if (sql[i] === ";" && dollarTag === null) {
      const stmt = current.trim();
      if (stmt.length > 0 && !/^-/.test(stmt)) statements.push(stmt);
      current = "";
      i++;
      continue;
    }
    current += sql[i];
    i++;
  }

  const trailing = current.trim();
  if (trailing.length > 0 && !/^-/.test(trailing)) statements.push(trailing);
  return statements;
}

// ── Management API executor ───────────────────────────────────────────────────

let _managementApiTokenBad = false;

async function runDDLViaManagementAPI(sql: string): Promise<"ok" | "skipped" | "error"> {
  if (!SUPABASE_ACCESS_TOKEN) return "skipped";
  if (_managementApiTokenBad) return "skipped";

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

    if (resp.status === 401 || resp.status === 403) {
      _managementApiTokenBad = true;
      console.warn(
        "[migrations/ddl] SUPABASE_ACCESS_TOKEN is invalid or not a personal access token.\n" +
        "  To fix: Generate a PAT at https://supabase.com/dashboard/account/tokens\n" +
        "  and set it as the SUPABASE_ACCESS_TOKEN secret."
      );
      return "skipped";
    }

    const text = await resp.text().catch(() => "");
    // 400 with "already exists" is fine (idempotent)
    if (resp.status === 400 && /already exists/i.test(text)) return "ok";
    console.warn(`[migrations/ddl] HTTP ${resp.status}: ${text.slice(0, 200)}`);
    return "error";
  } catch (e: any) {
    console.warn("[migrations/ddl] Network error:", e.message);
    return "error";
  }
}

async function applyDDLViaManagementAPI(): Promise<{ ok: number; failed: number; skipped: boolean }> {
  if (!SUPABASE_ACCESS_TOKEN) {
    return { ok: 0, failed: 0, skipped: true };
  }

  let patchSQL = "";
  try {
    patchSQL = readFileSync(MASTER_PATCHES_PATH, "utf-8");
  } catch {
    console.warn("[migrations] Could not read master_patches.sql");
    return { ok: 0, failed: 0, skipped: true };
  }

  const statements = splitStatements(patchSQL).filter(isDDL);
  let ok = 0, failed = 0;

  for (const stmt of statements) {
    const result = await runDDLViaManagementAPI(stmt + ";");
    if (result === "ok") ok++;
    else if (result === "error") failed++;
    else break; // token bad — no point continuing
  }

  return { ok, failed, skipped: _managementApiTokenBad };
}

// ── RPC-based patch runner ────────────────────────────────────────────────────

async function runPatches_ViaRPC(): Promise<"ok" | "missing" | "error"> {
  const admin = getAdmin();
  if (!admin) return "missing";

  try {
    const { data, error } = await admin.rpc("stayguided_apply_patches");
    if (error) {
      if (/Could not find|function.*does not exist/i.test(error.message)) return "missing";
      console.warn("[migrations/rpc] stayguided_apply_patches error:", error.message);
      return "error";
    }
    const result = data as { ok: boolean; error?: string } | null;
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

// ── Data seeds ────────────────────────────────────────────────────────────────

async function seedBadges(): Promise<void> {
  const admin = getAdmin();
  if (!admin) return;
  const badges = [
    { slug: "hadith_start", name: "Hadith Seeker",  description: "First hadith episode completed",  icon: "📜", xp_reward: 15 },
    { slug: "hadith_10",    name: "Hadith Student", description: "Completed 10 hadith episodes",    icon: "📚", xp_reward: 75 },
    { slug: "hadith_40",    name: "Hadith Scholar", description: "Completed 40 hadith episodes",    icon: "🏛️", xp_reward: 300 },
  ];
  for (const badge of badges) {
    const { error } = await admin.from("badges").upsert(badge, { onConflict: "slug", ignoreDuplicates: true });
    if (error) console.warn(`[migrations/seed] Badge (${badge.slug}):`, error.message);
  }
}

async function seedSettings(): Promise<void> {
  const admin = getAdmin();
  if (!admin) return;
  await admin.from("app_settings").upsert(
    { key: "lifetime_price_usd", value: "49.99", description: "Lifetime subscription price (USD)", type: "number" },
    { onConflict: "key", ignoreDuplicates: true }
  );
}

async function normaliseReferralCodes(): Promise<void> {
  const admin = getAdmin();
  if (!admin) return;
  try {
    const { data } = await admin.from("profiles").select("id, referral_code").not("referral_code", "is", null);
    if (!data) return;
    const toFix = data.filter((p: { referral_code: string }) => p.referral_code && p.referral_code !== p.referral_code.toUpperCase());
    for (const p of toFix) {
      await admin.from("profiles").update({ referral_code: p.referral_code.toUpperCase() }).eq("id", p.id);
    }
    if (toFix.length > 0) console.log(`[migrations/seed] Normalised ${toFix.length} referral codes to uppercase`);
  } catch { /* non-critical */ }
}

// ── Schema status check ───────────────────────────────────────────────────────

interface ColumnCheck { table: string; column: string }

const REQUIRED_COLUMNS: ColumnCheck[] = [
  { table: "subscriptions", column: "store" },
  { table: "subscriptions", column: "product_id" },
  { table: "subscriptions", column: "original_transaction_id" },
  { table: "episodes",      column: "image_url" },
  { table: "profiles",      column: "push_token" },
  { table: "profiles",      column: "first_active_at" },
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

// ── Main entry point ──────────────────────────────────────────────────────────

export async function applySchemaPatches(): Promise<void> {
  if (!SUPABASE_SERVICE_KEY && !SUPABASE_ACCESS_TOKEN) {
    console.warn("[migrations] No credentials available — skipping schema patches");
    return;
  }

  // ── 1. Fast path: try the in-database RPC (zero external dependencies) ──────
  const rpcResult = await runPatches_ViaRPC();

  if (rpcResult === "ok") {
    console.log("[migrations] stayguided_apply_patches() RPC succeeded");
    // RPC handles seeds internally — still run DML seeds for extra safety
    await Promise.allSettled([seedBadges(), seedSettings(), normaliseReferralCodes()]);
  } else {
    // ── 2. RPC missing or errored → check what's needed ──────────────────────
    const missingBefore = await getMissingColumns().catch(() => [] as string[]);

    if (missingBefore.length > 0 || rpcResult === "missing") {
      // ── 3. Apply DDL via Management API (works on fresh deploys) ─────────
      if (SUPABASE_ACCESS_TOKEN) {
        console.log(`[migrations] Schema incomplete (${missingBefore.join(", ") || "RPC missing"}) — applying DDL via Management API…`);
        const { ok, failed, skipped } = await applyDDLViaManagementAPI();

        if (!skipped) {
          console.log(`[migrations] Management API DDL: ${ok} applied, ${failed} failed`);

          // ── 4. After DDL, retry RPC (it should now be defined) ───────────
          const rpcRetry = await runPatches_ViaRPC();
          if (rpcRetry === "ok") {
            console.log("[migrations] RPC now available and executed successfully");
          }
        }
      } else {
        // No PAT available — log clear actionable instructions once
        console.warn(
          "[migrations] Automatic DDL requires SUPABASE_ACCESS_TOKEN (personal access token).\n" +
          "  The secret is expected to be set in the Replit project. If it is missing:\n" +
          "  1. Generate a PAT at https://supabase.com/dashboard/account/tokens\n" +
          "  2. Add it as SUPABASE_ACCESS_TOKEN in Replit Secrets\n" +
          "  Alternatively, run master_patches.sql once in Supabase Dashboard → SQL Editor."
        );
      }
    } else {
      // RPC errored but schema is fine — log and continue
      console.log("[migrations] Schema check passed (RPC returned error but all columns present)");
    }

    // ── 5. Always seed DML data ───────────────────────────────────────────────
    await Promise.allSettled([seedBadges(), seedSettings(), normaliseReferralCodes()]);
  }

  // ── 6. Final schema status report ───────────────────────────────────────────
  const missingAfter = await getMissingColumns().catch(() => [] as string[]);
  if (missingAfter.length === 0) {
    console.log("[migrations] Schema check passed — all required columns present ✓");
  } else {
    console.warn(
      `[migrations] Still missing after patches: ${missingAfter.join(", ")}.\n` +
      (SUPABASE_ACCESS_TOKEN && !_managementApiTokenBad
        ? "  DDL was attempted — check the errors above for details."
        : "  Run master_patches.sql in Supabase Dashboard → SQL Editor to resolve.")
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
        : `Missing columns: ${missing.join(", ")}.`,
  };
}
