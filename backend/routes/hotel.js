const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');
const { body, validationResult } = require('express-validator');
const { protect, authorize }     = require('../middleware/auth');
const { logoUpload, uploadHotelLogo } = require('../utils/logoUpload');
const { isValidGstin } = require('../utils/gst');
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

// Trial/subscription access gate. Login still works; once the trial or paid plan
// has lapsed the product is blocked with 402 and the app routes the user to the
// upgrade page. Explicit positive rule (blueprint §2): access iff
//   (active  AND plan_valid_to  > now)  OR  (trial AND trial_end_date > now).
const requireActiveHotel = (req, res, next) => {
  const h = req.user.hotel;
  const now = Date.now();
  const active   = h?.subscription_status === 'active' && h?.plan_valid_to  && new Date(h.plan_valid_to).getTime()  > now;
  const trialing = h?.subscription_status === 'trial'  && h?.trial_end_date && new Date(h.trial_end_date).getTime() > now;
  if (active || trialing) return next();
  return res.status(402).json({
    success: false,
    code: 'SUBSCRIPTION_REQUIRED',
    message: 'Your free trial has ended. Please choose a plan to continue using StayXPulse.',
  });
};

const MW      = [...HA, withHotel, requireActiveHotel]; // product endpoints — gated
const MW_OPEN = [...HA, withHotel];                     // billing/status — always reachable

// Guest order history resets daily at 12:00 noon IST (typical checkout) so a new
// guest doesn't see the previous guest's requests. Returns the ISO timestamp of
// the most recent 12:00 noon IST boundary (today's if past noon, else yesterday's).
const GUEST_RESET_HOUR_IST = 12;
const dailyResetCutoffIso = () => {
  const IST = 5.5 * 3600 * 1000;               // IST = UTC+5:30
  const istNow = Date.now() + IST;             // shift so UTC getters read IST wall-clock
  const d = new Date(istNow);
  let cut = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), GUEST_RESET_HOUR_IST, 0, 0, 0);
  if (istNow < cut) cut -= 24 * 3600 * 1000;   // before noon → use yesterday's noon
  return new Date(cut - IST).toISOString();    // convert back to real UTC
};

// "Today"/"Yesterday" filters use Indian midnight, not server (UTC) midnight —
// the server runs in UTC where midnight is 5:30 AM IST, which hid late-evening
// requests from the "Today" view for Indian hotels.
const istDayStartIso = (daysAgo = 0) => {
  const IST = 5.5 * 3600 * 1000;
  const d = new Date(Date.now() + IST);
  const cut = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - daysAgo, 0, 0, 0, 0);
  return new Date(cut - IST).toISOString();
};

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

    // rooms.type has a CHECK constraint with capitalised values, so a lowercase
    // default (or any unknown value) fails the insert with a 500 instead of a
    // useful message.
    const ROOM_TYPES = ['Standard', 'Deluxe', 'Suite', 'Executive Suite', 'Villa'];
    const type = ROOM_TYPES.includes(req.body.type) ? req.body.type : 'Standard';

    const { data, error } = await supabase.from('rooms').insert({
      hotel_id: req.hotelId,
      number: req.body.number,
      type,
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

// Import an array of menu items directly (starter templates + AI menu scan preview)
router.post('/food/bulk-json', MW, async (req, res) => {
  try {
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    const toInsert = items
      .filter(r => r && r.name && r.category && r.price !== undefined && r.price !== '')
      .slice(0, 300)
      .map(r => ({
        hotel_id: req.hotelId,
        name: String(r.name).trim().slice(0, 120),
        description: String(r.description || '').trim().slice(0, 300),
        price: Math.max(0, parseFloat(r.price) || 0),
        category: String(r.category).trim().slice(0, 60),
        is_veg: r.isVeg !== false && String(r.isVeg).toLowerCase() !== 'false',
        is_available: true,
        image_emoji: r.emoji || '🍽',
      }));

    if (toInsert.length === 0)
      return res.status(400).json({ success: false, message: 'No valid items. Each item needs name, price and category.' });

    const { error } = await supabase.from('food_items').insert(toInsert);
    if (error) throw error;
    res.json({ success: true, message: `${toInsert.length} items added to your menu`, count: toInsert.length });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// AI menu-card scan: photo of a printed menu → structured items. Returns the
// extracted items for client-side preview/editing; nothing is inserted here —
// the client imports the confirmed list via /food/bulk-json.
const MENU_SCAN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['items'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'price', 'category', 'isVeg', 'emoji', 'description'],
        properties: {
          name:        { type: 'string' },
          price:       { type: 'number' },
          category:    { type: 'string' },
          isVeg:       { type: 'boolean' },
          emoji:       { type: 'string' },
          description: { type: 'string' },
        },
      },
    },
  },
};

router.post('/food/scan-menu', MW, memUpload.single('image'), async (req, res) => {
  try {
    if (!process.env.ANTHROPIC_API_KEY)
      return res.status(503).json({ success: false, message: 'Menu scanning is not set up yet. Add ANTHROPIC_API_KEY to the server environment.' });
    if (!req.file) return res.status(400).json({ success: false, message: 'No image uploaded' });
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(req.file.mimetype))
      return res.status(400).json({ success: false, message: 'Upload a JPEG, PNG or WebP photo of your menu card' });

    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic();

    const response = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'low', format: { type: 'json_schema', schema: MENU_SCAN_SCHEMA } },
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: req.file.mimetype, data: req.file.buffer.toString('base64') } },
          {
            type: 'text',
            text: 'This is a photo of a hotel/restaurant menu card (likely Indian). Extract every food and drink item. ' +
              'price: the number only, in rupees; if an item lists Half/Full or multiple sizes with different prices, output one item per size (e.g. "Chicken Biryani (Half)"). ' +
              'category: use the menu\'s own section headings; if none, infer a sensible one (Breakfast, Starters, Main Course, Breads, Rice & Biryani, Chinese, Beverages, Desserts). ' +
              'isVeg: from the green/red markings if present, otherwise judge from the dish (chicken/mutton/fish/egg/prawn = false). ' +
              'emoji: one food emoji that suits the dish. ' +
              'description: only if a description is actually printed on the menu, else empty string. ' +
              'Skip decorative text, taglines, hotel name, GST notes and page numbers. If part of the menu is unreadable, extract what you can.',
          },
        ],
      }],
    });

    if (response.stop_reason === 'refusal')
      return res.status(422).json({ success: false, message: 'The AI declined to process this image. Try a clearer photo of the menu card.' });
    if (response.stop_reason === 'max_tokens')
      return res.status(422).json({ success: false, message: 'This menu is too large for one scan. Try photographing one page at a time.' });

    const textBlock = response.content.find(b => b.type === 'text');
    const parsed = JSON.parse(textBlock.text);
    res.json({ success: true, data: parsed.items || [] });
  } catch (e) {
    const msg = e.status === 429 ? 'Scanner is busy right now, try again in a minute.' : (e.message || 'Scan failed');
    res.status(500).json({ success: false, message: msg });
  }
});

