// ─────────────────────────────────────────────────────────────────────────────
//  Sunver Growth Engine (SGE) — outbound events (Requirement 3) + helpers.
//
//  Every event is written to the `sge_outbox` table (idempotent on event_id)
//  and then POSTed to the engine webhook, HMAC-SHA256 signed, with retry/backoff.
//  If SGE_WEBHOOK_URL / SGE_WEBHOOK_SECRET are not set, NOTHING is sent (and
//  nothing queues a send) — exactly as the spec requires on day one.
//
//  Error-safe by contract: enqueue() and drain() never throw, so a webhook
//  problem can never break a signup, order or payment.
// ─────────────────────────────────────────────────────────────────────────────
const crypto   = require('crypto');
const supabase = require('./supabase');

const PRODUCT = 'stay-x-pulse';

function cfg() { return { url: process.env.SGE_WEBHOOK_URL || '', secret: process.env.SGE_WEBHOOK_SECRET || '' }; }
function configured() { const c = cfg(); return !!(c.url && c.secret); }

// Money is integer paise including GST; tax alongside. GST here is 18% inclusive
// (gross/1.18 is the taxable value), matching our invoices.
const toPaise = (rupees) => Math.round(Number(rupees || 0) * 100);
const taxPaiseFromGross = (grossRupees) => {
  const g = Number(grossRupees || 0);
  return Math.round((g - g / 1.18) * 100);
};

// Normalise a phone to E.164 (default +91). Returns null if unusable.
function e164(phone, cc = '91') {
  if (!phone) return null;
  let p = String(phone).trim().replace(/[\s()\-.]/g, '');
  if (p.startsWith('+')) return '+' + p.slice(1).replace(/\D/g, '');
  p = p.replace(/\D/g, '');
  if (!p) return null;
  p = p.replace(/^0+/, '');
  if (p.length === 10) return `+${cc}${p}`;        // bare 10-digit Indian number
  if (p.length > 10) return `+${p}`;               // already carries a country code
  return `+${cc}${p}`;
}

const clean = (o) => {
  const out = {};
  for (const [k, v] of Object.entries(o || {})) if (v !== undefined && v !== null && v !== '') out[k] = v;
  return Object.keys(out).length ? out : undefined;
};

// The attribution subset attached to every event, read from the hotel row.
function attributionOf(hotel) {
  const a = (hotel && hotel.attribution) || {};
  return clean({
    sge_aid: (hotel && hotel.sge_aid) || a.sge_aid,
    sge_ref: a.sge_ref,
    sge_src: a.sge_src || a.src || a.utm_source,
    campaign: a.utm_campaign || a.campaign,
    utm: clean({ utm_source: a.utm_source, utm_medium: a.utm_medium, utm_campaign: a.utm_campaign, utm_content: a.utm_content }),
  }) || {};
}

// Who the event is about (name/email/phone), from a hotel row.
function partyOf(hotel) {
  return clean({
    name: hotel && hotel.hotel_name,
    email: hotel && hotel.email,
    phone: e164(hotel && hotel.phone),
  }) || {};
}

const backoffMinutes = (attempts) => (attempts <= 3 ? [1, 5, 30][attempts - 1] : 60); // then hourly
const MAX_ATTEMPTS = 30; // ~24h of hourly retries → give up

// Write an event to the outbox (idempotent) and try to send it immediately.
// `ref` must come from a stable DB row (never a clock/random) so a resend is a
// no-op. Never throws.
async function enqueue(type, ref, data) {
  try {
    const event_id = `sxp:${type}:${ref}`;
    const payload = { type, event_id, data: { product: PRODUCT, ...data } };
    const { error } = await supabase.from('sge_outbox').upsert(
      { event_id, type, payload, status: 'pending', attempts: 0, next_attempt_at: new Date().toISOString() },
      { onConflict: 'event_id', ignoreDuplicates: true },
    );
    if (error && /relation|does not exist|schema cache/i.test(error.message || '')) {
      console.warn('[sge] outbox table missing (run migration 024) — event dropped:', event_id);
      return;
    }
    // Best-effort immediate delivery; failures just leave it queued for the drainer.
    if (configured()) drain().catch(() => {});
  } catch (e) {
    console.error('[sge] enqueue failed (non-fatal):', e.message);
  }
}

function sign(raw, secret) {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(raw).digest('hex');
}

// Send one queued row. Returns { done } | { dead, error } | { retry, error }.
async function sendOne(row, c) {
  const raw = JSON.stringify(row.payload);
  let res;
  try {
    res = await fetch(c.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-SGE-Signature': sign(raw, c.secret) },
      body: raw,
    });
  } catch (e) { return { retry: true, error: 'network: ' + e.message }; }

  if (res.status === 200) return { done: true };
  if (res.status === 400 || res.status === 401) {
    let body = ''; try { body = await res.text(); } catch (_) {}
    return { dead: true, error: `${res.status} ${body}`.slice(0, 300) };  // payload/signature bug → stop
  }
  return { retry: true, error: `http ${res.status}` };                    // 503/5xx → retry later
}

// Drain due events. Safe to call often (the immediate send after enqueue, and a
// cron). Never throws.
async function drain(limit = 25) {
  try {
    if (!configured()) return { skipped: 'not_configured' };
    const c = cfg();
    const { data: rows } = await supabase
      .from('sge_outbox').select('*')
      .eq('status', 'pending').lte('next_attempt_at', new Date().toISOString())
      .order('created_at', { ascending: true }).limit(limit);
    let sent = 0, dead = 0, retried = 0;
    for (const row of rows || []) {
      const r = await sendOne(row, c);
      if (r.done) {
        await supabase.from('sge_outbox').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', row.id);
        sent++;
      } else if (r.dead) {
        await supabase.from('sge_outbox').update({ status: 'dead', last_error: r.error }).eq('id', row.id);
        dead++;
      } else {
        const attempts = (row.attempts || 0) + 1;
        const patch = attempts >= MAX_ATTEMPTS
          ? { status: 'dead', last_error: `gave up: ${r.error}` }
          : { attempts, last_error: r.error, next_attempt_at: new Date(Date.now() + backoffMinutes(attempts) * 60000).toISOString() };
        await supabase.from('sge_outbox').update(patch).eq('id', row.id);
        retried++;
      }
    }
    return { sent, dead, retried };
  } catch (e) {
    console.error('[sge] drain failed (non-fatal):', e.message);
    return { error: e.message };
  }
}

module.exports = { enqueue, drain, configured, toPaise, taxPaiseFromGross, e164, attributionOf, partyOf, PRODUCT };
