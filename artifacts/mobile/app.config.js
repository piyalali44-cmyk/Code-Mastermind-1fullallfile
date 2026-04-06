const config = require("./app.json");

module.exports = {
  ...config.expo,
  extra: {
    ...config.expo?.extra,
  },
  env: {
    EXPO_PUBLIC_API_BASE_URL:
      process.env.EXPO_PUBLIC_API_BASE_URL ??
      (process.env.EXPO_PUBLIC_DOMAIN
        ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
        : `https://${process.env.REPLIT_DEV_DOMAIN}/api`),
    EXPO_PUBLIC_SUPABASE_URL:
      process.env.EXPO_PUBLIC_SUPABASE_URL ?? "https://tkruzfskhtcazjxdracm.supabase.co",
    EXPO_PUBLIC_SUPABASE_ANON_KEY:
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "",
  },
};
