// Canonical web-app base URL used in email links (login, reset, upgrade…).
//
// Prefers the CLIENT_URL env var, but falls back to the production domain when
// it's unset or still points at an old Vercel preview/default URL — so email
// links always show the real domain even before the env var is corrected.
//
// To change the domain: set CLIENT_URL in Vercel → Settings → Environment
// Variables (any non-vercel.app value is used as-is), then redeploy.
const PROD = 'https://stayxpulse.sunver.in';
const raw = process.env.CLIENT_URL;

const CLIENT_URL = (raw && !/vercel\.app/i.test(raw))
  ? raw.replace(/\/+$/, '')   // strip trailing slash(es)
  : PROD;

module.exports = CLIENT_URL;
