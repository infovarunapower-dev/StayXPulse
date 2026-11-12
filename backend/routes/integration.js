// ─────────────────────────────────────────────────────────────────────────────
//  POS integration — READ-ONLY feed for a hotel's own PMS/POS.
//    GET /api/integration/food-orders?since=<ISO>&limit=   (Bearer token)
//    GET /api/integration/menu                             (Bearer token)
//
//  Token (integration_tokens) maps to one hotel + a mode:
//    • live  → real orders only (TEST-marked orders skipped)
//    • test  → only TEST-marked orders
//  Everything here only READS existing data — no writes, hotel-scoped, isolated.
// ─────────────────────────────────────────────────────────────────────────────
const express  = require('express');
const router   = express.Router();
const supabase = require('../utils/supabase');

// Bearer token → { hotelId, mode }. Attaches to req. 401 otherwise.
async function tokenAuth(req, res, next) {
  try {
    const h = req.headers.authorization || '';
    const tok = h.startsWith('Bearer ') ? h.slice(7).trim() : '';
    if (!tok) return res.status(401).json({ error: 'unauthorized' });
    const { data } = await supabase.from('integration_tokens')
      .select('hotel_id, mode, is_active').eq('token', tok).maybeSingle();
    if (!data || !data.is_active || !data.hotel_id) return res.status(401).json({ error: 'unauthorized' });
    req.posHotelId = data.hotel_id;
    req.posMode = data.mode === 'test' ? 'test' : 'live';
    next();
  } catch (e) { res.status(401).json({ error: 'unauthorized' }); }
}

// Stable short code from the order UUID (e.g. SX-012345). Deterministic — the
// same order always yields the same code.
const shortCode = (id) => 'SX-' + (parseInt(String(id).replace(/-/g, '').slice(0, 8), 16) % 1000000).toString().padStart(6, '0');

// A guest note marks a test order only when "TEST" appears as a whole word.
const isTestNote = (note) => /\btest\b/i.test(note || '');

const clampLimit = (v, def = 100, max = 500) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, max) : def;
};

// ── Orders feed ───────────────────────────────────────────────────────────────
router.get('/food-orders', tokenAuth, async (req, res) => {
  try {
    const since = req.query.since ? new Date(req.query.since) : null;
    const sinceIso = since && !isNaN(since.getTime()) ? since.toISOString() : null;
    const limit = clampLimit(req.query.limit);

    let q = supabase.from('food_orders')
      .select('id, room_number, items, total_amount, guest_note, status, created_at, updated_at')
      .eq('hotel_id', req.posHotelId);
    // created-or-changed since the cursor (ISO has no commas → safe in .or()).
    if (sinceIso) q = q.or(`created_at.gt.${sinceIso},updated_at.gt.${sinceIso}`);
    const { data: rows, error } = await q.limit(limit * 2); // headroom for mode filtering
    if (error) throw error;

    // veg flag per line comes from the current menu.
    const { data: menu } = await supabase.from('food_items').select('id, is_veg').eq('hotel_id', req.posHotelId);
    const vegById = new Map((menu || []).map(m => [m.id, !!m.is_veg]));

    const effTime = (o) => o.updated_at || o.created_at;
    let orders = (rows || [])
      .map(o => ({ ...o, _is_test: isTestNote(o.guest_note), _eff: effTime(o) }))
      .filter(o => (req.posMode === 'test' ? o._is_test : !o._is_test))
      .sort((a, b) => new Date(a._eff) - new Date(b._eff))
      .slice(0, limit);

    const shaped = orders.map(o => {
      const total = Number(o.total_amount) || 0;
      return {
        id: o.id,
        order_number: shortCode(o.id),
        room_number: o.room_number,
        guest_name: null,
        guest_phone: null,
        status: o.status || 'pending',
        is_test: o._is_test,
        items: (Array.isArray(o.items) ? o.items : []).map(it => ({
          item_id: it.foodItem || null,
          name: it.name,
          qty: it.quantity,
          price: Number(it.price) || 0,
          veg: vegById.has(it.foodItem) ? vegById.get(it.foodItem) : null,
          note: null,
        })),
        guest_note: o.guest_note || null,
        subtotal: total,
        tax_amount: 0,
        prices_include_tax: true,
        total_amount: total,
        payment_status: 'unpaid',
        paid_amount: 0,
        payment_mode: null,
        payment_reference: null,
        created_at: o.created_at,
        updated_at: o._eff,
      };
    });

    const next_since = shaped.length ? shaped[shaped.length - 1].updated_at : (sinceIso || new Date(0).toISOString());
    res.set('Cache-Control', 'no-store');
    res.json({ orders: shaped, next_since, has_more: shaped.length >= limit });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Menu feed ─────────────────────────────────────────────────────────────────
router.get('/menu', tokenAuth, async (req, res) => {
  try {
    const { data: items, error } = await supabase.from('food_items')
      .select('id, name, category, price, is_veg, is_available, description, sort_order')
      .eq('hotel_id', req.posHotelId)
      .order('category', { ascending: true }).order('sort_order', { ascending: true });
    if (error) throw error;

    const shaped = (items || []).map(i => ({
      item_id: i.id,
      name: i.name,
      category: i.category || null,
      price: Number(i.price) || 0,
      veg: !!i.is_veg,
      available: i.is_available !== false,
      description: i.description || null,
      sort_order: i.sort_order ?? null,
      updated_at: null, // full menu is polled; per-item change time can be added later
    }));

    res.set('Cache-Control', 'no-store');
    res.json({ items: shaped, prices_include_tax: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
