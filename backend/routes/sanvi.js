const express = require('express');
const crypto  = require('crypto');
const router  = express.Router();
const supabase = require('../utils/supabase');

const PRODUCT = 'Stay-X-Pulse';

// ── Shared-secret guard (read-only feed for the Sanvi marketing engine) ───────
// Set SANVI_API_TOKEN in this backend's env to the value Sanvi holds.
const sanviAuth = (req, res, next) => {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : (req.headers['x-sanvi-key'] || '');
  const expected = process.env.SANVI_API_TOKEN || '';
  const ok = expected.length > 0 && token.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  if (!ok) return res.status(401).json({ success: false, message: 'Unauthorized' });
  next();
};

const clampLimit = (v, def = 500, max = 1000) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, max) : def;
};
// strip undefined/null/'' so we never emit invented/blank fields
const clean = (obj) => {
  const out = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined && v !== null && v !== '') out[k] = v;
  return Object.keys(out).length ? out : undefined;
};
const utmOf = (h) => clean({
  utm_source: h?.utm_source, utm_medium: h?.utm_medium,
  utm_campaign: h?.utm_campaign, utm_content: h?.utm_content,
});
const leadOf = (h) => clean({
  email: h?.email, phone: h?.phone, name: h?.hotel_name, business: h?.hotel_name,
});
// months a payment covers, from its validity window → for MRR (annual ≠ amount)
const monthsBetween = (from, to) => {
  if (!from || !to) return 1;
  const days = Math.round((new Date(to) - new Date(from)) / 86400000);
  if (days >= 300) return 12;
  if (days >= 80)  return 3;
  return 1;
};

// Run a hotels select that includes utm_* columns, falling back to a select
// WITHOUT them if migration 017 hasn't run yet — so leads/trials never vanish
// just because the utm columns don't exist. `build(cols)` returns a query.
const UTM = 'utm_source, utm_medium, utm_campaign, utm_content';
const selectHotels = async (build, extraCols) => {
  const withUtm  = `id, hotel_name, email, phone, ${extraCols ? extraCols + ', ' : ''}${UTM}`;
  const baseCols = `id, hotel_name, email, phone${extraCols ? ', ' + extraCols : ''}`;
  let res = await build(withUtm);
  if (res.error) res = await build(baseCols);
  return res.data || [];
};

