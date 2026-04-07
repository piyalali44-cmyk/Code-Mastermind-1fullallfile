# StayGuided Me — Islamic Audio Mobile App + Admin Panel

## Overview
A comprehensive Islamic audio mobile app (Expo/React Native) connected to Supabase (`tkruzfskhtcazjxdracm`), with a full-featured React + Vite admin panel. Features Qur'an listening, Islamic story library, a 20-chapter guided journey through Islamic history, gamification (XP, streaks, badges, leaderboard), freemium subscriptions, and a referral program.

## Architecture

### Artifacts
- `artifacts/mobile` — Expo React Native app (main product, `/mobile` preview path)
- `artifacts/admin` — React + Vite admin panel (`/admin/` preview path, port 23744)
- `artifacts/api-server` — Express API server (port 8080; used by mobile for auth/signup/OTP/contact/hadith API)
- `artifacts/mockup-sandbox` — Vite dev server for canvas mockups

### Supabase Project
- Project ID: `tkruzfskhtcazjxdracm`
- URL: `https://tkruzfskhtcazjxdracm.supabase.co`
- Env vars set (shared): `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`, `SUPABASE_URL`, `VITE_SUPABASE_URL`
- Admin panel uses Vite `define` in vite.config.ts to expose: `VITE_SUPABASE_ANON_KEY` (from `EXPO_PUBLIC_SUPABASE_ANON_KEY`) and `VITE_SUPABASE_SERVICE_KEY` (from `SUPABASE_SERVICE_ROLE_KEY`)
- API server uses Replit's built-in `DATABASE_URL` for local PostgreSQL (likes/comments tables) and Supabase JS client with `SUPABASE_SERVICE_ROLE_KEY` for all Supabase operations
- `VITE_API_BASE_URL` in admin panel dynamically resolves to `https://$REPLIT_DEV_DOMAIN/api`
- Mobile app `app.config.js` uses `REPLIT_DEV_DOMAIN` to set `EXPO_PUBLIC_API_BASE_URL` at startup
- **NOTE**: Direct PostgreSQL connections to Supabase (port 5432) are blocked from Replit; use Supabase JS client via REST API instead

### Database Status
- All migrations applied (complete_setup.sql, master_migration.sql, all patches)
- 46+ tables created including: profiles, series, episodes, user_xp, user_streaks, subscriptions, referrals, badges, leaderboard, etc.
- Super admin account: `imranrir46@gmail.com` (role: super_admin)
- **Subscription columns** (store, product_id, original_transaction_id) confirmed present ✅
- **profiles.push_token** column confirmed present ✅
- **Hadith badges** (hadith_start, hadith_10, hadith_40) seeded at every API server start ✅
- **episodes.image_url** column applied and exposed in admin episode editor ✅
- **Admin RPC functions** (admin_award_xp, admin_award_badge, apply_referral_code, redeem_code, etc.) all in master_patches.sql ✅

### Migration Files (cleaned up — only 2 root SQL files remain)
- `artifacts/mobile/supabase/admin_panel_setup.sql` — Comprehensive schema + RLS + functions (run in Supabase SQL Editor)
- `artifacts/mobile/supabase/fix_duplicates.sql` — Removes duplicate rows (run after admin_panel_setup.sql)
- `artifacts/mobile/supabase/migrations/` — Ordered migration history
- `artifacts/mobile/supabase/steps/` — Foundational setup steps

### API Server Schema Automation
At startup, `applySchemaPatches()` in `artifacts/api-server/src/lib/supabaseMigrations.ts` runs:

1. **RPC path (self-healing, preferred)** — calls `supabase.rpc('stayguided_apply_patches')`.
   The comprehensive RPC reapplies ALL patches on every restart using only the service-role key:
   columns, indexes, admin RLS policies, admin functions, coupon tables, referral functions, grants,
   badge/settings seeds. No personal access token needed once the function exists in DB.

