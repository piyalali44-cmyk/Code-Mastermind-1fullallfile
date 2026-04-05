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
        : "https://f2e5cc93-2607-4e51-9625-693bca775672-00-1fzmn5eyvj394.pike.replit.dev/api"),
  },
};
