const express = require('express');
const router = express.Router();
const supabase = require('../utils/supabase');

// Shared-secret guard for the Sunver master admin portal.
// Set MASTER_API_KEY in this backend's env to the same value the portal uses.
const masterAuth = (req, res, next) => {
  const bearer = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.split(' ')[1]
    : null;
  const key = req.headers['x-master-key'] || bearer;
  if (!process.env.MASTER_API_KEY || key !== process.env.MASTER_API_KEY) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  next();
};

// Start of "today" in IST, expressed as a UTC ISO string.
function istDayStartIso() {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 3600 * 1000);
  const midnightUtcMs = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - 5.5 * 3600 * 1000;
  return new Date(midnightUtcMs).toISOString();
}

// GET /api/master/stats — read-only aggregate for the master portal.
router.get('/stats', masterAuth, async (req, res) => {
  try {
    const dayStart = istDayStartIso();
    const [
      { count: totalHotels },
      { count: activeHotels },
      { count: totalRooms },
      { count: ordersToday },
      { count: pendingOrders },
      { data: orderRows },
      { data: paymentRows },
    ] = await Promise.all([
      supabase.from('hotels').select('*', { count: 'exact', head: true }),
      supabase.from('hotels').select('*', { count: 'exact', head: true }).eq('subscription_status', 'active'),
      supabase.from('rooms').select('*', { count: 'exact', head: true }),
      supabase.from('food_orders').select('*', { count: 'exact', head: true }).gte('created_at', dayStart),
      supabase.from('food_orders').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('food_orders').select('total_amount, status'),
      supabase.from('payments').select('amount'),
    ]);

    const orderRevenue = (orderRows || [])
      .filter((o) => o.status !== 'cancelled')
      .reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
    const saasRevenue = (paymentRows || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    res.json({
      generatedAt: new Date().toISOString(),
      cards: [
        { key: 'hotels', label: 'Hotels', value: totalHotels || 0, sub: `${activeHotels || 0} active` },
        { key: 'rooms', label: 'Rooms', value: totalRooms || 0 },
        { key: 'orders_today', label: 'Orders today', value: ordersToday || 0 },
        { key: 'pending_orders', label: 'Pending orders', value: pendingOrders || 0 },
        { key: 'order_revenue', label: 'Order revenue', value: Math.round(orderRevenue), format: 'inr' },
        { key: 'saas_revenue', label: 'Subscriptions', value: Math.round(saasRevenue), format: 'inr' },
      ],
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
