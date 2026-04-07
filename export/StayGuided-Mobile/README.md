# StayGuided Me — Mobile App (Standalone)

এই ফোল্ডারটি সম্পূর্ণ standalone। Monorepo ছাড়া যেকোনো কম্পিউটারে কাজ করবে।

---

## প্রথমে যা লাগবে

| Tool | ডাউনলোড |
|------|---------|
| Node.js (v20+) | https://nodejs.org |
| EAS CLI | `npm install -g eas-cli` |

---

## Step 1 — Supabase Anon Key নিন

1. https://supabase.com/dashboard খুলুন
2. Project: **tkruzfskhtcazjxdracm** select করুন
3. **Project Settings → API** তে যান
4. **anon / public** key কপি করুন

---

## Step 2 — Environment Setup

এই ফোল্ডারে `.env` নামে ফাইল বানান:

```
EXPO_PUBLIC_SUPABASE_URL=https://tkruzfskhtcazjxdracm.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=এখানে-anon-key-বসান
EXPO_PUBLIC_API_BASE_URL=https://আপনার-replit-domain.replit.app/api
```

---

## Step 3 — Dependencies Install

```bash
npm install
```

---

## Step 4 — ফোনে চালান (Development)

```bash
npx expo start
```

ফোনে **Expo Go** app দিয়ে QR code scan করুন।

---

## Step 5A — Android APK Build (EAS Cloud — সবচেয়ে সহজ)

Android Studio দরকার নেই — EAS cloud এ build হবে।

```bash
# প্রথমবার: Expo account এ login (expo.dev থেকে account বানান)
eas login
eas init

# APK build (internal testing / সরাসরি install)
npm run build:android

# Play Store AAB build
npm run build:android:prod
```

Build ১০-২০ মিনিট লাগবে। শেষে download link পাবেন।

---

## Step 5B — iOS Build

> Apple Developer account লাগবে ($99/year)

```bash
npm run build:ios
```

---

## Step 6 — Store Submit

```bash
eas submit --platform android   # Google Play
eas submit --platform ios       # Apple App Store
```

---

## ফোল্ডার Structure

```
StayGuided-Mobile/
├── app/              ← সব screen (Expo Router)
│   ├── (tabs)/       ← Home, Search, Library, Profile
│   ├── series/       ← Series detail + episodes
│   ├── player.tsx    ← Audio player
│   └── journey.tsx   ← Islamic learning journey
├── components/       ← Reusable UI
├── context/          ← Auth, Content, Audio state
├── lib/              ← Supabase client, DB helpers
├── assets/           ← Images, fonts
├── supabase/
│   ├── admin_panel_setup.sql  ← Supabase SQL Editor এ run করুন
│   └── fix_duplicates.sql
├── app.json          ← App name, bundle ID
├── eas.json          ← Build profiles
└── .env.example      ← Key template
```

---

## App নাম পরিবর্তন

`app.json` edit করুন:

```json
{
  "expo": {
    "name": "আপনার App নাম",
    "ios": { "bundleIdentifier": "com.yourcompany.appname" },
    "android": { "package": "com.yourcompany.appname" }
  }
}
```

---

## Database Setup (একবার)

App এ content না দেখালে:
1. https://supabase.com/dashboard → SQL Editor
2. `supabase/admin_panel_setup.sql` paste করে Run
3. `supabase/fix_duplicates.sql` paste করে Run

---

## Common সমস্যা

| সমস্যা | সমাধান |
|--------|--------|
| "Supabase key missing" | `.env` এ `EXPO_PUBLIC_SUPABASE_ANON_KEY` চেক করুন |
| Content দেখা যাচ্ছে না | Supabase SQL Editor এ `admin_panel_setup.sql` run করুন |
| QR scan হচ্ছে না | ফোন ও PC একই WiFi এ রাখুন |
| EAS build fail | `eas diagnostics` run করুন |