2. **Management API fallback** — if the RPC function doesn't exist yet (fresh DB), applies
   master_patches.sql via `https://api.supabase.com/v1/projects/{ref}/database/query`.
   Requires `SUPABASE_ACCESS_TOKEN` (set as a Replit secret). After this first-run bootstrap,
   subsequent restarts use the RPC path exclusively.

3. **Data seeding (always runs)** — seeds hadith badges, lifetime_price_usd, and normalises
   referral codes to uppercase via the service-role client (works unconditionally).

4. **Schema status check** — checks required columns and logs any that are still missing.

- Schema health endpoint: `GET /api/health/schema` (requires `Authorization: Bearer <service-role-key>`)
- SQL statement splitting is dollar-quote-aware to handle `DO $$ ... $$;` and `$func$` blocks
- **No manual SQL execution required** — bootstrap is automatic via SUPABASE_ACCESS_TOKEN on fresh deploy.

---

## Admin Panel (`artifacts/admin`)

### Tech Stack
- React + Vite (TypeScript), Tailwind CSS v4, Radix UI components, Recharts, @dnd-kit/sortable, Sonner toasts, Wouter routing

### Theme
- Always dark: deep navy `#080F1C`, gold primary `#D4A030`, surface cards `#101825`/`#1A2535`
- CSS variables set in `src/index.css` — use `bg-background`, `text-primary`, `bg-card`, etc.

### Key Files
- `src/lib/supabase.ts` — ONE browser Supabase client:
  - `supabase` (anon key + RLS) — used for ALL data operations and user authentication
  - `supabaseAdmin` — exported as `null` (kept for backward-compatible imports); all privileged ops go via `/api/admin/*` server endpoints
- `src/lib/types.ts` — All TypeScript types (Profile, Category, Series, Episode, etc.)
- `src/lib/utils.ts` — `cn`, `maskEmail`, `formatDate`, `formatDateTime`, `formatRelative`, `formatDuration`
- `src/contexts/AuthContext.tsx` — Auth state (`useAuth()` returns user, profile, role, signIn, signOut, isAtLeast)
- `src/App.tsx` — All 30+ routes, lazy-loaded, guarded by RequireAuth

### Critical Architecture — Supabase Client Pattern
- `supabase` (anon key) handles BOTH auth AND data operations. After user signs in, their JWT is used with RLS policies.
- `supabaseAdmin` (service_role key) is ONLY used for `auth.admin` operations (inviting users, deleting users) — used in AdminUsers.tsx and UserDetail.tsx.
- Admin write access is controlled by RLS policies using `is_admin()` function that checks the user's role in profiles table.
- The `fix_admin_permissions.sql` must be run in Supabase to enable admin RLS policies.

### Responsive Design
- **Sidebar**: Mobile drawer + desktop collapsible with persistent state (localStorage); `SidebarProvider` context in `App.tsx`; `useSidebar()` hook; tooltips on collapsed icons; active indicator bar on nav items
- **AdminLayout**: Mobile hamburger menu, breadcrumbs, user avatar/initials dropdown (Portal-based); Cmd+K command palette search (role-filtered); responsive padding `p-3 md:p-6 lg:p-8`
- **Login page**: Glassmorphism card, gold gradient button, icon-embedded inputs, floating gold particles, logo pulse animation, entrance animation
- **Dashboard**: Responsive KPI grid (`grid-cols-2 md:grid-cols-3 xl:grid-cols-6`), staggered entrance animations, hover effects, loading skeletons

