/**
 * run-supabase-migrations.mts
 *
 * Applies all SQL migration files to the Supabase project using the
 * Management API (REST). This approach works from Replit because direct
 * PostgreSQL connections to Supabase (port 5432) are blocked by Replit's
 * network policy.
 *
 * Usage:
 *   pnpm --filter scripts exec tsx src/run-supabase-migrations.mts
 *
 * Required environment variables:
 *   SUPABASE_ACCESS_TOKEN   — Personal access token from app.supabase.com/account/tokens
 *   SUPABASE_PROJECT_ID     — Project ref (e.g. tkruzfskhtcazjxdracm)
 *
 * Optional:
 *   SUPABASE_MIGRATIONS_DIR — Path to the directory containing .sql files
 *                              (defaults to artifacts/mobile/supabase)
 */

import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";

const PROJECT_ID =
  process.env.SUPABASE_PROJECT_ID ?? "tkruzfskhtcazjxdracm";

const ACCESS_TOKEN =
  process.env.SUPABASE_ACCESS_TOKEN ??
  process.env.SUPABASE_MANAGEMENT_TOKEN ??
  "";

const MIGRATIONS_DIR = resolve(
  process.env.SUPABASE_MIGRATIONS_DIR ??
    join(import.meta.dirname, "..", "..", "artifacts", "mobile", "supabase"),
);

const API_URL = `https://api.supabase.com/v1/projects/${PROJECT_ID}/database/query`;

if (!ACCESS_TOKEN) {
  console.error(
    "❌ SUPABASE_ACCESS_TOKEN is not set.\n" +
      "Generate one at https://app.supabase.com/account/tokens and set it as an env var.",
  );
  process.exit(1);
}

async function runSql(sql: string): Promise<void> {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });

  if (res.status !== 201) {
    const body = await res.text();
    let message: string;
    try {
      message = (JSON.parse(body) as { message?: string }).message ?? body;
    } catch {
      message = body;
    }

    // Ignore safe "already exists" / "already member" errors — they mean the
    // migration was applied in a previous run, which is fine.
    const safeErrors = [
      "already exists",
      "already member",
      "duplicate key",
    ];
    if (safeErrors.some((s) => message.toLowerCase().includes(s))) {
      return;
    }

    throw new Error(message);
  }
}

// Ordered list of files to apply. Order matters — complete_setup must run
// before patches that depend on its tables.
const ORDERED_FILES = [
  "complete_setup.sql",
  "master_migration.sql",
  "fix_admin_permissions.sql",
  "fix_library_tables.sql",
  "fix_redeem_system.sql",
  "quiz_attempts_table.sql",
  "enable_realtime.sql",
  "referral_speed_patch.sql",
  "transactions_patch.sql",
  "run_this_patch.sql",
  "migration_patch.sql",
];

async function main(): Promise<void> {
  console.log(`\n🚀 Running Supabase migrations`);
  console.log(`   Project : ${PROJECT_ID}`);
  console.log(`   Dir     : ${MIGRATIONS_DIR}\n`);

  // Verify the migrations directory exists
  let availableFiles: string[];
  try {
    availableFiles = await readdir(MIGRATIONS_DIR);
  } catch {
    console.error(`❌ Migrations directory not found: ${MIGRATIONS_DIR}`);
    process.exit(1);
  }

  const toRun = ORDERED_FILES.filter((f) => availableFiles.includes(f));

  if (toRun.length === 0) {
    console.warn("⚠️  No migration files found — nothing to apply.");
    return;
  }

  let applied = 0;
  let skipped = 0;
  let failed = 0;

  for (const filename of toRun) {
    const filepath = join(MIGRATIONS_DIR, filename);
    const sql = await readFile(filepath, "utf-8");

    process.stdout.write(`  → ${filename} … `);
    try {
      await runSql(sql);
      console.log("✓");
      applied++;
    } catch (err) {
      console.log("✗");
      console.error(`     ${(err as Error).message}`);
      failed++;
    }
  }

  const skippedFiles = ORDERED_FILES.filter((f) => !availableFiles.includes(f));
  skipped = skippedFiles.length;

  console.log(`\n─────────────────────────────────`);
  console.log(`  Applied : ${applied}`);
  console.log(`  Skipped : ${skipped} (file not found)`);
  console.log(`  Failed  : ${failed}`);
  console.log(`─────────────────────────────────\n`);

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
