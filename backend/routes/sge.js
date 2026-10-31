// ─────────────────────────────────────────────────────────────────────────────
//  Sunver Growth Engine — read-only trial/plan status lookup (Requirement 4).
//  GET /api/sge/account-status?phone=+91... | &email=...
//  Auth: Authorization: Bearer <SGE_LOOKUP_TOKEN>. Returns ONLY status fields —
//  no orders, guests or payment details.
// ─────────────────────────────────────────────────────────────────────────────
const express  = require('express');
const crypto   = require('crypto');
const router   = express.Router();
const supabase = require('../utils/supabase');
const { e164 } = require('../utils/sge');

const lookupAuth = (req, res, next) => {
  const expected = process.env.SGE_LOOKUP_TOKEN || '';
  const h = req.headers.authorization || '';
  const tok = h.startsWith('Bearer ') ? h.slice(7) : '';
  const ok = expected.length > 0 && tok.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(tok), Buffer.from(expected));
  if (!ok) return res.status(401).json({ error: 'unauthorized' });
  next();
};

const dayMs = 86400000;
const daysLeft = (iso) => {
  if (!iso) return 0;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / dayMs));
};

router.get('/account-status', lookupAuth, async (req, res) => {
  try {
    const email = req.query.email ? String(req.query.email).toLowerCase().trim() : null;
    const phone = req.query.phone ? String(req.query.phone) : null;

    let hotel = null;
    if (email) {
      const { data } = await supabase.from('hotels')
        .select('hotel_name, subscription_status, trial_end_date, plan_valid_to, current_plan_id, plans:current_plan_id(name)')
        .eq('email', email).limit(1);
      hotel = (data && data[0]) || null;
    }
    if (!hotel && phone) {
      // Match on the last 10 digits so stored formats (+91…, spaces, 0-prefix) still hit.
      const norm = e164(phone) || '';
      const last10 = norm.replace(/\D/g, '').slice(-10);
      if (last10) {
        const { data } = await supabase.from('hotels')
          .select('hotel_name, subscription_status, trial_end_date, plan_valid_to, current_plan_id, plans:current_plan_id(name)')
          .ilike('phone', `%${last10}%`).limit(1);
        hotel = (data && data[0]) || null;
      }
    }

    if (!hotel) return res.json({ found: false });

    const now = Date.now();
    const planActive = hotel.subscription_status === 'active' && hotel.plan_valid_to && new Date(hotel.plan_valid_to).getTime() > now;
    const trialing   = hotel.subscription_status === 'trial'  && hotel.trial_end_date && new Date(hotel.trial_end_date).getTime() > now;

    let status, days_left;
    if (planActive)      { status = 'active';  days_left = daysLeft(hotel.plan_valid_to); }
    else if (trialing)   { status = 'trial';   days_left = daysLeft(hotel.trial_end_date); }
    else if (hotel.trial_end_date || hotel.plan_valid_to) { status = 'expired'; days_left = 0; }
    else                 { status = 'none';    days_left = 0; }

    res.json({
      found: true,
      product: 'stay-x-pulse',
      name: hotel.hotel_name || null,
      status,
      plan_name: planActive ? (hotel.plans && hotel.plans.name) || null : null,
      trial_ends_at: hotel.trial_end_date || null,
      plan_ends_at: planActive ? hotel.plan_valid_to || null : null,
      days_left,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
