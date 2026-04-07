const config = require("./app.json");

// ── Supabase Configuration ───────────────────────────────────────────────────
// The anon key is safe to embed (it's a public key, not a secret).
// You can override via EXPO_PUBLIC_SUPABASE_ANON_KEY in your .env file.

const SUPABASE_URL = "https://tkruzfskhtcazjxdracm.supabase.co";
const SUPABASE_ANON_KEY = "REPLACE_WITH_YOUR_SUPABASE_ANON_KEY";

// ── API Server URL ───────────────────────────────────────────────────────────
// Point this to your deployed Replit API server.
// Format: https://YOUR-REPLIT-PROJECT.replit.app/api-server
const API_BASE_URL = "REPLACE_WITH_YOUR_API_SERVER_URL";

// Env var overrides (for local development)
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? SUPABASE_ANON_KEY;
const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? API_BASE_URL;

if (!supabaseAnonKey || supabaseAnonKey === "REPLACE_WITH_YOUR_SUPABASE_ANON_KEY") {
  console.warn("[app.config] Set EXPO_PUBLIC_SUPABASE_ANON_KEY in your .env file!");
}

module.exports = {
  ...config.expo,
  extra: {
    ...config.expo?.extra,
  },
  env: {
    EXPO_PUBLIC_SUPABASE_URL: supabaseUrl,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: supabaseAnonKey,
    EXPO_PUBLIC_API_BASE_URL: apiBaseUrl,
  },
};