### Image Upload
- **ImageUpload component** (`src/components/ImageUpload.tsx`): Reusable component with Supabase Storage upload to `content-assets` bucket, drag-and-drop, URL paste fallback, preview, remove button
- Used in Categories (icon_url), Series (cover_url), Episodes (cover_override_url), Reciters (photo_url)
- Storage RLS: public read, admin-only write (checks `profiles` table with role IN admin/super_admin/editor/content)
- **All table pages**: Wrapped in `overflow-x-auto` for horizontal scrolling on mobile; UsersList has mobile card view + desktop table
- **Page titles**: All use responsive `text-xl md:text-2xl` font sizing
- **CSS**: Global transitions, mobile utilities, gold selection color in `index.css`
- **Revenue tracking**: Dashboard + Analytics both show revenue from subscriptions (weekly/monthly plans) with date range picker; data from `subscriptions` table + `app_settings` prices; only counts `status=active` subscriptions where `provider != 'admin'`; admin-granted shown separately
- **User Tier Split**: Analytics pie chart redesigned with side legend, proper colors, percentage labels
- **Grant Premium**: Plan selector (Weekly/Monthly/Lifetime) with auto-date calculation; lifetime = no expiry (NULL `expires_at`); expiry preview shown in dialog; admin-granted subscriptions marked with `provider='admin'`
- **UserDetail**: Shows "Granted" badge, plan type, expiry info ("never expires" for lifetime); Edit Name, Reset Password, Grant/Revoke Premium with error handling

### Status: FULLY BUILT — all 30 pages wired to Supabase, zero TypeScript errors
- **AuthContext**: Fixed — queries `from("profiles").eq("id", userId)`, handles stale `refresh_token_not_found` errors gracefully
- **Login**: Create admin user in Supabase Auth, then update role to `super_admin` in profiles table
- **DialogContent warning**: Fixed — `aria-describedby={undefined}` suppresses Radix UI warning
- **Admin block/premium fallbacks**: `UserDetail.tsx` falls back to direct table updates if RPCs don't exist

### Critical Pattern — Supabase Query Builder
- Supabase `from(...).insert/update/upsert/delete(...)` returns a thenable (NOT a real Promise)
- **NEVER** use `.catch()` on these — use `.then(() => {}, () => {})` for fire-and-forget
- **ALWAYS** await or `.then()` these calls

### Database Key Names (app_settings)
- Subscription: `weekly_price_usd`, `monthly_price_usd`, `trial_days`, `trial_enabled`
- XP: `xp_per_episode`, `xp_per_surah`, `xp_daily_login`, `xp_streak_multiplier`, `streak_grace_hours`
- Referral: `referrer_xp_reward`, `referred_xp_reward`, `referral_enabled`, `referral_code_prefix`, `max_referrals_per_user`
- Guest: `guest_access_enabled`, `guest_can_listen`, `guest_can_browse`, `guest_episode_limit`, `guest_prompt_register`
- Downloads: `max_downloads_free`, `max_downloads_premium`, `download_wifi_only_default`, `download_expiry_days`
- Appearance: `app_name`, `maintenance_mode`, `maintenance_message`, `force_update_version`, `ramadan_mode`
- Quran: `default_reciter`, `default_translation`, `show_arabic_default`, `show_translation_default`, `quran_streaming_quality`, `quran_download_quality`

### Pages Built (22-section PRD coverage)
| Section | Files |
|---------|-------|
| Auth | `pages/Login.tsx` |
| Layout | `components/AdminLayout.tsx`, `components/Sidebar.tsx` |
| Dashboard | `pages/Dashboard.tsx` — KPI cards, activity log, user growth chart |
| Content | `pages/content/Categories.tsx`, `Series.tsx`, `Episodes.tsx`, `Reciters.tsx`, `ContentReports.tsx` |
| Journey | `pages/journey/JourneyTimeline.tsx` — drag-drop @dnd-kit |
| Feed | `pages/feed/FeedManager.tsx`, `WidgetInjection.tsx` |
| Users | `pages/users/UsersList.tsx`, `UserDetail.tsx` |
| Monetization | `pages/monetization/SubscriptionPlans.tsx`, `Coupons.tsx`, `DonationSettings.tsx` |
| Gamification | `pages/gamification/QuizBuilder.tsx`, `BadgeManager.tsx`, `Leaderboard.tsx` |
| Notifications | `pages/notifications/PushNotifications.tsx`, `PopupsNoticeBar.tsx`, `ContactMessages.tsx` |
| Analytics | `pages/analytics/Analytics.tsx` |
| Settings | `pages/settings/FeatureFlags.tsx`, `AppSettingsGuest.tsx`, `AppSettingsQuran.tsx`, `AppSettingsSubscription.tsx`, `AppSettingsDownloads.tsx`, `AppSettingsXP.tsx`, `AppSettingsAppearance.tsx`, `ReferralSettings.tsx`, `ApiSources.tsx`, `RateLimiting.tsx`, `RamadanMode.tsx` |
| Admin | `pages/admin/AdminUsers.tsx`, `ActivityLog.tsx` |

