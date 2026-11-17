// ─────────────────────────────────────────────────────────────────────────────
//  Sunver Growth Engine — read-only account lookups.
//
//  GET /api/sge/account-status?phone=+91… | &email=…   (one account)
//  GET /api/sge/accounts?updated_since=<ISO>&cursor=…   (daily list, hourly poll)
//
//  Auth: Authorization: Bearer <SGE_LOOKUP_TOKEN>. Returns ONLY status + setup
//  progress — never guest details, order contents or payment specifics.
//
//  All reads are hotel-scoped and side-effect free: these endpoints can never
//  change live data.
// ─────────────────────────────────────────────────────────────────────────────
const express  = require('express');
const crypto   = require('crypto');
const router   = express.Router();
const supabase = require('../utils/supabase');
const { e164 } = require('../utils/sge');

const PRODUCT = 'stay-x-pulse';
const DAY = 86400000;
// Trial hotels get 10 rooms (mirrors TRIAL_ROOM_LIMIT in routes/hotel.js).
const TRIAL_ROOM_LIMIT = 10;

// Columns we read for every account view.
const HOTEL_COLS =
  'id, hotel_name, email, phone, subscription_status, trial_end_date, ' +
  'plan_valid_to, plan_valid_from, current_plan_id, created_at, ' +
  'plans:current_plan_id(name, max_rooms)';

const lookupAuth = (req, res, next) => {
  const expected = process.env.SGE_LOOKUP_TOKEN || '';
  const h = req.headers.authorization || '';
  const tok = h.startsWith('Bearer ') ? h.slice(7) : '';
  const ok = expected.length > 0 && tok.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(tok), Buffer.from(expected));
  if (!ok) return res.status(401).json({ error: 'unauthorized' });
  next();
};

const daysLeft = (iso) => {
  if (!iso) return 0;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / DAY));
};

// Current standing from a hotel row. Note: subscription_status may still read
// 'active'/'trial' after the date has passed (nothing flips it), so we always
// gate on the end date too — a lapsed paid term reads as 'expired'.
function statusOf(hotel) {
  const now = Date.now();
  const active = hotel.subscription_status === 'active' && hotel.plan_valid_to && new Date(hotel.plan_valid_to).getTime() > now;
  const trial  = hotel.subscription_status === 'trial'  && hotel.trial_end_date && new Date(hotel.trial_end_date).getTime() > now;
  let status = 'none', days_left = 0;
  if (active)      { status = 'active'; days_left = daysLeft(hotel.plan_valid_to); }
  else if (trial)  { status = 'trial';  days_left = daysLeft(hotel.trial_end_date); }
  else if (hotel.trial_end_date || hotel.plan_valid_to) { status = 'expired'; }
  return { status, days_left, active, trial };
}

// Setup-progress + billing figures for one hotel. All counts are exact (head
// queries), so no 1000-row cap can skew them. A handful of tiny queries per
// hotel — fine at today's scale; revisit as a DB view/rpc before many hundreds
// of accounts are polled in one page.
async function progressFor(hotel) {
  const id = hotel.id;
  const sevenAgo = new Date(Date.now() - 7 * DAY).toISOString();
  const st = statusOf(hotel);
  const [rooms, menu, ordersTotal, orders7, firstOrder, lastPaid, lastLogin] = await Promise.all([
    supabase.from('rooms').select('*', { count: 'exact', head: true }).eq('hotel_id', id),
    supabase.from('food_items').select('*', { count: 'exact', head: true }).eq('hotel_id', id),
    supabase.from('food_orders').select('*', { count: 'exact', head: true }).eq('hotel_id', id),
    supabase.from('food_orders').select('*', { count: 'exact', head: true }).eq('hotel_id', id).gte('created_at', sevenAgo),
    supabase.from('food_orders').select('created_at').eq('hotel_id', id).order('created_at', { ascending: true }).limit(1),
    supabase.from('payment_orders').select('cycle, amount').eq('hotel_id', id).eq('status', 'paid').order('paid_at', { ascending: false }).limit(1),
    supabase.from('users').select('last_login').eq('hotel_id', id).order('last_login', { ascending: false }).limit(1),
  ]);
  const paid = (lastPaid.data && lastPaid.data[0]) || null;
  const roomsLimit = st.active
    ? (hotel.plans && hotel.plans.max_rooms != null ? hotel.plans.max_rooms : null)
    : (st.trial ? TRIAL_ROOM_LIMIT : (hotel.plans && hotel.plans.max_rooms != null ? hotel.plans.max_rooms : null));
  return {
    rooms_added:   rooms.count || 0,
    menu_items:    menu.count || 0,
    orders_total:  ordersTotal.count || 0,
    orders_last_7d: orders7.count || 0,
    first_order_at: (firstOrder.data && firstOrder.data[0] && firstOrder.data[0].created_at) || null,
    last_active_at: (lastLogin.data && lastLogin.data[0] && lastLogin.data[0].last_login) || null,
    billing_period: st.active ? (paid && paid.cycle) || null : null,
    price_paise:    st.active && paid ? Math.round(Number(paid.amount || 0) * 100) : null,
    rooms_limit:    roomsLimit,
    trial_started_at: hotel.created_at || null,
  };
}

