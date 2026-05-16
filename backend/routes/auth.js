const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');

const { User, Hotel } = require('../models');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');
const generateToken = require('../utils/token');
const { generateUserId, generatePassword } = require('../utils/credentials');
const { sendWelcomeEmail, sendForgotPasswordEmail } = require('../utils/email');

// ─── Validation helpers ───────────────────────────────────────────────────────
const validate = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, errors: errors.array() });
  }
  return null;
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/login
// ─────────────────────────────────────────────────────────────────────────────
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

      // Find user — allow login by email OR userId (for hotel admins)
      let user = await User.findOne({ email }).populate('hotel');
      if (!user) {
        // Try matching by userId on the Hotel model
        const hotel = await Hotel.findOne({ userId: email });
        if (hotel) user = await User.findOne({ hotel: hotel._id }).populate('hotel');
      }

      if (!user) {
        return res.status(401).json({ success: false, message: 'Invalid email or password.' });
      }
      if (!user.isActive) {
        return res.status(403).json({ success: false, message: 'Your account is disabled. Contact support.' });
      }

      const match = await user.matchPassword(password);
      if (!match) {
        return res.status(401).json({ success: false, message: 'Invalid email or password.' });
      }

      // For hotel admins — check hotel subscription status
      if (user.role === 'hoteladmin' && user.hotel) {
        const hotel = user.hotel;
        // Auto-expire trial
        if (hotel.subscriptionStatus === 'trial' && new Date() > hotel.trialEndDate) {
          hotel.subscriptionStatus = 'expired';
          await hotel.save();
        }
      }

      user.lastLogin = new Date();
      await user.save({ validateBeforeSave: false });

      const token = generateToken(user._id, rememberMe);

      res.json({
        success: true,
        token,
        user: {
          id:       user._id,
          name:     user.name,
          email:    user.email,
          role:     user.role,
          hotel:    user.hotel
            ? {
                id:                 user.hotel._id,
                hotelName:          user.hotel.hotelName,
                logoUrl:            user.hotel.logoUrl,
                gstNumber:          user.hotel.gstNumber,
                phone:              user.hotel.phone,
                subscriptionStatus: user.hotel.subscriptionStatus,
                trialEndDate:       user.hotel.trialEndDate,
                planValidTo:        user.hotel.planValidTo,
              }
            : null,
        },
      });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ success: false, message: 'Server error. Please try again.' });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/register   (public — hotel self-registration)
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/register',
  upload.single('logo'),
  async (req, res) => {
    try {
      const { hotelName, phone, email, address, gstNumber } = req.body;

      // Basic validation
      if (!hotelName || !hotelName.trim()) return res.status(400).json({ success: false, message: 'Hotel name is required.' });
      if (!phone     || !phone.trim())     return res.status(400).json({ success: false, message: 'Phone number is required.' });
      if (!email     || !email.trim())     return res.status(400).json({ success: false, message: 'Email address is required.' });
      if (!address   || !address.trim())   return res.status(400).json({ success: false, message: 'Address is required.' });
      if (!gstNumber || !gstNumber.trim()) return res.status(400).json({ success: false, message: 'GST number is required.' });

      const cleanEmail = email.toLowerCase().trim();

      // Check duplicates
      const existingHotel = await Hotel.findOne({ email: cleanEmail });
      if (existingHotel) return res.status(409).json({ success: false, message: 'This email is already registered.' });

      const existingUser = await User.findOne({ email: cleanEmail });
      if (existingUser) return res.status(409).json({ success: false, message: 'This email is already in use.' });

      // Generate credentials
      const userId   = await generateUserId();
      const password = generatePassword();

      // Logo URL
      const logoUrl = req.file ? `/uploads/logos/${req.file.filename}` : null;

      // Create hotel
      const hotel = await Hotel.create({
        hotelName:          hotelName.trim(),
        phone:              phone.trim(),
        email:              cleanEmail,
        address:            address.trim(),
        gstNumber:          gstNumber.trim().toUpperCase(),
        logoUrl,
        userId,
        isActive:           true,
        subscriptionStatus: 'trial',
      });

      // Create hotel admin user
      await User.create({
        name:     hotelName.trim(),
        email:    cleanEmail,
        password,
        role:     'hoteladmin',
        hotel:    hotel._id,
        isActive: true,
      });

      // Send welcome email — never blocks registration
      try {
        await sendWelcomeEmail({ hotelName: hotelName.trim(), email: cleanEmail, userId, password, trialEndDate: hotel.trialEndDate });
      } catch (emailErr) {
        console.error('Welcome email failed (registration succeeded):', emailErr.message);
      }

      console.log(`✅ Hotel registered: ${hotelName} (${cleanEmail}) — UserID: ${userId}`);

      res.status(201).json({
        success: true,
        message: 'Hotel registered successfully! Check your email for login credentials.',
        data: { hotelId: hotel._id, hotelName: hotel.hotelName, userId, trialEndDate: hotel.trialEndDate },
      });
    } catch (err) {
      console.error('Register error:', err.message, 'Code:', err.code);
      if (err.code === 11000) {
        const field = Object.keys(err.keyPattern || {})[0] || '';
        const msg = field.includes('email') ? 'This email is already registered.' :
                    field.includes('userId') ? 'Please try again.' :
                    'A hotel with these details already exists.';
        return res.status(409).json({ success: false, message: msg });
      }
      res.status(500).json({ success: false, message: err.message || 'Server error. Please try again.' });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/forgot-password
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/forgot-password',
  [body('email').isEmail().withMessage('Valid email is required').normalizeEmail()],
  async (req, res) => {
    const err = validate(req, res); if (err) return;

    try {
      const user = await User.findOne({ email: req.body.email });

      // Always return success to prevent user enumeration
      if (!user) {
        return res.json({ success: true, message: 'If that email exists, a reset link has been sent.' });
      }

      // Generate reset token
      const rawToken  = crypto.randomBytes(32).toString('hex');
      const hashToken = crypto.createHash('sha256').update(rawToken).digest('hex');

      user.resetPasswordToken  = hashToken;
      user.resetPasswordExpire = Date.now() + 15 * 60 * 1000; // 15 min
      await user.save({ validateBeforeSave: false });

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

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/reset-password/:token
// ─────────────────────────────────────────────────────────────────────────────
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
      const hashToken = crypto
        .createHash('sha256')
        .update(req.params.token)
        .digest('hex');

      const user = await User.findOne({
        resetPasswordToken:  hashToken,
        resetPasswordExpire: { $gt: Date.now() },
      });

      if (!user) {
        return res.status(400).json({ success: false, message: 'Reset link is invalid or has expired.' });
      }

      user.password = req.body.password;
      user.resetPasswordToken  = undefined;
      user.resetPasswordExpire = undefined;
      await user.save();

      res.json({ success: true, message: 'Password reset successful. You can now log in.' });
    } catch (err) {
      console.error('Reset password error:', err);
      res.status(500).json({ success: false, message: 'Server error. Please try again.' });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/me   (protected)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/me', protect, async (req, res) => {
  res.json({ success: true, user: req.user });
});

module.exports = router;
