# StayGuided — মোবাইল অ্যাপ + API সার্ভার

এই ফোল্ডারে StayGuided মোবাইল অ্যাপ এবং API সার্ভার আছে। এটি সম্পূর্ণ standalone — Replit-এর বাইরে যেকোনো জায়গায় কাজ করবে।

## ফোল্ডার স্ট্রাকচার

```
stayguided-app/
├── package.json         ← রুট workspace scripts (build:api, typecheck, etc.)
├── mobile/              ← Expo React Native মোবাইল অ্যাপ
├── api-server/          ← Express.js API সার্ভার
├── lib/
│   ├── api-zod/         ← শেয়ার্ড Zod স্কিমা (API validation)
│   ├── db/              ← Drizzle ORM ডাটাবেস স্কিমা
│   └── api-client-react/← React Query API ক্লায়েন্ট
├── supabase/
│   └── migrations/      ← সব SQL মাইগ্রেশন ফাইল
├── pnpm-workspace.yaml  ← pnpm workspace কনফিগ
├── tsconfig.base.json   ← শেয়ার্ড TypeScript কনফিগ
├── .env.example         ← Environment variables টেমপ্লেট
└── README.md            ← এই ফাইল
```

## প্রয়োজনীয় সফটওয়্যার

- **Node.js** v18 বা তার উপরে
- **pnpm** v9 বা তার উপরে (`npm install -g pnpm`)
- **Supabase** প্রজেক্ট (https://supabase.com)
- **EAS CLI** (মোবাইল বিল্ডের জন্য): `npm install -g eas-cli`

## সেটআপ (A-to-Z)

### ধাপ ১: Environment Variables সেট করুন

```bash
cp .env.example .env
```

`.env` ফাইল খুলে আপনার Supabase ও ডাটাবেসের তথ্য দিন:
- `SUPABASE_URL` — আপনার Supabase প্রজেক্ট URL
- `SUPABASE_ANON_KEY` — Supabase anon/public key
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key (API সার্ভারের জন্য)
- `DATABASE_URL` — PostgreSQL connection string
- `EXPO_PUBLIC_SUPABASE_URL` — মোবাইল অ্যাপের জন্য Supabase URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` — মোবাইল অ্যাপের জন্য anon key
- `EXPO_PUBLIC_API_URL` — API সার্ভারের URL (যেমন: https://api.example.com/api)

### ধাপ ২: ডাটাবেস মাইগ্রেশন

Supabase SQL Editor-এ গিয়ে `supabase/migrations/` ফোল্ডারের SQL ফাইলগুলো ক্রমানুসারে রান করুন।

অথবা মোবাইল ফোল্ডারের ভিতর `supabase/` ফোল্ডারে `admin_panel_setup.sql` ও `master_patches.sql` রান করুন।

### ধাপ ৩: Dependencies ইনস্টল

```bash
pnpm install
```

### ধাপ ৪: API সার্ভার বিল্ড ও রান

রুট ফোল্ডার থেকে (recommended):

```bash
pnpm run build:api
PORT=3000 pnpm run start:api
```

অথবা সরাসরি api-server ফোল্ডার থেকে:

```bash
cd api-server
pnpm run build
PORT=3000 pnpm run start
```

Development মোডে:

```bash
pnpm run dev:api
```

### ধাপ ৫: মোবাইল অ্যাপ রান (Development)

```bash
cd mobile
pnpm run dev
```

Expo Go অ্যাপ দিয়ে QR কোড স্ক্যান করুন।

### ধাপ ৬: মোবাইল অ্যাপ বিল্ড (Production)

EAS দিয়ে Android APK/AAB বিল্ড:

```bash
cd mobile
eas build --platform android
```

iOS বিল্ড:

```bash
cd mobile
eas build --platform ios
```

অথবা Android Studio/Xcode-এ লোকালি বিল্ড করতে:

```bash
cd mobile
npx expo prebuild
```

এরপর `android/` বা `ios/` ফোল্ডার Android Studio বা Xcode-এ খুলুন।

## API সার্ভার Endpoints

API সার্ভার `/api` path-এ সব route পরিবেশন করে। CORS কনফিগারেশন:
- Development: `localhost` ও `127.0.0.1` স্বয়ংক্রিয়ভাবে allowed
- Production: `ALLOWED_ORIGINS` env var-এ আপনার ডোমেইন দিন (কমা দিয়ে আলাদা)

## সমস্যা সমাধান

- **pnpm install ব্যর্থ হলে**: Node.js ও pnpm সর্বশেষ ভার্সন ব্যবহার করুন
- **API কানেক্ট হচ্ছে না**: `.env` ফাইলে `DATABASE_URL` ও `SUPABASE_*` ভেরিয়েবল চেক করুন
- **মোবাইল অ্যাপে API দেখাচ্ছে না**: `EXPO_PUBLIC_API_URL` সঠিকভাবে সেট করুন
- **TypeScript error**: `pnpm run typecheck` চালিয়ে দেখুন কোথায় error আছে
