const jwt = require('jsonwebtoken');
const supabase = require('../utils/supabase');

const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorised. No token provided.' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', decoded.id)
      .maybeSingle();

    if (error) {
      console.error('Auth middleware Supabase error:', error);
      return res.status(401).json({ success: false, message: 'Auth error: ' + error.message });
    }

    if (!user) {
      console.error('User not found for id:', decoded.id);
      return res.status(401).json({ success: false, message: 'User no longer exists.' });
    }

    if (!user.is_active) {
      return res.status(403).json({ success: false, message: 'Account is disabled. Contact support.' });
    }

    // Fetch hotel separately if user has a hotel_id
    if (user.hotel_id) {
      const { data: hotel } = await supabase
        .from('hotels')
        .select('*')
        .eq('id', user.hotel_id)
        .maybeSingle();
      user.hotel = hotel || null;
    } else {
      user.hotel = null;
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('Auth middleware error:', err.message);
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
};

const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: `Role '${req.user.role}' is not permitted to access this resource.`,
    });
  }
  next();
};

module.exports = { protect, authorize };
