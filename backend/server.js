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

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    const { seedSuperAdmin } = require('./utils/seed');
    await seedSuperAdmin();

    app.listen(PORT, () => {
      console.log(`🚀 StayXPulse API running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
