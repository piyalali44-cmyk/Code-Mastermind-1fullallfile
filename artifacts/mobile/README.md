# StayGuided Me — Mobile App

React Native / Expo mobile app for the StayGuided Me Islamic audio platform.

---

## Prerequisites

Before you start, install these on your computer:

| Tool | Link |
|------|------|
| Node.js (v20+) | https://nodejs.org |
| pnpm | `npm install -g pnpm` |
| Expo CLI | `npm install -g expo` |
| EAS CLI (for building APK/IPA) | `npm install -g eas-cli` |

---

## Step 1 — Get Your Supabase Anon Key

1. Open https://supabase.com/dashboard
2. Select the **tkruzfskhtcazjxdracm** project
3. Go to **Project Settings → API**
4. Copy the **anon / public** key (NOT the service_role key)

---

## Step 2 — Set Up Environment

From **inside this folder** (`artifacts/mobile/`):

```bash
cp .env.example .env
```

Open `.env` and paste your anon key:

```
EXPO_PUBLIC_SUPABASE_URL=https://tkruzfskhtcazjxdracm.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=paste-your-anon-key-here
EXPO_PUBLIC_API_BASE_URL=https://your-replit-domain.replit.app/api-server
```

> For `EXPO_PUBLIC_API_BASE_URL`: use your Replit project's deployed URL + `/api-server`

---

## Step 3 — Install Dependencies

This app lives inside a pnpm monorepo. From the **project root** (two levels up):

```bash
pnpm install
```

---

## Step 4 — Run on Your Phone (Development)

```bash
# From the project root:
pnpm --filter @workspace/mobile run dev
```

Or from this folder:
```bash
npx expo start
```

Then scan the QR code with **Expo Go** app on your Android or iPhone.

---

## Step 5A — Build Android APK (via EAS Cloud Build)

This is the easiest way — EAS builds in the cloud, you don't need Android Studio.

**1. Create a free Expo account:**
   - Go to https://expo.dev and sign up

**2. Log in to EAS:**
```bash
eas login
```

**3. Create the EAS project (first time only):**
```bash
eas init
```

**4. Build the APK:**
```bash
eas build --platform android --profile preview
```

> - Select **APK** format when asked (not AAB, unless uploading to Play Store)
> - The build takes 10–20 minutes in the cloud
> - You'll get a download link when it's done
> - Install the APK directly on any Android phone

**5. For a Play Store release (AAB format):**
```bash
eas build --platform android --profile production
```

---

## Step 5B — Build iOS IPA (via EAS Cloud Build)

> **Requires:** Apple Developer account ($99/year) + Mac (for signing setup)

```bash
eas build --platform ios --profile production
```

- EAS will guide you through Apple credentials setup
- The IPA can be submitted to the App Store with `eas submit --platform ios`

---

## Step 6 — Submit to App Stores

**Google Play Store:**
```bash
eas submit --platform android
```

**Apple App Store:**
```bash
eas submit --platform ios
```

---

## Folder Structure

```
artifacts/mobile/
├── app/                  # All screens (Expo Router)
│   ├── (tabs)/           # Bottom-tab screens (Home, Search, Library, etc.)
│   ├── series/[id].tsx   # Series detail + episode list
│   ├── journey.tsx       # Islamic learning journey
│   └── player.tsx        # Audio player
├── components/           # Reusable UI components
├── context/              # Global state (Auth, Content, Audio Player)
├── lib/                  # Supabase client, database helpers
├── data/mockData.ts      # Fallback mock data (used when DB is empty)
├── supabase/             # SQL files for database setup
│   ├── admin_panel_setup.sql  # Run this in Supabase SQL Editor
│   └── fix_duplicates.sql     # Run to clean duplicate DB rows
├── .env.example          # Copy to .env and fill in keys
├── app.json              # Expo config (app name, icons, bundle ID)
└── eas.json              # EAS Build config
```

---

## Database Setup (One-Time)

If the app shows no content, run these SQL files in Supabase SQL Editor:

1. **Supabase Dashboard** → SQL Editor
2. Run `supabase/admin_panel_setup.sql` (comprehensive DB setup)
3. Run `supabase/fix_duplicates.sql` (clean any duplicate rows)

---

## Changing App Name / Bundle ID

Edit `app.json`:

```json
{
  "expo": {
    "name": "StayGuided Me",
    "slug": "stayguided-me",
    "ios": {
      "bundleIdentifier": "com.yourcompany.stayguided"
    },
    "android": {
      "package": "com.yourcompany.stayguided"
    }
  }
}
```

---

## Common Issues

| Problem | Solution |
|---------|----------|
| App shows "Supabase key missing" | Check your `.env` file has `EXPO_PUBLIC_SUPABASE_ANON_KEY` |
| No content showing | Run `admin_panel_setup.sql` in Supabase SQL Editor |
| QR code not scanning | Make sure phone and computer are on same WiFi |
| Build fails on EAS | Run `eas diagnostics` and check logs |