// One account's full public view (status + progress), shared by both endpoints.
async function accountView(hotel, extra = {}) {
  const st = statusOf(hotel);
  const progress = await progressFor(hotel);
  return {
    account_id: hotel.id,
    product: PRODUCT,
    name: hotel.hotel_name || null,
    status: st.status,
    plan_name: st.active ? (hotel.plans && hotel.plans.name) || null : null,
    trial_ends_at: hotel.trial_end_date || null,
    plan_ends_at: st.active ? hotel.plan_valid_to || null : null,
    days_left: st.days_left,
    ...progress,
    ...extra,
  };
}

// Of several accounts sharing a phone/email, pick the one the engine should act
// on: an active plan first, else a live trial, else the newest. Fixes the old
// bug where an arbitrary (often expired) row was returned.
function pickBest(hotels) {
  const rank = (h) => {
    const s = statusOf(h).status;
    return s === 'active' ? 0 : s === 'trial' ? 1 : 2;
  };
  return [...hotels].sort((a, b) => {
    const r = rank(a) - rank(b);
    if (r !== 0) return r;
    return new Date(b.created_at || 0) - new Date(a.created_at || 0); // newest first
  })[0] || null;
}

// ── GET /account-status ───────────────────────────────────────────────────────
router.get('/account-status', lookupAuth, async (req, res) => {
  try {
    const email = req.query.email ? String(req.query.email).toLowerCase().trim() : null;
    const phone = req.query.phone ? String(req.query.phone) : null;

    let candidates = [];
    if (email) {
      const { data } = await supabase.from('hotels').select(HOTEL_COLS).eq('email', email).limit(25);
      candidates = data || [];
    }
    if (!candidates.length && phone) {
      // Match on the last 10 digits so stored formats (+91…, spaces, 0-prefix) hit.
      const last10 = (e164(phone) || '').replace(/\D/g, '').slice(-10);
      if (last10) {
        const { data } = await supabase.from('hotels').select(HOTEL_COLS).ilike('phone', `%${last10}%`).limit(25);
        candidates = data || [];
      }
    }

    const hotel = pickBest(candidates);
    if (!hotel) return res.json({ found: false });

    const view = await accountView(hotel);
    res.json({ found: true, ...view });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /accounts (daily list) ────────────────────────────────────────────────
// Returns every account changed since ?updated_since=<ISO> (or all, capped),
// keyset-paged by updated_at. The engine calls this hourly to catch any event
// that was lost and to reconcile its numbers against ours.
router.get('/accounts', lookupAuth, async (req, res) => {
  try {
    const since  = req.query.updated_since ? new Date(req.query.updated_since).toISOString() : null;
    const cursor = req.query.cursor ? new Date(req.query.cursor).toISOString() : null;
    const limit  = Math.min(Math.max(Number(req.query.limit) || 200, 1), 500);
    const after  = [cursor, since].filter(Boolean).sort().pop() || null; // the later of the two

    // Prefer updated_at; if migration 026 has not run yet, fall back to created_at
    // so the endpoint still works (older rows then look "changed" at creation).
    const runQuery = async (col) => {
      let q = supabase.from('hotels').select(HOTEL_COLS + ', updated_at')
        .order(col, { ascending: true }).limit(limit);
      if (after) q = q.gt(col, after);
      return q;
    };

    let orderCol = 'updated_at';
    let { data, error } = await runQuery(orderCol);
    if (error && /updated_at|column|schema cache/i.test(error.message || '')) {
      orderCol = 'created_at';
      ({ data, error } = await runQuery(orderCol));
    }
    if (error) throw error;

    const rows = data || [];
    const accounts = [];
    for (const h of rows) {
      accounts.push(await accountView(h, {
        created_at: h.created_at || null,
        updated_at: h.updated_at || h.created_at || null,
      }));
    }

    const last = rows[rows.length - 1];
    const next_cursor = rows.length === limit && last ? (last[orderCol] || null) : null;
    res.json({ accounts, next_cursor, order_by: orderCol });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
