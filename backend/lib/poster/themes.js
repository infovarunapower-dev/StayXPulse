const supabase = require('../../utils/supabase');

// ── Poster themes ─────────────────────────────────────────────────────────────
// Each theme is a marketing angle for StayXPulse aimed at hotel owners/managers
// in India. `angle` steers the copy model; `mood` steers the background image.
const THEMES = [
  {
    key: 'qr-room-service',
    angle: 'Guests scan a QR code in their room and order food or services instantly — no phone calls to the front desk.',
    mood: 'elegant hotel room interior, bedside table, warm ambient lighting, luxury minimal',
  },
  {
    key: 'guest-delight',
    angle: 'Delighted guests leave better reviews. Faster service means happier stays and higher ratings.',
    mood: 'smiling hotel guest relaxing in a premium suite, soft morning light, aspirational',
  },
  {
    key: 'revenue-boost',
    angle: 'In-room ordering lifts food & beverage revenue — guests order more when it takes ten seconds.',
    mood: 'beautifully plated room-service meal on a tray, dramatic lighting, gourmet food photography',
  },
  {
    key: 'go-digital',
    angle: 'Replace paper menus and phone-call chaos with one digital dashboard for the whole property.',
    mood: 'modern hotel reception desk, clean architectural lines, teal and gold accents, futuristic calm',
  },
  {
    key: 'menu-showcase',
    angle: 'A beautiful digital menu with photos sells more than a laminated card ever will.',
    mood: 'overhead flat-lay of vibrant Indian dishes, rich colors, editorial food photography',
  },
  {
    key: 'analytics-insight',
    angle: 'Know your busiest hours, best-selling dishes and pending requests at a glance with live analytics.',
    mood: 'abstract glowing data visualization over a dark elegant background, teal accents, premium tech',
  },
  {
    key: 'contactless-trust',
    angle: 'Contactless service is the new standard — guests expect it, StayXPulse delivers it.',
    mood: 'hand holding a smartphone scanning a QR code on a wooden table, shallow depth of field',
  },
  {
    key: 'front-desk-relief',
    angle: 'Free your front desk from routine calls — requests flow straight to the right team with alerts.',
    mood: 'calm organized hotel lobby, staff at ease, warm hospitality atmosphere, cinematic',
  },
  {
    key: 'easy-setup',
    angle: 'Set up in one evening: add rooms, print QR codes, go live. Three-day free trial, no hardware.',
    mood: 'freshly printed QR cards on a marble counter next to a room key, crisp product photography',
  },
  {
    key: 'boutique-premium',
    angle: 'Boutique hotels and resorts use StayXPulse to feel five-star without five-star headcount.',
    mood: 'boutique resort infinity pool at dusk, golden hour, luxurious travel photography',
  },
];

// Pick the theme least recently used, so consecutive days never repeat and the
// full set rotates evenly. History comes from the daily_posters table; if the
// table is missing or empty (first run), fall back to day-of-year rotation so
// the cron still produces something.
async function pickTheme() {
  try {
    const { data, error } = await supabase
      .from('daily_posters')
      .select('theme')
      .order('created_at', { ascending: false })
      .limit(THEMES.length - 1);

    if (!error && data && data.length) {
      const recent = data.map((r) => r.theme);
      // Least recently used = not in `recent`, or deepest in it.
      const unused = THEMES.filter((t) => !recent.includes(t.key));
      if (unused.length) return unused[0];
      const byAge = [...THEMES].sort(
        (a, b) => recent.indexOf(b.key) - recent.indexOf(a.key)
      );
      return byAge[0];
    }
  } catch (e) {
    console.error('Theme history lookup failed, using date fallback:', e.message);
  }

  const dayOfYear = Math.floor(
    (Date.now() - Date.UTC(new Date().getUTCFullYear(), 0, 0)) / 86400000
  );
  return THEMES[dayOfYear % THEMES.length];
}

module.exports = { THEMES, pickTheme };
