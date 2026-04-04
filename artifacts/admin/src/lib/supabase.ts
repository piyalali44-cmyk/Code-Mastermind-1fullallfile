import { createClient, SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_PROJECT_URL = "https://tkruzfskhtcazjxdracm.supabase.co";

const supabaseUrl =
  (import.meta.env.VITE_SUPABASE_URL as string) || SUPABASE_PROJECT_URL;

const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY as string;

export const SUPABASE_KEY_MISSING = !supabaseAnonKey;

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
  });
}

if (!globalThis.__supabaseAdminAuthClient && supabaseServiceKey) {
  globalThis.__supabaseAdminAuthClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export const supabase = globalThis.__supabaseMainClient as SupabaseClient;

export const supabaseAdmin = globalThis.__supabaseAdminAuthClient as SupabaseClient | null;

export const SUPABASE_URL = supabaseUrl;
