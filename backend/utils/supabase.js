const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  {
    auth: { persistSession: false },
    global: {
      fetch: (url, options) => {
        const https = require('https');
        const agent = new https.Agent({ family: 4 });
        return require('node-fetch')(url, { ...options, agent });
      }
    }
  }
);

module.exports = supabase;