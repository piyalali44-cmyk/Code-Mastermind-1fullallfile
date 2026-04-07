# StayGuided Me — Mobile App

---

## প্রথমে ২টো জিনিস লাগবে

1. **Node.js** (v20+): https://nodejs.org
2. **EAS CLI**: Terminal এ রান করুন:
   ```bash
   npm install -g eas-cli
   ```

---

## Step 1 — Supabase Anon Key সেট করুন

`app.config.js` ফাইল খুলুন এবং এই লাইনটা ঠিক করুন:

```js
const SUPABASE_ANON_KEY = "REPLACE_WITH_YOUR_SUPABASE_ANON_KEY";
```

**আপনার key কোথায় পাবেন:**
1. https://supabase.com/dashboard → Project `tkruzfskhtcazjxdracm`
2. Project Settings → API → **anon / public** key কপি করুন

**API Server URL** (Replit থেকে deploy করার পর):
```js
const API_BASE_URL = "https://আপনার-replit-project.replit.app/api-server";
```

---

## Step 2 — Dependencies Install

```bash
npm install
```

---

## Step 3 — ফোনে Test করুন

```bash
npx expo start
```

ফোনে **Expo Go** app দিয়ে QR code scan করুন।

---

## Step 4 — Android APK Build করুন

```bash
# Expo account এ login (expo.dev থেকে free account)
eas login

# প্রথমবার project setup
eas init

# APK build (সরাসরি ফোনে install করা যাবে)
npm run build:android
```

> ১০-২০ মিনিট পর download link আসবে। সেই APK সরাসরি Android এ install করুন।

---

## Step 5 — Play Store APK (Production)

```bash
npm run build:android:prod
```

> এটা AAB format — Play Store এ upload করার জন্য।

---

## Step 6 — iOS Build

> Apple Developer account লাগবে ($99/year)

```bash
npm run build:ios
```

---

## App নাম পরিবর্তন করুন

`app.json` খুলুন:

```json
{
  "expo": {
    "name": "আপনার App নাম",
    "android": { "package": "com.yourcompany.appname" },
    "ios": { "bundleIdentifier": "com.yourcompany.appname" }
  }
}
```

---

## Database Setup (প্রথমবার)

যদি app এ কোনো content না দেখায়:

1. https://supabase.com/dashboard → Project `tkruzfskhtcazjxdracm`
2. SQL Editor → `supabase/admin_panel_setup.sql` paste করে Run
3. SQL Editor → `supabase/fix_duplicates.sql` paste করে Run

---

## ফোল্ডার Structure

```
StayGuided-Mobile/
├── app/              ← সব screen
│   ├── (tabs)/       ← Home, Search, Library, Profile
│   ├── player.tsx    ← Audio player
│   └── journey.tsx   ← Islamic learning journey
├── components/       ← Reusable UI
├── context/          ← Auth, Content state
├── lib/              ← Supabase, DB helpers
├── assets/           ← Images, fonts
├── supabase/         ← Database SQL files
├── app.config.js     ← ← এখানে anon key সেট করুন
├── app.json          ← App name, bundle ID
└── eas.json          ← Build profiles
```

---

## Common সমস্যা

| সমস্যা | সমাধান |
|--------|--------|
| Content দেখা যাচ্ছে না | Supabase SQL Editor এ `admin_panel_setup.sql` run করুন |
| Build fail | `eas diagnostics` run করুন |
| Login হচ্ছে না | `app.config.js` এ anon key ঠিক আছে কিনা দেখুন |
