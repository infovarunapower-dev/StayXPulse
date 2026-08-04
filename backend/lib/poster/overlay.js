const path = require('path');
const sharp = require('sharp');

// ── Brand ─────────────────────────────────────────────────────────────────────
// Values mirror frontend/src/styles/global.css (Emerald Luxe theme). If the
// palette changes there, change it here too — this file is the only place the
// backend knows the brand.
const BRAND = {
  teal: '#0D9488', //  --brand
  tealMid: '#14B8A6', //  --brand-mid
  tealBright: '#2DD4BF', //  --brand (dark mode) — pops on photo backgrounds
  gold: '#C99A5B', //  --accent
  goldBright: '#E0B341', //  --accent (dark mode)
  ink: '#0E1B17', //  --gray-900
  white: '#FFFFFF',
  // Plus Jakarta Sans matches the web app but is NOT installed on Vercel's
  // lambdas — librsvg falls back down this chain there. See lib/poster/README.
  font: "'Plus Jakarta Sans', 'DejaVu Sans', 'Segoe UI', sans-serif",
  url: 'stayxpulse.sunver.in',
  cta: 'Start your 3-day free trial',
};

const WIDTH = 1080;
const HEIGHT = 1350; // 4:5 — Instagram/WhatsApp portrait

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

// Greedy word-wrap for SVG <text> (no native wrapping). maxChars is tuned per
// font size at 1080px width, not measured — good enough for 6-word headlines.
function wrap(text, maxChars, maxLines) {
  const words = String(text).trim().split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).trim().length > maxChars && line) {
      lines.push(line);
      line = w;
    } else {
      line = (line + ' ' + w).trim();
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] = lines[maxLines - 1].replace(/\W*$/, '') + '…';
  }
  return lines;
}

function buildSvg({ headline, subtext }) {
  const headLines = wrap(headline, 22, 2);
  const subLines = wrap(subtext, 46, 2);

  const headSize = 76;
  const headLead = 88;
  const subSize = 34;
  const subLead = 46;

  // Text block grows upward from the CTA pill so spacing stays constant no
  // matter how many lines wrap.
  const ctaY = HEIGHT - 150;
  const subY = ctaY - 64 - (subLines.length - 1) * subLead;
  const headY = subY - 56 - (headLines.length - 1) * headLead;
  const barY = headY - headSize - 20;

  const headTspans = headLines
    .map((l, i) => `<tspan x="72" dy="${i === 0 ? 0 : headLead}">${esc(l)}</tspan>`)
    .join('');
  const subTspans = subLines
    .map((l, i) => `<tspan x="72" dy="${i === 0 ? 0 : subLead}">${esc(l)}</tspan>`)
    .join('');

  return `<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0"    stop-color="${BRAND.ink}" stop-opacity="0"/>
      <stop offset="0.45" stop-color="${BRAND.ink}" stop-opacity="0.15"/>
      <stop offset="1"    stop-color="${BRAND.ink}" stop-opacity="0.92"/>
    </linearGradient>
    <linearGradient id="cta" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${BRAND.teal}"/>
      <stop offset="1" stop-color="${BRAND.tealMid}"/>
    </linearGradient>
  </defs>

  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#scrim)"/>

  <!-- top-right brand wordmark (logo PNG is composited separately at top-left) -->
  <text x="${WIDTH - 72}" y="112" text-anchor="end" font-family=${JSON.stringify(BRAND.font)}
        font-size="34" font-weight="700" fill="${BRAND.white}" opacity="0.95">Stay<tspan fill="${BRAND.tealBright}">X</tspan>Pulse</text>

  <!-- gold accent bar -->
  <rect x="72" y="${barY}" width="120" height="10" rx="5" fill="${BRAND.goldBright}"/>

  <text x="72" y="${headY}" font-family=${JSON.stringify(BRAND.font)} font-size="${headSize}"
        font-weight="800" fill="${BRAND.white}">${headTspans}</text>

  <text x="72" y="${subY}" font-family=${JSON.stringify(BRAND.font)} font-size="${subSize}"
        font-weight="500" fill="${BRAND.white}" opacity="0.9">${subTspans}</text>

  <!-- CTA pill + URL -->
  <rect x="72" y="${ctaY - 44}" width="518" height="72" rx="36" fill="url(#cta)"/>
  <text x="331" y="${ctaY + 4}" text-anchor="middle" font-family=${JSON.stringify(BRAND.font)}
        font-size="28" font-weight="700" fill="${BRAND.white}">${esc(BRAND.cta)}</text>
  <text x="72" y="${ctaY + 78}" font-family=${JSON.stringify(BRAND.font)} font-size="26"
        font-weight="600" fill="${BRAND.goldBright}" letter-spacing="1">${esc(BRAND.url)}</text>
</svg>`;
}

