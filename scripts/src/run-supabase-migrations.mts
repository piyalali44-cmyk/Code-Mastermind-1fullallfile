/**
 * run-supabase-migrations.mts
 *
 * Applies SQL migration files to the Supabase project via the Management API.
 * Each file is split into individual statements which are executed one-by-one
 * so that a single "already exists" error never silently swallows the rest of
 * a file.
 *
 * Usage:
 *   pnpm --filter scripts exec tsx src/run-supabase-migrations.mts
 *
 * Required environment variables:
 *   SUPABASE_ACCESS_TOKEN   — Personal access token from app.supabase.com
 *   SUPABASE_PROJECT_ID     — Project ref (e.g. tkruzfskhtcazjxdracm)
 *
 * Optional:
 *   SUPABASE_MIGRATIONS_DIR — Path to the directory containing .sql files
 *                             (defaults to artifacts/mobile/supabase)
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

// ── SQL statement splitter ─────────────────────────────────────────────────
// Splits a SQL file into individual statements while correctly handling:
//   • Dollar-quoted strings ($$ ... $$ or $tag$ ... $tag$)
//   • Single-quoted strings ('...')
//   • Line comments (-- ...)
//   • Block comments (/* ... */)
function splitStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = "";
  let i = 0;
  const len = sql.length;

  while (i < len) {
    // ── Line comment ──────────────────────────────────────────────────────
    if (sql[i] === "-" && sql[i + 1] === "-") {
      const end = sql.indexOf("\n", i);
      const comment = end === -1 ? sql.slice(i) : sql.slice(i, end + 1);
      current += comment;
      i += comment.length;
      continue;
    }

    // ── Block comment ─────────────────────────────────────────────────────
    if (sql[i] === "/" && sql[i + 1] === "*") {
      const end = sql.indexOf("*/", i + 2);
      const comment = end === -1 ? sql.slice(i) : sql.slice(i, end + 2);
      current += comment;
      i += comment.length;
      continue;
    }

    // ── Dollar-quoted string ($tag$...$tag$) ──────────────────────────────
    if (sql[i] === "$") {
      const closeTag = sql.indexOf("$", i + 1);
      if (closeTag !== -1) {
        const tag = sql.slice(i, closeTag + 1); // e.g. "$$" or "$func$"
        const endTag = sql.indexOf(tag, closeTag + 1);
        if (endTag !== -1) {
          // Consume the entire dollar-quoted block verbatim
          const block = sql.slice(i, endTag + tag.length);
          current += block;
          i += block.length;
          continue;
        }
      }
    }

    // ── Single-quoted string ('...') ───────────────────────────────────────
    if (sql[i] === "'") {
      let j = i + 1;
      while (j < len) {
        if (sql[j] === "'" && sql[j + 1] === "'") {
          j += 2; // escaped quote
        } else if (sql[j] === "'") {
          j += 1;
          break;
        } else {
          j++;
        }
      }
      current += sql.slice(i, j);
      i = j;
      continue;
    }

    // ── Statement terminator ───────────────────────────────────────────────
    if (sql[i] === ";") {
      current += ";";
      const trimmed = current.trim();
      if (trimmed.length > 1) {
        // skip bare ";" lines
        statements.push(trimmed);
      }
      current = "";
      i++;
      continue;
    }

    current += sql[i];
    i++;
  }

  // Any trailing content without a trailing semicolon
  const trimmed = current.trim();
  if (trimmed) {
    statements.push(trimmed);
  }

  return statements;
}

// ── Run a single SQL statement via the Management API ─────────────────────
type StmtResult = "applied" | "skipped" | "failed";

const SAFE_ERROR_PATTERNS = [
  "already exists",
  "already member",
  "duplicate key",
];

async function runStatement(sql: string): Promise<{ result: StmtResult; error?: string }> {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });

  if (res.status === 201) {
    return { result: "applied" };
  }

  const body = await res.text();
  let message: string;
  try {
    message = (JSON.parse(body) as { message?: string }).message ?? body;
  } catch {
    message = body;
  }

  const isIdempotent = SAFE_ERROR_PATTERNS.some((p) =>
    message.toLowerCase().includes(p),
  );
  if (isIdempotent) {
    return { result: "skipped", error: message };
  }

  return { result: "failed", error: message };
}

// ── Ordered list of migration files ───────────────────────────────────────
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

  let totalApplied = 0;
  let totalSkipped = 0;
  let totalFailed = 0;
  let filesFailed = 0;

  for (const filename of toRun) {
    const filepath = join(MIGRATIONS_DIR, filename);
    const sql = await readFile(filepath, "utf-8");
    const statements = splitStatements(sql);

    console.log(`  ▸ ${filename} (${statements.length} statements)`);

    let fileApplied = 0;
    let fileSkipped = 0;
    let fileFailed = 0;

    for (let idx = 0; idx < statements.length; idx++) {
      const stmt = statements[idx];
      const preview = stmt.slice(0, 80).replace(/\s+/g, " ");

      const { result, error } = await runStatement(stmt);

      if (result === "applied") {
        fileApplied++;
      } else if (result === "skipped") {
        fileSkipped++;
        // Log at debug level — these are expected on re-runs
        if (process.env.DEBUG_MIGRATIONS) {
          console.log(`      [${idx + 1}] skipped (${error}) — ${preview}`);
        }
      } else {
        fileFailed++;
        console.error(`      [${idx + 1}] ✗ FAILED — ${preview}`);
        console.error(`           ${error}`);
      }
    }

    const statusIcon = fileFailed > 0 ? "✗" : fileSkipped === statements.length ? "↷" : "✓";
    console.log(
      `      ${statusIcon}  applied=${fileApplied}  skipped=${fileSkipped}  failed=${fileFailed}`,
    );

    if (fileFailed > 0) filesFailed++;
    totalApplied += fileApplied;
    totalSkipped += fileSkipped;
    totalFailed += fileFailed;
  }

  const notFound = ORDERED_FILES.filter((f) => !availableFiles.includes(f));

  console.log(`\n─────────────────────────────────────────`);
  console.log(`  Statements applied : ${totalApplied}`);
  console.log(`  Statements skipped : ${totalSkipped} (idempotent / already exists)`);
  console.log(`  Statements failed  : ${totalFailed}`);
  if (notFound.length > 0) {
    console.log(`  Files not found    : ${notFound.join(", ")}`);
  }
  console.log(`─────────────────────────────────────────\n`);

  if (filesFailed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
