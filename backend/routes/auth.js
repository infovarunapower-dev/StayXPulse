const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { logoUpload, uploadHotelLogo } = require('../utils/logoUpload');
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
router.post('/register', logoUpload.single('logo'), async (req, res) => {
  try {
    const { hotelName, phone, email, address, gstNumber, intent } = req.body;
    const isBuy = intent === 'buy';   // direct-purchase: no free trial
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
    if (!isBuy) trialEndDate.setDate(trialEndDate.getDate() + 3);   // 3-day trial (skipped for direct-buy)

    // The logo used to be parsed and then silently dropped — logo_url was never
    // written, so every hotel's logo was NULL while the signup form said
    // "✅ Uploaded".
    const logoUrl = await uploadHotelLogo(req.file);

    const { data: hotel, error: hotelError } = await supabase.from('hotels').insert({
      hotel_name: hotelName.trim(), phone: phone.trim(), email: cleanEmail,
      address: address.trim(), gst_number: gstNumber.trim().toUpperCase(),
      logo_url: logoUrl,
      user_id: userId, is_active: true,
      subscription_status: isBuy ? 'expired' : 'trial',   // direct-buy has no trial → must subscribe to activate
      trial_end_date: trialEndDate.toISOString(),
    }).select().single();
    if (hotelError) throw hotelError;

    const { error: userError } = await supabase.from('users').insert({
      name: hotelName.trim(), email: cleanEmail, password_hash: hashedPassword,
      role: 'hoteladmin', hotel_id: hotel.id, is_active: true,
    });
    if (userError) throw userError;

    // Credentials go ONLY to the address entered on the signup form — this is the
    // one time the plaintext password exists, so a silent failure would strand the
    // hotel. Report the real outcome instead of always saying "check your email".
    let mailed = false;
    let mailError = null;
    try {
      const r = await sendWelcomeEmail({ hotelName: hotelName.trim(), email: cleanEmail, userId, password, trialEndDate });
      mailed = r?.success !== false;
      if (!mailed) mailError = r?.error || 'unknown send failure';
      // Test mode logs instead of sending, so the hotel gets nothing — treat it
      // as "not delivered" for the purposes of showing the fallback below.
      if (r?.mode === 'test') { mailed = false; mailError = 'EMAIL_TEST_MODE is on — nothing was sent'; }
      console.log(`📧 Welcome email → ${cleanEmail} : ${mailed ? 'ok' : 'NOT DELIVERED'}${r?.mode ? ` (${r.mode} mode)` : ''}${mailError ? ` — ${mailError}` : ''}`);
    } catch (e) {
      mailError = e.message;
      console.error(`📧 Welcome email → ${cleanEmail} threw:`, e.message);
    }

    res.status(201).json({
      success: true,
      message: mailed
        ? `Hotel registered successfully! Login credentials have been sent to ${cleanEmail}.`
        : `Hotel registered! We could not email your credentials, so please save them from this screen now.`,
      data: {
        hotelId: hotel.id, hotelName: hotel.hotel_name, userId, trialEndDate,
        emailSent: mailed, emailedTo: cleanEmail,
        // Last-resort delivery. The generated password exists in plaintext only
        // here — the DB stores a bcrypt hash — so if the mail did not go out,
        // showing it to the person who just registered (over HTTPS, in their own
        // session) is the difference between a working account and a dead one.
        credentials: mailed ? null : { userId, email: cleanEmail, password },
        intent: isBuy ? 'buy' : 'trial',
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Server error.' });
  }
});

// POST /api/auth/forgot-password
// Emails a single-use, 1-hour reset LINK (not a password). Always returns a
// generic success so the endpoint can't be used to discover which emails exist.
router.post('/forgot-password', async (req, res) => {
  const generic = { success: true, message: 'If that email is registered, a password reset link has been sent.' };
  try {
    const email = (req.body.email || '').toLowerCase().trim();
    if (!email) return res.json(generic);

    const { data: users } = await supabase.from('users').select('id, name, email').eq('email', email);
    const user = users && users[0];
    if (user) {
      const rawToken  = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex'); // hashed at rest
      const expire    = new Date(Date.now() + 60 * 60 * 1000).toISOString();         // 1 hour

      await supabase.from('users')
        .update({ reset_password_token: tokenHash, reset_password_expire: expire })
        .eq('id', user.id);

      const CLIENT_URL = require('../utils/clientUrl');
      const { sendForgotPasswordEmail } = require('../utils/email');
      const resetUrl = `${CLIENT_URL}/reset-password/${rawToken}`;
      try { await sendForgotPasswordEmail({ email: user.email, name: user.name, resetUrl }); }
      catch (e) { console.error('Reset email error:', e.message); }
    }
    return res.json(generic);
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/auth/reset-password/:token
// Verifies the token and sets the user's OWN new password.
router.post('/reset-password/:token', async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || String(password).length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
    }

    const tokenHash = crypto.createHash('sha256').update(req.params.token).digest('hex');
    const { data: users } = await supabase.from('users')
      .select('id, reset_password_expire')
      .eq('reset_password_token', tokenHash);
    const user = users && users[0];

    if (!user || !user.reset_password_expire || new Date(user.reset_password_expire).getTime() < Date.now()) {
      return res.status(400).json({ success: false, message: 'This reset link is invalid or has expired. Please request a new one.' });
    }

    const hashed = await bcrypt.hash(password, 12);
    await supabase.from('users')
      .update({ password_hash: hashed, reset_password_token: null, reset_password_expire: null })  // single-use
      .eq('id', user.id);

    return res.json({ success: true, message: 'Password reset successful. You can now log in with your new password.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/auth/me
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ success: false, message: 'Not authorized.' });
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    const { data: users } = await supabase.from('users').select('*').eq('id', decoded.id);
    if (!users || users.length === 0) return res.status(404).json({ success: false, message: 'User not found.' });

    const user = users[0];
    // This route verifies the JWT inline rather than going through `protect`,
    // so it has to repeat protect's deactivated-account check — otherwise a
    // hotel disabled by the superadmin keeps getting its profile back until
    // the token expires.
    if (user.is_active === false) return res.status(403).json({ success: false, message: 'Account is deactivated.' });

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