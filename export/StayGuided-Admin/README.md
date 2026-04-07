# StayGuided Me — Admin Panel (Standalone)

React + Vite web admin panel। এই ফোল্ডারটি সম্পূর্ণ standalone।

---

## Admin Panel দিয়ে কী করা যাবে

- **Content**: Series, Episodes, Reciters, Categories যোগ/সম্পাদনা/মুছা
- **Users**: সব user দেখা, role পরিবর্তন, ban/unban
- **Analytics**: Play counts, popular content, user activity
- **Subscriptions**: Plans ও coupons manage করা
- **Gamification**: Badges, XP, leaderboard manage করা
- **Settings**: App সব settings control করা

---

## Option A — Replit এ Deploy করুন (সহজ)

### Step 1 — Supabase Anon Key নিন

1. https://supabase.com/dashboard খুলুন
2. Project: **tkruzfskhtcazjxdracm**
3. **Project Settings → API** → **anon / public** key কপি করুন

### Step 2 — Replit Secrets এ Key যোগ করুন

Replit এ বাম দিকে lock icon (Secrets) এ যান এবং যোগ করুন:

| Secret নাম | Value |
|------------|-------|
| `VITE_SUPABASE_URL` | `https://tkruzfskhtcazjxdracm.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | আপনার anon key |

### Step 3 — Deploy করুন

Replit এ **Deploy** বা **Publish** button চাপুন।

আপনার admin panel চলবে: `https://your-project.replit.app/admin`

---

## Option B — Local Development

### Prerequisites

- Node.js (v20+): https://nodejs.org

### Setup

```bash
# এই ফোল্ডারে `.env.local` ফাইল বানান
cp .env.example .env.local
```

`.env.local` edit করুন:
```
VITE_SUPABASE_URL=https://tkruzfskhtcazjxdracm.supabase.co
VITE_SUPABASE_ANON_KEY=আপনার-anon-key
```

### Install ও Run

```bash
npm install
npm run dev
```

Browser এ http://localhost:5173 খুলুন।

---

## Option C — cPanel / Web Hosting এ Deploy

```bash
npm install
npm run build
```

`dist/` ফোল্ডার তৈরি হবে। এই ফোল্ডারের সব ফাইল আপনার cPanel File Manager এ আপলোড করুন।

> **Note**: cPanel এ build করতে `VITE_SUPABASE_ANON_KEY` environment variable set করতে হবে।

---

## Login

- URL: আপনার deployed admin panel URL
- Email: `imranrir46@gmail.com`
- Password: আপনার Supabase Auth password

---

## ফোল্ডার Structure

```
StayGuided-Admin/
├── src/
│   ├── pages/          ← সব admin pages
│   │   ├── content/    ← Reciters, Series, Episodes
│   │   ├── users/      ← User management
│   │   ├── analytics/  ← Stats ও charts
│   │   └── settings/   ← App settings
│   ├── components/     ← Reusable components
│   ├── lib/
│   │   └── supabase.ts ← Supabase client
│   └── main.tsx        ← Entry point
├── public/             ← Static files
├── index.html
├── vite.config.ts      ← Build config
├── package.json
└── .env.example        ← Key template
```

---

## নতুন Admin User যোগ করুন

Supabase SQL Editor এ run করুন:

```sql
-- Admin access দিতে:
UPDATE profiles SET role = 'admin' WHERE email = 'new@email.com';

-- Super admin (সব access):
UPDATE profiles SET role = 'super_admin' WHERE email = 'new@email.com';
```

---

## Role Hierarchy

`super_admin` > `admin` > `editor` > `content` > `support`

---

## Common সমস্যা

| সমস্যা | সমাধান |
|--------|--------|
| "Supabase key missing" | `VITE_SUPABASE_ANON_KEY` set করুন |
| Login হচ্ছে না | Supabase Auth এ user আছে কিনা চেক করুন |
| Data save হচ্ছে না | Browser console এ error দেখুন |
| Content দেখা যাচ্ছে না | Mobile app এর `supabase/admin_panel_setup.sql` run করুন |
