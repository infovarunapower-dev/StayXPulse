const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { protect, authorize }     = require('../middleware/auth');
const supabase = require('../utils/supabase');
const { sendTrialReminderEmail, sendExpiryReminderEmail, sendPasswordResetByAdminEmail, sendAppUpdateEmail } = require('../utils/email');
const { generateOrderRecordPDF, generateInvoicePDF } = require('../utils/invoice');
const { computeGst } = require('../utils/gstCalc');
const JSZip = require('jszip');
const CLIENT_URL = require('../utils/clientUrl');

const SA = [protect, authorize('superadmin')];

const validate = (req, res) => {
  const e = validationResult(req);
  if (!e.isEmpty()) return res.status(422).json({ success: false, errors: e.array() });
  return null;
};

// Helper to map hotel snake_case to camelCase for frontend
const mapHotel = (h) => ({
  ...h,
  _id: h.id,
  hotelName: h.hotel_name,
  userId: h.user_id,
  subscriptionStatus: h.subscription_status,
  trialEndDate: h.trial_end_date,
  planValidTo: h.plan_valid_to,
  planValidFrom: h.plan_valid_from,
  currentPlan: h.plans || null,
  logoUrl: h.logo_url,
  gstNumber: h.gst_number,
  isActive: h.is_active,
});

