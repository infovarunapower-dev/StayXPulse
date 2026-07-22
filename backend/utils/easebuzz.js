const crypto = require('crypto');

// ── Easebuzz payment gateway ─────────────────────────────────────────────────
// Hosted-checkout flow:
//   1. server POSTs /payment/initiateLink  → receives an access_key
//   2. browser is sent to {BASE}/pay/{access_key}
//   3. Easebuzz POSTs the result back to surl/furl (form-urlencoded)
//   4. server verifies the REVERSE hash before trusting anything
//
// Base URLs are env-overridable so a change on Easebuzz's side never needs a
// code deploy.
const ENV = (process.env.EASEBUZZ_ENV || 'test').toLowerCase();
const IS_PROD = ENV === 'prod' || ENV === 'production';

const PAY_BASE = process.env.EASEBUZZ_PAY_BASE
  || (IS_PROD ? 'https://pay.easebuzz.in' : 'https://testpay.easebuzz.in');
const DASH_BASE = process.env.EASEBUZZ_DASHBOARD_BASE
  || (IS_PROD ? 'https://dashboard.easebuzz.in' : 'https://testdashboard.easebuzz.in');

const KEY  = process.env.EASEBUZZ_KEY;
const SALT = process.env.EASEBUZZ_SALT;

const isConfigured = () => !!(KEY && SALT);

const sha512 = (s) => crypto.createHash('sha512').update(s).digest('hex');

// Easebuzz compares the amount string byte-for-byte against the one inside the
// hash, so it must be formatted identically in both places.
const fmtAmount = (n) => Number(n).toFixed(2);

const t = (v) => String(v ?? '').trim();

// REQUEST hash:
//   key|txnid|amount|productinfo|firstname|email|udf1|…|udf10|salt
const requestHash = ({ txnid, amount, productinfo, firstname, email, udf = {} }) => {
  const parts = [
    t(KEY), t(txnid), fmtAmount(amount), t(productinfo), t(firstname), t(email),
    ...Array.from({ length: 10 }, (_, i) => t(udf[`udf${i + 1}`])),
    t(SALT),
  ];
  return sha512(parts.join('|'));
};

// RESPONSE (reverse) hash — note `status` sits second and the udf fields run
// backwards. Getting the pipe count wrong here silently rejects every real
// payment, so the sequence is written out explicitly rather than derived.
const responseHash = (p) => {
  const parts = [
    t(SALT), t(p.status),
    ...Array.from({ length: 10 }, (_, i) => t(p[`udf${10 - i}`])),
    t(p.email), t(p.firstname), t(p.productinfo), fmtAmount(p.amount), t(p.txnid), t(KEY),
  ];
  return sha512(parts.join('|'));
};

const verifyResponse = (payload) => {
  if (!isConfigured() || !payload) return false;
  const given = t(payload.hash).toLowerCase();
  if (!given) return false;
  const expected = responseHash(payload);
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(given, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

// Step 1 — ask Easebuzz for an access_key.
const initiatePayment = async ({ txnid, amount, productinfo, firstname, email, phone, surl, furl, udf = {} }) => {
  if (!isConfigured()) throw new Error('Easebuzz is not configured (EASEBUZZ_KEY / EASEBUZZ_SALT)');

  const body = new URLSearchParams({
    key: KEY,
    txnid: t(txnid),
    amount: fmtAmount(amount),
    productinfo: t(productinfo),
    firstname: t(firstname),
    email: t(email),
    phone: t(phone),
    surl, furl,
    hash: requestHash({ txnid, amount, productinfo, firstname, email, udf }),
  });
  for (let i = 1; i <= 10; i++) if (udf[`udf${i}`]) body.append(`udf${i}`, t(udf[`udf${i}`]));

  const res = await fetch(`${PAY_BASE}/payment/initiateLink`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body,
  });

  const text = await res.text();
  let json;
  try { json = JSON.parse(text); }
  catch { throw new Error(`Easebuzz returned a non-JSON response (${res.status}): ${text.slice(0, 200)}`); }

  // status 1 = success; anything else carries the reason in `data`. Easebuzz
  // often returns a per-field object here ({"phone":["invalid"]}), so log the
  // whole payload — "Parameter validation failed" alone is undebuggable.
  if (String(json.status) !== '1' || !json.data) {
    console.error('Easebuzz initiate rejected:', JSON.stringify(json), '| sent:', JSON.stringify({
      txnid: t(txnid), amount: fmtAmount(amount), productinfo: t(productinfo),
      firstname: t(firstname), email: t(email), phone: t(phone), surl, furl,
    }));
    // error_desc carries the actual cause ("Invalid merchant key."); `data` is
    // usually just the generic "Parameter validation failed".
    let reason = json.error_desc || json.error || json.message;
    if (reason) {
      throw new Error(`Easebuzz refused the payment request — ${String(reason).slice(0, 300)}`);
    }
    if (typeof json.data === 'string') reason = json.data;
    else if (json.data && typeof json.data === 'object') {
      // Flatten {field: [msg]} into "field: msg" so the user sees the cause.
      reason = Object.entries(json.data)
        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join(' · ');
    } else reason = JSON.stringify(json);
    throw new Error(`Easebuzz refused the payment request — ${String(reason).slice(0, 300)}`);
  }

  return { accessKey: json.data, paymentUrl: `${PAY_BASE}/pay/${json.data}` };
};

// Step 4 (belt and braces) — ask Easebuzz directly what happened to a txnid,
// instead of trusting only what was posted to us.
const retrieveTransaction = async (txnid) => {
  if (!isConfigured()) throw new Error('Easebuzz is not configured');
  const body = new URLSearchParams({
    txnid: t(txnid),
    key: KEY,
    hash: sha512(`${t(KEY)}|${t(txnid)}|${t(SALT)}`),
  });
  const res = await fetch(`${DASH_BASE}/transaction/v1/retrieve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body,
  });
  const text = await res.text();
  try { return JSON.parse(text); }
  catch { throw new Error(`Easebuzz retrieve returned non-JSON (${res.status}): ${text.slice(0, 200)}`); }
};

module.exports = {
  isConfigured, initiatePayment, verifyResponse, retrieveTransaction,
  requestHash, responseHash, fmtAmount,
  ENV, IS_PROD, PAY_BASE, DASH_BASE,
};
