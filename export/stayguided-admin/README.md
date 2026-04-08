# StayGuided — Admin Panel

এই ফোল্ডারে StayGuided-এর Admin Panel আছে। এটি একটি সম্পূর্ণ standalone React + Vite প্রজেক্ট — সরাসরি cPanel বা যেকোনো static hosting-এ deploy করা যাবে।

## এখানে যা যা করা যায়

- **কনটেন্ট** — Series, Episodes, Reciters, Categories যোগ/সম্পাদনা/মুছে ফেলা
- **ইউজার** — সব ইউজার দেখা, রোল পরিবর্তন, ব্যান/আনব্যান
- **অ্যানালিটিক্স** — প্লে কাউন্ট, জনপ্রিয় কনটেন্ট, ইউজার অ্যাক্টিভিটি
- **সাবস্ক্রিপশন** — প্ল্যান ম্যানেজ, প্রিমিয়াম দেওয়া/বাতিল, কুপন
- **নোটিফিকেশন** — পুশ নোটিফিকেশন ক্যাম্পেইন পাঠানো
- **মডারেশন** — কমেন্ট রিভিউ, রিপোর্ট হ্যান্ডল করা
- **ফিড ম্যানেজার** — অ্যাপে ব্যানার ও কনটেন্ট ইনজেক্ট করা
- **ফিচার ফ্ল্যাগ** — অ্যাপ ফিচার টগল করা (percentage-based rollout)
- **রেফারেল** — রেফারেল কোড ও রিওয়ার্ড ট্র্যাক করা

## ফোল্ডার স্ট্রাকচার

```
stayguided-admin/
├── src/
│   ├── pages/             ← ফিচার অনুযায়ী Admin পেজ
│   │   ├── content/       ← Reciters, Series, Episodes
│   │   ├── users/         ← ইউজার ম্যানেজমেন্ট
│   │   ├── analytics/     ← অ্যানালিটিক্স ও পরিসংখ্যান
│   │   ├── notifications/ ← পুশ নোটিফিকেশন
│   │   └── Dashboard.tsx  ← মূল ড্যাশবোর্ড
│   ├── components/        ← রিইউজেবল কম্পোনেন্ট
│   ├── contexts/          ← Auth context (RBAC সহ)
│   ├── lib/               ← Supabase ক্লায়েন্ট
│   └── main.tsx
├── public/                ← স্ট্যাটিক ফাইল
├── index.html             ← এন্ট্রি পয়েন্ট
├── vite.config.ts         ← Vite কনফিগারেশন (simplified)
├── tsconfig.json          ← TypeScript কনফিগারেশন (standalone)
├── package.json           ← Dependencies (সব catalog: resolved)
├── components.json        ← shadcn/ui কনফিগ
├── .env.example           ← Environment variables টেমপ্লেট
├── .htaccess              ← Apache SPA redirect (cPanel-এর জন্য)
└── README.md              ← এই ফাইল
```

## প্রয়োজনীয় সফটওয়্যার

- **Node.js** v18 বা তার উপরে
- **npm** বা **pnpm**

## সেটআপ (A-to-Z)

### ধাপ ১: Environment Variables সেট করুন

```bash
cp .env.example .env
```

