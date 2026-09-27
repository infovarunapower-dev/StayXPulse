// ─────────────────────────────────────────────────────────────────────────────
//  First-party website analytics.
//   POST /api/analytics/visit  — public; the frontend logs a page view here.
//  The Super Admin dashboard reads the aggregates via /superadmin/summary
//  (analytics_summary() RPC), so the numbers are only ever shown to super admin.
// ─────────────────────────────────────────────────────────────────────────────
const express  = require('express');
const router   = express.Router();
const jwt      = require('jsonwebtoken');
const supabase = require('../utils/supabase');

// If the request carries a valid login token, resolve who it is (server-side,
// so the browser can't spoof a hotel name). Returns {} for anonymous visits.
async function identityFrom(req) {
  try {
    const h = req.headers.authorization || '';
    const tok = h.startsWith('Bearer ') ? h.slice(7) : '';
    if (!tok) return {};
    const decoded = jwt.verify(tok, process.env.JWT_SECRET);
    const { data: u } = await supabase
      .from('users')
      .select('email, role, hotel_id, hotels(hotel_name)')
      .eq('id', decoded.id)
      .single();
    if (!u) return {};
    return {
      user_email: u.email || null,
      hotel_id: u.hotel_id || null,
      hotel_name: (u.hotels && u.hotels.hotel_name) || (u.role === 'superadmin' ? 'Super Admin' : null),
    };
  } catch (_) { return {}; }
}

// Collapse dynamic segments (QR tokens, ids, reset tokens) so "top paths" stays
// meaningful: /guest/abc123… → /guest/:id, /reset-password/xyz → /reset-password/:id
function normalizePath(p) {
  if (!p || typeof p !== 'string') return '/';
  let path = p.split('?')[0].split('#')[0];
  if (path.length > 200) path = path.slice(0, 200);
  const parts = path.split('/').map((seg) => {
    if (!seg) return seg;
    if (/^\d+$/.test(seg)) return ':id';
    if (/^[0-9a-fA-F-]{16,}$/.test(seg)) return ':id';
    if (seg.length > 24) return ':id';
    return seg;
  });
  return parts.join('/') || '/';
}

router.post('/visit', async (req, res) => {
  try {
    const path = normalizePath(req.body && req.body.path);
    const visitorId = String((req.body && req.body.visitorId) || '').slice(0, 64) || null;
    const referrer  = String((req.body && req.body.referrer) || '').slice(0, 300) || null;
    const ua        = String(req.headers['user-agent'] || '').slice(0, 300) || null;
    const ident     = await identityFrom(req);
    const row = { path, visitor_id: visitorId, referrer, user_agent: ua, ...ident };
    const { error } = await supabase.from('page_visits').insert(row);
    // Self-heal: if migration 021 (identity columns) isn't run yet, retry with
    // just the base columns so visit logging still works.
    if (error && Object.keys(ident).length) {
      await supabase.from('page_visits').insert({ path, visitor_id: visitorId, referrer, user_agent: ua });
    }
    res.json({ success: true });
  } catch (e) {
    // Never let analytics logging error the client.
    res.json({ success: false });
  }
});

module.exports = router;
