const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');

const supabase = require('../utils/supabase');
const generateToken = require('../utils/token');
const { generateUserId, generatePassword } = require('../utils/credentials');
const { sendWelcomeEmail, sendForgotPasswordEmail } = require('../utils/email');

const validate = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, errors: errors.array() });
  }
  return null;
};

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
router.post(
  '/login',
  [
    body('email').notEmpty().withMessage('Email or User ID is required').trim(),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  async (req, res) => {
    const err = validate(req, res); if (err) return;

    try {
      const { email, password, rememberMe = false } = req.body;

      // Find user by email
      let { data: user } = await supabase
        .from('users')
        .select('*, hotels(*)')
        .eq('email', email.toLowerCase().trim())
        .single();

      // If not found by email, try userId on hotels table
      if (!user) {
        const { data: hotel } = await supabase
          .from('hotels')
          .select('*')
          .eq('user_id', email)
          .single();

        if (hotel) {
          const { data: hotelUser } = await supabase
            .from('users')
            .select('*, hotels(*)')
            .eq('hotel_id', hotel.id)
            .single();
          user = hotelUser;
        }
      }

      if (!user) {
        return res.status(401).json({ success: false, message: 'Invalid email or password.' });
      }
      if (!user.is_active) {
        return res.status(403).json({ success: false, message: 'Your account is disabled. Contact support.' });
      }

      const match = await bcrypt.compare(password, user.password);
      if (!match) {
        return res.status(401).json({ success: false, message: 'Invalid email or password.' });
      }

      // Auto-expire trial for hotel admins
      if (user.role === 'hoteladmin' && user.hotels) {
        const hotel = user.hotels;
        if (hotel.subscription_status === 'trial' && new Date() > new Date(hotel.trial_end_date)) {
          await supabase
            .from('hotels')
            .update({ subscription_status: 'expired' })
            .eq('id', hotel.id);
          hotel.subscription_status = 'expired';
        }
      }

      // Update last login
      await supabase
        .from('users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', user.id);

      const token = generateToken(user.id, rememberMe);
      const hotel = user.hotels;

      res.json({
        success: true,
        token,
        user: {
          id:    user.id,
          name:  user.name,
          email: user.email,
          role:  user.role,
          hotel: hotel ? {
            id:                 hotel.id,
            hotelName:          hotel.hotel_name,
            logoUrl:            hotel.logo_url,
            gstNumber:          hotel.gst_number,
            phone:              hotel.phone,
            subscriptionStatus: hotel.subscription_status,
            trialEndDate:       hotel.trial_end_date,
            planValidTo:        hotel.plan_valid_to,
          } : null,
        },
      });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ success: false, message: 'Server error. Please try again.' });
    }
  }
);

// ─── POST /api/auth/register ──────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { hotelName, phone, email, address, gstNumber } = req.body;

    if (!hotelName?.trim()) return res.status(400).json({ success: false, message: 'Hotel name is required.' });
    if (!phone?.trim())     return res.status(400).json({ success: false, message: 'Phone number is required.' });
    if (!email?.trim())     return res.status(400).json({ success: false, message: 'Email address is required.' });
    if (!address?.trim())   return res.status(400).json({ success: false, message: 'Address is required.' });
    if (!gstNumber?.trim()) return res.status(400).json({ success: false, message: 'GST number is required.' });

    const cleanEmail = email.toLowerCase().trim();

    // Check duplicates
    const { data: existingHotel } = await supabase.from('hotels').select('id').eq('email', cleanEmail).single();
    if (existingHotel) return res.status(409).json({ success: false, message: 'This email is already registered.' });

    const { data: existingUser } = await supabase.from('users').select('id').eq('email', cleanEmail).single();
    if (existingUser) return res.status(409).json({ success: false, message: 'This email is already in use.' });

    const userId   = await generateUserId();
    const password = generatePassword();
    const hashedPassword = await bcrypt.hash(password, 12);

    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 14);

    // Create hotel
    const { data: hotel, error: hotelError } = await supabase
      .from('hotels')
      .insert({
        hotel_name:          hotelName.trim(),
        phone:               phone.trim(),
        email:               cleanEmail,
        address:             address.trim(),
        gst_number:          gstNumber.trim().toUpperCase(),
        user_id:             userId,
        is_active:           true,
        subscription_status: 'trial',
        trial_end_date:      trialEndDate.toISOString(),
      })
      .select()
      .single();

    if (hotelError) throw hotelError;

    // Create hotel admin user
    const { error: userError } = await supabase
      .from('users')
      .insert({
        name:      hotelName.trim(),
        email:     cleanEmail,
        password:  hashedPassword,
        role:      'hoteladmin',
        hotel_id:  hotel.id,
        is_active: true,
      });

    if (userError) throw userError;

    // Send welcome email
    try {
      await sendWelcomeEmail({ hotelName: hotelName.trim(), email: cleanEmail, userId, password, trialEndDate });
    } catch (emailErr) {
      console.error('Welcome email failed:', emailErr.message);
    }

    res.status(201).json({
      success: true,
      message: 'Hotel registered successfully! Check your email for login credentials.',
      data: { hotelId: hotel.id, hotelName: hotel.hotel_name, userId, trialEndDate },
    });
  } catch (err) {
    console.error('Register error:', err.message);
    res.status(500).json({ success: false, message: err.message || 'Server error. Please try again.' });
  }
});

