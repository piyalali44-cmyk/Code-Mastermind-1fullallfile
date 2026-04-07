# StayGuided Me

Islamic audio content platform — Expo/React Native mobile app, React admin panel, and Node.js/Express API server, all backed by Supabase.

---

## What This Project Contains

| Folder | What It Is |
|--------|------------|
| `artifacts/mobile/` | Expo (React Native) mobile app for iOS & Android |
| `artifacts/admin/` | React web admin panel for content & user management |
| `artifacts/api-server/` | Node.js/Express API server (auth, subscriptions, social) |

---

## Quick Start (Local Development)

### Prerequisites

- **Node.js** v20+ — https://nodejs.org
- **pnpm** — `npm install -g pnpm`
- **Supabase project** — https://supabase.com (free tier works)

### Step 1 — Clone & Install

```bash
git clone <your-repo-url>
cd stayguided-me
pnpm install
```

### Step 2 — Set Up Environment Variables

Each service has its own `.env.example`. Copy and fill them in:

```bash
cp artifacts/api-server/.env.example artifacts/api-server/.env
cp artifacts/admin/.env.example       artifacts/admin/.env.local
cp artifacts/mobile/.env.example      artifacts/mobile/.env
```

Fill in your Supabase values (see "Getting Your Supabase Keys" below).

### Step 3 — Run All Services

Open three terminals (or use a process manager):

```bash
# Terminal 1 — API Server
pnpm --filter @workspace/api-server run dev

# Terminal 2 — Admin Panel
BASE_PATH=/admin PORT=3001 pnpm --filter @workspace/admin run dev

# Terminal 3 — Mobile App
cd artifacts/mobile
pnpm run dev:local
```

Then scan the QR code with **Expo Go** on your phone.

---

## Getting Your Supabase Keys

1. Go to https://supabase.com/dashboard
2. Open your project → **Project Settings → API**
3. Copy:
   - **Project URL** — looks like `https://xxxxxxxxxxxx.supabase.co`
   - **anon / public** key — safe for client-side use
   - **service_role** key — secret, server-side only (never expose to browser)
4. For the **Management API token** (needed for auto-migration on first deploy):
   - Go to https://supabase.com/dashboard/account/tokens
   - Generate a new token and copy it as `SUPABASE_ACCESS_TOKEN`

---

## Database Setup (One-Time)

The API server auto-applies all schema patches on startup if `SUPABASE_ACCESS_TOKEN` + `SUPABASE_SERVICE_ROLE_KEY` are set. No manual SQL needed.

If you prefer to set up manually, run these files in the Supabase SQL Editor:

1. `artifacts/mobile/supabase/admin_panel_setup.sql` — full schema setup
2. `artifacts/mobile/supabase/master_patches.sql` — latest patches & RLS policies

To make yourself a super admin after signing up in the app:

```sql
UPDATE profiles
SET role = 'super_admin'
WHERE id = auth.uid();
```

Or by email via Supabase SQL Editor:

```sql
UPDATE profiles
SET role = 'super_admin'
WHERE email = 'your-email@example.com';
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Mobile App (Expo)                     │
│  iOS / Android — React Native + Expo Router             │
│  Direct Supabase client (auth, content, storage)        │
│  + API server calls (social features, subscriptions)    │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│                   API Server (Express)                   │
│  /api/auth        — signup, signin, password reset      │
│  /api/content     — likes, comments                     │
│  /api/subscription — receipt verification (IAP)         │
│  /api/admin       — user management, moderation         │
│  /api/hadith      — Hadith data                         │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│                  Admin Panel (React/Vite)                │
│  Content management (Series, Episodes, Reciters)        │
│  User & subscription management                         │
│  Analytics & engagement metrics                         │
│  Push notification campaigns                            │
└─────────────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│                      Supabase                           │
│  PostgreSQL database + Row Level Security               │
│  Auth (email/password, Apple Sign In)                   │
│  Storage (cover images, audio files)                    │
│  Realtime (live content updates)                        │
└─────────────────────────────────────────────────────────┘
```

---

## Environment Variables Reference

### API Server (`artifacts/api-server/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | Yes | Port for the Express server (e.g. `8080`) |
| `NODE_ENV` | Yes | `production` or `development` |
| `SUPABASE_URL` | Yes | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Yes | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (secret) |
| `DATABASE_URL` | Yes | Direct Postgres connection string (from Supabase) |
| `SUPABASE_ACCESS_TOKEN` | First deploy | Supabase Management API token (for auto-migration) |
| `SUPABASE_PROJECT_ID` | First deploy | Your Supabase project ref ID |
| `ALLOWED_ORIGINS` | Production | Comma-separated allowed CORS origins |
| `APPLE_BUNDLE_ID` | App Store | iOS bundle identifier |
| `APPLE_SHARED_SECRET` | App Store | Apple in-app purchase shared secret |
| `GOOGLE_PLAY_PACKAGE_NAME` | Play Store | Android package name |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Play Store | Google service account JSON string |

### Admin Panel (`artifacts/admin/.env.local`)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | Yes | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key |
| `VITE_API_BASE_URL` | Optional | API server URL (defaults to `/api`) |

