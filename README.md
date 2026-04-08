# StayGuided Me — সম্পূর্ণ সেটাপ গাইড (বাংলা)

> **ধর্মীয় ইসলামিক অডিও কন্টেন্ট অ্যাপ** — Expo (React Native) মোবাইল অ্যাপ, React অ্যাডমিন প্যানেল এবং Node.js/Express API সার্ভার — Supabase দিয়ে চালিত।

---

## বিষয়সূচি

1. [প্রজেক্ট কী কী আছে](#১-প্রজেক্ট-কী-কী-আছে)
2. [শুরুর আগে যা লাগবে](#২-শুরুর-আগে-যা-লাগবে)
3. [ধাপ ১ — Supabase প্রজেক্ট তৈরি ও ডেটাবেস সেটাপ](#ধাপ-১--supabase-প্রজেক্ট-তৈরি-ও-ডেটাবেস-সেটাপ)
4. [ধাপ ২ — API সার্ভার সেটাপ](#ধাপ-২--api-সার্ভার-সেটাপ)
5. [ধাপ ৩ — Admin প্যানেল সেটাপ](#ধাপ-৩--admin-প্যানেল-সেটাপ)
6. [ধাপ ৪ — মোবাইল অ্যাপ বিল্ড ও পাবলিশ](#ধাপ-৪--মোবাইল-অ্যাপ-বিল্ড-ও-পাবলিশ)
7. [Environment Variables সম্পূর্ণ তালিকা](#environment-variables-সম্পূর্ণ-তালিকা)
8. [প্রথমবার Admin একাউন্ট তৈরি](#প্রথমবার-admin-একাউন্ট-তৈরি)
9. [সাধারণ সমস্যা ও সমাধান](#সাধারণ-সমস্যা-ও-সমাধান)
10. [গুরুত্বপূর্ণ ফাইলের তালিকা](#গুরুত্বপূর্ণ-ফাইলের-তালিকা)

---

## ১. প্রজেক্ট কী কী আছে

```
stayguided/
├── artifacts/
│   ├── mobile/          ← Expo React Native মোবাইল অ্যাপ (iOS + Android)
│   ├── api-server/      ← Node.js/Express API সার্ভার
│   └── admin/           ← React অ্যাডমিন প্যানেল (web)
├── supabase/
│   └── migrations/      ← Supabase SQL migration ফাইলগুলো
└── README.md            ← এই ফাইল
```

**তিনটি আলাদা অংশ:**

| অংশ | কাজ | ব্যবহারকারী |
|-----|-----|------------|
| **মোবাইল অ্যাপ** | ব্যবহারকারীরা কন্টেন্ট শোনে, Quran Player, Gamification | সবাই |
| **Admin প্যানেল** | কন্টেন্ট আপলোড, ব্যবহারকারী পরিচালনা, Feature Flags | শুধু Admin |
| **API সার্ভার** | মোবাইল ও Admin-এর মাঝে ডেটা আদান-প্রদান, Push Notification | স্বয়ংক্রিয় |

---

## ২. শুরুর আগে যা লাগবে

- **Supabase একাউন্ট** — বিনামূল্যে: [supabase.com](https://supabase.com)
- **Node.js v20+** — [nodejs.org](https://nodejs.org) থেকে ডাউনলোড করুন
- **pnpm** — `npm install -g pnpm` দিয়ে ইন্সটল করুন
- **Expo EAS Account** (মোবাইল বিল্ডের জন্য) — [expo.dev](https://expo.dev)
- **Apple Developer Account** (iOS পাবলিশের জন্য) — [developer.apple.com](https://developer.apple.com)
- **Google Play Console** (Android পাবলিশের জন্য) — [play.google.com/console](https://play.google.com/console)

---

## ধাপ ১ — Supabase প্রজেক্ট তৈরি ও ডেটাবেস সেটাপ

### ১.১ নতুন Supabase প্রজেক্ট তৈরি করুন

1. [supabase.com](https://supabase.com) → **Start your project** → Sign In
2. **New project** বাটনে ক্লিক করুন
3. নাম দিন: `stayguided-me`, পাসওয়ার্ড দিন (মনে রাখুন), Region: Singapore বা কাছের যেটা ভালো

### ১.২ API Keys নিন

`Project Settings` → `API` → এখান থেকে নিন:

| Key | কোথায় পাবেন |
|-----|------------|
| **Project URL** | `https://xxxx.supabase.co` |
| **anon/public key** | API Keys সেকশনে |
| **service_role key** | API Keys সেকশনে (গোপন রাখুন) |
| **Database Connection String** | `Project Settings` → `Database` → `Connection string (URI)` |

### ১.৩ SQL Migration চালান

**SQL Editor** খুলুন (বাম দিকের মেনু থেকে `SQL Editor`)

**প্রথমে** `supabase/migrations/20260401_complete_setup.sql` ফাইলের পুরো কন্টেন্ট কপি করুন → SQL Editor-এ পেস্ট করুন → **Run** চাপুন।

**তারপর একে একে** এই ফাইলগুলো একইভাবে চালান (উপর থেকে নিচে ক্রমে):

```
supabase/migrations/20260405_fix_admin_permissions.sql
supabase/migrations/20260406_likes_comments_blocking.sql
supabase/migrations/20260407_quiz_system.sql
supabase/migrations/20260407_quiz_sample_data.sql
supabase/migrations/20260407_missing_feature_flags.sql
supabase/migrations/20260407_content_reports_enhancements.sql
supabase/migrations/20260407_subscription_production.sql
supabase/migrations/20260408_rate_app_flag.sql
supabase/migrations/20260409_schema_fixes.sql
```

প্রতিটি ফাইল Run করার পর `Success` বা সবুজ টিক দেখলে পরেরটা করুন।

### ১.৪ Admin SQL Setup চালান (অত্যন্ত গুরুত্বপূর্ণ)

```
artifacts/mobile/supabase/admin_panel_setup.sql
```

এই ফাইলটিও SQL Editor-এ চালান। এটা `stayguided_apply_patches()` নামের একটি স্বয়ংক্রিয় function তৈরি করে — API সার্ভার প্রতিবার চালু হলে এটি ডেটাবেস নিজেই ঠিক করে নেয়।

---

## ধাপ ২ — API সার্ভার সেটাপ

### ২.১ .env ফাইল তৈরি করুন

`artifacts/api-server/` ফোল্ডারে যান:

```bash
cp artifacts/api-server/.env.example artifacts/api-server/.env
```

`.env` ফাইল খুলুন এবং পূরণ করুন:

```env
PORT=8080
NODE_ENV=production

SUPABASE_URL=https://আপনার-প্রজেক্ট-id.supabase.co
SUPABASE_ANON_KEY=আপনার-anon-key
SUPABASE_SERVICE_ROLE_KEY=আপনার-service-role-key
DATABASE_URL=postgresql://postgres:পাসওয়ার্ড@db.আপনার-প্রজেক্ট-id.supabase.co:5432/postgres

# ঐচ্ছিক — প্রথমবার deploy-এ ডেটাবেস auto-setup করতে
SUPABASE_ACCESS_TOKEN=আপনার-supabase-personal-access-token
SUPABASE_PROJECT_ID=আপনার-প্রজেক্ট-id
```

`SUPABASE_ACCESS_TOKEN` কোথায় পাবেন:
[supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens) → **Generate new token**

### ২.২ চালু করুন

```bash
pnpm install
pnpm --filter @workspace/api-server run dev
```

চালু হলে দেখবেন:
```
[INFO] Server listening  port: 8080
```

### ২.৩ Production Deploy

Railway, Render, Fly.io, বা নিজের VPS-এ:

```bash
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/api-server run start
```

Deploy করার পর আপনার API URL হবে: `https://আপনার-সার্ভার.com`

---

## ধাপ ৩ — Admin প্যানেল সেটাপ

### ৩.১ .env.local ফাইল তৈরি করুন

```bash
cp artifacts/admin/.env.example artifacts/admin/.env.local
```

`.env.local` পূরণ করুন:

```env
VITE_SUPABASE_URL=https://আপনার-প্রজেক্ট-id.supabase.co
VITE_SUPABASE_ANON_KEY=আপনার-anon-key
```

### ৩.২ Development-এ চালু করুন

```bash
pnpm --filter @workspace/admin run dev
```

Browser-এ খুলুন: `http://localhost:5173/admin/`

### ৩.৩ Production Build ও Deploy

```bash
pnpm --filter @workspace/admin run build
```

`artifacts/admin/dist/` ফোল্ডারটি Netlify, Vercel, বা Cloudflare Pages-এ আপলোড করুন।

> Static hosting-এ `/admin/*` সব route `index.html`-এ redirect করতে হবে।

---

## ধাপ ৪ — মোবাইল অ্যাপ বিল্ড ও পাবলিশ

### ৪.১ .env ফাইল তৈরি করুন

```bash
cp artifacts/mobile/.env.example artifacts/mobile/.env
```

পূরণ করুন:

```env
EXPO_PUBLIC_SUPABASE_URL=https://আপনার-প্রজেক্ট-id.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=আপনার-anon-key
EXPO_PUBLIC_API_BASE_URL=https://আপনার-api-সার্ভার.com/api
```

### ৪.২ Local Development (কম্পিউটারে চালু করুন)

```bash
pnpm --filter @workspace/mobile run dev:local
```

- **iOS**: iPhone-এ Expo Go অ্যাপ → QR Code স্ক্যান
- **Android**: Expo Go অ্যাপ → Scan QR Code

### ৪.৩ App Store / Play Store-এ পাবলিশ

```bash
npm install -g eas-cli
eas login
cd artifacts/mobile
eas build --platform ios      # iOS বিল্ড
eas build --platform android  # Android বিল্ড
```

### ৪.৪ iOS App Store ID পাওয়ার পর

App Store-এ সাবমিট করার পর numeric App ID পাবেন (যেমন: `1234567890`।

`artifacts/mobile/app/settings.tsx` ফাইলে এই লাইন আপডেট করুন:

```typescript
const IOS_STORE_URL = "itms-apps://itunes.apple.com/app/id1234567890?action=write-review";
```

---

## Environment Variables সম্পূর্ণ তালিকা

### API সার্ভার (`artifacts/api-server/.env`)

| Variable | বাধ্যতামূলক | কোথায় পাবেন |
|----------|------------|------------|
| `PORT` | না (default 8080) | যেকোনো সংখ্যা |
| `NODE_ENV` | না | `production` বা `development` |
| `SUPABASE_URL` | **হ্যাঁ** | Supabase → Project Settings → API |
| `SUPABASE_ANON_KEY` | **হ্যাঁ** | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | **হ্যাঁ** | Supabase → Project Settings → API |
| `DATABASE_URL` | **হ্যাঁ** | Supabase → Project Settings → Database |
| `SUPABASE_ACCESS_TOKEN` | ঐচ্ছিক | supabase.com/dashboard/account/tokens |
| `SUPABASE_PROJECT_ID` | ঐচ্ছিক | Supabase URL-এর মাঝের অংশ |
| `ALLOWED_ORIGINS` | ঐচ্ছিক | Admin ও App-এর URL (comma separated) |
| `APPLE_BUNDLE_ID` | ঐচ্ছিক | iOS subscription-এর জন্য |
| `APPLE_SHARED_SECRET` | ঐচ্ছিক | iOS subscription-এর জন্য |

### Admin প্যানেল (`artifacts/admin/.env.local`)

| Variable | বাধ্যতামূলক | কোথায় পাবেন |
|----------|------------|------------|
| `VITE_SUPABASE_URL` | **হ্যাঁ** | Supabase → Project Settings → API |
| `VITE_SUPABASE_ANON_KEY` | **হ্যাঁ** | Supabase → Project Settings → API |
| `VITE_API_BASE_URL` | ঐচ্ছিক | আলাদা domain হলে API সার্ভারের URL |

### মোবাইল অ্যাপ (`artifacts/mobile/.env`)

| Variable | বাধ্যতামূলক | কোথায় পাবেন |
|----------|------------|------------|
| `EXPO_PUBLIC_SUPABASE_URL` | **হ্যাঁ** | Supabase → Project Settings → API |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | **হ্যাঁ** | Supabase → Project Settings → API |
| `EXPO_PUBLIC_API_BASE_URL` | **হ্যাঁ** | Deploy করা API সার্ভারের URL + `/api` |

---

## প্রথমবার Admin একাউন্ট তৈরি

1. মোবাইল অ্যাপে বা Admin প্যানেলে **Sign Up** করুন
2. Supabase → **Table Editor** → `profiles` টেবিলে যান
3. আপনার user খুঁজুন → `role` কলামে `super_admin` দিন → Save করুন
4. Admin প্যানেলে আবার লগইন করুন — এখন সব কিছু দেখা যাবে

---

## সাধারণ সমস্যা ও সমাধান

**SQL run করতে গেলে error আসছে:**
Migration ফাইলগুলো ক্রম মেনে চালান। `20260401_complete_setup.sql` সবার আগে চালাতে হবে।

**API সার্ভার চালু হচ্ছে না:**
`.env` ফাইলে সব key ঠিকঠাক আছে কিনা দেখুন। `DATABASE_URL`-এ পাসওয়ার্ডে বিশেষ চিহ্ন থাকলে URL-encode করুন (`@` → `%40`)।

**Admin প্যানেলে login হচ্ছে না:**
`.env.local`-এ Supabase URL ও anon key ঠিক আছে কিনা দেখুন। Supabase Authentication-এ email confirmation বন্ধ করুন।

**মোবাইল অ্যাপে content দেখাচ্ছে না:**
`EXPO_PUBLIC_API_BASE_URL` ঠিক আছে কিনা দেখুন (শেষে `/api` থাকতে হবে)। API সার্ভার চালু আছে কিনা দেখুন।

**Push Notification কাজ করছে না:**
Expo Go-তে push notification কাজ করে না। EAS Build দিয়ে production build তৈরি করে test করুন।

**Feature Flags দেখা যাচ্ছে না:**
Admin প্যানেলে **Settings → Feature Flags** page খুলুন — এটি খুললেই সব flags স্বয়ংক্রিয়ভাবে তৈরি হয়। বা `supabase/migrations/20260407_missing_feature_flags.sql` চালান।

---

## গুরুত্বপূর্ণ ফাইলের তালিকা

| ফাইল | কাজ |
|------|-----|
| `artifacts/mobile/app.json` | অ্যাপের নাম, Bundle ID, version, Deep Link origin |
| `artifacts/mobile/app/settings.tsx` | iOS App Store ID — publish করার পর এখানে বদলাবেন |
| `artifacts/api-server/.env` | API সার্ভারের সব secret key |
| `artifacts/admin/.env.local` | Admin প্যানেলের Supabase keys |
| `artifacts/mobile/.env` | মোবাইল অ্যাপের Supabase ও API URL |
| `artifacts/mobile/supabase/admin_panel_setup.sql` | সম্পূর্ণ ডেটাবেস schema — একবারই চালাতে হয় |
| `supabase/migrations/` | সব SQL migration ফাইল — ক্রমে চালাতে হবে |

---

## সংক্ষিপ্ত চেকলিস্ট

```
 Supabase প্রজেক্ট তৈরি করেছি
 সব SQL migration চালিয়েছি (20260401 থেকে 20260409 পর্যন্ত)
 admin_panel_setup.sql চালিয়েছি
 API সার্ভারে .env ফাইল পূরণ করেছি
 Admin প্যানেলে .env.local ফাইল পূরণ করেছি
 Mobile অ্যাপে .env ফাইল পূরণ করেছি
 profiles টেবিলে নিজের role = super_admin দিয়েছি
 Admin Feature Flags page খুলে flags আসছে দেখেছি
 Mobile অ্যাপে content দেখাচ্ছে
 Push notification test করেছি
```