`.env` ফাইল খুলে আপনার তথ্য দিন:
- `VITE_SUPABASE_URL` — আপনার Supabase প্রজেক্ট URL
- `VITE_SUPABASE_ANON_KEY` — Supabase anon/public key (Supabase Dashboard → Project Settings → API থেকে পাবেন)
- `VITE_API_BASE_URL` — API সার্ভারের URL (যেমন: https://api.example.com/api)

### ধাপ ২: Dependencies ইনস্টল

```bash
npm install
```

### ধাপ ৩: Development মোডে রান

```bash
npm run dev
```

ব্রাউজারে http://localhost:5173 খুলুন।

### ধাপ ৪: Production Build

```bash
npm run build
```

`dist/` ফোল্ডারে build output তৈরি হবে।

## Admin User তৈরি করা

মোবাইল অ্যাপে সাইন আপ করার পর, Supabase SQL Editor-এ এই SQL রান করুন:

```sql
-- Super admin (সব অ্যাক্সেস)
UPDATE profiles SET role = 'super_admin' WHERE email = 'your-email@example.com';

-- Regular admin
UPDATE profiles SET role = 'admin' WHERE email = 'your-email@example.com';
```

### রোল হায়ারার্কি

| রোল | অ্যাক্সেস |
|------|-----------|
| `super_admin` | সম্পূর্ণ অ্যাক্সেস — ইউজার, কনটেন্ট, সেটিংস, বিলিং |
| `admin` | কনটেন্ট, ইউজার, মডারেশন |
| `editor` | শুধু কনটেন্ট ম্যানেজমেন্ট |
| `content` | কনটেন্ট যোগ/সম্পাদনা (মুছতে পারবে না) |
| `support` | শুধু ইউজার দেখা ও মডারেশন |

## cPanel-এ Deploy করার নিয়ম

### পদ্ধতি ১: সরাসরি আপলোড

1. আপনার কম্পিউটারে `npm run build` করুন
2. `dist/` ফোল্ডারের ভিতরের **সব ফাইল** cPanel File Manager-এ `public_html/` (অথবা আপনার ডোমেইনের ফোল্ডার)-এ আপলোড করুন
3. `.htaccess` ফাইলটিও `public_html/`-এ আপলোড করুন (SPA routing-এর জন্য দরকার — ছাড়া পেজ রিলোডে 404 দেখাবে)

### পদ্ধতি ২: সাবডিরেক্টরিতে Deploy

যদি সাবডিরেক্টরিতে host করতে চান (যেমন: `example.com/admin/`):

1. `.env` ফাইলে `BASE_PATH=/admin/` সেট করুন
2. `npm run build` করুন
3. `dist/` ফোল্ডারের সব ফাইল cPanel-এ `public_html/admin/` ফোল্ডারে আপলোড করুন
4. `.htaccess` ফাইল `public_html/admin/`-এ রাখুন এবং ভিতরে পরিবর্তন করুন:
   - `RewriteBase /admin/`
   - `RewriteRule . /admin/index.html [L]`

### পদ্ধতি ৩: Netlify/Vercel-এ Deploy

1. GitHub-এ push করুন
2. Netlify/Vercel-এ নতুন প্রজেক্ট তৈরি করুন
3. Build command: `npm run build`
4. Publish directory: `dist`
5. Environment variables সেট করুন (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_API_BASE_URL)

## ডাটাবেস সেটআপ (যদি নতুন শুরু করেন)

Supabase SQL Editor-এ এই ফাইলগুলো রান করুন:

1. `admin_panel_setup.sql` — সম্পূর্ণ ডাটাবেস সেটআপ
2. `master_patches.sql` — সর্বশেষ প্যাচ ও RLS পলিসি

## সমস্যা সমাধান

| সমস্যা | সমাধান |
|---------|--------|
| npm install ব্যর্থ | Node.js v18+ ব্যবহার করুন |
| পেজ রিলোডে 404 | `.htaccess` ফাইল সঠিক জায়গায় আছে কিনা চেক করুন |
| "Supabase key missing" | `.env` ফাইলে `VITE_SUPABASE_ANON_KEY` সেট করুন |
| Admin লগইন হচ্ছে না | Supabase SQL Editor-এ `UPDATE profiles SET role='super_admin' WHERE email='...'` রান করুন |
| ডাটা দেখাচ্ছে না | Supabase RLS policies চেক করুন — `admin_panel_setup.sql` রান করুন |
| API error | API সার্ভার চালু আছে কিনা নিশ্চিত করুন, `VITE_API_BASE_URL` সঠিক কিনা দেখুন |
| TypeScript error | `npm run typecheck` চালিয়ে দেখুন কোথায় error আছে |
