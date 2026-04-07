import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ── Configuration ─────────────────────────────────────────────────────────────
// These are injected at build time by vite.config.ts via `define`.
// IMPORTANT: Only the anon key is embedded in the browser bundle. The
// service-role key is intentionally NOT injected — privileged admin operations
// (invite user, delete user) are proxied through the /api/admin/* server
// endpoints which hold the service-role key server-side only.
const SUPABASE_PROJECT_URL = "https://tkruzfskhtcazjxdracm.supabase.co";

const supabaseUrl =
  (import.meta.env.VITE_SUPABASE_URL as string) || SUPABASE_PROJECT_URL;

const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || "";

// Exported so App.tsx can render a friendly configuration-error screen
// instead of letting every Supabase call fail silently.
export const SUPABASE_KEY_MISSING = !supabaseAnonKey;

if (import.meta.env.DEV && SUPABASE_KEY_MISSING) {
  console.error(
    "[supabase] VITE_SUPABASE_ANON_KEY is not set.\n" +
    "Set EXPO_PUBLIC_SUPABASE_ANON_KEY in your shared environment variables — " +
    "vite.config.ts reads it and injects it as VITE_SUPABASE_ANON_KEY at build time.",
  );
}

// ── Main client (anon key + RLS) ──────────────────────────────────────────────
// Use this for all data operations. Access is scoped by the signed-in user's
// JWT and enforced by Supabase Row Level Security policies.
declare global {
  var __supabaseMainClient: SupabaseClient | undefined;
}

if (!globalThis.__supabaseMainClient && supabaseAnonKey) {
  globalThis.__supabaseMainClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storageKey: "sb-admin-auth",
    },
    global: {
      headers: { "x-app-name": "StayGuided Me Admin" },
    },
  });
}

export const supabase = globalThis.__supabaseMainClient as SupabaseClient;

// supabaseAdmin is no longer created in the browser. Privileged admin
// operations use the /api/admin/* server endpoints instead.
// Kept as null export for backward-compatible imports.
export const supabaseAdmin: SupabaseClient | null = null;

export const SUPABASE_URL = supabaseUrl;
