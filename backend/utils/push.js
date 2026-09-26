// ─────────────────────────────────────────────────────────────────────────────
//  Android push (FCM) — server-side transport only.
//
//  FCM is used ONLY to wake a CLOSED Android app. Auth/data/users stay in
//  Supabase. The Firebase service-account credential lives in ONE server-side
//  env var (FCM_SERVICE_ACCOUNT) — never in the frontend, the APK, or git.
//
//  If FCM_SERVICE_ACCOUNT is not set, every call safely no-ops with a log, so
//  orders/requests keep working before Firebase is wired up.
//
//  NOTE: firebase-admin v13+ uses the MODULAR API — require the subpaths
//  ('firebase-admin/app', 'firebase-admin/messaging'), NOT admin.apps /
//  admin.credential.cert (those are undefined on the default export in v14).
// ─────────────────────────────────────────────────────────────────────────────
const supabase = require('./supabase');

let _messaging = null;  // cached getMessaging() instance once initialised
let _initTried = false; // so we log/attempt init exactly once per lambda
let _initError = null;  // last init failure message (for the health diagnostic)

// Lazily initialise firebase-admin from the server-side service account. Returns
// the messaging instance, or null if it can't be configured. Never throws.
function getMessagingClient() {
  if (_initTried) return _messaging;
  _initTried = true;
  try {
    const raw = process.env.FCM_SERVICE_ACCOUNT;
    if (!raw || !raw.trim()) {
      console.warn('[push] FCM_SERVICE_ACCOUNT not set — push disabled (no-op). Orders/requests still work.');
      return null;
    }
    // Accept either raw JSON or base64-encoded JSON (Vercel env vars can mangle
    // the private_key newlines; base64 sidesteps that entirely).
    let jsonStr = raw.trim();
    if (!jsonStr.startsWith('{')) {
      try { jsonStr = Buffer.from(jsonStr, 'base64').toString('utf8'); } catch (_) { /* fall through */ }
    }
    const cred = JSON.parse(jsonStr);
    // Some env pipelines turn a real newline into literal backslash-n.
    if (cred.private_key && cred.private_key.includes('\\n')) {
      cred.private_key = cred.private_key.replace(/\\n/g, '\n');
    }
    // v14 modular API (subpath requires kept lazy so a missing package can't
    // take down the whole hotel router at import time).
    const { initializeApp, cert, getApps } = require('firebase-admin/app');
    const { getMessaging } = require('firebase-admin/messaging');
    if (!getApps().length) {
      initializeApp({ credential: cert(cred) });
    }
    _messaging = getMessaging();
    console.log('[push] firebase-admin initialised — FCM push enabled.');
    return _messaging;
  } catch (e) {
    _initError = (e && ((e.code ? e.code + ': ' : '') + e.message)) || String(e);
    console.error('[push] init failed — push disabled (no-op):', _initError);
    _messaging = null;
    return null;
  }
}

// ── Web Push (VAPID) init — browsers, even when the tab is closed ────────────
let _webpush = null, _webTried = false;
function getWebPush() {
  if (_webTried) return _webpush;
  _webTried = true;
  try {
    const pub = process.env.VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
    if (!pub || !priv) { console.warn('[push] VAPID keys not set — web push disabled (no-op).'); return null; }
    const webpush = require('web-push');
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:info@stayxpulse.sunver.in', pub, priv);
    _webpush = webpush;
    console.log('[push] web-push (VAPID) initialised.');
    return _webpush;
  } catch (e) { console.error('[push] web-push init failed:', e.message); return null; }
}
function vapidPublicKey() { return process.env.VAPID_PUBLIC_KEY || null; }

// FCM data payload values MUST be strings. Coerce everything.
function stringifyData(data) {
  const out = {};
  for (const [k, v] of Object.entries(data || {})) {
    if (v !== undefined && v !== null) out[k] = String(v);
  }
  return out;
}

/**
 * Send an Android notification to every ACTIVE device registered for a hotel.
 *
 * Sends a NOTIFICATION payload (so Android's system tray displays it and plays
 * the channel sound even when the WebView is dead) PLUS a data payload (type,
 * id, route) so a tap can deep-link to the right screen.
 *
 * Error-safe by contract: this never throws. Call it after the DB insert; a
 * push failure must never fail the order/request.
 *
 * @param {string} hotelId
 * @param {{title:string, body:string, data?:object}} msg
 */
