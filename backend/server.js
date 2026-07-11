const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/superadmin', require('./routes/superadmin'));
app.use('/api/hotel', require('./routes/hotel'));
app.use('/api/payments', require('./routes/payment'));
app.use('/api/email', require('./routes/email'));

// Seed on first request
let seeded = false;
app.use(async (req, res, next) => {
  if (!seeded) {
    try {
      const { seedSuperAdmin } = require('./utils/seed');
      await seedSuperAdmin();
      seeded = true;
    } catch (e) {
      console.error('Seed error:', e.message);
    }
  }
  next();
});

const PORT = process.env.PORT || 5000;

// For local development
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`ðŸš€ StayXPulse API running on http://localhost:${PORT}`);
  });
}

// Export for Vercel
module.exports = app;