### Mobile App (`artifacts/mobile/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `EXPO_PUBLIC_SUPABASE_URL` | Yes | Your Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key |
| `EXPO_PUBLIC_API_BASE_URL` | Yes | Full URL to your API server + `/api` |

---

## Building the Mobile App for Production

### Install EAS CLI

```bash
npm install -g eas-cli
eas login
```

### Build Android APK (for direct install / testing)

```bash
cd artifacts/mobile
eas build --platform android --profile preview
```

### Build Android AAB (for Google Play Store)

```bash
eas build --platform android --profile production
```

### Build iOS IPA (requires Apple Developer account)

```bash
eas build --platform ios --profile production
```

### Submit to Stores

```bash
eas submit --platform android   # Google Play
eas submit --platform ios       # App Store
```

---

## Deploying to Production (Self-Hosted)

### API Server

The API server is a standard Node.js/Express app. Deploy it to any Node.js host:

**Option A — Docker**

```bash
cd artifacts/api-server
docker build -t stayguided-api .
docker run -p 8080:8080 --env-file .env stayguided-api
```

**Option B — Any VPS / PaaS (Railway, Render, Fly.io, etc.)**

1. Set all environment variables from `.env.example`
2. Build command: `pnpm --filter @workspace/api-server run build`
3. Start command: `node artifacts/api-server/dist/index.js`

### Admin Panel

The admin panel is a static React SPA. Build and serve it:

```bash
BASE_PATH=/admin pnpm --filter @workspace/admin run build
# Output: artifacts/admin/dist/public/
```

Serve the `dist/public/` folder from any static host (Nginx, Vercel, Netlify, etc.) at the `/admin` path.

---

## Features

### Mobile App
- Discover feed with content recommendations
- Islamic audio series player with background playback
- Media notification bar controls (lock screen, notification shade)
- Quran player with reciter selection and translation
- Journey Timeline — structured Islamic learning path
- Gamification — XP, levels, badges, streaks
- Push notifications
- Bookmarks, downloads, listening history
- Referral system and coupon redemption
- Apple Sign In + email/password authentication

### Admin Panel
- Content management — Series, Episodes, Reciters, Categories
- User management — roles, subscription grants, banning
- Analytics — engagement, revenue, geographic distribution
- Push notification campaigns
- Feature flags with percentage-based rollouts
- Feed manager — inject banners and content rows remotely
- Subscription & coupon management
- Comment moderation
- Contact messages & content reports

### API Server
- User authentication and profile management
- Social features — likes, comments, moderation
- In-app purchase receipt verification (Apple + Google)
- Subscription status and tier management
- Hadith data serving
- Admin operations — user management, badge awards, XP
- Referral code and coupon redemption

---

## Project Structure

```
stayguided-me/
├── artifacts/
│   ├── mobile/               # Expo React Native app
│   │   ├── app/              # Screens (Expo Router)
│   │   ├── components/       # Reusable UI components
│   │   ├── context/          # Auth, Audio, Content context
│   │   ├── lib/              # Supabase client, DB helpers
│   │   └── supabase/         # SQL schema files
│   ├── admin/                # React admin panel
│   │   ├── src/
│   │   │   ├── pages/        # Admin pages by feature
│   │   │   ├── components/   # Shared UI
│   │   │   └── lib/          # Supabase client
│   │   └── vite.config.ts
│   └── api-server/           # Express API server
│       ├── src/
│       │   ├── routes/       # Route handlers
│       │   └── lib/          # DB clients, migrations, logger
│       └── data/             # Static Hadith JSON files
├── lib/                      # Shared TypeScript libraries
├── pnpm-workspace.yaml       # Monorepo workspace config
└── README.md                 # This file
```

---

## Common Issues

| Problem | Solution |
|---------|----------|
| "Supabase key missing" | Set `EXPO_PUBLIC_SUPABASE_ANON_KEY` (mobile) or `VITE_SUPABASE_ANON_KEY` (admin) |
| No content in app | Run `admin_panel_setup.sql` in Supabase SQL Editor, then add content via admin panel |
| Can't log into admin | Set your user role to `super_admin` in Supabase SQL Editor |
| API CORS errors | Set `ALLOWED_ORIGINS` env var on the API server with your client origins |
| Subscriptions not working | Set `APPLE_SHARED_SECRET` / `GOOGLE_SERVICE_ACCOUNT_JSON` and `NODE_ENV=production` |
| Auto-migration not running | Set `SUPABASE_ACCESS_TOKEN` and `SUPABASE_PROJECT_ID` on first deploy |
| Mobile QR not scanning | Ensure phone and computer are on the same WiFi network |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile | Expo 54, React Native, Expo Router, react-native-track-player |
| Admin Panel | React 19, Vite, Tailwind CSS, Radix UI, Recharts |
| API Server | Node.js, Express, TypeScript, Pino logger |
| Database | Supabase (PostgreSQL + RLS + Auth + Storage + Realtime) |
| State | TanStack Query, React Context |
| Build | pnpm workspaces (monorepo), EAS Build (mobile) |
