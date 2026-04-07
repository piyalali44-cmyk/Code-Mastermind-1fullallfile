# StayGuided Me — Mobile App

React Native / Expo mobile app for the StayGuided Me Islamic audio platform.

---

## Prerequisites

| Tool | Install |
|------|---------|
| Node.js v20+ | https://nodejs.org |
| pnpm | `npm install -g pnpm` |
| Expo Go (phone) | iOS App Store / Google Play |
| EAS CLI (for builds) | `npm install -g eas-cli` |

---

## Step 1 — Get Your Supabase Keys

1. Go to https://supabase.com/dashboard
2. Open your project → **Project Settings → API**
3. Copy the **anon / public** key (NOT the service_role key)

---

## Step 2 — Set Up Environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
EXPO_PUBLIC_SUPABASE_URL=https://tkruzfskhtcazjxdracm.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=paste-your-anon-key-here
EXPO_PUBLIC_API_BASE_URL=https://your-api-server.com/api
```

> For `EXPO_PUBLIC_API_BASE_URL`: use your deployed API server URL.
> During local development this can be `http://YOUR_LOCAL_IP:8080/api`
> (use your computer's local network IP, not `localhost`, so the phone can reach it)

---

## Step 3 — Install Dependencies

From the **project root** (two levels up):

```bash
pnpm install
```

---

## Step 4 — Run on Your Phone

```bash
# From the project root:
pnpm --filter @workspace/mobile run dev:local

# Or from this folder directly:
npx expo start
```

Scan the QR code with **Expo Go** on your phone.

---

## Step 5A — Build Android APK (EAS Cloud Build)

```bash
eas login
eas init   # First time only
eas build --platform android --profile preview
```

> Builds in the cloud — no Android Studio required.
> Download the APK from the link EAS provides and install it directly.

For Play Store (AAB format):
```bash
eas build --platform android --profile production
```

---

## Step 5B — Build iOS IPA

> Requires Apple Developer account ($99/year)

```bash
eas build --platform ios --profile production
```

---

## Step 6 — Submit to Stores

```bash
eas submit --platform android   # Google Play
eas submit --platform ios       # App Store
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
├── supabase/             # SQL files for database setup
│   ├── admin_panel_setup.sql  # Run in Supabase SQL Editor (full setup)
│   └── master_patches.sql     # Latest schema patches + RLS policies
├── .env.example          # Copy to .env and fill in keys
├── app.json              # Expo config (app name, icons, bundle ID)
└── eas.json              # EAS Build profiles
```

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

## Database Setup (One-Time)

If the app shows no content:

1. **Supabase Dashboard** → SQL Editor
2. Run `supabase/admin_panel_setup.sql`
3. Run `supabase/master_patches.sql`
4. Add content through the admin panel

---

## Common Issues

| Problem | Solution |
|---------|----------|
| "Supabase key missing" | Check `.env` has `EXPO_PUBLIC_SUPABASE_ANON_KEY` |
| No content showing | Run `admin_panel_setup.sql` then add content in admin panel |
| Can't connect to API | Use your computer's local network IP (not `localhost`) in `EXPO_PUBLIC_API_BASE_URL` |
| QR code not scanning | Phone and computer must be on the same WiFi |
| Build fails on EAS | Run `eas diagnostics` for details |
