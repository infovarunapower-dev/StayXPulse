// ─────────────────────────────────────────────────────────────────────────────
//  First-party website analytics.
//   POST /api/analytics/visit  — public; the frontend logs a page view here.
//  The Super Admin dashboard reads the aggregates via /superadmin/summary
//  (analytics_summary() RPC), so the numbers are only ever shown to super admin.
// ─────────────────────────────────────────────────────────────────────────────
const express  = require('express');
const router   = express.Router();
const supabase = require('../utils/supabase');

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
    await supabase.from('page_visits').insert({ path, visitor_id: visitorId, referrer, user_agent: ua });
    res.json({ success: true });
  } catch (e) {
    // Never let analytics logging error the client.
    res.json({ success: false });
  }
});

module.exports = router;
