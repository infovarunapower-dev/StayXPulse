const express  = require('express');
const router   = express.Router();
const crypto   = require('crypto');

const { protect, authorize } = require('../middleware/auth');
const supabase = require('../utils/supabase');
const { generateInvoicePDF } = require('../utils/invoice');
const easebuzz = require('../utils/easebuzz');
const { activateSubscription, CYCLE_DAYS } = require('../utils/activateSubscription');
const CLIENT_URL = require('../utils/clientUrl');

const HA = [protect, authorize('hoteladmin')];

const CYCLE_DISCOUNT = { monthly: 0, quarterly: 10, yearly: 20 };

// Amount the customer actually pays, derived from the DB price — never from
// anything the client sends.
const amountFor = (price, cycle) => ({
  monthly:   price,
  quarterly: Math.round(price * 3  * 0.90),
  yearly:    Math.round(price * 12 * 0.80),
}[cycle]);

// ── GET all plans with computed pricing ───────────────────────────────────────
router.get('/plans', async (req, res) => {
  try {
    const { data: plans, error } = await supabase.from('plans').select('*').eq('is_active', true).order('price', { ascending: true });
    if (error) throw error;

    const withPricing = (plans || []).map(p => ({
      ...p,
      pricing: {
        monthly:   { amount: amountFor(p.price, 'monthly'),   discount: 0,  days: 30,  label: 'per month' },
        quarterly: { amount: amountFor(p.price, 'quarterly'), discount: 10, days: 90,  label: 'per 3 months' },
        yearly:    { amount: amountFor(p.price, 'yearly'),    discount: 20, days: 365, label: 'per year' },
      },
    }));

    res.json({
      success: true,
      data: withPricing,
      gateway: 'easebuzz',
      gatewayEnv: easebuzz.ENV,
      configured: easebuzz.isConfigured(),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── INITIATE payment ─────────────────────────────────────────────────────────
// Creates our own order row, asks Easebuzz for an access_key, and hands the
// browser a URL to redirect to. The customer pays on Easebuzz's page and is
// posted back to /easebuzz/callback below.
router.post('/initiate', HA, async (req, res) => {
  if (!easebuzz.isConfigured()) {
    return res.status(503).json({ success: false, message: 'Payments are not configured yet. Please contact support.' });
  }
  try {
    const { planId, cycle } = req.body;
    if (!planId || !cycle || !CYCLE_DAYS[cycle]) {
      return res.status(400).json({ success: false, message: 'planId and cycle (monthly/quarterly/yearly) are required.' });
    }

    const hotelId = req.user.hotel?.id || req.user.hotel;
    const { data: hotel, error: hErr } = await supabase.from('hotels').select('*').eq('id', hotelId).single();
    if (hErr || !hotel) return res.status(404).json({ success: false, message: 'Hotel not found.' });

    const { data: plan, error: pErr } = await supabase.from('plans').select('*').eq('id', planId).eq('is_active', true).single();
    if (pErr || !plan) return res.status(404).json({ success: false, message: 'Plan not found.' });

    const amount = amountFor(plan.price, cycle);
    if (!Number.isFinite(amount) || amount < 1) {
      return res.status(400).json({ success: false, message: 'This plan has no price set. Please contact support.' });
    }
    // Easebuzz rejects a txnid it has seen before, so make it unique per attempt
    // rather than per order — a customer who abandons checkout must be able to
    // retry.
    const txnid = `SXP${Date.now()}${crypto.randomBytes(3).toString('hex')}`.slice(0, 30);

    const { error: oErr } = await supabase.from('payment_orders').insert({
      hotel_id: hotel.id, plan_id: plan.id, cycle,
      amount, txnid, gateway: 'easebuzz', status: 'created',
    });
    if (oErr) throw oErr;

    // Easebuzz posts the result to these; both point at the same handler, which
    // branches on `status`.
    const callbackUrl = `${process.env.API_PUBLIC_URL || CLIENT_URL}/api/payments/easebuzz/callback`;

    // Easebuzz validates these strictly and rejects the whole request with a
    // generic "Parameter validation failed" if any of them carries punctuation
    // or the wrong length — so normalise before sending, and fail with a useful
    // message rather than handing the gateway something it will refuse.
    const clean = (s, max) => String(s || '').replace(/[^a-zA-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
    const phone = String(hotel.phone || '').replace(/\D/g, '').slice(-10);

    if (phone.length !== 10) {
      return res.status(400).json({ success: false, message: 'Your hotel phone number must be a valid 10-digit number before you can pay. Update it under Hotel Profile.' });
    }
    if (!/^\S+@\S+\.\S+$/.test(String(hotel.email || ''))) {
      return res.status(400).json({ success: false, message: 'Your hotel email address is not valid. Please contact support.' });
    }

    const { paymentUrl } = await easebuzz.initiatePayment({
      txnid,
      amount,
      productinfo: clean(`StayXPulse ${plan.name} ${cycle}`, 100) || 'StayXPulse Subscription',
      firstname: clean(hotel.hotel_name, 60) || 'Hotel',
      email: String(hotel.email).trim(),
      phone,
      surl: callbackUrl,
      furl: callbackUrl,
      // Deliberately no udf fields: they are part of BOTH hash sequences, so if
      // the gateway ever trims or re-encodes one, the reverse hash silently
      // stops matching and every payment looks tampered. txnid already links
      // the callback back to our order.
    });

    res.json({ success: true, data: { paymentUrl, txnid, amount, planName: plan.name, cycle } });
  } catch (err) {
    console.error('Easebuzz initiate error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── EASEBUZZ CALLBACK (surl / furl) ──────────────────────────────────────────
// Public by design: Easebuzz POSTs here from the customer's browser, so there
// is no JWT. Authenticity comes from the reverse hash — nothing in the payload
// is trusted until that verifies.
const handleEasebuzzResult = async (payload, source) => {
  if (!easebuzz.verifyResponse(payload)) {
    console.warn('Easebuzz callback failed hash verification — ignoring', { txnid: payload?.txnid, status: payload?.status });
    return { ok: false, reason: 'bad_hash' };
  }

  const status = String(payload.status || '').toLowerCase();
  const txnid  = payload.txnid;

  if (status !== 'success') {
    await supabase.from('payment_orders')
      .update({ status: 'failed', gateway_payment_id: payload.easepayid || null })
      .eq('txnid', txnid).eq('status', 'created');
    console.log(`Easebuzz ${source}: txnid=${txnid} status=${status} — not activating`);
    return { ok: false, reason: status || 'failed', failed: true };
  }

  return activateSubscription({
    txnid,
    gatewayPaymentId: payload.easepayid,
    gateway: 'easebuzz',
    source,
  });
};

router.post('/easebuzz/callback', async (req, res) => {
  let redirect = `${CLIENT_URL}/hotel/subscription?payment=failed`;
  try {
    const result = await handleEasebuzzResult(req.body, 'callback');
    if (result.ok) {
      redirect = `${CLIENT_URL}/hotel/subscription?payment=success`;
    } else if (result.reason === 'bad_hash') {
      redirect = `${CLIENT_URL}/hotel/subscription?payment=invalid`;
    }
  } catch (err) {
    console.error('Easebuzz callback error:', err.message);
  }
  // 303 so the browser follows with GET — this arrived as a form POST.
  res.redirect(303, redirect);
});

// ── EASEBUZZ WEBHOOK ─────────────────────────────────────────────────────────
// Server-to-server backstop. Without it, a customer who closes the tab after
// paying would be charged with nothing activated, because the callback above
// only fires if their browser makes it back.
router.post('/easebuzz/webhook', async (req, res) => {
  try {
    const result = await handleEasebuzzResult(req.body, 'webhook');
    if (result.reason === 'bad_hash') return res.status(400).json({ success: false, message: 'Invalid hash' });
    // Always 200 on a validly signed event so the gateway stops retrying.
    res.json({ success: true, handled: result.ok, already: !!result.already });
  } catch (err) {
    console.error('Easebuzz webhook error:', err.message);
    res.status(500).json({ success: false });
  }
});

// ── RECONCILE a pending payment ──────────────────────────────────────────────
// If the browser never came back and the webhook never fired, the hotel can ask
// us to check with Easebuzz directly rather than paying twice.
router.post('/reconcile', HA, async (req, res) => {
  try {
    const hotelId = req.user.hotel?.id || req.user.hotel;
    let { txnid } = req.body;

    // With no txnid, check this hotel's most recent unfinished attempt — that is
    // what a customer means by "I paid but nothing happened".
    if (!txnid) {
      const { data: pending } = await supabase.from('payment_orders')
        .select('txnid').eq('hotel_id', hotelId).eq('status', 'created')
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (!pending) return res.json({ success: true, activated: false, status: 'no_pending_payment' });
      txnid = pending.txnid;
    }

    const { data: order } = await supabase.from('payment_orders').select('*').eq('txnid', txnid).single();
    if (!order || order.hotel_id !== hotelId) return res.status(404).json({ success: false, message: 'Order not found.' });

    const info = await easebuzz.retrieveTransaction(txnid);
    const tx = Array.isArray(info?.msg) ? info.msg[0] : info?.msg;
    const status = String(tx?.status || '').toLowerCase();

    if (status !== 'success') {
      return res.json({ success: true, activated: false, status: status || 'unknown' });
    }

    const result = await activateSubscription({
      txnid, gatewayPaymentId: tx.easepayid, gateway: 'easebuzz', source: 'reconcile',
    });
    res.json({ success: true, activated: !!result.ok, already: !!result.already, invoiceNumber: result.invoiceNumber });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── DOWNLOAD invoice PDF ──────────────────────────────────────────────────────
router.get('/invoice/:paymentId', HA, async (req, res) => {
  try {
    const { data: payment, error } = await supabase
      .from('payments')
      .select('*, hotels(*), plans(*)')
      .eq('payment_id', req.params.paymentId)
      .single();

    if (error || !payment) return res.status(404).json({ success: false, message: 'Invoice not found.' });

    const hotelId = req.user.hotel?.id || req.user.hotel;
    if (payment.hotel_id !== hotelId) {
      return res.status(403).json({ success: false, message: 'Not authorised.' });
    }

    const hotel = payment.hotels;
    const plan  = payment.plans;

    // Derive the cycle from the period actually sold — it used to be hardcoded
    // 'monthly', so a yearly invoice claimed "Monthly / 30 days" next to dates
    // spanning a year.
    const days  = (payment.valid_from && payment.valid_to)
      ? Math.round((new Date(payment.valid_to) - new Date(payment.valid_from)) / 86400000) : 30;
    const cycle = days >= 365 ? 'yearly' : days >= 90 ? 'quarterly' : 'monthly';

    const pdfBuffer = await generateInvoicePDF({
      invoice: payment.invoice_number,
      hotel: { hotelName: hotel.hotel_name, email: hotel.email, address: hotel.address, gstNumber: hotel.gst_number },
      plan, cycle, amount: payment.amount,
      validFrom: payment.valid_from, validTo: payment.valid_to, paymentId: payment.payment_id,
    });

    res.set({
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="Invoice_${payment.invoice_number}.pdf"`,
      'Content-Length':      pdfBuffer.length,
    });
    res.end(pdfBuffer);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET hotel's own payment history ──────────────────────────────────────────
router.get('/my-payments', HA, async (req, res) => {
  try {
    const hotelId = req.user.hotel?.id || req.user.hotel;
    const { data: payments, error } = await supabase
      .from('payments')
      .select('*, plans(name)')
      .eq('hotel_id', hotelId)
      .order('paid_at', { ascending: false });
    if (error) throw error;
    res.json({ success: true, data: payments || [] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
