# Daily AI Marketing Poster

Every morning a Vercel cron hits `GET /api/cron/daily-poster`, which:

1. **Picks a theme** (`themes.js`) — 10 marketing angles rotated least-recently-used,
   using the `daily_posters` table as memory so no theme repeats until all have run.
2. **Writes the copy** (`generateCopy.js`) — one Gemini call returns
   `{ headline, subtext, caption, imagePrompt }` as strict JSON.
3. **Generates the background** (`generateImage.js`) — Imagen 3 via the Gemini API,
   3:4 portrait, prompt asks for a calm lower third so text stays legible.
4. **Overlays the brand** (`overlay.js`) — sharp composites a 1080×1350 poster:
   dark scrim, headline, subtext, gold accent bar, teal CTA pill, logo
   (`backend/assets/logo.png`) and StayXPulse wordmark.
5. **Stores it** (`storage.js`) — uploads to the public `daily-posters` Supabase
   bucket and logs a row in `daily_posters`.
6. **Delivers it** (`deliver.js`) — optional email (existing Brevo/SMTP mailer —
   not Resend, to match this repo) and/or WhatsApp Cloud API. Both best-effort.

## Setup

1. Run `supabase/migrations/009_daily_posters.sql` in the Supabase SQL Editor
   (creates the table, the bucket, and the public-read policy).
2. Fill the env vars (see `backend/.env.example`, "Daily AI marketing poster"
   section) locally in `backend/.env` and in Vercel → Settings → Environment
   Variables. **Redeploy after adding them.**
   - `GEMINI_API_KEY` — required (aistudio.google.com, needs Imagen access;
     Imagen is a paid-tier feature).
   - `CRON_SECRET` — required; any long random string. Vercel automatically
     sends it as `Authorization: Bearer <CRON_SECRET>` on cron invocations.
   - `POSTER_EMAIL_TO` — optional; where the daily email lands.
   - `WHATSAPP_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID` / `POSTER_WHATSAPP_TO` —
     optional; Meta WhatsApp Cloud API.
3. The schedule lives in `vercel.json` → `crons`: `30 3 * * *` UTC = **9:00 AM IST**.

## Testing locally

```powershell
cd backend; npm run dev
# in another terminal:
curl -H "Authorization: Bearer <your CRON_SECRET>" http://localhost:5000/api/cron/daily-poster
```

The JSON response contains `imageUrl` — the finished poster in Supabase storage.

## Design customization

All visual knobs are in `overlay.js`:

- `BRAND` — colors mirror `frontend/src/styles/global.css` (Emerald Luxe):
  teal `#0D9488`/`#14B8A6`, gold `#C99A5B`/`#E0B341`, ink `#0E1B17`.
- Canvas is 1080×1350 (4:5). Change `WIDTH`/`HEIGHT` plus the Imagen
  `aspectRatio` in `generateImage.js` together.
- CTA text and URL are `BRAND.cta` / `BRAND.url`.
- Layout (scrim strength, accent bar, pill) is one SVG in `buildSvg()`.

### Font caveat (known limitation)

The overlay asks for **Plus Jakarta Sans** (the web app's font), but Vercel's
lambdas don't have it installed — sharp/librsvg will fall back to a generic
sans-serif in production (locally it renders correctly if the font is installed
on Windows). If the fallback looks off, the fix is to bundle the TTFs in
`backend/assets/fonts/` with a `fonts.conf` and set `FONTCONFIG_PATH` — flag it
and it can be wired up.

## Cost note

Each run bills one Gemini text call (fractions of a cent) and one Imagen 3
image (~$0.03–0.04). The `CRON_SECRET` guard exists so strangers can't run up
that bill; keep it set.