### Role Hierarchy & RBAC
`super_admin` > `admin` > `editor` > `content` > `support`

| Section | support | content | editor | admin | super_admin |
|---|:---:|:---:|:---:|:---:|:---:|
| Dashboard | ✓ | ✓ | ✓ | ✓ | ✓ |
| Content/Journey/Hadith | ✗ | ✓ | ✓ | ✓ | ✓ |
| Home Feed/Gamification | ✗ | ✗ | ✓ | ✓ | ✓ |
| Users | ✓(read) | ✗ | ✗ | ✓ | ✓ |
| Monetization | ✗ | ✗ | ✗ | ✓ | ✓ |
| Push/Popups Notifications | ✗ | ✗ | ✓ | ✓ | ✓ |
| Contact Messages | ✓ | ✗ | ✓ | ✓ | ✓ |
| Analytics | ✓ | ✓ | ✓ | ✓ | ✓ |
| Settings (basic) | ✗ | ✗ | ✗ | ✓ | ✓ |
| Settings (advanced) | ✗ | ✗ | ✗ | ✗ | ✓ |
| Admin Users | ✗ | ✗ | ✗ | ✗ | ✓ |
| Activity Log | ✗ | ✗ | ✗ | ✓ | ✓ |

**Role Assignment:**
- `AdminUsers.tsx`: Search existing registered user by email/name → assign role directly (no email invite needed)
- `UserDetail.tsx`: "Admin Role ও Permissions" card — assign/change role for any user from their profile
- Both log to `admin_activity_log`
- `protect_role_column()` trigger prevents non-admin users from self-promoting via RLS

**Route Protection:** `RequirePermission` component wraps sensitive routes (minRole="admin" for monetization/settings, minRole="super_admin" for staff/users and advanced settings)

- Every write action logs to `admin_activity_log`

### Critical Patterns
```ts
// Supabase data: import { supabase } from "@/lib/supabase"
// Supabase auth.admin: import { supabaseAdmin } from "@/lib/supabase"
// Auth: const { profile, role, isAtLeast } = useAuth()
// Toast: import { toast } from "sonner"
// App settings: supabase.from('app_settings').upsert({ key, value })
// Activity log: required on EVERY write
// toast.success("Setting saved — app will update within 30 minutes") for app_settings
```

### SQL Files (in `artifacts/mobile/supabase/`)
- `full_setup.sql` — **Single source of truth** — ALL tables, functions, views, RLS, seed data (1681 lines). Run once for fresh install.
- `migration_patch.sql` — **Minimal patch** — Only the missing functions + backfills. Run this if full_setup.sql was already partially applied. Safe to run multiple times.
- `setup.sql` — Core mobile tables + functions (profiles, XP, streaks, badges, referrals, leaderboards, avatars storage)
- `admin_setup.sql` — Admin panel tables + extensions (categories, series, episodes, reciters, app_settings, feature_flags, coupons, popups, push campaigns, donations, API sources, admin notes)
- `fix_admin_permissions.sql` — Adds `is_admin()` + admin RLS policies so authenticated admins can manage content
- `fix_subscription.sql` — Fixes subscription constraints + admin_grant/revoke_premium functions
- `migrate_weekly_monthly.sql` — Migration from annual→weekly plans (already applied, kept for reference)
- `seed_content.sql` — Sample content: categories, reciters, series, episodes, feature flags
- `reset.sql` — Drops ALL tables/functions/views for clean slate (run before full_setup.sql)
- `schema.sql` — DEPRECATED — use full_setup.sql instead

