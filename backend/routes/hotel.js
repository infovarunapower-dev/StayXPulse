const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');
const { body, validationResult } = require('express-validator');
const { protect, authorize }     = require('../middleware/auth');
const supabase = require('../utils/supabase');

const HA  = [protect, authorize('hoteladmin')];
const val = (req, res) => {
  const e = validationResult(req);
  if (!e.isEmpty()) return res.status(422).json({ success: false, errors: e.array() });
  return null;
};

const memUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const withHotel = (req, res, next) => {
  if (!req.user.hotel) return res.status(403).json({ success: false, message: 'No hotel associated with this account.' });
  req.hotelId = req.user.hotel.id || req.user.hotel;
  next();
};
const MW = [...HA, withHotel];

// ════════════════════════════════════════════════════════════════════
// ROOMS
// ════════════════════════════════════════════════════════════════════
router.get('/rooms', MW, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('hotel_id', req.hotelId)
      .order('number', { ascending: true });
    if (error) throw error;
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/rooms', [...MW, body('number').trim().notEmpty().withMessage('Room number required')], async (req, res) => {
  if (val(req, res)) return;
  try {
    const { data: exists } = await supabase.from('rooms').select('id').eq('hotel_id', req.hotelId).eq('number', req.body.number);
    if (exists && exists.length > 0) return res.status(409).json({ success: false, message: `Room ${req.body.number} already exists.` });

    const { data, error } = await supabase.from('rooms').insert({
      hotel_id: req.hotelId,
      number: req.body.number,
      type: req.body.type || 'standard',
      floor: req.body.floor || null,
      is_active: true,
    }).select().single();
    if (error) throw error;
    res.status(201).json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.delete('/rooms/:id', MW, async (req, res) => {
  try {
    const { error } = await supabase.from('rooms').delete().eq('id', req.params.id).eq('hotel_id', req.hotelId);
    if (error) throw error;
    res.json({ success: true, message: 'Room deleted' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ════════════════════════════════════════════════════════════════════
// FOOD ITEMS
// ════════════════════════════════════════════════════════════════════
router.get('/food', MW, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('food_items')
      .select('*')
      .eq('hotel_id', req.hotelId)
      .order('category', { ascending: true })
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });
    if (error) throw error;
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/food', [...MW, body('name').trim().notEmpty(), body('price').isNumeric(), body('category').trim().notEmpty()], async (req, res) => {
  if (val(req, res)) return;
  try {
    const { data, error } = await supabase.from('food_items').insert({
      hotel_id: req.hotelId,
      name: req.body.name,
      description: req.body.description || '',
      price: req.body.price,
      category: req.body.category,
      is_veg: req.body.isVeg !== undefined ? req.body.isVeg : true,
      is_available: true,
      image_emoji: req.body.imageEmoji || '🍽',
      sort_order: req.body.sortOrder || 0,
    }).select().single();
    if (error) throw error;
    res.status(201).json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.put('/food/:id', MW, async (req, res) => {
  try {
    const { data, error } = await supabase.from('food_items').update({
      name: req.body.name,
      description: req.body.description,
      price: req.body.price,
      category: req.body.category,
      is_veg: req.body.isVeg,
      image_emoji: req.body.imageEmoji,
      sort_order: req.body.sortOrder,
    }).eq('id', req.params.id).eq('hotel_id', req.hotelId).select().single();
    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, message: 'Item not found' });
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.patch('/food/:id/availability', MW, async (req, res) => {
  try {
    const { data, error } = await supabase.from('food_items')
      .update({ is_available: req.body.isAvailable })
      .eq('id', req.params.id).eq('hotel_id', req.hotelId).select().single();
    if (error) throw error;
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.delete('/food/:id', MW, async (req, res) => {
  try {
    const { error } = await supabase.from('food_items').delete().eq('id', req.params.id).eq('hotel_id', req.hotelId);
    if (error) throw error;
    res.json({ success: true, message: 'Item deleted' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// Bulk upload
router.post('/food/bulk', MW, memUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    const ext = path.extname(req.file.originalname).toLowerCase();
    let rows = [];

    if (ext === '.csv') {
      const text = req.file.buffer.toString('utf-8');
      const lines = text.split('\n').filter(l => l.trim());
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
      for (let i = 1; i < lines.length; i++) {
        const vals = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
        if (vals.length < 2) continue;
        const obj = {};
        headers.forEach((h, idx) => obj[h] = vals[idx] || '');
        rows.push(obj);
      }
    } else if (ext === '.xlsx' || ext === '.xls') {
      const XLSX = require('xlsx');
      const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
      rows = rows.map(r => {
        const norm = {};
        Object.keys(r).forEach(k => norm[k.toLowerCase().trim()] = String(r[k]).trim());
        return norm;
      });
    } else {
      return res.status(400).json({ success: false, message: 'Only .csv, .xlsx, .xls files supported' });
    }

    const toInsert = rows
      .filter(r => r.name && r.price && r.category)
      .map(r => ({
        hotel_id: req.hotelId,
        name: r.name,
        description: r.description || '',
        price: parseFloat(r.price) || 0,
        category: r.category,
        is_veg: String(r.isveg || r.is_veg || r.veg || 'true').toLowerCase() !== 'false',
        is_available: true,
        image_emoji: r.emoji || r.imageemoji || '🍽',
      }));

    if (toInsert.length === 0)
      return res.status(400).json({ success: false, message: 'No valid rows found. Required columns: name, price, category' });

    const { error } = await supabase.from('food_items').insert(toInsert);
    if (error) throw error;
    res.json({ success: true, message: `${toInsert.length} items imported successfully`, count: toInsert.length });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ════════════════════════════════════════════════════════════════════
// SERVICE REQUESTS
// ════════════════════════════════════════════════════════════════════
router.get('/service-requests', MW, async (req, res) => {
  try {
    const { filter = 'all', status, from, to, page = 1, limit = 50 } = req.query;
    let query = supabase.from('service_requests').select('*', { count: 'exact' }).eq('hotel_id', req.hotelId);

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const yesterday = new Date(new Date(today).setDate(new Date(today).getDate() - 1)).toISOString();

    if (filter === 'today') query = query.gte('created_at', today);
    else if (filter === 'yesterday') query = query.gte('created_at', yesterday).lt('created_at', today);
    if (from && to) query = query.gte('created_at', from).lte('created_at', new Date(new Date(to).setHours(23, 59, 59)).toISOString());
    if (status && status !== 'all') query = query.eq('status', status);

    query = query.order('created_at', { ascending: false }).range((page - 1) * limit, page * limit - 1);

    const { data, error, count } = await query;
    if (error) throw error;

    const { count: pendingCount } = await supabase.from('service_requests').select('*', { count: 'exact', head: true }).eq('hotel_id', req.hotelId).eq('status', 'pending');

    res.json({ success: true, data, total: count, pendingCount });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.patch('/service-requests/:id/status', MW, async (req, res) => {
  try {
    const update = { status: req.body.status };
    if (req.body.status === 'completed') update.completed_at = new Date().toISOString();
    const { data, error } = await supabase.from('service_requests').update(update).eq('id', req.params.id).eq('hotel_id', req.hotelId).select().single();
    if (error) throw error;
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ════════════════════════════════════════════════════════════════════
// FOOD ORDERS
// ════════════════════════════════════════════════════════════════════
router.get('/food-orders', MW, async (req, res) => {
  try {
    const { filter = 'all', status, from, to, page = 1, limit = 50 } = req.query;
    let query = supabase.from('food_orders').select('*', { count: 'exact' }).eq('hotel_id', req.hotelId);

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const yesterday = new Date(new Date(today).setDate(new Date(today).getDate() - 1)).toISOString();

    if (filter === 'today') query = query.gte('created_at', today);
    else if (filter === 'yesterday') query = query.gte('created_at', yesterday).lt('created_at', today);
    if (from && to) query = query.gte('created_at', from).lte('created_at', new Date(new Date(to).setHours(23, 59, 59)).toISOString());
    if (status && status !== 'all') query = query.eq('status', status);

    query = query.order('created_at', { ascending: false }).range((page - 1) * limit, page * limit - 1);

    const { data, error, count } = await query;
    if (error) throw error;

    const { count: pendingCount } = await supabase.from('food_orders').select('*', { count: 'exact', head: true }).eq('hotel_id', req.hotelId).eq('status', 'pending');

    res.json({ success: true, data, total: count, pendingCount });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.patch('/food-orders/:id/status', MW, async (req, res) => {
  try {
    const { data, error } = await supabase.from('food_orders').update({ status: req.body.status }).eq('id', req.params.id).eq('hotel_id', req.hotelId).select().single();
    if (error) throw error;
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ════════════════════════════════════════════════════════════════════
// ANALYTICS
// ════════════════════════════════════════════════════════════════════
router.get('/analytics', MW, async (req, res) => {
  try {
    const hotelId = req.hotelId;
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const startOf7 = new Date(now.setDate(now.getDate() - 7)).toISOString();

    const [
      { count: totalOrders },
      { count: todayOrders },
      { data: allOrders },
      { data: todayOrdersData },
      { count: totalRequests },
      { count: pendingRequests },
      { data: recentOrders },
    ] = await Promise.all([
      supabase.from('food_orders').select('*', { count: 'exact', head: true }).eq('hotel_id', hotelId),
      supabase.from('food_orders').select('*', { count: 'exact', head: true }).eq('hotel_id', hotelId).gte('created_at', startOfToday),
      supabase.from('food_orders').select('total_amount, status').eq('hotel_id', hotelId).neq('status', 'cancelled'),
      supabase.from('food_orders').select('total_amount').eq('hotel_id', hotelId).gte('created_at', startOfToday).neq('status', 'cancelled'),
      supabase.from('service_requests').select('*', { count: 'exact', head: true }).eq('hotel_id', hotelId),
      supabase.from('service_requests').select('*', { count: 'exact', head: true }).eq('hotel_id', hotelId).eq('status', 'pending'),
      supabase.from('food_orders').select('*').eq('hotel_id', hotelId).order('created_at', { ascending: false }).limit(5),
    ]);

    const totalRevenue = (allOrders || []).reduce((sum, o) => sum + (o.total_amount || 0), 0);
    const todayRevenue = (todayOrdersData || []).reduce((sum, o) => sum + (o.total_amount || 0), 0);

    res.json({
      success: true,
      data: {
        stats: { totalOrders, todayOrders, totalRevenue, todayRevenue, totalRequests, pendingRequests },
        topItems: [],
        dailyOrders: [],
        categoryRevenue: [],
        recentOrders: recentOrders || [],
      }
    });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ════════════════════════════════════════════════════════════════════
// GUEST LANDING PAGE (public)
// ════════════════════════════════════════════════════════════════════
router.get('/guest/:qrToken', async (req, res) => {
  try {
    const { data: room, error: roomError } = await supabase.from('rooms').select('*, hotels(*)').eq('qr_token', req.params.qrToken).eq('is_active', true).single();
    if (roomError || !room) return res.status(404).json({ success: false, message: 'Invalid or inactive QR code.' });

    const hotel = room.hotels;
    const { data: foodItems } = await supabase.from('food_items').select('*').eq('hotel_id', hotel.id).eq('is_available', true).order('category').order('sort_order');

    const menu = {};
    (foodItems || []).forEach(item => {
      if (!menu[item.category]) menu[item.category] = [];
      menu[item.category].push(item);
    });

    res.json({ success: true, data: { hotel: { _id: hotel.id, hotelName: hotel.hotel_name, phone: hotel.phone, logoUrl: hotel.logo_url }, room: { _id: room.id, number: room.number, type: room.type }, menu } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/guest/:qrToken/order', async (req, res) => {
  try {
    const { data: room, error } = await supabase.from('rooms').select('*').eq('qr_token', req.params.qrToken).eq('is_active', true).single();
    if (error || !room) return res.status(404).json({ success: false, message: 'Invalid QR' });

    const { items, guestNote = '' } = req.body;
    if (!items || items.length === 0) return res.status(400).json({ success: false, message: 'No items in order' });

    const totalAmount = items.reduce((sum, i) => sum + (i.price * i.quantity), 0);
    const { data: order, error: orderError } = await supabase.from('food_orders').insert({
      hotel_id: room.hotel_id, room_id: room.id, room_number: room.number, items, total_amount: totalAmount, guest_note: guestNote,
    }).select().single();
    if (orderError) throw orderError;
    res.status(201).json({ success: true, data: order, message: 'Order placed successfully!' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/guest/:qrToken/service', async (req, res) => {
  try {
    const { data: room, error } = await supabase.from('rooms').select('*').eq('qr_token', req.params.qrToken).eq('is_active', true).single();
    if (error || !room) return res.status(404).json({ success: false, message: 'Invalid QR' });

    const { type, note = '' } = req.body;
    if (!type) return res.status(400).json({ success: false, message: 'Request type required' });

    const { data: sr, error: srError } = await supabase.from('service_requests').insert({
      hotel_id: room.hotel_id, room_id: room.id, room_number: room.number, type, note,
    }).select().single();
    if (srError) throw srError;
    res.status(201).json({ success: true, data: sr, message: 'Request submitted!' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.get('/guest/:qrToken/orders', async (req, res) => {
  try {
    const { data: room, error } = await supabase.from('rooms').select('*').eq('qr_token', req.params.qrToken).eq('is_active', true).single();
    if (error || !room) return res.status(404).json({ success: false, message: 'Invalid QR' });

    const [{ data: orders }, { data: requests }] = await Promise.all([
      supabase.from('food_orders').select('*').eq('room_id', room.id).order('created_at', { ascending: false }).limit(20),
      supabase.from('service_requests').select('*').eq('room_id', room.id).order('created_at', { ascending: false }).limit(20),
    ]);
    res.json({ success: true, data: { orders: orders || [], requests: requests || [] } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

module.exports = router;
