const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { protect, authorize }     = require('../middleware/auth');
const supabase = require('../utils/supabase');
const { sendTrialReminderEmail, sendExpiryReminderEmail, sendPasswordResetByAdminEmail } = require('../utils/email');
const { generateOrderRecordPDF } = require('../utils/invoice');

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
router.get('/payments/:id/order-record', SA, async (req, res) => {
  try {
    const { data: payment, error } = await supabase
      .from('payments')
      .select('*, hotels(*), plans(*)')
      .eq('id', req.params.id)
      .single();
    if (error || !payment) return res.status(404).json({ success: false, message: 'Payment not found.' });

    const pdf = await generateOrderRecordPDF({ payment, hotel: payment.hotels || {}, plan: payment.plans || {} });
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

    let daysLeft = 0;
    if (hotel.subscription_status === 'trial' && hotel.trial_end_date) {
      daysLeft = Math.max(0, Math.ceil((new Date(hotel.trial_end_date) - Date.now()) / 86400000));
      await sendTrialReminderEmail({ hotelName: hotel.hotel_name, email: hotel.email, daysLeft, trialEndDate: hotel.trial_end_date });
    } else if (hotel.plan_valid_to) {
      daysLeft = Math.max(0, Math.ceil((new Date(hotel.plan_valid_to) - Date.now()) / 86400000));
      const { data: plan } = await supabase.from('plans').select('name').eq('id', hotel.current_plan_id).single();
      await sendExpiryReminderEmail({ hotelName: hotel.hotel_name, email: hotel.email, planName: plan?.name || 'Subscription', daysLeft, expiryDate: hotel.plan_valid_to });
    }
    res.json({ success: true, message: `Reminder sent to ${hotel.email}` });
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

    await sendPasswordResetByAdminEmail({ hotelName: hotel.hotel_name, email: hotel.email, newPassword });
    res.json({ success: true, data: { hotelName: hotel.hotel_name, userId: hotel.user_id, email: hotel.email, password: newPassword } });
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

module.exports = router;