// Branded background used when AI image generation is unavailable (e.g. the
// free Gemini tier has no image quota). Not a plain rectangle: layered brand
// gradient, off-canvas glows and concentric QR-corner motifs keep it looking
// designed. Varies by theme key so consecutive days still differ.
function fallbackBackground(themeKey = '') {
  const seed = [...String(themeKey)].reduce((a, c) => a + c.charCodeAt(0), 0);
  const palettes = [
    ['#0E1B17', '#0F766E', '#14B8A6'],
    ['#0A1512', '#134E4A', '#0D9488'],
    ['#0E1B17', '#1E2B27', '#0F766E'],
  ];
  const [dark, mid, bright] = palettes[seed % palettes.length];
  const svg = `<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${dark}"/>
      <stop offset="0.55" stop-color="${mid}"/>
      <stop offset="1" stop-color="${bright}"/>
    </linearGradient>
    <radialGradient id="glowTeal" cx="0.85" cy="0.18" r="0.6">
      <stop offset="0" stop-color="${BRAND.tealBright}" stop-opacity="0.55"/>
      <stop offset="1" stop-color="${BRAND.tealBright}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glowGold" cx="0.12" cy="0.45" r="0.5">
      <stop offset="0" stop-color="${BRAND.goldBright}" stop-opacity="0.28"/>
      <stop offset="1" stop-color="${BRAND.goldBright}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#glowTeal)"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#glowGold)"/>
  <!-- QR finder-pattern motif, oversized and clipped by the canvas edge -->
  <g stroke="${BRAND.white}" fill="none" opacity="0.10">
    <rect x="760" y="120" width="420" height="420" rx="72" stroke-width="26"/>
    <rect x="838" y="198" width="264" height="264" rx="44" stroke-width="18"/>
    <rect x="906" y="266" width="128" height="128" rx="24" fill="${BRAND.white}" stroke="none"/>
  </g>
  <g stroke="${BRAND.white}" fill="none" opacity="0.05">
    <rect x="-160" y="820" width="380" height="380" rx="64" stroke-width="24"/>
    <rect x="-90" y="890" width="240" height="240" rx="40" stroke-width="16"/>
  </g>
</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

// Compose the final 1080×1350 poster: background cover-resized, scrim + text
// SVG, and the PNG logo badge at top-left.
async function composePoster(backgroundBuffer, { headline, subtext }) {
  const svg = Buffer.from(buildSvg({ headline, subtext }));

  const logo = await sharp(path.join(__dirname, '../../assets/logo.png'))
    .resize(88, 88, { fit: 'inside' })
    .png()
    .toBuffer();

  return sharp(backgroundBuffer)
    .resize(WIDTH, HEIGHT, { fit: 'cover', position: 'attention' })
    .composite([
      { input: svg, top: 0, left: 0 },
      { input: logo, top: 64, left: 72 },
    ])
    .png({ quality: 92 })
    .toBuffer();
}

module.exports = { composePoster, fallbackBackground, BRAND, WIDTH, HEIGHT };