// ── GET /api/sanvi/events ─────────────────────────────────────────────────────
router.get('/events', sanviAuth, async (req, res) => {
  try {
    const since = req.query.since ? new Date(req.query.since).toISOString() : null;
    const limit = clampLimit(req.query.limit);

    const [hotels, { data: orders }, { data: payments }, { data: roomRows }] = await Promise.all([
      selectHotels((cols) => {
        let q = supabase.from('hotels').select(cols).order('created_at', { ascending: true }).limit(limit);
        if (since) q = q.gt('created_at', since);
        return q;
      }, 'created_at'),
      (since ? supabase.from('payment_orders').select('id, hotel_id, amount, initiated_at, created_at').gt('initiated_at', since) : supabase.from('payment_orders').select('id, hotel_id, amount, initiated_at, created_at')).order('initiated_at', { ascending: true }).limit(limit),
      (since ? supabase.from('payments').select('id, hotel_id, payment_id, amount, paid_at').gt('paid_at', since) : supabase.from('payments').select('id, hotel_id, payment_id, amount, paid_at')).order('paid_at', { ascending: true }).limit(limit),
      supabase.from('rooms').select('hotel_id'),
    ]);

    const hotelMap = Object.fromEntries((hotels || []).map(h => [h.id, h]));
    const need = [...new Set([...(orders || []).map(o => o.hotel_id), ...(payments || []).map(p => p.hotel_id)])].filter(id => id && !hotelMap[id]);
    if (need.length) {
      const extra = await selectHotels((cols) => supabase.from('hotels').select(cols).in('id', need));
      extra.forEach(h => { hotelMap[h.id] = h; });
    }
    const rooms = {};
    (roomRows || []).forEach(r => { rooms[r.hotel_id] = (rooms[r.hotel_id] || 0) + 1; });

    const events = [];
    (hotels || []).forEach(h => events.push({
      id: `trial_${h.id}`, ts: h.created_at, type: 'trial_started',
      product: PRODUCT, value: 0, lead: leadOf(h), meta: clean({ ...(utmOf(h) || {}), rooms: rooms[h.id] }),
    }));
    (orders || []).forEach(o => { const h = hotelMap[o.hotel_id]; events.push({
      id: `co_${o.id}`, ts: o.initiated_at || o.created_at, type: 'checkout_started',
      product: PRODUCT, value: Number(o.amount) || 0, lead: leadOf(h), meta: clean({ ...(utmOf(h) || {}), rooms: rooms[o.hotel_id] }),
    }); });
    (payments || []).forEach(p => { const h = hotelMap[p.hotel_id]; events.push({
      id: `pay_${p.payment_id || p.id}`, ts: p.paid_at, type: 'payment_success',
      product: PRODUCT, value: Number(p.amount) || 0, lead: leadOf(h), meta: clean({ ...(utmOf(h) || {}), rooms: rooms[p.hotel_id] }),
    }); });

    let feed = events.filter(e => e.ts && (!since || new Date(e.ts) > new Date(since)));
    feed.sort((a, b) => new Date(a.ts) - new Date(b.ts));
    feed = feed.slice(0, limit);
    const next_since = feed.length ? feed[feed.length - 1].ts : (since || new Date(0).toISOString());
    res.set('Cache-Control', 'no-store');
    res.json({ events: feed, next_since });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/sanvi/orders (Easebuzz payments) ─────────────────────────────────
router.get('/orders', sanviAuth, async (req, res) => {
  try {
    const since = req.query.since ? new Date(req.query.since).toISOString() : null;
    const limit = clampLimit(req.query.limit);
    let q = supabase.from('payments')
      .select('id, hotel_id, plan_id, payment_id, txnid, amount, valid_from, valid_to, paid_at')
      .order('paid_at', { ascending: true }).limit(limit);
    if (since) q = q.gt('paid_at', since);
    const { data: payments, error } = await q;
    if (error) throw error;

    const planIds  = [...new Set((payments || []).map(p => p.plan_id).filter(Boolean))];
    const hotelIds = [...new Set((payments || []).map(p => p.hotel_id).filter(Boolean))];
    const [{ data: plans }, hotels, { data: roomRows }] = await Promise.all([
      planIds.length  ? supabase.from('plans').select('id, name').in('id', planIds) : Promise.resolve({ data: [] }),
      hotelIds.length ? selectHotels((cols) => supabase.from('hotels').select(cols).in('id', hotelIds)) : Promise.resolve([]),
      supabase.from('rooms').select('hotel_id'),
    ]);
    const planMap  = Object.fromEntries((plans || []).map(p => [p.id, p.name]));
    const hotelMap = Object.fromEntries((hotels || []).map(h => [h.id, h]));
    const rooms = {};
    (roomRows || []).forEach(r => { rooms[r.hotel_id] = (rooms[r.hotel_id] || 0) + 1; });

    const orders = (payments || []).map(p => {
      const h = hotelMap[p.hotel_id] || {};
      const amount = Number(p.amount) || 0;
      const mrr = Math.round(amount / monthsBetween(p.valid_from, p.valid_to));
      return {
        id: p.payment_id || p.txnid || `pay_${p.id}`,
        status: 'success', product: PRODUCT,
        plan: (planMap[p.plan_id] || '').toLowerCase() || undefined,
        amount, mrr, setup_fee: 0, ts: p.paid_at,
        customer: clean({ email: h.email, phone: h.phone, name: h.hotel_name }),
        meta: clean({ utm_content: h.utm_content, rooms: rooms[p.hotel_id] }),
      };
    });
    const next_since = orders.length ? orders[orders.length - 1].ts : (since || new Date(0).toISOString());
    res.set('Cache-Control', 'no-store');
    res.json({ orders, next_since });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
