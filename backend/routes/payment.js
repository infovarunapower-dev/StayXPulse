const express  = require('express');
const router   = express.Router();
const crypto   = require('crypto');
const Razorpay = require('razorpay');

const { protect, authorize } = require('../middleware/auth');
const { Hotel, Plan, Payment } = require('../models');
const RazorpayOrder = require('../models/RazorpayOrder');
const { generateInvoicePDF } = require('../utils/invoice');
const { sendPaymentSuccessEmail } = require('../utils/email');

const HA = [protect, authorize('hoteladmin')];

const razorpay = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Cycle → days multiplier
const CYCLE_DAYS = { monthly: 30, quarterly: 90, yearly: 365 };

// Cycle → discount %
const CYCLE_DISCOUNT = { monthly: 0, quarterly: 10, yearly: 20 };

// ── GET all plans with computed pricing per cycle ─────────────────────────────
router.get('/plans', async (req, res) => {
  try {
    const plans = await Plan.find({ isActive: true }).sort({ price: 1 });

    const withPricing = plans.map(p => ({
      ...p.toObject(),
      pricing: {
        monthly:   { amount: p.price,                                      discount: 0,  days: 30,  label: 'per month' },
        quarterly: { amount: Math.round(p.price * 3 * 0.90),               discount: 10, days: 90,  label: 'per 3 months' },
        yearly:    { amount: Math.round(p.price * 12 * 0.80),              discount: 20, days: 365, label: 'per year' },
      },
    }));

    res.json({ success: true, data: withPricing });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── CREATE Razorpay order ─────────────────────────────────────────────────────
router.post('/create-order', HA, async (req, res) => {
  try {
    const { planId, cycle } = req.body;

    if (!planId || !cycle || !CYCLE_DAYS[cycle]) {
      return res.status(400).json({ success: false, message: 'planId and cycle (monthly/quarterly/yearly) are required.' });
    }

    const hotel = await Hotel.findById(req.user.hotel);
    if (!hotel) return res.status(404).json({ success: false, message: 'Hotel not found.' });

    const plan = await Plan.findById(planId);
    if (!plan || !plan.isActive) return res.status(404).json({ success: false, message: 'Plan not found.' });

    // Compute amount based on cycle
    const AMOUNTS = {
      monthly:   plan.price,
      quarterly: Math.round(plan.price * 3 * 0.90),
      yearly:    Math.round(plan.price * 12 * 0.80),
    };
    const amountINR   = AMOUNTS[cycle];
    const amountPaise = amountINR * 100; // Razorpay uses paise

    // Create order on Razorpay
    const rzpOrder = await razorpay.orders.create({
      amount:   amountPaise,
      currency: 'INR',
      receipt:  `hotel_${hotel._id}_${Date.now()}`,
      notes: {
        hotelId:   hotel._id.toString(),
        hotelName: hotel.hotelName,
        planId:    planId,
        planName:  plan.name,
        cycle,
      },
    });

    // Save order to DB
    const dbOrder = await RazorpayOrder.create({
      hotel:           hotel._id,
      plan:            planId,
      cycle,
      amount:          amountPaise,
      amountDisplay:   amountINR,
      razorpayOrderId: rzpOrder.id,
    });

    res.json({
      success: true,
      data: {
        orderId:    rzpOrder.id,
        amount:     amountPaise,
        currency:   'INR',
        keyId:      process.env.RAZORPAY_KEY_ID,
        hotelName:  hotel.hotelName,
        email:      hotel.email,
        phone:      hotel.phone,
        planName:   plan.name,
        cycle,
        amountDisplay: amountINR,
      },
    });
  } catch (err) {
    console.error('Create order error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── VERIFY payment + auto-activate ───────────────────────────────────────────
router.post('/verify', HA, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    // 1. Verify signature
    const expectedSig = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSig !== razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Invalid payment signature. Possible tampering detected.' });
    }

    // 2. Find our DB order
    const rzpOrder = await RazorpayOrder.findOne({ razorpayOrderId: razorpay_order_id })
      .populate('hotel').populate('plan');

    if (!rzpOrder) return res.status(404).json({ success: false, message: 'Order not found.' });
    if (rzpOrder.status === 'paid') return res.json({ success: true, message: 'Already activated.', data: rzpOrder });

    // 3. Compute validity dates
    const validFrom = new Date();
    const validTo   = new Date();
    validTo.setDate(validTo.getDate() + CYCLE_DAYS[rzpOrder.cycle]);

    // 4. Update RazorpayOrder
    rzpOrder.razorpayPaymentId = razorpay_payment_id;
    rzpOrder.razorpaySignature = razorpay_signature;
    rzpOrder.status    = 'paid';
    rzpOrder.validFrom = validFrom;
    rzpOrder.validTo   = validTo;
    await rzpOrder.save();

    // 5. Create Payment record (for invoicing)
    const payment = await Payment.create({
      hotel:     rzpOrder.hotel._id,
      plan:      rzpOrder.plan._id,
      amount:    rzpOrder.amountDisplay,
      paymentId: razorpay_payment_id,
      validFrom,
      validTo,
    });

    // 6. Auto-activate hotel subscription
    const hotel = rzpOrder.hotel;
    hotel.subscriptionStatus = 'active';
    hotel.currentPlan   = rzpOrder.plan._id;
    hotel.planValidFrom = validFrom;
    hotel.planValidTo   = validTo;
    hotel.isActive      = true;
    await hotel.save();

    // 7. Generate PDF invoice
    let pdfBuffer = null;
    try {
      pdfBuffer = await generateInvoicePDF({
        invoice:     payment.invoiceNumber,
        hotel:       { hotelName: hotel.hotelName, email: hotel.email, address: hotel.address, gstNumber: hotel.gstNumber },
        plan:        rzpOrder.plan,
        cycle:       rzpOrder.cycle,
        amount:      rzpOrder.amountDisplay,
        validFrom,
        validTo,
        paymentId:   razorpay_payment_id,
      });
    } catch (pdfErr) {
      console.error('PDF generation failed:', pdfErr.message);
    }

    // 8. Send success email with invoice
    await sendPaymentSuccessEmail({
      hotelName:     hotel.hotelName,
      email:         hotel.email,
      plan:          rzpOrder.plan.name,
      cycle:         rzpOrder.cycle,
      amount:        rzpOrder.amountDisplay,
      invoiceNumber: payment.invoiceNumber,
      validFrom,
      validTo,
      paymentId:     razorpay_payment_id,
      pdfBuffer,
    });

    res.json({
      success: true,
      message: 'Payment verified and subscription activated!',
      data: {
        invoiceNumber: payment.invoiceNumber,
        planName:      rzpOrder.plan.name,
        cycle:         rzpOrder.cycle,
        amount:        rzpOrder.amountDisplay,
        validFrom,
        validTo,
      },
    });
  } catch (err) {
    console.error('Verify error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── DOWNLOAD invoice PDF ──────────────────────────────────────────────────────
router.get('/invoice/:paymentId', HA, async (req, res) => {
  try {
    const payment = await Payment.findOne({ paymentId: req.params.paymentId })
      .populate('hotel').populate('plan');

    if (!payment) return res.status(404).json({ success: false, message: 'Invoice not found.' });
    if (payment.hotel._id.toString() !== req.user.hotel.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorised.' });
    }

    const pdfBuffer = await generateInvoicePDF({
      invoice:   payment.invoiceNumber,
      hotel:     { hotelName: payment.hotel.hotelName, email: payment.hotel.email, address: payment.hotel.address, gstNumber: payment.hotel.gstNumber },
      plan:      payment.plan,
      cycle:     'monthly',
      amount:    payment.amount,
      validFrom: payment.validFrom,
      validTo:   payment.validTo,
      paymentId: payment.paymentId,
    });

    res.set({
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="Invoice_${payment.invoiceNumber}.pdf"`,
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
    const payments = await Payment.find({ hotel: req.user.hotel })
      .populate('plan', 'name')
      .sort({ paidAt: -1 });
    res.json({ success: true, data: payments });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
