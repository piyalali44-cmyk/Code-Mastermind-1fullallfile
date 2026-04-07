import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env["SUPABASE_URL"] ?? "https://tkruzfskhtcazjxdracm.supabase.co";
const SUPABASE_SERVICE_KEY = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";
const SUPABASE_ACCESS_TOKEN = process.env["SUPABASE_ACCESS_TOKEN"] ?? "";
const PROJECT_REF =
  process.env["SUPABASE_PROJECT_ID"] ??
  process.env["EXPO_PUBLIC_SUPABASE_PROJECT_REF"] ??
  "tkruzfskhtcazjxdracm";

function getAdmin() {
  if (!SUPABASE_SERVICE_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function runSQLViaManagementAPI(sql: string, label: string): Promise<boolean> {
  if (!SUPABASE_ACCESS_TOKEN) return false;
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
    if (resp.ok) {
      console.log(`[migrations] Applied via API: ${label}`);
      return true;
    }
    const text = await resp.text().catch(() => "");
    if (resp.status === 401) {
      console.warn(`[migrations] Management API: unauthorized (token may be a service-role key, not a personal access token). Run master_patches.sql manually.`);
    } else {
      console.warn(`[migrations] "${label}" API failed (${resp.status}): ${text.slice(0, 120)}`);
    }
    return false;
  } catch (e: any) {
    console.warn(`[migrations] "${label}" API error: ${e.message}`);
    return false;
  }
}

interface ColumnCheck {
  table: string;
  column: string;
  addSql: string;
  label: string;
}

const REQUIRED_COLUMNS: ColumnCheck[] = [
  {
    table: "subscriptions",
    column: "store",
    addSql: "ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS store TEXT;",
    label: "subscriptions.store",
  },
  {
    table: "subscriptions",
    column: "product_id",
    addSql: "ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS product_id TEXT;",
    label: "subscriptions.product_id",
  },
  {
    table: "subscriptions",
    column: "original_transaction_id",
    addSql: "ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS original_transaction_id TEXT;",
    label: "subscriptions.original_transaction_id",
  },
  {
    table: "episodes",
    column: "image_url",
    addSql: "ALTER TABLE public.episodes ADD COLUMN IF NOT EXISTS image_url TEXT;",
    label: "episodes.image_url",
  },
  {
    table: "profiles",
    column: "push_token",
    addSql: "ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS push_token TEXT;",
    label: "profiles.push_token",
  },
];

async function checkMissingColumns(): Promise<ColumnCheck[]> {
  const admin = getAdmin();
  if (!admin) return [];

  const missing: ColumnCheck[] = [];

  for (const check of REQUIRED_COLUMNS) {
    try {
      const { error } = await admin
        .from(check.table)
        .select(check.column)
        .limit(1);

      if (error && (error.code === "PGRST204" || error.message?.includes("does not exist") || error.message?.includes("column"))) {
        missing.push(check);
      }
    } catch {
      missing.push(check);
    }
  }
  return missing;
}

async function seedHadithBadges(): Promise<void> {
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
    if (error) {
      console.warn(`[migrations] Badge upsert failed (${badge.slug}):`, error.message);
    }
  }
  console.log("[migrations] Hadith badges seeded");
}

async function seedAppSettings(): Promise<void> {
  const admin = getAdmin();
  if (!admin) return;

  const settings = [
    { key: "lifetime_price_usd", value: "49.99", description: "Lifetime subscription price (USD)", type: "number" },
  ];

  for (const s of settings) {
    await admin
      .from("app_settings")
      .upsert(s, { onConflict: "key", ignoreDuplicates: true });
  }
}

export async function applySchemaPatches(): Promise<void> {
  if (!SUPABASE_SERVICE_KEY && !SUPABASE_ACCESS_TOKEN) {
    console.warn("[migrations] No credentials — skipping schema patches");
    return;
  }

  const missing = await checkMissingColumns().catch(() => [] as ColumnCheck[]);

  if (missing.length > 0) {
    const missingSql = missing.map((c) => c.addSql).join("\n");
    let appliedCount = 0;

    for (const col of missing) {
      const ok = await runSQLViaManagementAPI(col.addSql, col.label);
      if (ok) appliedCount++;
    }

    if (appliedCount < missing.length) {
      console.warn(
        `[migrations] ${missing.length - appliedCount} column(s) still missing — run master_patches.sql in Supabase Dashboard:\n` +
        `  artifacts/mobile/supabase/master_patches.sql\n` +
        `Missing: ${missing.map((c) => c.label).join(", ")}`
      );
    }
  } else {
    console.log("[migrations] Schema up to date — all required columns present");
  }

  await seedHadithBadges().catch((e) =>
    console.warn("[migrations] Badge seeding error:", e.message)
  );

  await seedAppSettings().catch((e) =>
    console.warn("[migrations] App settings seeding error:", e.message)
  );
}

export async function getSchemaStatus(): Promise<{
  ok: boolean;
  missing: string[];
  message: string;
}> {
  const missing = await checkMissingColumns().catch(() => [] as ColumnCheck[]);
  return {
    ok: missing.length === 0,
    missing: missing.map((c) => c.label),
    message:
      missing.length === 0
        ? "All required schema columns are present"
        : `Missing columns: ${missing.map((c) => c.label).join(", ")}. Run master_patches.sql to fix.`,
  };
}
