const express  = require('express');
const router   = express.Router();
const crypto   = require('crypto');
const Razorpay = require('razorpay');

const { protect, authorize } = require('../middleware/auth');
const supabase = require('../utils/supabase');
const { generateInvoicePDF } = require('../utils/invoice');
const { sendPaymentSuccessEmail } = require('../utils/email');
const { activateSubscription } = require('../utils/activateSubscription');

const HA = [protect, authorize('hoteladmin')];

const razorpay = process.env.RAZORPAY_KEY_ID
  ? new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET })
  : null;

// TEST payment mode — verify the activation flow without a real charge.
// Defaults ON so payments can be simulated during setup. To GO LIVE: set real
// RAZORPAY_KEY_ID/SECRET and PAYMENT_TEST_MODE=false in the env, then redeploy.
const PAYMENT_TEST_MODE = process.env.PAYMENT_TEST_MODE !== 'false';

const CYCLE_DAYS     = { monthly: 30, quarterly: 90, yearly: 365 };
const CYCLE_DISCOUNT = { monthly: 0,  quarterly: 10, yearly: 20  };

// ── GET all plans with computed pricing ───────────────────────────────────────
router.get('/plans', async (req, res) => {
  try {
    const { data: plans, error } = await supabase.from('plans').select('*').eq('is_active', true).order('price', { ascending: true });
    if (error) throw error;

    const withPricing = (plans || []).map(p => ({
      ...p,
      pricing: {
        monthly:   { amount: p.price,                           discount: 0,  days: 30,  label: 'per month' },
        quarterly: { amount: Math.round(p.price * 3 * 0.90),   discount: 10, days: 90,  label: 'per 3 months' },
        yearly:    { amount: Math.round(p.price * 12 * 0.80),  discount: 20, days: 365, label: 'per year' },
      },
    }));

    res.json({ success: true, data: withPricing, testMode: PAYMENT_TEST_MODE });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── TEST payment: simulate a successful payment (no real charge) ──────────────
// Mirrors the live verify() activation so you can confirm the whole flow:
// payment record → subscription active → invoice → history → access restored.
router.post('/test-pay', HA, async (req, res) => {
  if (!PAYMENT_TEST_MODE) {
    return res.status(403).json({ success: false, message: 'Test payments are disabled — live payment is active.' });
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

    const AMOUNTS = { monthly: plan.price, quarterly: Math.round(plan.price * 3 * 0.90), yearly: Math.round(plan.price * 12 * 0.80) };
    const amount = AMOUNTS[cycle];
    const validFrom = new Date();
    const validTo = new Date(); validTo.setDate(validTo.getDate() + CYCLE_DAYS[cycle]);
    const invoiceNumber = `INV-${Date.now()}`;
    const paymentId = `TEST-${Date.now()}`;

    const { error: payErr } = await supabase.from('payments').insert({
      hotel_id: hotel.id, plan_id: planId, amount, payment_id: paymentId,
      valid_from: validFrom.toISOString(), valid_to: validTo.toISOString(),
      invoice_number: invoiceNumber, notes: 'TEST PAYMENT (simulated — no real charge)',
    });
    if (payErr) throw payErr;

    await supabase.from('hotels').update({
      subscription_status: 'active', current_plan_id: planId,
      plan_valid_from: validFrom.toISOString(), plan_valid_to: validTo.toISOString(),
      is_active: true,
    }).eq('id', hotel.id);

    // Best-effort invoice email — never blocks activation
    try {
      let pdfBuffer = null;
      try {
        pdfBuffer = await generateInvoicePDF({
          invoice: invoiceNumber,
          hotel: { hotelName: hotel.hotel_name, email: hotel.email, address: hotel.address, gstNumber: hotel.gst_number },
          plan, cycle, amount, validFrom, validTo, paymentId,
        });
      } catch (e) { console.error('Test invoice PDF error:', e.message); }
      await sendPaymentSuccessEmail({
        hotelName: hotel.hotel_name, email: hotel.email, plan: plan.name, cycle,
        amount, invoiceNumber, validFrom, validTo, paymentId, pdfBuffer,
      });
    } catch (e) { console.error('Test payment email error:', e.message); }

    res.json({
      success: true,
      message: 'Test payment recorded — subscription activated.',
      data: { invoiceNumber, planName: plan.name, cycle, amount, validFrom, validTo, test: true },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── CREATE Razorpay order ─────────────────────────────────────────────────────
router.post('/create-order', HA, async (req, res) => {
  if (!razorpay) return res.status(503).json({ success: false, message: 'Live payment is not configured. Test mode is active.' });
  try {
    const { planId, cycle } = req.body;

    if (!planId || !cycle || !CYCLE_DAYS[cycle]) {
      return res.status(400).json({ success: false, message: 'planId and cycle (monthly/quarterly/yearly) are required.' });
    }

    const hotelId = req.user.hotel?.id || req.user.hotel;
    const { data: hotel, error: hotelError } = await supabase.from('hotels').select('*').eq('id', hotelId).single();
    if (hotelError || !hotel) return res.status(404).json({ success: false, message: 'Hotel not found.' });

    const { data: plan, error: planError } = await supabase.from('plans').select('*').eq('id', planId).eq('is_active', true).single();
    if (planError || !plan) return res.status(404).json({ success: false, message: 'Plan not found.' });

    const AMOUNTS = {
      monthly:   plan.price,
      quarterly: Math.round(plan.price * 3 * 0.90),
      yearly:    Math.round(plan.price * 12 * 0.80),
    };
    const amountINR   = AMOUNTS[cycle];
    const amountPaise = amountINR * 100;

    const rzpOrder = await razorpay.orders.create({
      amount:   amountPaise,
      currency: 'INR',
      receipt:  `hotel_${hotel.id}_${Date.now()}`,
      notes: { hotelId: hotel.id, hotelName: hotel.hotel_name, planId, planName: plan.name, cycle },
    });

    const { error: dbError } = await supabase.from('razorpay_orders').insert({
      hotel_id: hotel.id, plan_id: planId, cycle,
      amount: amountPaise, amount_display: amountINR,
      razorpay_order_id: rzpOrder.id,
    });
    if (dbError) throw dbError;

    res.json({
      success: true,
      data: {
        orderId: rzpOrder.id, amount: amountPaise, currency: 'INR',
        keyId: process.env.RAZORPAY_KEY_ID,
        hotelName: hotel.hotel_name, email: hotel.email, phone: hotel.phone,
        planName: plan.name, cycle, amountDisplay: amountINR,
      },
    });
  } catch (err) {
    console.error('Create order error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── VERIFY payment + auto-activate ───────────────────────────────────────────
// The browser calls this immediately after checkout. It races the Razorpay
// webhook below; activateSubscription() is idempotent so whichever lands first
// wins and the other is a no-op.
router.post('/verify', HA, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Missing payment details.' });
    }

    const expectedSig = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    const a = Buffer.from(expectedSig, 'utf8');
    const b = Buffer.from(String(razorpay_signature), 'utf8');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return res.status(400).json({ success: false, message: 'Invalid payment signature.' });
    }

    const result = await activateSubscription({
      razorpayOrderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
      source: 'verify',
    });

    if (!result.ok && result.reason === 'order_not_found') {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }
    if (!result.ok) return res.status(500).json({ success: false, message: result.reason });

    res.json({
      success: true,
      message: result.already ? 'Already activated.' : 'Payment verified and subscription activated!',
      data: {
        invoiceNumber: result.invoiceNumber,
        planName: result.plan?.name || result.rzpOrder?.plans?.name,
        cycle: result.rzpOrder?.cycle,
        amount: result.rzpOrder?.amount_display,
        validFrom: result.validFrom,
        validTo: result.validTo,
      },
    });
  } catch (err) {
    console.error('Verify error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── RAZORPAY WEBHOOK ─────────────────────────────────────────────────────────
// Server-to-server confirmation. Without this, a guest who closes the tab after
// paying is charged with nothing activated and no record — the browser callback
// above is the only thing that would have recorded it.
//
// Public by design (no JWT): authenticity comes from the HMAC signature over the
// RAW body, so server.js captures req.rawBody before JSON parsing.
// Configure at Razorpay Dashboard > Settings > Webhooks:
//   URL    https://stayxpulse.sunver.in/api/payments/webhook
//   Events payment.captured, order.paid
//   Secret must match RAZORPAY_WEBHOOK_SECRET
router.post('/webhook', async (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    console.error('Webhook received but RAZORPAY_WEBHOOK_SECRET is not set');
    return res.status(500).json({ success: false, message: 'Webhook not configured' });
  }

  try {
    const signature = req.headers['x-razorpay-signature'];
    const raw = req.rawBody || Buffer.from(JSON.stringify(req.body || {}));
    const expected = crypto.createHmac('sha256', secret).update(raw).digest('hex');

    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(String(signature || ''), 'utf8');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      console.warn('Webhook signature mismatch — ignoring');
      return res.status(400).json({ success: false, message: 'Invalid signature' });
    }

    const event  = req.body?.event;
    const entity = req.body?.payload?.payment?.entity || req.body?.payload?.order?.entity;
    const orderId   = entity?.order_id || entity?.id;
    const paymentId = req.body?.payload?.payment?.entity?.id;

    // Acknowledge anything we don't act on, so Razorpay stops retrying.
    if (!['payment.captured', 'order.paid'].includes(event) || !orderId || !paymentId) {
      return res.json({ success: true, ignored: event || 'unknown' });
    }

    const result = await activateSubscription({
      razorpayOrderId: orderId,
      paymentId,
      source: `webhook:${event}`,
    });

    if (!result.ok) console.error('Webhook activation failed:', result.reason, orderId);

    // Always 200 on a validly signed event: a non-2xx makes Razorpay retry for
    // hours, and a genuinely unknown order will never succeed on retry.
    res.json({ success: true, handled: result.ok, already: !!result.already });
  } catch (err) {
    console.error('Webhook error:', err.message);
    res.status(500).json({ success: false });
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

    const pdfBuffer = await generateInvoicePDF({
      invoice: payment.invoice_number,
      hotel: { hotelName: hotel.hotel_name, email: hotel.email, address: hotel.address, gstNumber: hotel.gst_number },
      plan, cycle: 'monthly', amount: payment.amount,
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
