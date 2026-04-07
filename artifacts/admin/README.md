# StayGuided Me — Admin Panel

React + Vite web admin panel for managing content, users, and analytics on the StayGuided Me platform.

---

## What You Can Do Here

- **Content** — Add/edit/delete Series, Episodes, Reciters, Categories
- **Users** — View all users, change roles, ban/unban accounts
- **Analytics** — Play counts, popular content, user activity, revenue
- **Subscriptions** — Manage plans, grant/revoke premium, coupons
- **Notifications** — Send push notification campaigns
- **Moderation** — Review and remove comments, handle reports
- **Feed Manager** — Remotely inject banners and content rows into the app
- **Feature Flags** — Toggle app features with percentage-based rollouts
- **Referrals** — Track referral codes and rewards

---

## Setup

### Step 1 — Environment Variables

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

```env
VITE_SUPABASE_URL=https://tkruzfskhtcazjxdracm.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

> Get your anon key: Supabase Dashboard → Project Settings → API → anon/public key

### Step 2 — Install & Run

```bash
# From the project root (two levels up):
pnpm install
BASE_PATH=/admin PORT=3001 pnpm --filter @workspace/admin run dev
```

Open http://localhost:3001/admin in your browser.

---

## Adding an Admin User

After signing up in the mobile app, run this SQL in Supabase SQL Editor:

```sql
-- Super admin (full access)
UPDATE profiles SET role = 'super_admin' WHERE email = 'your-email@example.com';

-- Regular admin
UPDATE profiles SET role = 'admin' WHERE email = 'your-email@example.com';
```

### Role Hierarchy

| Role | Access |
|------|--------|
| `super_admin` | Full access — users, content, settings, billing |
| `admin` | Content, users, moderation |
| `editor` | Content management only |
| `content` | Add/edit content (no delete) |
| `support` | View users and moderation only |

---

## Adding Content

### Via Admin Panel (Recommended)
1. Go to **Content → Reciters** → Add Reciter
2. Go to **Content → Series** → Add Series
3. Go to **Content → Episodes** → Add Episodes to a Series

### Via Supabase Dashboard
1. Go to https://supabase.com/dashboard
2. Select your project
3. Table Editor → edit `reciters`, `series`, `episodes` tables directly

---

## Database Setup (If Starting Fresh)

Run these files in Supabase SQL Editor (Dashboard → SQL Editor):

1. `artifacts/mobile/supabase/admin_panel_setup.sql` — full database setup
2. `artifacts/mobile/supabase/master_patches.sql` — latest patches and RLS policies

---

## Folder Structure

```
artifacts/admin/
├── src/
│   ├── pages/            # Admin pages by feature domain
│   │   ├── content/      # Reciters, Series, Episodes
│   │   ├── users/        # User management
│   │   ├── analytics/    # Analytics and stats
│   │   ├── notifications/# Push notification campaigns
│   │   └── Dashboard.tsx # Main dashboard
│   ├── components/       # Reusable components
│   ├── contexts/         # Auth context with RBAC
│   ├── lib/              # Supabase client
│   └── main.tsx
├── .env.example          # Environment variable template
├── vite.config.ts        # Vite build config
└── index.html
```

---

## Common Issues

| Problem | Solution |
|---------|----------|
| "Supabase key missing" | Set `VITE_SUPABASE_ANON_KEY` in `.env.local` |
| Can't log in as admin | Run `UPDATE profiles SET role='super_admin' WHERE email='...'` in Supabase SQL Editor |
| Data not showing | Check Supabase RLS policies — run `admin_panel_setup.sql` |
| API operations failing | Make sure API server is running and `VITE_API_BASE_URL` points to it |
