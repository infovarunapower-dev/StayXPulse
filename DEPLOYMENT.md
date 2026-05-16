# StayXPulse — Vercel + Supabase + GitHub Deployment Guide

---

## Overview
```
GitHub Repo → Vercel (frontend + backend API) → Supabase (database + storage)
```
**Cost: $0/month on free tiers**

---

## Step 1 — Set Up Supabase (5 minutes)

1. Go to https://supabase.com → Sign Up (free)
2. Click **New Project**:
   - Name: `stayxpulse`
   - Database Password: choose strong password (save it!)
   - Region: `Southeast Asia (Singapore)` — closest to India
3. Wait ~2 minutes for project to be ready

### Run the Database Schema

4. In Supabase dashboard → **SQL Editor** → **New Query**
5. Copy the entire contents of `supabase/schema.sql` → paste → click **Run**
6. Then run `supabase/storage.sql` the same way

### Get Your API Keys

7. Go to **Settings → API** and copy:
   - `Project URL` → `SUPABASE_URL`
   - `anon public` key → `SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_KEY` ⚠️ Keep this secret!

---

## Step 2 — Set Up GitHub (3 minutes)

1. Go to https://github.com → Sign up / Login
2. Click **New Repository**:
   - Name: `stayxpulse`
   - Private: ✅ (recommended)
   - Don't add README (we have our own)
3. Click **Create Repository**

### Push your code

Open terminal in your project root (`G:\Gayatri_6`):

```cmd
git init
git add .
git commit -m "Initial StayXPulse commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/stayxpulse.git
git push -u origin main
```

---

## Step 3 — Deploy to Vercel (5 minutes)

1. Go to https://vercel.com → Sign up with GitHub
2. Click **Add New → Project**
3. Import your `stayxpulse` GitHub repo
4. Configure:
   - **Root Directory:** leave empty (uses root)
   - **Framework Preset:** Other
   - **Build Command:** `cd frontend && npm install && npm run build`
   - **Output Directory:** `frontend/build`
   - **Install Command:** `cd backend && npm install`

### Add Environment Variables

5. In Vercel → **Settings → Environment Variables**, add ALL of these:

```
SUPABASE_URL            = https://xxxx.supabase.co
SUPABASE_ANON_KEY       = eyJhbGci...
SUPABASE_SERVICE_KEY    = eyJhbGci...

JWT_SECRET              = your_long_random_secret_min_64_chars
JWT_EXPIRE              = 7d
JWT_REMEMBER_EXPIRE     = 30d

EMAIL_TEST_MODE         = false
SMTP_HOST               = smtp.gmail.com
SMTP_PORT               = 587
SMTP_USER               = your_gmail@gmail.com
SMTP_PASS               = your16charapppassword
FROM_NAME               = StayXPulse
FROM_EMAIL              = your_gmail@gmail.com

CLIENT_URL              = https://your-app.vercel.app

SUPER_ADMIN_EMAIL       = superadmin@stayxpulse.com
SUPER_ADMIN_PASSWORD    = YourStrongPassword@123
SUPER_ADMIN_NAME        = Super Admin

RAZORPAY_KEY_ID         = rzp_live_XXXXXXXX
RAZORPAY_KEY_SECRET     = XXXXXXXXXXXXXXXX

NODE_ENV                = production
```

6. Click **Deploy**
7. Wait 2-3 minutes — Vercel builds and deploys

---

## Step 4 — Update CLIENT_URL

After deployment, Vercel gives you a URL like `https://stayxpulse.vercel.app`

1. Go to Vercel → **Settings → Environment Variables**
2. Update `CLIENT_URL` = `https://stayxpulse.vercel.app`
3. Go to **Deployments → Redeploy**

---

## Step 5 — Update Frontend API URL

In your frontend, update `src/utils/api.js`:

```js
const api = axios.create({
  baseURL: process.env.NODE_ENV === 'production'
    ? 'https://stayxpulse.vercel.app/api'
    : '/api',
  headers: { 'Content-Type': 'application/json' },
});
```

Commit and push:
```cmd
git add .
git commit -m "Update API URL for production"
git push
```
Vercel auto-deploys on every push! ✅

---

## Step 6 — Connect Custom Domain (optional)

If you have `stayxpulse.sunver.in`:

1. Vercel → **Settings → Domains** → Add `stayxpulse.sunver.in`
2. In your DNS (sunver.in registrar) add:
   ```
   Type  : CNAME
   Name  : stayxpulse
   Value : cname.vercel-dns.com
   ```
3. SSL is automatic — Vercel handles it!

---

## Local Development (after Supabase setup)

```cmd
# Terminal 1 — Backend
cd G:\Gayatri_6\backend
npm install
# Make sure .env has SUPABASE_URL and SUPABASE_SERVICE_KEY filled in
npm run dev

# Terminal 2 — Frontend
cd G:\Gayatri_6\frontend
npm install
npm start
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `SUPABASE_URL missing` | Check .env has correct Supabase URL |
| Login not working | Check Supabase → Table Editor → users table has super admin row |
| Images not uploading | Check Supabase Storage → hotel-logos bucket exists |
| API 500 errors | Check Vercel → Functions → Logs for error details |
| CORS errors | Add your domain to CORS origins in server.js |

---

## Auto-Deploy Workflow

Every time you push to GitHub:
```
git add .
git commit -m "your change"
git push
```
→ Vercel automatically redeploys in ~2 minutes 🚀
