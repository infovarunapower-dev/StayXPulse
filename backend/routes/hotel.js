const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const path     = require('path');
const { body, validationResult } = require('express-validator');
const { protect, authorize }     = require('../middleware/auth');

const { Hotel, Room, FoodItem, FoodOrder, ServiceRequest } = require('../models');

const HA  = [protect, authorize('hoteladmin')];
const val = (req, res) => { const e = validationResult(req); if (!e.isEmpty()) return res.status(422).json({ success:false, errors:e.array() }); return null; };

// Bulk upload (CSV/Excel parsing via multer memory storage)
const memUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5*1024*1024 } });

// ── Middleware: attach hotel from logged-in user ──────────────────────────────
const withHotel = (req, res, next) => {
  if (!req.user.hotel) return res.status(403).json({ success:false, message:'No hotel associated with this account.' });
  req.hotelId = req.user.hotel._id || req.user.hotel;
  next();
};
const MW = [...HA, withHotel];

// ════════════════════════════════════════════════════════════════════
// ROOMS
// ════════════════════════════════════════════════════════════════════
router.get('/rooms', MW, async (req, res) => {
  try {
    const rooms = await Room.find({ hotel: req.hotelId }).sort({ number: 1 });
    res.json({ success:true, data: rooms });
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
});

router.post('/rooms', [...MW, body('number').trim().notEmpty().withMessage('Room number required')], async (req, res) => {
  if (val(req,res)) return;
  try {
    const exists = await Room.findOne({ hotel:req.hotelId, number:req.body.number });
    if (exists) return res.status(409).json({ success:false, message:`Room ${req.body.number} already exists.` });
    const room = await Room.create({ hotel:req.hotelId, ...req.body });
    res.status(201).json({ success:true, data:room });
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
});

router.delete('/rooms/:id', MW, async (req, res) => {
  try {
    await Room.findOneAndDelete({ _id:req.params.id, hotel:req.hotelId });
    res.json({ success:true, message:'Room deleted' });
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
});

// ════════════════════════════════════════════════════════════════════
// FOOD ITEMS
// ════════════════════════════════════════════════════════════════════
router.get('/food', MW, async (req, res) => {
  try {
    const items = await FoodItem.find({ hotel:req.hotelId }).sort({ category:1, sortOrder:1, name:1 });
    res.json({ success:true, data:items });
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
});

router.post('/food', [...MW,
  body('name').trim().notEmpty(),
  body('price').isNumeric(),
  body('category').trim().notEmpty(),
], async (req, res) => {
  if (val(req,res)) return;
  try {
    const item = await FoodItem.create({ hotel:req.hotelId, ...req.body });
    res.status(201).json({ success:true, data:item });
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
});

router.put('/food/:id', MW, async (req, res) => {
  try {
    const item = await FoodItem.findOneAndUpdate({ _id:req.params.id, hotel:req.hotelId }, req.body, { new:true });
    if (!item) return res.status(404).json({ success:false, message:'Item not found' });
    res.json({ success:true, data:item });
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
});

router.patch('/food/:id/availability', MW, async (req, res) => {
  try {
    const item = await FoodItem.findOneAndUpdate(
      { _id:req.params.id, hotel:req.hotelId },
      { isAvailable: req.body.isAvailable },
      { new:true }
    );
    res.json({ success:true, data:item });
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
});

router.delete('/food/:id', MW, async (req, res) => {
  try {
    await FoodItem.findOneAndDelete({ _id:req.params.id, hotel:req.hotelId });
    res.json({ success:true, message:'Item deleted' });
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
});

// Bulk upload — CSV or Excel
router.post('/food/bulk', MW, memUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success:false, message:'No file uploaded' });
    const ext = path.extname(req.file.originalname).toLowerCase();
    let rows = [];

    if (ext === '.csv') {
      const text = req.file.buffer.toString('utf-8');
      const lines = text.split('\n').filter(l => l.trim());
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g,''));
      for (let i = 1; i < lines.length; i++) {
        const vals = lines[i].split(',').map(v => v.trim().replace(/"/g,''));
        if (vals.length < 2) continue;
        const obj = {};
        headers.forEach((h, idx) => obj[h] = vals[idx] || '');
        rows.push(obj);
      }
    } else if (ext === '.xlsx' || ext === '.xls') {
      const XLSX = require('xlsx');
      const wb   = XLSX.read(req.file.buffer, { type:'buffer' });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(ws, { defval:'' });
      rows = rows.map(r => {
        const norm = {};
        Object.keys(r).forEach(k => norm[k.toLowerCase().trim()] = String(r[k]).trim());
        return norm;
      });
    } else {
      return res.status(400).json({ success:false, message:'Only .csv, .xlsx, .xls files supported' });
    }

    const toInsert = rows
      .filter(r => r.name && r.price && r.category)
      .map(r => ({
        hotel:       req.hotelId,
        name:        r.name,
        description: r.description || '',
        price:       parseFloat(r.price) || 0,
        category:    r.category,
        isVeg:       String(r.isveg || r.is_veg || r.veg || 'true').toLowerCase() !== 'false',
        isAvailable: true,
        imageEmoji:  r.emoji || r.imageemoji || '🍽',
      }));

    if (toInsert.length === 0)
      return res.status(400).json({ success:false, message:'No valid rows found. Required columns: name, price, category' });

    await FoodItem.insertMany(toInsert, { ordered:false });
    res.json({ success:true, message:`${toInsert.length} items imported successfully`, count:toInsert.length });
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
});

// ════════════════════════════════════════════════════════════════════
// SERVICE REQUESTS
// ════════════════════════════════════════════════════════════════════
const dateFilter = (filter) => {
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  if (filter === 'today')     return { $gte: today };
  if (filter === 'yesterday') return { $gte: yesterday, $lt: today };
  return null;
};

router.get('/service-requests', MW, async (req, res) => {
  try {
    const { filter='all', status, from, to, page=1, limit=50 } = req.query;
    const q = { hotel: req.hotelId };
    const df = dateFilter(filter);
    if (df) q.createdAt = df;
    if (from && to) q.createdAt = { $gte: new Date(from), $lte: new Date(new Date(to).setHours(23,59,59)) };
    if (status && status !== 'all') q.status = status;

    const [data, total, pendingCount] = await Promise.all([
      ServiceRequest.find(q).sort({ createdAt:-1 }).skip((page-1)*limit).limit(Number(limit)),
      ServiceRequest.countDocuments(q),
      ServiceRequest.countDocuments({ hotel:req.hotelId, status:'pending' }),
    ]);
    res.json({ success:true, data, total, pendingCount });
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
});

router.patch('/service-requests/:id/status', MW, async (req, res) => {
  try {
    const update = { status: req.body.status };
    if (req.body.status === 'completed') update.completedAt = new Date();
    const sr = await ServiceRequest.findOneAndUpdate({ _id:req.params.id, hotel:req.hotelId }, update, { new:true });
    res.json({ success:true, data:sr });
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
});

// ════════════════════════════════════════════════════════════════════
// FOOD ORDERS
// ════════════════════════════════════════════════════════════════════
router.get('/food-orders', MW, async (req, res) => {
  try {
    const { filter='all', status, from, to, page=1, limit=50 } = req.query;
    const q = { hotel: req.hotelId };
    const df = dateFilter(filter);
    if (df) q.createdAt = df;
    if (from && to) q.createdAt = { $gte: new Date(from), $lte: new Date(new Date(to).setHours(23,59,59)) };
    if (status && status !== 'all') q.status = status;

    const [data, total, pendingCount] = await Promise.all([
      FoodOrder.find(q).sort({ createdAt:-1 }).skip((page-1)*limit).limit(Number(limit)),
      FoodOrder.countDocuments(q),
      FoodOrder.countDocuments({ hotel:req.hotelId, status:'pending' }),
    ]);
    res.json({ success:true, data, total, pendingCount });
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
});

router.patch('/food-orders/:id/status', MW, async (req, res) => {
  try {
    const order = await FoodOrder.findOneAndUpdate(
      { _id:req.params.id, hotel:req.hotelId },
      { status: req.body.status },
      { new:true }
    );
    res.json({ success:true, data:order });
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
});

// ════════════════════════════════════════════════════════════════════
// ANALYTICS
// ════════════════════════════════════════════════════════════════════
router.get('/analytics', MW, async (req, res) => {
  try {
    const hotelId = req.hotelId;
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOf30    = new Date(now); startOf30.setDate(now.getDate()-30);
    const startOf7     = new Date(now); startOf7.setDate(now.getDate()-7);

    const [
      totalOrders, todayOrders, totalRevenue, todayRevenue,
      totalRequests, pendingRequests,
      topItems, dailyOrders, categoryRevenue, recentOrders
    ] = await Promise.all([
      FoodOrder.countDocuments({ hotel:hotelId }),
      FoodOrder.countDocuments({ hotel:hotelId, createdAt:{ $gte:startOfToday } }),
      FoodOrder.aggregate([{ $match:{ hotel:hotelId, status:{ $ne:'cancelled' } } }, { $group:{ _id:null, total:{ $sum:'$totalAmount' } } }]),
      FoodOrder.aggregate([{ $match:{ hotel:hotelId, status:{ $ne:'cancelled' }, createdAt:{ $gte:startOfToday } } }, { $group:{ _id:null, total:{ $sum:'$totalAmount' } } }]),
      ServiceRequest.countDocuments({ hotel:hotelId }),
      ServiceRequest.countDocuments({ hotel:hotelId, status:'pending' }),
      // Top food items by quantity
      FoodOrder.aggregate([
        { $match:{ hotel:hotelId } }, { $unwind:'$items' },
        { $group:{ _id:'$items.name', total:{ $sum:'$items.quantity' } } },
        { $sort:{ total:-1 } }, { $limit:5 }
      ]),
      // Daily orders last 7 days
      FoodOrder.aggregate([
        { $match:{ hotel:hotelId, createdAt:{ $gte:startOf7 } } },
        { $group:{ _id:{ $dateToString:{ format:'%Y-%m-%d', date:'$createdAt' } }, count:{ $sum:1 }, revenue:{ $sum:'$totalAmount' } } },
        { $sort:{ _id:1 } }
      ]),
      // Revenue by category
      FoodOrder.aggregate([
        { $match:{ hotel:hotelId } }, { $unwind:'$items' },
        { $lookup:{ from:'fooditems', localField:'items.foodItem', foreignField:'_id', as:'fi' } },
        { $unwind:{ path:'$fi', preserveNullAndEmptyArrays:true } },
        { $group:{ _id:{ $ifNull:['$fi.category','Other'] }, revenue:{ $sum:{ $multiply:['$items.price','$items.quantity'] } } } },
        { $sort:{ revenue:-1 } }, { $limit:6 }
      ]),
      FoodOrder.find({ hotel:hotelId }).sort({ createdAt:-1 }).limit(5),
    ]);

    res.json({
      success:true,
      data:{
        stats:{ totalOrders, todayOrders, totalRevenue:totalRevenue[0]?.total||0, todayRevenue:todayRevenue[0]?.total||0, totalRequests, pendingRequests },
        topItems, dailyOrders, categoryRevenue, recentOrders,
      }
    });
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
});

// ════════════════════════════════════════════════════════════════════
// GUEST LANDING PAGE  (public — no auth, accessed via QR token)
// ════════════════════════════════════════════════════════════════════
router.get('/guest/:qrToken', async (req, res) => {
  try {
    const room = await Room.findOne({ qrToken:req.params.qrToken, isActive:true }).populate('hotel');
    if (!room) return res.status(404).json({ success:false, message:'Invalid or inactive QR code.' });

    const hotel     = room.hotel;
    const foodItems = await FoodItem.find({ hotel:hotel._id, isAvailable:true }).sort({ category:1, sortOrder:1 });

    // Group food by category
    const menu = {};
    foodItems.forEach(item => {
      if (!menu[item.category]) menu[item.category] = [];
      menu[item.category].push(item);
    });

    res.json({ success:true, data:{ hotel:{ _id:hotel._id, hotelName:hotel.hotelName, phone:hotel.phone, logoUrl:hotel.logoUrl }, room:{ _id:room._id, number:room.number, type:room.type }, menu } });
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
});

// Guest — place food order
router.post('/guest/:qrToken/order', async (req, res) => {
  try {
    const room = await Room.findOne({ qrToken:req.params.qrToken, isActive:true });
    if (!room) return res.status(404).json({ success:false, message:'Invalid QR' });

    const { items, guestNote='' } = req.body;
    if (!items || items.length === 0) return res.status(400).json({ success:false, message:'No items in order' });

    const totalAmount = items.reduce((sum, i) => sum + (i.price * i.quantity), 0);
    const order = await FoodOrder.create({ hotel:room.hotel, room:room._id, roomNumber:room.number, items, totalAmount, guestNote });
    res.status(201).json({ success:true, data:order, message:'Order placed successfully!' });
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
});

// Guest — place service request
router.post('/guest/:qrToken/service', async (req, res) => {
  try {
    const room = await Room.findOne({ qrToken:req.params.qrToken, isActive:true });
    if (!room) return res.status(404).json({ success:false, message:'Invalid QR' });

    const { type, note='' } = req.body;
    if (!type) return res.status(400).json({ success:false, message:'Request type required' });

    const sr = await ServiceRequest.create({ hotel:room.hotel, room:room._id, roomNumber:room.number, type, note });
    res.status(201).json({ success:true, data:sr, message:'Request submitted!' });
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
});

// Guest — get my orders
router.get('/guest/:qrToken/orders', async (req, res) => {
  try {
    const room = await Room.findOne({ qrToken:req.params.qrToken, isActive:true });
    if (!room) return res.status(404).json({ success:false, message:'Invalid QR' });

    const [orders, requests] = await Promise.all([
      FoodOrder.find({ room:room._id }).sort({ createdAt:-1 }).limit(20),
      ServiceRequest.find({ room:room._id }).sort({ createdAt:-1 }).limit(20),
    ]);
    res.json({ success:true, data:{ orders, requests } });
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
});

module.exports = router;
