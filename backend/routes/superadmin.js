const express = require('express');
const router  = express.Router();
const { body, validationResult } = require('express-validator');
const { protect, authorize }     = require('../middleware/auth');
const { User, Hotel, Plan, Payment } = require('../models');
const { sendTrialReminderEmail, sendExpiryReminderEmail, sendPasswordResetByAdminEmail } = require('../utils/email');

const SA = [protect, authorize('superadmin')];

const validate = (req, res) => {
  const e = validationResult(req);
  if (!e.isEmpty()) return res.status(422).json({ success: false, errors: e.array() });
  return null;
};

// ─── DASHBOARD SUMMARY ────────────────────────────────────────────────────────
router.get('/summary', SA, async (req, res) => {
  try {
    const [totalHotels, activeHotels, trialHotels, expiredHotels, totalRevenue, recentPayments] =
      await Promise.all([
        Hotel.countDocuments(),
        Hotel.countDocuments({ subscriptionStatus: 'active' }),
        Hotel.countDocuments({ subscriptionStatus: 'trial' }),
        Hotel.countDocuments({ subscriptionStatus: 'expired' }),
        Payment.aggregate([{ $group: { _id: null, total: { $sum: '$amount' } } }]),
        Payment.find().sort({ paidAt: -1 }).limit(5).populate('hotel', 'hotelName email').populate('plan', 'name'),
      ]);

    // Monthly revenue (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const monthlyRevenue = await Payment.aggregate([
      { $match: { paidAt: { $gte: sixMonthsAgo } } },
      { $group: { _id: { year: { $year: '$paidAt' }, month: { $month: '$paidAt' } }, revenue: { $sum: '$amount' } } },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    // Expiring soon (next 7 days)
    const in7 = new Date(); in7.setDate(in7.getDate() + 7);
    const expiringSoon = await Hotel.find({
      subscriptionStatus: 'active',
      planValidTo: { $lte: in7, $gte: new Date() },
    }).select('hotelName email planValidTo');

    res.json({
      success: true,
      data: {
        stats: { totalHotels, activeHotels, trialHotels, expiredHotels,
                 totalRevenue: totalRevenue[0]?.total || 0 },
        monthlyRevenue,
        recentPayments,
        expiringSoon,
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
    const query = {};
    if (status) query.subscriptionStatus = status;
    if (search) query.$or = [
      { hotelName: { $regex: search, $options: 'i' } },
      { email:     { $regex: search, $options: 'i' } },
    ];

    const [hotels, total] = await Promise.all([
      Hotel.find(query)
        .populate('currentPlan', 'name price')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit)),
      Hotel.countDocuments(query),
    ]);

    // Attach userId from User model
    const userMap = {};
    const users = await User.find({ role: 'hoteladmin', hotel: { $in: hotels.map(h => h._id) } }).select('hotel email');
    users.forEach(u => { userMap[u.hotel.toString()] = u.email; });

    res.json({ success: true, data: hotels, total, page: Number(page),
               pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET single hotel
router.get('/hotels/:id', SA, async (req, res) => {
  try {
    const hotel = await Hotel.findById(req.params.id).populate('currentPlan');
    if (!hotel) return res.status(404).json({ success: false, message: 'Hotel not found' });
    const user  = await User.findOne({ hotel: hotel._id }).select('email lastLogin isActive');
    res.json({ success: true, data: { hotel, user } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH toggle hotel active status
router.patch('/hotels/:id/toggle', SA, async (req, res) => {
  try {
    const hotel = await Hotel.findById(req.params.id);
    if (!hotel) return res.status(404).json({ success: false, message: 'Hotel not found' });
    const user  = await User.findOne({ hotel: hotel._id });
    if (user) { user.isActive = !user.isActive; await user.save(); }
    res.json({ success: true, message: `Hotel ${user?.isActive ? 'activated' : 'deactivated'}` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── ACTIVATE PLAN (manually by super admin) ──────────────────────────────────
router.post(
  '/hotels/:id/activate',
  [...SA,
    body('planId').notEmpty().withMessage('Plan is required'),
    body('paymentId').notEmpty().withMessage('Payment ID is required'),
    body('validFrom').isISO8601().withMessage('Valid from date required'),
    body('validTo').isISO8601().withMessage('Valid to date required'),
    body('amount').isNumeric().withMessage('Amount is required'),
  ],
  async (req, res) => {
    const err = validate(req, res); if (err) return;
    try {
      const { planId, paymentId, validFrom, validTo, amount, notes } = req.body;
      const hotel = await Hotel.findById(req.params.id);
      if (!hotel) return res.status(404).json({ success: false, message: 'Hotel not found' });

      const payment = await Payment.create({
        hotel: hotel._id, plan: planId, amount: Number(amount),
        paymentId, validFrom: new Date(validFrom), validTo: new Date(validTo), notes,
      });

      hotel.subscriptionStatus = 'active';
      hotel.currentPlan        = planId;
      hotel.planValidFrom      = new Date(validFrom);
      hotel.planValidTo        = new Date(validTo);
      hotel.isActive           = true;
      await hotel.save();

      await payment.populate('plan', 'name');
      res.json({ success: true, message: 'Plan activated successfully', data: payment });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ─── PAID HOTELS ─────────────────────────────────────────────────────────────
router.get('/paid-hotels', SA, async (req, res) => {
  try {
    const hotels = await Hotel.find({ subscriptionStatus: { $in: ['active', 'expired'] } })
      .populate('currentPlan', 'name price')
      .sort({ planValidTo: 1 });
    res.json({ success: true, data: hotels });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── PAYMENT HISTORY ─────────────────────────────────────────────────────────
router.get('/payments', SA, async (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const query = {};
    const payments = await Payment.find(query)
      .populate('hotel', 'hotelName email')
      .populate('plan',  'name')
      .sort({ paidAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Payment.countDocuments(query);
    const totalRevenue = await Payment.aggregate([{ $group: { _id: null, sum: { $sum: '$amount' } } }]);

    res.json({ success: true, data: payments, total,
               totalRevenue: totalRevenue[0]?.sum || 0,
               page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── PLANS CRUD ───────────────────────────────────────────────────────────────
router.get('/plans', SA, async (req, res) => {
  try {
    const plans = await Plan.find().sort({ price: 1 });
    res.json({ success: true, data: plans });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/plans',
  [...SA,
    body('name').notEmpty(), body('price').isNumeric(),
    body('durationDays').isNumeric(), body('maxRooms').isNumeric(),
  ],
  async (req, res) => {
    const err = validate(req, res); if (err) return;
    try {
      const plan = await Plan.create(req.body);
      res.status(201).json({ success: true, data: plan });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.put('/plans/:id', SA, async (req, res) => {
  try {
    const plan = await Plan.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });
    res.json({ success: true, data: plan });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/plans/:id', SA, async (req, res) => {
  try {
    await Plan.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Plan deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── SEND REMINDER EMAIL ──────────────────────────────────────────────────────
router.post('/reminders/:hotelId', SA, async (req, res) => {
  try {
    const hotel = await Hotel.findById(req.params.hotelId);
    if (!hotel) return res.status(404).json({ success: false, message: 'Hotel not found' });

    let daysLeft = 0;
    if (hotel.subscriptionStatus === 'trial') {
      daysLeft = Math.max(0, Math.ceil((hotel.trialEndDate - Date.now()) / 86400000));
    } else if (hotel.planValidTo) {
      daysLeft = Math.max(0, Math.ceil((hotel.planValidTo - Date.now()) / 86400000));
    }

    if (hotel.subscriptionStatus === 'trial') {
      await sendTrialReminderEmail({ hotelName: hotel.hotelName, email: hotel.email, daysLeft, trialEndDate: hotel.trialEndDate });
    } else {
      const plan = hotel.currentPlan ? (await require('../models/Plan').findById(hotel.currentPlan)) : null;
      await sendExpiryReminderEmail({ hotelName: hotel.hotelName, email: hotel.email, planName: plan?.name || 'Subscription', daysLeft, expiryDate: hotel.planValidTo });
    }
    res.json({ success: true, message: `Reminder sent to ${hotel.email}` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});


// ─── VIEW HOTEL CREDENTIALS ───────────────────────────────────────────────────
router.get('/hotels/:id/credentials', SA, async (req, res) => {
  try {
    const hotel = await Hotel.findById(req.params.id);
    if (!hotel) return res.status(404).json({ success: false, message: 'Hotel not found' });
    res.json({ success: true, data: { hotelName: hotel.hotelName, userId: hotel.userId, email: hotel.email, password: '(hidden — click Reset Password to generate a new one)' } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/hotels/:id/reset-credentials', SA, async (req, res) => {
  try {
    const { generatePassword } = require('../utils/credentials');
    const hotel = await Hotel.findById(req.params.id);
    if (!hotel) return res.status(404).json({ success: false, message: 'Hotel not found' });
    const user = await User.findOne({ hotel: hotel._id });
    if (!user) return res.status(404).json({ success: false, message: 'Hotel user not found' });
    const newPassword = generatePassword();
    user.password = newPassword;
    await user.save();
    // Send new credentials by email
    await sendPasswordResetByAdminEmail({ hotelName: hotel.hotelName, email: hotel.email, userId: hotel.userId, newPassword });
    res.json({ success: true, data: { hotelName: hotel.hotelName, userId: hotel.userId, email: hotel.email, password: newPassword } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});


// ─── RESET HOTEL PASSWORD ────────────────────────────────────────────────────
router.post('/hotels/:id/reset-password', SA, async (req, res) => {
  try {
    const { generatePassword } = require('../utils/credentials');
    const hotel = await Hotel.findById(req.params.id);
    if (!hotel) return res.status(404).json({ success: false, message: 'Hotel not found' });
    const user = await User.findOne({ hotel: hotel._id });
    if (!user) return res.status(404).json({ success: false, message: 'Hotel user not found' });

    const newPassword = generatePassword();
    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      data: {
        hotelName: hotel.hotelName,
        email:     hotel.email,
        userId:    hotel.userId,
        password:  newPassword,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
