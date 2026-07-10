const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const supabase = require('../utils/supabase');

// Staff tokens carry { staffId, role: 'staff' } — a different shape from admin
// tokens ({ id }), so a staff token can never pass the admin `protect` middleware
// (it looks the id up in `users`) and vice versa.
const protectStaff = async (req, res, next) => {
  let token;
  if (req.headers.authorization?.startsWith('Bearer ')) token = req.headers.authorization.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, message: 'Not authorised' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'staff' || !decoded.staffId) return res.status(401).json({ success: false, message: 'Not a staff token' });
    const { data: staff, error } = await supabase.from('staff').select('*').eq('id', decoded.staffId).maybeSingle();
    if (error || !staff) return res.status(401).json({ success: false, message: 'Staff account no longer exists' });
    if (!staff.is_active) return res.status(403).json({ success: false, message: 'Your account has been disabled. Contact your manager.' });
    req.staff = staff;
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

// ── Staff login: hotel code (HTL001) + phone + 4-digit PIN ──────────
router.post('/login', async (req, res) => {
  try {
    const hotelCode = String(req.body.hotelCode || '').trim().toUpperCase();
    const phone     = String(req.body.phone || '').trim();
    const pin       = String(req.body.pin || '').trim();
    if (!hotelCode || !phone || !pin)
      return res.status(400).json({ success: false, message: 'Hotel code, phone and PIN are required' });

    const { data: hotel } = await supabase.from('hotels').select('id, hotel_name, user_id').eq('user_id', hotelCode).maybeSingle();
    if (!hotel) return res.status(401).json({ success: false, message: 'Hotel code not found. Ask your manager for it (e.g. HTL001).' });

    const { data: staff } = await supabase.from('staff').select('*')
      .eq('hotel_id', hotel.id).eq('phone', phone).maybeSingle();
    if (!staff) return res.status(401).json({ success: false, message: 'No staff account with this phone number' });
    if (!staff.is_active) return res.status(403).json({ success: false, message: 'Your account has been disabled. Contact your manager.' });

    const ok = await bcrypt.compare(pin, staff.pin_hash);
    if (!ok) return res.status(401).json({ success: false, message: 'Wrong PIN' });

    const token = jwt.sign({ staffId: staff.id, role: 'staff' }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.json({
      success: true,
      token,
      data: { id: staff.id, name: staff.name, department: staff.department, hotelName: hotel.hotel_name },
    });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── My tasks: assigned service requests (open + completed today) ────
router.get('/tasks', protectStaff, async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data, error } = await supabase.from('service_requests')
      .select('id, request_ref, room_number, type, note, status, assigned_at, completed_at, created_at')
      .eq('assigned_to', req.staff.id)
      .or(`status.in.(pending,in-progress),and(status.eq.completed,completed_at.gte.${todayStart.toISOString()})`)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;

    res.json({
      success: true,
      data,
      me: { name: req.staff.name, department: req.staff.department },
    });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── Update own task status: start / complete ────────────────────────
router.patch('/tasks/:id/status', protectStaff, async (req, res) => {
  try {
    const status = req.body.status;
    if (!['in-progress', 'completed'].includes(status))
      return res.status(400).json({ success: false, message: 'Status must be in-progress or completed' });

    const update = { status };
    if (status === 'completed') update.completed_at = new Date().toISOString();

    const { data, error } = await supabase.from('service_requests')
      .update(update)
      .eq('id', req.params.id)
      .eq('assigned_to', req.staff.id)   // staff can only touch their own tasks
      .select()
      .single();
    if (error) throw error;
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

module.exports = router;
