const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

// Vercel puts a proxy in front of us, so the client IP arrives in
// X-Forwarded-For. Without this every request looks like it comes from the
// proxy and the rate limiters below would throttle all customers as one.
app.set('trust proxy', 1);

app.use(helmet({
  // The API only ever returns JSON; CSP/COEP here would just fight the SPA,
  // which Vercel serves from a different build.
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// ── CORS ──────────────────────────────────────────────────────────────────────
// The website is one origin, but the Android app is NOT: Capacitor serves the
// bundled assets from https://localhost (androidScheme: 'https'), so locking
// this to CLIENT_URL alone would break every APK in the field.
const ALLOWED_ORIGINS = [
  process.env.CLIENT_URL,
  'https://stayxpulse.sunver.in',
  'https://localhost',        // Capacitor Android
  'capacitor://localhost',    // Capacitor iOS
  'http://localhost:3000',    // local dev
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    // No Origin header = same-origin, curl, or a native HTTP client — allow.
    if (!origin) return cb(null, true);
    const clean = origin.replace(/\/+$/, '');
    // Vercel preview builds and the *.vercel.app production alias serve the
    // same SPA; blocking them breaks testing a deploy before it goes to the
    // custom domain.
    if (ALLOWED_ORIGINS.includes(clean) || /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(clean)) {
      return cb(null, true);
    }
    // false, not an Error: throwing here reaches the error handler and returns
    // a 500, when the correct behaviour is simply to omit the CORS header.
    return cb(null, false);
  },
  credentials: false,
}));

// The Razorpay webhook signs the RAW request body, so keep a copy before
// JSON.parse rewrites it — re-stringifying the parsed object does not
// byte-for-byte reproduce what was signed.
app.use(express.json({
  limit: '1mb',
  verify: (req, res, buf) => { if (buf && buf.length) req.rawBody = buf; },
}));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ── Rate limiting ─────────────────────────────────────────────────────────────
// Note: the store is in-memory and Vercel runs several lambda instances, so
// these are per-instance ceilings rather than a global guarantee. That is still
// enough to stop credential stuffing and SMTP flooding; a shared store (Redis)
// would be the next step if abuse becomes real.
const limiter = (windowMinutes, max, message) => rateLimit({
  windowMs: windowMinutes * 60 * 1000,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message },
});

// Credential stuffing + account-creation/SMTP abuse.
app.use('/api/auth/login',           limiter(15, 20, 'Too many login attempts. Please try again in a few minutes.'));
app.use('/api/auth/register',        limiter(60, 10, 'Too many registration attempts. Please try again later.'));
app.use('/api/auth/forgot-password', limiter(60,  5, 'Too many password reset requests. Please try again later.'));
// Each scan bills the Anthropic API.
app.use('/api/hotel/food/scan-menu', limiter(60, 30, 'Menu scan limit reached. Please try again later.'));

// Guest QR endpoints are unauthenticated, but they must NOT be limited per IP:
// an entire hotel shares one NAT address, and the guest page polls for order
// status every 20s. An IP limit means a couple of guests lock out everyone
// else — and GuestLanding renders any failure as "Invalid QR Code", so the
// product would appear broken exactly when it is busiest.
// Only the two write endpoints are capped, keyed per room QR token.
const guestWriteLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 40,                                   // 40 orders/requests per room per 10 min
  standardHeaders: true,
  legacyHeaders: false,
  // Mounted at /api/hotel/guest, so req.path is "/<qrToken>/order".
  keyGenerator: (req) => req.path.split('/')[1] || req.ip,
  message: { success: false, message: 'Too many requests from this room. Please wait a moment.' },
});
app.use('/api/hotel/guest', (req, res, next) =>
  req.method === 'POST' ? guestWriteLimiter(req, res, next) : next());

// Loose global backstop. Deliberately generous: a hotel front desk, manager and
// two tablets behind ONE office IP, each polling orders every 5s, legitimately
// makes ~800 requests / 15 min. Tripping this would also block /auth/login and
// lock staff out of their own dashboard.
app.use('/api',                      limiter(15, 5000, 'Too many requests. Please slow down.'));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/superadmin', require('./routes/superadmin'));
app.use('/api/hotel', require('./routes/hotel'));
app.use('/api/payments', require('./routes/payment'));
app.use('/api/email', require('./routes/email'));
app.use('/api/master', require('./routes/master'));

// ── Terminal error handler ────────────────────────────────────────────────────
// Without this, anything thrown by middleware (notably multer's file-size and
// file-type rejections) falls through to Express's default handler, which
// returns an HTML 500. The client then finds no `message` in the response and
// shows a useless "please try again" — which is what a hotel saw if it picked
// an iPhone HEIC photo as its logo: registration failed with no explanation.
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);

  if (err && (err.code === 'LIMIT_FILE_SIZE' || err.name === 'MulterError' || /^Logo must be/.test(err.message || ''))) {
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? 'That image is too large — please use one under 2MB.'
      : (err.message || 'That file could not be accepted.');
    return res.status(400).json({ success: false, message });
  }

  console.error('Unhandled error:', err?.message, err?.stack);
  res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
});

const PORT = process.env.PORT || 5000;

// For local development
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`StayXPulse API running on http://localhost:${PORT}`);
  });
}

// Export for Vercel
module.exports = app;
