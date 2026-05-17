const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
  global: {
    fetch: (...args) => {
      const nodeFetch = require('node-fetch');
      return nodeFetch(...args);
    }
  }
});

module.exports = supabase;
