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
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    return cb(new Error('Not allowed by CORS'));
  },
  credentials: false,
}));

app.use(express.json({ limit: '1mb' }));
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
// Guest QR endpoints are unauthenticated by design — cap ordering abuse.
app.use('/api/hotel/guest',          limiter(10, 60, 'Too many requests. Please slow down.'));
// Each scan bills the Anthropic API.
app.use('/api/hotel/food/scan-menu', limiter(60, 30, 'Menu scan limit reached. Please try again later.'));
// Loose global backstop.
app.use('/api',                      limiter(15, 1000, 'Too many requests. Please slow down.'));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/superadmin', require('./routes/superadmin'));
app.use('/api/hotel', require('./routes/hotel'));
app.use('/api/payments', require('./routes/payment'));
app.use('/api/email', require('./routes/email'));
app.use('/api/master', require('./routes/master'));

const PORT = process.env.PORT || 5000;

// For local development
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`StayXPulse API running on http://localhost:${PORT}`);
  });
}

// Export for Vercel
module.exports = app;