// ─── POST /api/auth/forgot-password ──────────────────────────────────────────
router.post(
  '/forgot-password',
  [body('email').isEmail().withMessage('Valid email is required').normalizeEmail()],
  async (req, res) => {
    const err = validate(req, res); if (err) return;

    try {
      const { data: user } = await supabase
        .from('users')
        .select('id, name, email')
        .eq('email', req.body.email)
        .single();

      if (!user) {
        return res.json({ success: true, message: 'If that email exists, a reset link has been sent.' });
      }

      const rawToken  = crypto.randomBytes(32).toString('hex');
      const hashToken = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiry    = new Date(Date.now() + 15 * 60 * 1000).toISOString();

      await supabase.from('users').update({
        reset_password_token:  hashToken,
        reset_password_expire: expiry,
      }).eq('id', user.id);

      const resetUrl = `${process.env.CLIENT_URL}/reset-password/${rawToken}`;

      try {
        await sendForgotPasswordEmail({ email: user.email, name: user.name, resetUrl });
      } catch (emailErr) {
        console.error('Forgot password email failed:', emailErr.message);
      }

      res.json({ success: true, message: 'If that email exists, a reset link has been sent.' });
    } catch (err) {
      console.error('Forgot password error:', err);
      res.status(500).json({ success: false, message: 'Server error. Please try again.' });
    }
  }
);

// ─── POST /api/auth/reset-password/:token ────────────────────────────────────
router.post(
  '/reset-password/:token',
  [
    body('password')
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
      .matches(/[A-Z]/).withMessage('Password must contain an uppercase letter')
      .matches(/[0-9]/).withMessage('Password must contain a number'),
  ],
  async (req, res) => {
    const err = validate(req, res); if (err) return;

    try {
      const hashToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

      const { data: user } = await supabase
        .from('users')
        .select('id, reset_password_expire')
        .eq('reset_password_token', hashToken)
        .single();

      if (!user || new Date(user.reset_password_expire) < new Date()) {
        return res.status(400).json({ success: false, message: 'Reset link is invalid or has expired.' });
      }

      const hashedPassword = await bcrypt.hash(req.body.password, 12);

      await supabase.from('users').update({
        password:              hashedPassword,
        reset_password_token:  null,
        reset_password_expire: null,
      }).eq('id', user.id);

      res.json({ success: true, message: 'Password reset successful. You can now log in.' });
    } catch (err) {
      console.error('Reset password error:', err);
      res.status(500).json({ success: false, message: 'Server error. Please try again.' });
    }
  }
);

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Not authorized.' });
    }
    const token = authHeader.split(' ')[1];
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const { data: user } = await supabase
      .from('users')
      .select('*, hotels(*)')
      .eq('id', decoded.id)
      .single();

    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    res.json({ success: true, user });
  } catch (err) {
    res.status(401).json({ success: false, message: 'Not authorized.' });
  }
});

module.exports = router;
