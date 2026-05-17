const { createClient } = require('@supabase/supabase-js');
const { fetch } = require('undici');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  {
    auth: { persistSession: false },
    global: { fetch }
  }
);

module.exports = supabase;