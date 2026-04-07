import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ── Configuration ─────────────────────────────────────────────────────────────
// These are injected at build time by vite.config.ts via `define`.
// They are sourced from the shared environment variables set on the project.
const SUPABASE_PROJECT_URL = "https://tkruzfskhtcazjxdracm.supabase.co";

const supabaseUrl =
  (import.meta.env.VITE_SUPABASE_URL as string) || SUPABASE_PROJECT_URL;

const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || "";
const supabaseServiceKey = (import.meta.env.VITE_SUPABASE_SERVICE_KEY as string) || "";

// Exported so App.tsx can render a friendly configuration-error screen instead
// of letting every Supabase call fail silently.
export const SUPABASE_KEY_MISSING = !supabaseAnonKey;

if (import.meta.env.DEV && SUPABASE_KEY_MISSING) {
  console.error(
    "[supabase] VITE_SUPABASE_ANON_KEY is not set.\n" +
    "Set EXPO_PUBLIC_SUPABASE_ANON_KEY in your shared environment variables — " +
    "vite.config.ts reads it and injects it as VITE_SUPABASE_ANON_KEY at build time.",
  );
}

// ── Singleton clients ─────────────────────────────────────────────────────────
// Using globalThis singletons avoids duplicate client creation during hot-module
// replacement in development.
declare global {
  var __supabaseMainClient: SupabaseClient | undefined;
  var __supabaseAdminAuthClient: SupabaseClient | undefined;
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

// Admin client uses the service-role key — ONLY for auth.admin operations
// (invite user, delete user). Never use it for data reads/writes; use `supabase`
// with the authenticated user's JWT and rely on RLS instead.
if (!globalThis.__supabaseAdminAuthClient && supabaseServiceKey) {
  globalThis.__supabaseAdminAuthClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: { "x-app-name": "StayGuided Me Admin (service)" },
    },
  });
}

export const supabase = globalThis.__supabaseMainClient as SupabaseClient;
export const supabaseAdmin = globalThis.__supabaseAdminAuthClient as SupabaseClient | null;

export const SUPABASE_URL = supabaseUrl;
