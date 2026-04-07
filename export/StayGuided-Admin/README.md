# StayGuided Me — Admin Panel

এই ফোল্ডারে `dist/` নামে pre-built ফোল্ডার আছে।
**npm install দরকার নেই, build দরকার নেই — সরাসরি deploy করা যাবে।**

---

## Option A — যেকোনো Server এ Deploy (সবচেয়ে সহজ)

### Node.js দিয়ে চালান (Replit, Railway, VPS, Local):

```bash
node server.js
```

ব্যস! Admin panel চলবে http://localhost:3000 এ।

> PORT change করতে: `PORT=8080 node server.js`

---

## Option B — cPanel / Web Hosting এ Deploy

`dist/` ফোল্ডারের ভেতরের সব ফাইল সরাসরি `public_html/` তে আপলোড করুন।
(File Manager → Upload → Extract)

---

## Option C — Replit এ New Project হিসেবে Deploy

1. এই ফোল্ডারটি নতুন Replit project এ upload করুন
2. Run command: `node server.js`
3. Deploy button চাপুন

---

## Login করুন

| Field | Value |
|-------|-------|
| Email | `imranrir46@gmail.com` |
| Password | আপনার Supabase Auth password |

---

## কী কী করা যাবে

- **Content**: Series, Episodes, Reciters যোগ/edit/মুছা
- **Users**: সব user দেখা, role পরিবর্তন, premium grant
- **Analytics**: Play counts, revenue, user activity
- **Gamification**: XP, badges, leaderboard
- **Settings**: App এর সব settings control

---

## ফোল্ডার Structure

```
StayGuided-Admin/
├── dist/           ← Pre-built static files (এটাই serve হয়)
│   ├── index.html
│   └── assets/     ← JS, CSS, images
├── src/            ← Source code (rebuild করতে হলে লাগবে)
├── server.js       ← Static file server (node server.js)
├── package.json
└── vite.config.ts  ← Build config (rebuild করতে হলে)
```

---

## Rebuild করতে চাইলে (Optional)

Source code পরিবর্তন করার পর rebuild করুন:

```bash
npm install
VITE_SUPABASE_ANON_KEY=your-key npm run build
node server.js
```

---

## নতুন Admin User যোগ করুন

Supabase Dashboard → SQL Editor এ run করুন:

```sql
UPDATE profiles SET role = 'admin' WHERE email = 'new@email.com';
-- অথবা super_admin (সব access):
UPDATE profiles SET role = 'super_admin' WHERE email = 'new@email.com';
```