### Environment Variables (all stored as Secrets)
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key (mobile + admin)
- `SUPABASE_ANON_KEY` — Same key, used by API server
- `SUPABASE_SERVICE_ROLE_KEY` — Service role key (admin ops + API server)
- `SUPABASE_DB_URL` — Direct PostgreSQL connection string
- `SUPABASE_ACCESS_TOKEN` — Supabase CLI access token
- `EXPO_PUBLIC_API_BASE_URL` + `EXPO_PUBLIC_API_URL` — API server URL (both set to same value)
- `EXPO_PUBLIC_SUPABASE_URL` / `VITE_SUPABASE_URL` / `SUPABASE_URL` — Supabase project URL

### Workflow Status (all 4 running)
- `artifacts/admin: web` — Port 23744, path /admin/
- `artifacts/api-server: API Server` — Port 8080, path /api
- `artifacts/mobile: expo` — Port 18115, path /
- `artifacts/mockup-sandbox: Component Preview Server` — Port 8081, path /__mockup

### Database Functions
All required database functions are included in `master_patches.sql` and applied automatically:
- `apply_referral_code` — mobile referral code redemption (authenticated)
- `process_referral_by_id` — API server referral processing (service role)
- `admin_award_xp`, `admin_award_badge`, `admin_revoke_badge` — admin gamification management
- `redeem_code` — unified coupon + referral code redemption
- `check_and_award_badges`, `award_badge` — automatic badge awarding on progress
- `stayguided_apply_patches` — self-healing startup migration RPC

Fallbacks remain in place for functions from earlier setup:
- `admin_block_user/unblock/grant/revoke` → `UserDetail.tsx` direct profile + subscriptions updates
- `check_and_award_badges` → fails silently if not yet applied (no impact on core flow)

### ⚠️ One-time Manual Steps (if not already applied)
- **Quiz attempts table**: Run `artifacts/mobile/supabase/quiz_attempts_table.sql` in Supabase SQL Editor
- **Enable Realtime**: Run `artifacts/mobile/supabase/enable_realtime.sql` in Supabase SQL Editor

### Realtime Subscriptions
- **Mobile App**: ContentContext (series/episodes), AuthContext (profiles/user_xp/user_streaks), AppSettingsContext (app_settings/feature_flags/popup_notices), Notifications screen
- **Admin Panel**: Dashboard (profiles/episodes/series/subscriptions/activity_log), Categories, Series, Episodes, UsersList (profiles), Transactions (subscriptions)

### Key RLS Notes
- `app_settings` and `feature_flags` allow **anon** SELECT (guest users need maintenance_mode, pricing, etc.)
- Admin write access uses `is_admin()` function checking profiles.role
- `protect_role_column()` trigger prevents non-admin users from self-promoting

---

## Mobile App (`artifacts/mobile`)

