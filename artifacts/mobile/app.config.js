const config = require("./app.json");

module.exports = {
  ...config.expo,
  extra: {
    ...config.expo?.extra,
  },
  env: {
    EXPO_PUBLIC_API_BASE_URL:
      process.env.EXPO_PUBLIC_API_BASE_URL ??
      "https://2c674757-24e6-4f77-a319-e136047f4e8f-00-319jytwvw59q6.pike.replit.dev/api",
  },
};
