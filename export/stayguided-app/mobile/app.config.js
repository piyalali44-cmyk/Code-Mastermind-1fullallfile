const config = require("./app.json");

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? "https://tkruzfskhtcazjxdracm.supabase.co";

const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.SUPABASE_ANON_KEY ??
  "";

const apiBaseUrl =
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  process.env.EXPO_PUBLIC_API_URL ??
  (process.env.EXPO_PUBLIC_DOMAIN
    ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
    : "http://localhost:3000/api");

if (!supabaseAnonKey) {
  console.warn(
    "[app.config] EXPO_PUBLIC_SUPABASE_ANON_KEY is not set. " +
    "Authentication and all Supabase operations will fail.",
  );
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