// ─── DASHBOARD SUMMARY ────────────────────────────────────────────────────────
router.get('/summary', SA, async (req, res) => {
  try {
    const [
      { count: totalHotels },
      { count: activeHotels },
      { count: trialHotels },
      { count: expiredHotels },
      { data: allPayments },
      { data: recentPayments },
    ] = await Promise.all([
      supabase.from('hotels').select('*', { count: 'exact', head: true }),
      supabase.from('hotels').select('*', { count: 'exact', head: true }).eq('subscription_status', 'active'),
      supabase.from('hotels').select('*', { count: 'exact', head: true }).eq('subscription_status', 'trial'),
      supabase.from('hotels').select('*', { count: 'exact', head: true }).eq('subscription_status', 'expired'),
      supabase.from('payments').select('amount'),
      supabase.from('payments').select('*, hotels(hotel_name, email), plans(name)').order('paid_at', { ascending: false }).limit(5),
    ]);

    const totalRevenue = (allPayments || []).reduce((sum, p) => sum + (p.amount || 0), 0);

    const in7 = new Date(); in7.setDate(in7.getDate() + 7);
    const { data: expiringSoon } = await supabase.from('hotels')
      .select('id, hotel_name, email, plan_valid_to')
      .eq('subscription_status', 'active')
      .lte('plan_valid_to', in7.toISOString())
      .gte('plan_valid_to', new Date().toISOString());

    res.json({
      success: true,
      data: {
        stats: { totalHotels, activeHotels, trialHotels, expiredHotels, totalRevenue },
        monthlyRevenue: [],
        recentPayments: (recentPayments || []).map(p => ({
          ...p,
          hotel: p.hotels ? { hotelName: p.hotels.hotel_name, email: p.hotels.email } : null,
          plan: p.plans ? { name: p.plans.name } : null,
        })),
        expiringSoon: (expiringSoon || []).map(h => ({
          ...h,
          hotelName: h.hotel_name,
          planValidTo: h.plan_valid_to,
        })),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── HOTEL LIST ───────────────────────────────────────────────────────────────
router.get('/hotels', SA, async (req, res) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    let query = supabase.from('hotels').select('*, plans(name, price)', { count: 'exact' });

    if (status) query = query.eq('subscription_status', status);
    if (search) query = query.or(`hotel_name.ilike.%${search}%,email.ilike.%${search}%`);

    query = query.order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    const { data: hotels, error, count } = await query;
    if (error) throw error;

    res.json({
      success: true, data: (hotels || []).map(mapHotel), total: count,
      page: Number(page), pages: Math.ceil(count / limit),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET single hotel
router.get('/hotels/:id', SA, async (req, res) => {
  try {
    const { data: hotel, error } = await supabase.from('hotels').select('*, plans(*)').eq('id', req.params.id).single();
    if (error || !hotel) return res.status(404).json({ success: false, message: 'Hotel not found' });
    const { data: users } = await supabase.from('users').select('email, last_login, is_active').eq('hotel_id', hotel.id);
    const user = users && users.length > 0 ? users[0] : null;
    res.json({ success: true, data: { hotel: mapHotel(hotel), user } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH toggle hotel active status
router.patch('/hotels/:id/toggle', SA, async (req, res) => {
  try {
    const { data: users } = await supabase.from('users').select('id, is_active').eq('hotel_id', req.params.id);
    if (!users || users.length === 0) return res.status(404).json({ success: false, message: 'Hotel user not found' });
    const user = users[0];
    const { error } = await supabase.from('users').update({ is_active: !user.is_active }).eq('id', user.id);
    if (error) throw error;
    res.json({ success: true, message: `Hotel ${!user.is_active ? 'activated' : 'deactivated'}` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── ACTIVATE PLAN ────────────────────────────────────────────────────────────
router.post('/hotels/:id/activate', [...SA,
  body('planId').notEmpty().withMessage('Plan is required'),
  body('paymentId').notEmpty().withMessage('Payment ID is required'),
  body('validFrom').isISO8601().withMessage('Valid from date required'),
  body('validTo').isISO8601().withMessage('Valid to date required'),
  body('amount').isNumeric().withMessage('Amount is required'),
], async (req, res) => {
  const err = validate(req, res); if (err) return;
  try {
    const { planId, paymentId, validFrom, validTo, amount, notes } = req.body;

    const { data: hotel, error: hotelError } = await supabase.from('hotels').select('*').eq('id', req.params.id).single();
    if (hotelError || !hotel) return res.status(404).json({ success: false, message: 'Hotel not found' });

    const { data: payment, error: payError } = await supabase.from('payments').insert({
      hotel_id: hotel.id, plan_id: planId, amount: Number(amount),
      payment_id: paymentId, valid_from: validFrom, valid_to: validTo, notes,
    }).select('*, plans(name)').single();
    if (payError) throw payError;

    const { error: updateError } = await supabase.from('hotels').update({
      subscription_status: 'active',
      current_plan_id: planId,
      plan_valid_from: validFrom,
      plan_valid_to: validTo,
      is_active: true,
    }).eq('id', hotel.id);
    if (updateError) throw updateError;

    res.json({ success: true, message: 'Plan activated successfully', data: payment });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── PAID HOTELS ──────────────────────────────────────────────────────────────
router.get('/paid-hotels', SA, async (req, res) => {
  try {
    const { data: hotels, error } = await supabase.from('hotels')
      .select('*, plans(name, price)')
      .in('subscription_status', ['active', 'expired'])
      .order('plan_valid_to', { ascending: true });
    if (error) throw error;
    res.json({ success: true, data: (hotels || []).map(mapHotel) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── PAYMENT HISTORY ──────────────────────────────────────────────────────────
router.get('/payments', SA, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const { data: payments, error, count } = await supabase.from('payments')
      .select('*, hotels(hotel_name, email, gst_number, address), plans(name)', { count: 'exact' })
      .order('paid_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);
    if (error) throw error;

    const { data: allPayments } = await supabase.from('payments').select('amount');
    const totalRevenue = (allPayments || []).reduce((sum, p) => sum + (p.amount || 0), 0);

    const mapped = (payments || []).map(p => ({
      ...p,
      hotel: p.hotels ? { hotelName: p.hotels.hotel_name, email: p.hotels.email, gstNumber: p.hotels.gst_number, address: p.hotels.address } : null,
      plan: p.plans ? { name: p.plans.name } : null,
    }));

    res.json({
      success: true, data: mapped, total: count, totalRevenue,
      page: Number(page), pages: Math.ceil(count / limit),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── ORDER RECORD (per-payment forensic PDF) ──────────────────────────────────
// Tax-invoice PDF for a payment (super-admin can pull any hotel's invoice).
router.get('/payments/:id/invoice', SA, async (req, res) => {
  try {
    const { data: payment, error } = await supabase.from('payments')
      .select('*, hotels(*), plans(*)').eq('id', req.params.id).single();
    if (error || !payment) return res.status(404).json({ success: false, message: 'Payment not found.' });

    const hotel = payment.hotels || {};
    const plan  = payment.plans  || {};
    const days  = (payment.valid_from && payment.valid_to)
      ? Math.round((new Date(payment.valid_to) - new Date(payment.valid_from)) / 86400000) : 30;
    const cycle = days >= 365 ? 'yearly' : days >= 90 ? 'quarterly' : 'monthly';

    const pdf = await generateInvoicePDF({
      invoice: payment.invoice_number,
      hotel: { hotelName: hotel.hotel_name, email: hotel.email, address: hotel.address, gstNumber: hotel.gst_number },
      plan, cycle, amount: payment.amount,
      validFrom: payment.valid_from, validTo: payment.valid_to, paymentId: payment.payment_id,
    });
    const fname = `Invoice_${String(payment.invoice_number || payment.id).replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${fname}"`, 'Content-Length': pdf.length });
    res.end(pdf);
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.get('/payments/:id/order-record', SA, async (req, res) => {
  try {
    const { data: payment, error } = await supabase
      .from('payments')
      .select('*, hotels(*), plans(*)')
      .eq('id', req.params.id)
      .single();
    if (error || !payment) return res.status(404).json({ success: false, message: 'Payment not found.' });

    // Checkout evidence (IP / user-agent / consent / timings) lives on the
    // payment_orders row, matched by txnid.
    let order = null;
    if (payment.txnid) {
      const { data: o } = await supabase.from('payment_orders').select('*').eq('txnid', payment.txnid).maybeSingle();
      order = o || null;
    }
    // The account holder is the hotel's admin user.
    let user = null;
    if (payment.hotel_id) {
      const { data: u } = await supabase.from('users').select('id, name, email, created_at').eq('hotel_id', payment.hotel_id).eq('role', 'hoteladmin').maybeSingle();
      user = u || null;
    }

    const pdf = await generateOrderRecordPDF({ payment, hotel: payment.hotels || {}, plan: payment.plans || {}, order, user });
    const fname = `OrderRecord_${String(payment.invoice_number || payment.id).replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fname}"`,
      'Content-Length': pdf.length,
    });
    res.end(pdf);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── PERIOD FILING: bulk-download a period's invoices as a ZIP ─────────────────
// ZIP contains one PDF per invoice + a filing-summary.csv (GST register).
router.get('/invoices/zip', SA, async (req, res) => {
  try {
    const { from, to } = req.query;
    const col = req.query.dateField === 'created_at' ? 'created_at' : 'paid_at';

    let q = supabase.from('payments').select('*, hotels(*), plans(name)').order(col, { ascending: true });
    if (from) q = q.gte(col, new Date(from).toISOString());
    if (to)   q = q.lte(col, new Date(new Date(to).getTime() + 86400000 - 1).toISOString()); // inclusive end-of-day
    const { data: payments, error } = await q;
    if (error) throw error;
    if (!payments || !payments.length) return res.status(404).json({ success: false, message: 'No invoices found in this period.' });

    const zip = new JSZip();
    const esc = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
    const csv = [['Invoice No', 'Invoice Date', 'Hotel', 'Buyer GSTIN', 'Place of Supply', 'Taxable', 'CGST', 'SGST', 'IGST', 'Total', 'Payment ID']
      .map(esc).join(',')];

    for (const p of payments) {
      const g = computeGst(p.amount, p.hotels?.gst_number);
      const dateStr = p[col] ? new Date(p[col]).toLocaleDateString('en-IN') : '';
      csv.push([p.invoice_number, dateStr, p.hotels?.hotel_name, p.hotels?.gst_number || 'Unregistered',
        g.placeOfSupply, g.taxable.toFixed(2), g.cgst.toFixed(2), g.sgst.toFixed(2), g.igst.toFixed(2), g.gross.toFixed(2), p.payment_id]
        .map(esc).join(','));

      const days  = (p.valid_from && p.valid_to) ? Math.round((new Date(p.valid_to) - new Date(p.valid_from)) / 86400000) : 30;
      const cycle = days >= 365 ? 'yearly' : days >= 90 ? 'quarterly' : 'monthly';
      const pdf = await generateInvoicePDF({
        invoice: p.invoice_number,
        hotel: { hotelName: p.hotels?.hotel_name, email: p.hotels?.email, address: p.hotels?.address, gstNumber: p.hotels?.gst_number },
        plan: p.plans || {}, cycle, amount: p.amount, validFrom: p.valid_from, validTo: p.valid_to, paymentId: p.payment_id,
      });
      const safe = String(p.invoice_number || p.id).replace(/[^a-zA-Z0-9_-]/g, '_');
      zip.file(`invoices/Invoice_${safe}.pdf`, pdf);
    }

    zip.file('filing-summary.csv', '﻿' + csv.join('\n'));
    const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    const label = `${from || 'all'}_to_${to || 'all'}`.replace(/[^0-9a-zA-Z_-]/g, '');
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="StayXPulse_Invoices_${label}.zip"`,
      'Content-Length': buf.length,
    });
    res.end(buf);
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ─── ORDER LEDGER (all checkout orders incl. pending/failed) ──────────────────
router.get('/orders', SA, async (req, res) => {
  try {
    let q = supabase.from('payment_orders')
      .select('*, hotels(hotel_name, email, gst_number), plans(name)')
      .order('created_at', { ascending: false }).limit(1000);
    if (req.query.status && req.query.status !== 'all') q = q.eq('status', req.query.status);
    const { data, error } = await q;
    if (error) throw error;

    const mapped = (data || []).map(o => {
      const g = computeGst(o.amount, o.hotels?.gst_number);
      return {
        id: o.id, txnid: o.txnid, status: o.status, amount: o.amount, cycle: o.cycle,
        hotelName: o.hotels?.hotel_name || null, hotelEmail: o.hotels?.email || null,
        buyerGstin: o.hotels?.gst_number || null, planName: o.plans?.name || null,
        placeOfSupply: g.placeOfSupply, intra: g.intra,
        gateway: o.gateway, gatewayPaymentId: o.gateway_payment_id,
        customerIp: o.customer_ip, userAgent: o.user_agent,
        termsAccepted: o.terms_accepted, termsAcceptedAt: o.terms_accepted_at, policyVersion: o.policy_version,
        validFrom: o.valid_from, validTo: o.valid_to,
        initiatedAt: o.initiated_at, paidAt: o.paid_at, createdAt: o.created_at,
      };
    });
    res.json({ success: true, data: mapped });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ─── PLANS CRUD ───────────────────────────────────────────────────────────────
router.get('/plans', SA, async (req, res) => {
  try {
    const { data: plans, error } = await supabase.from('plans').select('*').order('price', { ascending: true });
    if (error) throw error;
    const mapped = (plans || []).map(p => ({
      ...p,
      _id: p.id,
      durationDays: p.duration_days,
      maxRooms: p.max_rooms,
      isActive: p.is_active,
      isPopular: p.is_popular,
    }));
    res.json({ success: true, data: mapped });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/plans', [...SA,
  body('name').notEmpty(), body('price').isNumeric(),
  body('durationDays').isNumeric(), body('maxRooms').isNumeric(),
], async (req, res) => {
  const err = validate(req, res); if (err) return;
  try {
    const { data: plan, error } = await supabase.from('plans').insert({
      name: req.body.name,
      price: req.body.price,
      duration_days: req.body.durationDays,
      max_rooms: req.body.maxRooms,
      features: req.body.features || [],
      is_active: true,
      is_popular: !!req.body.isPopular,
    }).select().single();
    if (error) throw error;
    res.status(201).json({ success: true, data: { ...plan, _id: plan.id, durationDays: plan.duration_days, maxRooms: plan.max_rooms, isPopular: plan.is_popular } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/plans/:id', SA, async (req, res) => {
  try {
    const { data: plan, error } = await supabase.from('plans').update({
      name: req.body.name,
      price: req.body.price,
      duration_days: req.body.durationDays,
      max_rooms: req.body.maxRooms,
      features: req.body.features,
      is_active: req.body.isActive,
      is_popular: req.body.isPopular,
    }).eq('id', req.params.id).select().single();
    if (error) throw error;
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });
    res.json({ success: true, data: { ...plan, _id: plan.id, durationDays: plan.duration_days, maxRooms: plan.max_rooms, isPopular: plan.is_popular } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/plans/:id', SA, async (req, res) => {
  try {
    const { error } = await supabase.from('plans').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true, message: 'Plan deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── SEND REMINDER EMAIL ──────────────────────────────────────────────────────
router.post('/reminders/:hotelId', SA, async (req, res) => {
  try {
    const { data: hotel, error } = await supabase.from('hotels').select('*').eq('id', req.params.hotelId).single();
    if (error || !hotel) return res.status(404).json({ success: false, message: 'Hotel not found' });

    if (!hotel.email) {
      return res.json({ success: true, emailed: false, emailError: 'This hotel has no email address on file', message: 'No email address on file for this hotel' });
    }

    let daysLeft = 0, emailResult = null, kind = null;
    if (hotel.subscription_status === 'trial' && hotel.trial_end_date) {
      daysLeft = Math.max(0, Math.ceil((new Date(hotel.trial_end_date) - Date.now()) / 86400000));
      kind = 'trial';
      emailResult = await sendTrialReminderEmail({ hotelName: hotel.hotel_name, email: hotel.email, daysLeft, trialEndDate: hotel.trial_end_date });
    } else if (hotel.plan_valid_to) {
      daysLeft = Math.max(0, Math.ceil((new Date(hotel.plan_valid_to) - Date.now()) / 86400000));
      kind = 'expiry';
      const { data: plan } = await supabase.from('plans').select('name').eq('id', hotel.current_plan_id).single();
      emailResult = await sendExpiryReminderEmail({ hotelName: hotel.hotel_name, email: hotel.email, planName: plan?.name || 'Subscription', daysLeft, expiryDate: hotel.plan_valid_to });
    } else {
      return res.json({ success: true, emailed: false, emailError: 'This hotel is not on a trial or a dated plan, so there is nothing to remind about' });
    }

    // sendEmail returns {success:false, error} on failure (it never throws), so
    // report the real delivery outcome instead of always claiming success.
    const emailed = !!emailResult?.success;
    res.json({
      success: true,
      emailed,
      emailError: emailed ? null : (emailResult?.error || 'Email could not be sent'),
      message: emailed
        ? `${kind === 'trial' ? 'Trial' : 'Expiry'} reminder emailed to ${hotel.email}`
        : `Reminder could NOT be delivered: ${emailResult?.error || 'unknown error'}`,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── VIEW HOTEL CREDENTIALS ───────────────────────────────────────────────────
router.get('/hotels/:id/credentials', SA, async (req, res) => {
  try {
    const { data: hotel, error } = await supabase.from('hotels').select('*').eq('id', req.params.id).single();
    if (error || !hotel) return res.status(404).json({ success: false, message: 'Hotel not found' });
    res.json({ success: true, data: { hotelName: hotel.hotel_name, userId: hotel.user_id, email: hotel.email, password: '(hidden — click Reset Password to generate a new one)' } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/hotels/:id/reset-credentials', SA, async (req, res) => {
  try {
    const { generatePassword } = require('../utils/credentials');
    const { data: hotel, error } = await supabase.from('hotels').select('*').eq('id', req.params.id).single();
    if (error || !hotel) return res.status(404).json({ success: false, message: 'Hotel not found' });

    const { data: users } = await supabase.from('users').select('*').eq('hotel_id', hotel.id);
    if (!users || users.length === 0) return res.status(404).json({ success: false, message: 'Hotel user not found' });

    const newPassword = generatePassword();
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await supabase.from('users').update({ password_hash: hashedPassword }).eq('id', users[0].id);

    // sendEmail never throws — it returns { success:false, error } on failure.
    // Surface that so the admin knows whether the hotel actually got the email.
    const emailResult = await sendPasswordResetByAdminEmail({
      hotelName: hotel.hotel_name, email: hotel.email, userId: hotel.user_id, newPassword,
    });
    res.json({
      success: true,
      emailed: !!emailResult?.success,
      emailError: emailResult?.success ? null : (emailResult?.error || 'Email could not be sent'),
      data: { hotelName: hotel.hotel_name, userId: hotel.user_id, email: hotel.email, password: newPassword },
    });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/hotels/:id/reset-password', SA, async (req, res) => {
  try {
    const { generatePassword } = require('../utils/credentials');
    const { data: hotel, error } = await supabase.from('hotels').select('*').eq('id', req.params.id).single();
    if (error || !hotel) return res.status(404).json({ success: false, message: 'Hotel not found' });

    const { data: users } = await supabase.from('users').select('*').eq('hotel_id', hotel.id);
    if (!users || users.length === 0) return res.status(404).json({ success: false, message: 'Hotel user not found' });

    const newPassword = generatePassword();
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await supabase.from('users').update({ password_hash: hashedPassword }).eq('id', users[0].id);

    res.json({ success: true, data: { hotelName: hotel.hotel_name, userId: hotel.user_id, email: hotel.email, password: newPassword } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── NOTIFY ALL HOTELS OF A NEW APP VERSION ───────────────────────────────────
// Superadmin-triggered broadcast: emails every hotel a "new app is ready"
// message with the download link. Run this right after releasing a new APK.
router.post('/notify-app-update', SA, async (req, res) => {
  try {
    const version = (req.body.version || '').toString().trim().slice(0, 20);
    const notes = Array.isArray(req.body.notes)
      ? req.body.notes.map(n => String(n).trim()).filter(Boolean).slice(0, 10).map(n => n.slice(0, 160))
      : [];
    const downloadUrl = `${CLIENT_URL.replace(/\/+$/, '')}/stayxpulse.apk`;

    const { data: hotels, error } = await supabase.from('hotels').select('hotel_name, email');
    if (error) throw error;
    const recipients = (hotels || []).filter(h => h.email && /\S+@\S+\.\S+/.test(h.email));

    let sent = 0, failed = 0;
    for (const h of recipients) {
      // sendEmail never throws — it returns {success:false} on failure, so
      // check the result rather than assuming success.
      let r;
      try { r = await sendAppUpdateEmail({ hotelName: h.hotel_name || 'there', email: h.email, version, downloadUrl, notes }); }
      catch (e) { r = { success: false, error: e.message }; }
      if (r?.success) sent++;
      else { failed++; console.error('[notify-app-update] not delivered for', h.email, r?.error); }
      await new Promise(r => setTimeout(r, 200)); // gentle pacing for the SMTP/API provider
    }
    res.json({
      success: true,
      sent, failed, total: recipients.length,
      message: `Sent to ${sent} hotel${sent !== 1 ? 's' : ''}${failed ? `, ${failed} failed` : ''}.`,
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ─── FULL HOTEL DRILL-DOWN (profile + all payments + activity) ────────────────
router.get('/hotels/:id/details', SA, async (req, res) => {
  try {
    const { data: hotel, error } = await supabase.from('hotels').select('*').eq('id', req.params.id).single();
    if (error || !hotel) return res.status(404).json({ success: false, message: 'Hotel not found' });

    const [
      { data: plan },
      { data: account },
      { data: payments },
      { count: rooms },
      { count: foodOrders },
      { count: serviceRequests },
    ] = await Promise.all([
      hotel.current_plan_id
        ? supabase.from('plans').select('name, price').eq('id', hotel.current_plan_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from('users').select('name, email, last_login, created_at').eq('hotel_id', hotel.id).eq('role', 'hoteladmin').maybeSingle(),
      supabase.from('payments').select('*, plans(name)').eq('hotel_id', hotel.id).order('paid_at', { ascending: false }),
      supabase.from('rooms').select('*', { count: 'exact', head: true }).eq('hotel_id', hotel.id),
      supabase.from('food_orders').select('*', { count: 'exact', head: true }).eq('hotel_id', hotel.id),
      supabase.from('service_requests').select('*', { count: 'exact', head: true }).eq('hotel_id', hotel.id),
    ]);

    const pays = payments || [];
    const totalPaid = pays.reduce((s, p) => s + (p.amount || 0), 0);

    res.json({
      success: true,
      data: {
        hotel: {
          id: hotel.id, hotelName: hotel.hotel_name, email: hotel.email, phone: hotel.phone,
          address: hotel.address, gstNumber: hotel.gst_number, userId: hotel.user_id,
          logoUrl: hotel.logo_url, isActive: hotel.is_active, subscriptionStatus: hotel.subscription_status,
          currentPlan: plan?.name || null, planValidFrom: hotel.plan_valid_from, planValidTo: hotel.plan_valid_to,
          trialStartDate: hotel.trial_start_date, trialEndDate: hotel.trial_end_date, createdAt: hotel.created_at,
        },
        account: account || null,
        payments: pays.map(p => ({
          id: p.id, invoiceNumber: p.invoice_number, amount: p.amount, planName: p.plans?.name || null,
          validFrom: p.valid_from, validTo: p.valid_to, paidAt: p.paid_at,
          paymentId: p.payment_id, gateway: p.gateway, txnid: p.txnid,
        })),
        stats: { rooms: rooms || 0, foodOrders: foodOrders || 0, serviceRequests: serviceRequests || 0, totalPaid, paymentCount: pays.length },
      },
    });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ─── ANDROID APK VERSION HISTORY ──────────────────────────────────────────────
const CURRENT_APP = require('../appVersion');

router.get('/app-versions', SA, async (req, res) => {
  try {
    // Auto-sync: make sure the current release (from appVersion.js, bumped on
    // every APK rebuild) is in the history, so a new version appears without
    // anyone clicking "Add version".
    if (CURRENT_APP?.version) {
      const { data: exists } = await supabase.from('app_versions')
        .select('id').eq('version', CURRENT_APP.version).maybeSingle();
      if (!exists) {
        await supabase.from('app_versions').insert({
          version:      CURRENT_APP.version,
          version_code: CURRENT_APP.versionCode ?? null,
          notes:        Array.isArray(CURRENT_APP.notes) ? CURRENT_APP.notes : [],
          released_at:  CURRENT_APP.releasedAt || new Date().toISOString(),
        });
      }
    }

    const { data, error } = await supabase.from('app_versions')
      .select('*')
      .order('version_code', { ascending: false, nullsFirst: false })
      .order('released_at', { ascending: false });
    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/app-versions', SA, async (req, res) => {
  try {
    const version = (req.body.version || '').toString().trim().slice(0, 20);
    if (!version) return res.status(400).json({ success: false, message: 'Version is required' });
    const vc = req.body.versionCode;
    const version_code = (vc === 0 || vc) && !isNaN(parseInt(vc, 10)) ? parseInt(vc, 10) : null;
    const notes = Array.isArray(req.body.notes)
      ? req.body.notes.map(n => String(n).trim()).filter(Boolean).slice(0, 20).map(n => n.slice(0, 200))
      : [];

    const { data, error } = await supabase.from('app_versions')
      .insert({ version, version_code, notes })
      .select().single();
    if (error) {
      if (error.code === '23505') return res.status(409).json({ success: false, message: `Version ${version} already exists` });
      throw error;
    }
    res.status(201).json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ─── ACTIVITY LOGS ────────────────────────────────────────────────────────────
// A single chronological feed of everything recorded across StayXPulse:
// registrations, logins, payments, checkout attempts, food orders, service
// requests, room changes and app releases. There is no dedicated audit table,
// so this stitches together every timestamped row into one stream. Read-only.
router.get('/logs', SA, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 300, 1000);
    const fromTs = req.query.from ? new Date(req.query.from).getTime() : null;
    const toTs   = req.query.to   ? new Date(req.query.to).getTime()   : null;
    const CAP = 400;   // per-source cap so one busy table can't crowd out the rest

    const [hotels, payments, orders, foodOrders, serviceReqs, rooms, users, appVersions] = await Promise.all([
      supabase.from('hotels').select('id, hotel_name, email, created_at').order('created_at', { ascending: false }).limit(CAP),
      supabase.from('payments').select('id, amount, invoice_number, paid_at, gateway, hotels(hotel_name), plans(name)').order('paid_at', { ascending: false }).limit(CAP),
      supabase.from('payment_orders').select('id, amount, status, txnid, initiated_at, paid_at, created_at, hotels(hotel_name), plans(name)').order('created_at', { ascending: false }).limit(CAP),
      supabase.from('food_orders').select('id, room_number, items, total_amount, status, created_at, hotels(hotel_name)').order('created_at', { ascending: false }).limit(CAP),
      supabase.from('service_requests').select('id, room_number, type, status, scheduled_for, created_at, hotels(hotel_name)').order('created_at', { ascending: false }).limit(CAP),
      supabase.from('rooms').select('id, number, type, created_at, hotels(hotel_name)').order('created_at', { ascending: false }).limit(CAP),
      supabase.from('users').select('name, email, role, last_login, hotels(hotel_name)').not('last_login', 'is', null).order('last_login', { ascending: false }).limit(CAP),
      supabase.from('app_versions').select('version, notes, released_at').order('released_at', { ascending: false }).limit(50),
    ]);

    const events = [];
    const add = (ts, category, icon, action, detail, hotel) => {
      if (!ts) return;
      events.push({ ts: new Date(ts).toISOString(), category, icon, action, detail: detail || '', hotel: hotel || null });
    };
    const money = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

    (hotels.data || []).forEach(h =>
      add(h.created_at, 'registration', '🏨', 'New hotel registered', h.email || '', h.hotel_name));

    (payments.data || []).forEach(p =>
      add(p.paid_at, 'payment', '💰', `Payment received · ${money(p.amount)}`,
          [p.plans?.name, p.invoice_number, p.gateway].filter(Boolean).join(' · '), p.hotels?.hotel_name));

    // Successful payments already come from the payments table above — from the
    // order table we surface only failed/abandoned attempts so it isn't doubled.
    (orders.data || []).filter(o => o.status !== 'paid').forEach(o => {
      const failed = o.status === 'failed';
      add(o.initiated_at || o.created_at, 'payment', failed ? '⚠️' : '🕓',
          `Checkout ${failed ? 'failed' : 'started'} · ${money(o.amount)}`,
          [o.plans?.name, o.txnid].filter(Boolean).join(' · '), o.hotels?.hotel_name);
    });

    (foodOrders.data || []).forEach(f => {
      const n = Array.isArray(f.items) ? f.items.length : 0;
      add(f.created_at, 'food', '🍽️', `Food order · Room ${f.room_number}`,
          `${n} item${n === 1 ? '' : 's'} · ${money(f.total_amount)} · ${f.status || 'pending'}`, f.hotels?.hotel_name);
    });

    (serviceReqs.data || []).forEach(s =>
      add(s.created_at, 'service', '🛎️', `Service request · Room ${s.room_number}`,
          [s.type, s.status, s.scheduled_for ? `for ${new Date(s.scheduled_for).toLocaleString('en-IN')}` : null].filter(Boolean).join(' · '), s.hotels?.hotel_name));

    (rooms.data || []).forEach(r =>
      add(r.created_at, 'room', '🚪', `Room ${r.number} added`, r.type || '', r.hotels?.hotel_name));

    (users.data || []).forEach(u =>
      add(u.last_login, 'login', '🔑', `Login · ${u.role || 'user'}`, u.email || '', u.hotels?.hotel_name));

    (appVersions.data || []).forEach(a =>
      add(a.released_at, 'system', '📱', `App v${a.version} released`,
          Array.isArray(a.notes) ? a.notes.join(' • ') : '', null));

    let feed = events.sort((a, b) => new Date(b.ts) - new Date(a.ts));
    if (fromTs) feed = feed.filter(e => new Date(e.ts).getTime() >= fromTs);
    if (toTs)   feed = feed.filter(e => new Date(e.ts).getTime() <= toTs);

    // Per-category counts across the whole (date-filtered) feed, before the cap,
    // so the filter chips show true totals.
    const counts = feed.reduce((m, e) => (m[e.category] = (m[e.category] || 0) + 1, m), {});

    res.json({ success: true, data: feed.slice(0, limit), counts, total: feed.length });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

module.exports = router;
