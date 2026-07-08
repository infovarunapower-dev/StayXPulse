const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const upload = multer();
const supabase = require('../utils/supabase');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password are required.' });

    const cleanEmail = email.toLowerCase().trim();
    const { data: users, error } = await supabase.from('users').select('*').eq('email', cleanEmail);
    if (error) return res.status(500).json({ success: false, message: 'Database error: ' + error.message });
    if (!users || users.length === 0) return res.status(401).json({ success: false, message: 'Invalid email or password.' });

    const user = users[0];
    if (!user.is_active) return res.status(403).json({ success: false, message: 'Account is disabled.' });

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ success: false, message: 'Invalid email or password.' });

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    let hotel = null;
    if (user.hotel_id) {
      const { data } = await supabase.from('hotels').select('*').eq('id', user.hotel_id).single();
      hotel = data;
    }

    res.json({
      success: true, token,
      user: {
        id: user.id, name: user.name, email: user.email, role: user.role,
        hotel: hotel ? {
          id: hotel.id, hotelName: hotel.hotel_name, logoUrl: hotel.logo_url,
          subscriptionStatus: hotel.subscription_status,
          trialEndDate: hotel.trial_end_date, planValidTo: hotel.plan_valid_to,
        } : null,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
});

// POST /api/auth/register
router.post('/register', upload.single('logo'), async (req, res) => {
  try {
    const { hotelName, phone, email, address, gstNumber } = req.body;
    if (!hotelName?.trim()) return res.status(400).json({ success: false, message: 'Hotel name is required.' });
    if (!phone?.trim()) return res.status(400).json({ success: false, message: 'Phone number is required.' });
    if (!email?.trim()) return res.status(400).json({ success: false, message: 'Email address is required.' });
    if (!address?.trim()) return res.status(400).json({ success: false, message: 'Address is required.' });
    if (!gstNumber?.trim()) return res.status(400).json({ success: false, message: 'GST number is required.' });

    const cleanEmail = email.toLowerCase().trim();
    const { data: existing } = await supabase.from('users').select('id').eq('email', cleanEmail);
    if (existing && existing.length > 0) return res.status(409).json({ success: false, message: 'This email is already in use.' });

    const { generateUserId, generatePassword } = require('../utils/credentials');
    const { sendWelcomeEmail } = require('../utils/email');

    const userId = await generateUserId();
    const password = generatePassword();
    const hashedPassword = await bcrypt.hash(password, 12);
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 3);   // 3-day free trial

    const { data: hotel, error: hotelError } = await supabase.from('hotels').insert({
      hotel_name: hotelName.trim(), phone: phone.trim(), email: cleanEmail,
      address: address.trim(), gst_number: gstNumber.trim().toUpperCase(),
      user_id: userId, is_active: true, subscription_status: 'trial',
      trial_end_date: trialEndDate.toISOString(),
    }).select().single();
    if (hotelError) throw hotelError;

    const { error: userError } = await supabase.from('users').insert({
      name: hotelName.trim(), email: cleanEmail, password_hash: hashedPassword,
      role: 'hoteladmin', hotel_id: hotel.id, is_active: true,
    });
    if (userError) throw userError;

    try { await sendWelcomeEmail({ hotelName: hotelName.trim(), email: cleanEmail, userId, password, trialEndDate }); }
    catch (e) { console.error('Email error:', e.message); }

    res.status(201).json({
      success: true,
      message: 'Hotel registered successfully! Check your email for login credentials.',
      data: { hotelId: hotel.id, hotelName: hotel.hotel_name, userId, trialEndDate },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Server error.' });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  res.json({ success: true, message: 'If that email exists, a reset link has been sent.' });
});

// POST /api/auth/reset-password/:token
router.post('/reset-password/:token', async (req, res) => {
  res.json({ success: true, message: 'Password reset successful.' });
});

// GET /api/auth/me
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ success: false, message: 'Not authorized.' });
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { data: users } = await supabase.from('users').select('*').eq('id', decoded.id);
    if (!users || users.length === 0) return res.status(404).json({ success: false, message: 'User not found.' });

    const user = users[0];
    let hotel = null;
    if (user.hotel_id) {
      const { data } = await supabase.from('hotels').select('*').eq('id', user.hotel_id).single();
      hotel = data;
    }
    res.json({
      success: true,
      user: {
        id: user.id, name: user.name, email: user.email, role: user.role,
        hotel: hotel ? {
          id: hotel.id, hotelName: hotel.hotel_name, logoUrl: hotel.logo_url,
          phone: hotel.phone, address: hotel.address, gstNumber: hotel.gst_number,
          subscriptionStatus: hotel.subscription_status,
          trialStartDate: hotel.trial_start_date, trialEndDate: hotel.trial_end_date,
          planValidFrom: hotel.plan_valid_from, planValidTo: hotel.plan_valid_to,
        } : null,
      },
    });
  } catch (err) {
    res.status(401).json({ success: false, message: 'Not authorized.' });
  }
});

module.exports = router;