# StayGuided Me — Admin Panel

React + Vite web admin panel for managing content, users, and analytics on the StayGuided Me platform.

---

## What You Can Do Here

- **Content**: Add/edit/delete Series, Episodes, Reciters, Categories
- **Users**: View all users, change roles, ban/unban
- **Analytics**: Play counts, popular content, user activity
- **Subscriptions**: Manage plans and coupons
- **Referrals**: Track referral codes and rewards

---

## Running on Replit (Recommended)

This admin panel is already set up and running in your Replit project. No extra setup needed — just deploy it.

### Step 1 — Add Supabase Secrets

In Replit, go to **Secrets** (lock icon in left sidebar) and add:

| Secret Name | Value |
|-------------|-------|
| `VITE_SUPABASE_URL` | `https://tkruzfskhtcazjxdracm.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon key |

> To get the anon key: Supabase Dashboard → Project Settings → API → anon/public key

### Step 2 — Deploy on Replit

1. Click the **Deploy** button (or "Publish") in Replit
2. Your admin panel will be available at `https://your-project.replit.app/admin`
3. Log in with your admin email: `imranrir46@gmail.com`

---

## Running Locally (Development)

### Prerequisites

- Node.js (v20+)
- pnpm: `npm install -g pnpm`

### Setup

```bash
# From this folder (artifacts/admin/)
cp .env.example .env.local
```

Edit `.env.local`:
```
VITE_SUPABASE_URL=https://tkruzfskhtcazjxdracm.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### Install & Run

```bash
# From the project root (two levels up):
pnpm install
pnpm --filter @workspace/admin run dev
```

Open http://localhost:PORT in your browser.

---

## Folder Structure

```
artifacts/admin/
├── src/
│   ├── pages/            # All admin pages
│   │   ├── content/      # Reciters, Series, Episodes management
│   │   ├── users/        # User management
│   │   ├── analytics/    # Analytics & stats
│   │   └── Dashboard.tsx # Main dashboard
│   ├── components/       # Reusable components (Sidebar, DataTable, etc.)
│   ├── lib/              # Supabase client
│   └── main.tsx          # App entry point
├── public/               # Static assets
├── .env.example          # Environment variable template
├── vite.config.ts        # Vite build config
└── index.html            # HTML entry point
```

---

## Adding a New Admin User

Run this SQL in Supabase SQL Editor (Dashboard → SQL Editor):

```sql
UPDATE profiles
SET role = 'admin'
WHERE email = 'new-admin@email.com';
```

For super admin (full access):
```sql
UPDATE profiles
SET role = 'super_admin'
WHERE email = 'new-admin@email.com';
```

---

## Adding Content

### Method 1: Admin Panel (Recommended)
1. Open the admin panel
2. Go to **Content → Reciters** → Add Reciter
3. Go to **Content → Series** → Add Series
4. Go to **Content → Episodes** → Add Episodes to a Series

### Method 2: Supabase Dashboard
1. Go to https://supabase.com/dashboard
2. Select project **tkruzfskhtcazjxdracm**
3. Go to **Table Editor**
4. Edit tables directly: `reciters`, `series`, `episodes`

---

## Common Issues

| Problem | Solution |
|---------|----------|
| "Supabase key missing" error | Add `VITE_SUPABASE_ANON_KEY` to Replit Secrets |
| Can't log in as admin | Run `UPDATE profiles SET role='super_admin' WHERE email='imranrir46@gmail.com'` in Supabase SQL Editor |
| Data not showing | Check Supabase RLS policies — run `admin_panel_setup.sql` from mobile app's supabase folder |
| Changes not saving | Check browser console for error messages |

---

## Database Setup

If you're starting fresh, run these in Supabase SQL Editor:

1. `artifacts/mobile/supabase/admin_panel_setup.sql` — Full database setup
2. `artifacts/mobile/supabase/fix_duplicates.sql` — Clean duplicate rows