async function sendPushToHotel(hotelId, { title, body, data } = {}) {
  if (!hotelId) { console.warn('[push] sendPushToHotel called without hotelId'); return; }
  let rows;
  try {
    const res = await supabase
      .from('device_tokens')
      .select('token, platform')
      .eq('hotel_id', hotelId)
      .eq('is_active', true);
    if (res.error) { console.error('[push] token lookup failed:', res.error.message); return; }
    rows = res.data || [];
  } catch (e) { console.error('[push] token lookup threw:', e.message); return; }

  const androidTokens = rows.filter(r => (r.platform || 'android') !== 'web').map(r => r.token).filter(Boolean);
  const webSubs       = rows.filter(r => r.platform === 'web').map(r => r.token).filter(Boolean);

  // Android (FCM) and web (VAPID) are independent transports — run both.
  await Promise.all([
    sendFcm(hotelId, androidTokens, { title, body, data }),
    sendWeb(hotelId, webSubs,       { title, body, data }),
  ]);
}

// Android devices via FCM. Error-safe.
async function sendFcm(hotelId, tokens, { title, body, data }) {
  try {
    if (!tokens.length) return;
    const messaging = getMessagingClient();
    if (!messaging) return;
    const resp = await messaging.sendEachForMulticast({
      tokens,
      notification: { title, body },
      data: stringifyData(data),
      android: {
        priority: 'high',
        notification: {
          channelId: 'stayxpulse_alerts_v2',
          sound: 'stayxpulse_alert',   // res/raw/stayxpulse_alert.mp3 (channel owns the sound on Android 8+)
          priority: 'high',
          defaultVibrateTimings: true,
        },
      },
    });
    console.log(`[push] FCM hotel ${hotelId}: sent ${resp.successCount}/${tokens.length} (fail ${resp.failureCount}).`);
    const dead = [];
    resp.responses.forEach((r, i) => {
      if (!r.success) {
        const code = (r.error && r.error.code) || '';
        if (/registration-token-not-registered|invalid-registration-token|invalid-argument/i.test(code)) dead.push(tokens[i]);
      }
    });
    if (dead.length) {
      await supabase.from('device_tokens').update({ is_active: false, updated_at: new Date().toISOString() }).in('token', dead);
      console.log(`[push] deactivated ${dead.length} dead FCM token(s).`);
    }
  } catch (e) { console.error('[push] sendFcm failed (non-fatal):', e.message); }
}

// Browsers via Web Push (VAPID) — fires even when the tab is closed. Each stored
// "token" is the JSON-stringified PushSubscription. Error-safe.
async function sendWeb(hotelId, subs, { title, body, data }) {
  try {
    if (!subs.length) return;
    const webpush = getWebPush();
    if (!webpush) return;
    const payload = JSON.stringify({ title, body, data: data || {} });
    let ok = 0; const dead = [];
    await Promise.all(subs.map(async (raw) => {
      try {
        await webpush.sendNotification(JSON.parse(raw), payload);
        ok++;
      } catch (err) {
        const sc = err && err.statusCode;
        if (sc === 404 || sc === 410) dead.push(raw); // subscription gone
      }
    }));
    console.log(`[push] WEB hotel ${hotelId}: sent ${ok}/${subs.length} (dead ${dead.length}).`);
    if (dead.length) {
      await supabase.from('device_tokens').update({ is_active: false, updated_at: new Date().toISOString() }).in('token', dead);
    }
  } catch (e) { console.error('[push] sendWeb failed (non-fatal):', e.message); }
}

// Diagnostic only: reports whether the FCM credential is present + valid and
// whether firebase-admin initialised — WITHOUT exposing any secret value.
function pushHealth() {
  const raw = process.env.FCM_SERVICE_ACCOUNT || '';
  const present = !!raw.trim();
  let parseOk = false, projectId = null, clientEmail = null, form = null;
  if (present) {
    try {
      let s = raw.trim();
      if (!s.startsWith('{')) { form = 'base64'; s = Buffer.from(s, 'base64').toString('utf8'); }
      else { form = 'json'; }
      const c = JSON.parse(s);
      parseOk = true;
      projectId = c.project_id || null;
      clientEmail = c.client_email ? c.client_email.split('@')[1] || 'present' : null;
    } catch (_) { parseOk = false; }
  }
  let moduleFound = true;
  try { require.resolve('firebase-admin'); } catch (_) { moduleFound = false; }
  const messaging = getMessagingClient();
  return { present, form, parseOk, projectId, clientEmailDomain: clientEmail, moduleFound, adminInit: !!messaging, initError: _initError };
}

module.exports = { sendPushToHotel, pushHealth, vapidPublicKey };
