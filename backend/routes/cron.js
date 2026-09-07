// ─────────────────────────────────────────────────────────────────────────────
//  Scheduled jobs, triggered by an external pinger (Supabase pg_cron).
//
//  Guarded by CRON_SECRET so only our scheduler can fire them. Every handler is
//  error-safe and returns a small JSON summary (handy for eyeballing in a log).
// ─────────────────────────────────────────────────────────────────────────────
const express  = require('express');
const router   = express.Router();
const crypto   = require('crypto');
const supabase = require('../utils/supabase');
const { sendPushToHotel } = require('../utils/push');

// Reminder policy (chosen 7 Sep 2026): first nudge once a pending order/request
// is 2 min old, then re-nudge every 2 min, up to 5 times, then give up. Stops
// immediately once the admin marks it done (status leaves 'pending').
const FIRST_DELAY_MS = 2 * 60 * 1000;
const INTERVAL_MS    = 2 * 60 * 1000;
const MAX_REMINDERS  = 5;

// Shared-secret guard. Accept the secret as a Bearer token, an x-cron-key
// header, or a ?key= query param (pg_net makes header-setting fiddly).
const cronAuth = (req, res, next) => {
  const expected = process.env.CRON_SECRET || '';
  const h = req.headers.authorization || '';
  const provided = (h.startsWith('Bearer ') ? h.slice(7) : '')
    || req.headers['x-cron-key'] || req.query.key || '';
  const ok = expected.length > 0 && provided.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(String(provided)), Buffer.from(expected));
  if (!ok) return res.status(401).json({ success: false, message: 'Unauthorized' });
  next();
};

// Re-push pending food orders / service requests that haven't been acted on.
async function runReminders() {
  const now = Date.now();
  // Anything last touched (or created, if never nudged) more than one interval
  // ago is due. created_at handles the first nudge; last_reminded_at the rest.
  const dueBefore = new Date(now - INTERVAL_MS).toISOString();
  const createdBefore = new Date(now - FIRST_DELAY_MS).toISOString();
  let foodSent = 0, serviceSent = 0;

  // ── Food orders ───────────────────────────────────────────────────────────
  const { data: orders } = await supabase
    .from('food_orders')
    .select('id, hotel_id, room_number, total_amount, reminder_count, last_reminded_at, created_at')
    .eq('status', 'pending')
    .lt('reminder_count', MAX_REMINDERS)
    .lte('created_at', createdBefore)
    .limit(500);

  for (const o of orders || []) {
    const lastTouch = o.last_reminded_at || o.created_at;
    if (new Date(lastTouch).toISOString() > dueBefore) continue; // not due yet
    const n = (o.reminder_count || 0) + 1;
    await sendPushToHotel(o.hotel_id, {
      title: 'StayXPulse — Order still pending',
      body: `Reminder: Room ${o.room_number} — ₹${o.total_amount} not actioned yet`,
      data: { type: 'food_order', id: o.id, route: '/hotel/food-orders', reminder: n },
    });
    await supabase.from('food_orders')
      .update({ reminder_count: n, last_reminded_at: new Date(now).toISOString() })
      .eq('id', o.id);
    foodSent++;
  }

  // ── Service requests ────────────────────────────────────────────────────────
  const { data: reqs } = await supabase
    .from('service_requests')
    .select('id, hotel_id, room_number, type, reminder_count, last_reminded_at, created_at')
    .eq('status', 'pending')
    .lt('reminder_count', MAX_REMINDERS)
    .lte('created_at', createdBefore)
    .limit(500);

  for (const r of reqs || []) {
    const lastTouch = r.last_reminded_at || r.created_at;
    if (new Date(lastTouch).toISOString() > dueBefore) continue;
    const n = (r.reminder_count || 0) + 1;
    await sendPushToHotel(r.hotel_id, {
      title: 'StayXPulse — Request still pending',
      body: `Reminder: Room ${r.room_number}: ${r.type} not actioned yet`,
      data: { type: 'service_request', id: r.id, route: '/hotel/service-requests', reminder: n },
    });
    await supabase.from('service_requests')
      .update({ reminder_count: n, last_reminded_at: new Date(now).toISOString() })
      .eq('id', r.id);
    serviceSent++;
  }

  return { foodSent, serviceSent };
}

// GET or POST — pg_net can do either. Kept fast and non-throwing.
const handler = async (req, res) => {
  try {
    const out = await runReminders();
    res.json({ success: true, ...out });
  } catch (e) {
    console.error('[cron/order-reminders]', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
};

router.get('/order-reminders', cronAuth, handler);
router.post('/order-reminders', cronAuth, handler);

module.exports = router;