### Structure
```
app/
  _layout.tsx          — Root layout with all providers + PersistentChrome overlay
  index.tsx            — Entry redirect (onboarding / login / tabs)
  onboarding.tsx       — 3-slide onboarding
  login.tsx            — Login + Signup + Guest + Google OAuth + Apple Sign-In
  player.tsx           — Full-screen audio player (stack, not modal)
  journey.tsx          — "Complete Story of Islam" timeline (20 chapters)
  search.tsx           — Search surahs and series
  progress.tsx         — XP, levels, streak, badges, weekly chart
  subscription.tsx     — Premium plans (Weekly $0.99 / Monthly $4.99)
  leaderboard.tsx      — Global XP leaderboard
  settings.tsx         — Settings with persisted toggles
  edit-profile.tsx     — Edit profile (display name, bio, avatar via expo-image-picker)
  reset-password.tsx   — 3-step OTP flow (Supabase recovery token)
  contact.tsx          — Contact us (paddingBottom: hasMiniplayer ? 148 : 108)
  privacy-policy.tsx   — Privacy policy (same padding pattern)
  terms.tsx            — Terms of service (same padding pattern)
  (tabs)/
    _layout.tsx        — Tabs (PersistentChrome handles tab bar)
    index.tsx          — Home tab
    quran.tsx          — Qur'an tab (114 surahs, searchable)
    library.tsx        — Library tab (6 sub-tabs)
    profile.tsx        — Profile tab
  quran/[id].tsx       — Surah detail with translation picker
  series/[id].tsx      — Series detail with episode list
  quiz/index.tsx       — Quiz listing screen (active quizzes from DB)
  quiz/[id].tsx        — Quiz-taking screen (questions, scoring, XP award on pass)

context/
  AuthContext.tsx       — Auth state via Supabase
  AudioContext.tsx      — Audio player state via expo-av (autoAdvance via playNextRef + userIdRef)
  ContentContext.tsx    — Series + Episodes from Supabase (replaces mock data, falls back to MOCK_SERIES if DB empty)
  UserActionsContext.tsx — Favourites, bookmarks, downloads (AsyncStorage)
```

### Content Data Flow (Admin → DB → Mobile)
- Admin panel writes series/episodes to Supabase via RLS (`is_admin()`)
- `ContentContext` fetches published series + episodes from Supabase on mobile app launch
- All screens (Home, Series Detail, Library, Search, Popular, Player) read from ContentContext
- If DB has no published series, falls back to mock data for development
- Provider hierarchy: `AuthProvider > AppSettingsProvider > UserActionsProvider > ContentProvider > AudioProvider`
- `AppSettingsContext` fetches remote config (maintenance_mode, guest_access, pricing, trial settings)
- Maintenance mode: globally enforced in `_layout.tsx` — blocks ALL routes when enabled
- Guest access: controlled remotely via `guest_access_enabled` setting — hides guest button + forces logout if disabled
- Settings > Subscription in admin redirects to Monetization > Plans (single source of truth)

### SQL Migrations
- `artifacts/mobile/supabase/complete_setup.sql` — full DB schema (run first if DB is fresh)
- `artifacts/mobile/supabase/master_migration.sql` — **CONSOLIDATED** migration: library tables, coupon_redemptions, admin RLS policies, redeem_code() RPC function, push_token column, referral_code backfill (run this after complete_setup)
- Individual files: `fix_redeem_system.sql`, `fix_library_tables.sql`, `fix_admin_permissions.sql` (superseded by master_migration.sql)

### Key Rules
- **Qur'an is ALWAYS FREE** — `canPlaySurah()` always returns true
- Referral code = `SG` + first 6 uppercase hex chars of UUID
- Level formula: `Math.floor(xp / 500) + 1`
- Bottom chrome (PersistentChrome) always visible except on onboarding/login
- ABOUT pages (contact, privacy-policy, terms) use `useAudio()` for `hasMiniplayer` padding

## Design System
- Background: `#080F1C` (deep navy)
- Primary Gold: `#B8860E` / `#D4A030`
- Green: `#15803D`
- Surface: `#101825`, `#1A2535`
- Typography: Inter (400/500/600/700)

## Installed Packages (mobile)
- `lucide-react-native` — SVG icons
- `expo-av` — audio playback
- `expo-linear-gradient` — gradient backgrounds
- `expo-blur` — tab bar blur
- `expo-clipboard` — clipboard for share
- `@react-native-async-storage/async-storage` — local persistence
- `@expo-google-fonts/inter` — typography
- `@supabase/supabase-js` — Supabase client

## Installed Packages (admin)
- `@supabase/supabase-js` — Supabase client
- `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` — drag-and-drop
- `recharts` — analytics charts
- `sonner` — toast notifications
- Full Radix UI component library