// ════════════════════════════════════════════════════════════════════
// SERVICE REQUESTS
// ════════════════════════════════════════════════════════════════════
router.get('/service-requests', MW, async (req, res) => {
  try {
    const { filter = 'all', status, from, to, page = 1, limit = 50 } = req.query;
    let query = supabase.from('service_requests').select('*', { count: 'exact' }).eq('hotel_id', req.hotelId);

    const today = istDayStartIso(0);
    const yesterday = istDayStartIso(1);

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

    const today = istDayStartIso(0);
    const yesterday = istDayStartIso(1);

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
// SUBSCRIPTION HISTORY (trial + paid plans + invoices)
// ════════════════════════════════════════════════════════════════════
// ─── HOTEL PROFILE ────────────────────────────────────────────────────────────
// MW_OPEN, not MW: a hotel whose trial has lapsed must still be able to correct
// its own name/GST — that data feeds the invoice it is about to pay for.

router.get('/profile', MW_OPEN, async (req, res) => {
  try {
    const { data, error } = await supabase.from('hotels')
      .select('id, hotel_name, email, phone, address, gst_number, logo_url, user_id')
      .eq('id', req.hotelId).single();
    if (error) throw error;
    res.json({ success: true, data: {
      id: data.id, hotelName: data.hotel_name, email: data.email, phone: data.phone,
      address: data.address, gstNumber: data.gst_number, logoUrl: data.logo_url, userId: data.user_id,
    }});
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.put('/profile', [...MW_OPEN, logoUpload.single('logo')], async (req, res) => {
  try {
    const { hotelName, phone, address, gstNumber } = req.body;
    if (!hotelName?.trim()) return res.status(400).json({ success: false, message: 'Hotel name is required.' });
    if (!phone?.trim())     return res.status(400).json({ success: false, message: 'Phone number is required.' });
    if (!address?.trim())   return res.status(400).json({ success: false, message: 'Address is required.' });
    if (!gstNumber?.trim()) return res.status(400).json({ success: false, message: 'GST number is required.' });
    if (!isValidGstin(gstNumber)) return res.status(400).json({ success: false, message: 'That GST number is not a valid GSTIN (e.g. 29ABCDE1234F1Z5).' });

    const update = {
      hotel_name: hotelName.trim(),
      phone: phone.trim(),
      address: address.trim(),
      gst_number: gstNumber.trim().toUpperCase(),
    };

    // Only overwrite the logo when a new file was actually sent — saving the
    // form without touching the file input must not wipe the existing one.
    if (req.file) {
      const { url, error: upErr } = await uploadHotelLogo(req.file);
      if (!url) return res.status(502).json({ success: false, message: `Logo upload failed: ${upErr || 'unknown error'}` });
      update.logo_url = url;
    }

    const { data, error } = await supabase.from('hotels').update(update)
      .eq('id', req.hotelId).select().single();
    if (error) throw error;

    // The email/invoice name comes from users.name, so keep them in step.
    await supabase.from('users').update({ name: update.hotel_name }).eq('hotel_id', req.hotelId).eq('role', 'hoteladmin');

    res.json({ success: true, message: 'Profile updated.', data: {
      id: data.id, hotelName: data.hotel_name, email: data.email, phone: data.phone,
      address: data.address, gstNumber: data.gst_number, logoUrl: data.logo_url,
    }});
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.get('/subscription', MW_OPEN, async (req, res) => {
  try {
    const { data: hotel, error: hErr } = await supabase
      .from('hotels')
      .select('subscription_status, trial_start_date, trial_end_date, plan_valid_from, plan_valid_to, current_plan_id, plans(name, price)')
      .eq('id', req.hotelId)
      .single();
    if (hErr) throw hErr;

    const { data: payments, error: pErr } = await supabase
      .from('payments')
      .select('id, amount, payment_id, invoice_number, valid_from, valid_to, paid_at, plans(name)')
      .eq('hotel_id', req.hotelId)
      .order('valid_from', { ascending: false });
    if (pErr) throw pErr;

    res.json({ success: true, data: { hotel, payments: payments || [] } });
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
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ success: false, message: 'No items in order' });
    if (items.length > 50) return res.status(400).json({ success: false, message: 'Too many items in one order.' });

    // NEVER trust the price or name the browser sends — re-read both from the
    // menu, scoped to this room's hotel, or a guest could order at any price.
    const ids = [...new Set(items.map(i => i.foodItem).filter(Boolean))];
    if (ids.length === 0) return res.status(400).json({ success: false, message: 'No valid items in order' });

    const { data: menuItems, error: menuError } = await supabase
      .from('food_items').select('id, name, price, is_available')
      .eq('hotel_id', room.hotel_id).in('id', ids);
    if (menuError) throw menuError;

    const byId = new Map((menuItems || []).map(m => [m.id, m]));
    const priced = [];
    for (const i of items) {
      const m = byId.get(i.foodItem);
      if (!m) return res.status(400).json({ success: false, message: 'One of the items is no longer on the menu.' });
      if (!m.is_available) return res.status(400).json({ success: false, message: `"${m.name}" is currently unavailable.` });
      const quantity = Math.floor(Number(i.quantity));
      if (!Number.isFinite(quantity) || quantity < 1 || quantity > 99)
        return res.status(400).json({ success: false, message: 'Invalid quantity.' });
      priced.push({ foodItem: m.id, name: m.name, price: Number(m.price), quantity });
    }

    const totalAmount = priced.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const { data: order, error: orderError } = await supabase.from('food_orders').insert({
      hotel_id: room.hotel_id, room_id: room.id, room_number: room.number, items: priced, total_amount: totalAmount, guest_note: String(guestNote).slice(0, 500),
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
    if (!type || typeof type !== 'string' || !type.trim()) return res.status(400).json({ success: false, message: 'Request type required' });

    const { data: sr, error: srError } = await supabase.from('service_requests').insert({
      hotel_id: room.hotel_id, room_id: room.id, room_number: room.number,
      type: type.trim().slice(0, 100), note: String(note).slice(0, 500),
    }).select().single();
    if (srError) throw srError;
    res.status(201).json({ success: true, data: sr, message: 'Request submitted!' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.get('/guest/:qrToken/orders', async (req, res) => {
  try {
    const { data: room, error } = await supabase.from('rooms').select('*').eq('qr_token', req.params.qrToken).eq('is_active', true).single();
    if (error || !room) return res.status(404).json({ success: false, message: 'Invalid QR' });

    // Only show this guest's activity since the daily 12:00-noon-IST reset
    const cutoff = dailyResetCutoffIso();
    const [{ data: orders }, { data: requests }] = await Promise.all([
      supabase.from('food_orders').select('*').eq('room_id', room.id).gte('created_at', cutoff).order('created_at', { ascending: false }).limit(20),
      supabase.from('service_requests').select('*').eq('room_id', room.id).gte('created_at', cutoff).order('created_at', { ascending: false }).limit(20),
    ]);
    res.json({ success: true, data: { orders: orders || [], requests: requests || [] } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

module.exports = router;
