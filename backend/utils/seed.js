const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const seedSuperAdmin = async () => {
  try {
    const email = process.env.SUPER_ADMIN_EMAIL;
    const password = process.env.SUPER_ADMIN_PASSWORD;
    const name = process.env.SUPER_ADMIN_NAME;

    // Check if super admin already exists
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .eq('role', 'superadmin')
      .single();

    if (existing) {
      console.log('✅ Super admin already exists');
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create super admin
    const { error } = await supabase.from('users').insert({
      name,
      email,
      password: hashedPassword,
      role: 'superadmin',
      is_active: true,
    });

    if (error) throw error;

    console.log(`🌱 Super admin seeded: ${email}`);

    // Seed default plans
    const { data: existingPlans } = await supabase
      .from('plans')
      .select('id')
      .limit(1);

    if (!existingPlans || existingPlans.length === 0) {
      const plans = [
        {
          name: 'Basic',
          price: 999,
          duration_days: 30,
          max_rooms: 20,
          features: ['QR Menu', 'Food Orders', 'Basic Analytics'],
          is_active: true,
        },
        {
          name: 'Standard',
          price: 2499,
          duration_days: 30,
          max_rooms: 50,
          features: ['QR Menu', 'Food Orders', 'Advanced Analytics', 'Service Requests', 'Email Support'],
          is_active: true,
        },
        {
          name: 'Premium',
          price: 4999,
          duration_days: 30,
          max_rooms: 200,
          features: ['QR Menu', 'Food Orders', 'Advanced Analytics', 'Service Requests', 'Priority Support', 'Custom Branding'],
          is_active: true,
        },
      ];

      const { error: planError } = await supabase.from('plans').insert(plans);
      if (planError) throw planError;

      console.log('🌱 Default plans seeded');
    }
  } catch (error) {
    console.error('❌ Seed failed:', error.message);
  }
};

module.exports = { seedSuperAdmin };
