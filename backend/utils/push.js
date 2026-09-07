// ─────────────────────────────────────────────────────────────────────────────
//  Android push (FCM) — server-side transport only.
//
//  FCM is used ONLY to wake a CLOSED Android app. Auth/data/users stay in
//  Supabase. The Firebase service-account credential lives in ONE server-side
//  env var (FCM_SERVICE_ACCOUNT) — never in the frontend, the APK, or git.
//
//  If FCM_SERVICE_ACCOUNT is not set, every call safely no-ops with a log, so
//  orders/requests keep working before Firebase is wired up.
// ─────────────────────────────────────────────────────────────────────────────
const supabase = require('./supabase');

let _admin = null;      // the initialised firebase-admin app's messaging(), cached
let _initTried = false; // so we log/attempt init exactly once per lambda

// Lazily initialise firebase-admin from the server-side service account. Returns
// the admin namespace, or null if it can't be configured (missing/invalid env,
// or the package isn't installed yet). Never throws.
function getAdmin() {
  if (_initTried) return _admin;
  _initTried = true;
  try {
    const raw = process.env.FCM_SERVICE_ACCOUNT;
    if (!raw || !raw.trim()) {
      console.warn('[push] FCM_SERVICE_ACCOUNT not set — push disabled (no-op). Orders/requests still work.');
      return null;
    }
    // Accept either raw JSON or base64-encoded JSON (Vercel env vars mangle
    // newlines in the private_key; base64 sidesteps that entirely).
    let jsonStr = raw.trim();
    if (!jsonStr.startsWith('{')) {
      try { jsonStr = Buffer.from(jsonStr, 'base64').toString('utf8'); } catch (_) { /* fall through */ }
    }
    const cred = JSON.parse(jsonStr);
    // Some env pipelines turn "\n" into literal backslash-n in the private key.
    if (cred.private_key && cred.private_key.includes('\\n')) {
      cred.private_key = cred.private_key.replace(/\\n/g, '\n');
    }
    const admin = require('firebase-admin');
    if (!admin.apps.length) {
      admin.initializeApp({ credential: admin.credential.cert(cred) });
    }
    _admin = admin;
    console.log('[push] firebase-admin initialised — FCM push enabled.');
    return _admin;
  } catch (e) {
    console.error('[push] init failed — push disabled (no-op):', e.message);
    _admin = null;
    return null;
  }
}

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
  try {
    const admin = getAdmin();
    if (!admin) return;                       // not configured yet → no-op
    if (!hotelId) { console.warn('[push] sendPushToHotel called without hotelId'); return; }

    const { data: rows, error } = await supabase
      .from('device_tokens')
      .select('token')
      .eq('hotel_id', hotelId)
      .eq('is_active', true);
    if (error) { console.error('[push] token lookup failed:', error.message); return; }

    const tokens = (rows || []).map(r => r.token).filter(Boolean);
    if (!tokens.length) {
      console.log(`[push] no active device tokens for hotel ${hotelId} — nothing to send.`);
      return;
    }

    const message = {
      tokens,
      notification: { title, body },
      data: stringifyData(data),
      android: {
        priority: 'high',
        notification: {
          channelId: 'stayxpulse_alerts',
          sound: 'default',
          priority: 'high',
          defaultVibrateTimings: true,
          defaultSound: true,
        },
      },
    };

    const resp = await admin.messaging().sendEachForMulticast(message);
    console.log(`[push] hotel ${hotelId}: sent ${resp.successCount}/${tokens.length} (fail ${resp.failureCount}).`);

    // Deactivate tokens FCM says are permanently dead (app uninstalled / token
    // rotated). Keep transient failures active so we retry them next time.
    const dead = [];
    resp.responses.forEach((r, i) => {
      if (!r.success) {
        const code = (r.error && r.error.code) || '';
        if (/registration-token-not-registered|invalid-registration-token|invalid-argument/i.test(code)) {
          dead.push(tokens[i]);
        }
      }
    });
    if (dead.length) {
      await supabase.from('device_tokens')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .in('token', dead);
      console.log(`[push] deactivated ${dead.length} dead token(s).`);
    }
  } catch (e) {
    console.error('[push] sendPushToHotel failed (non-fatal):', e.message);
  }
}

module.exports = { sendPushToHotel };
