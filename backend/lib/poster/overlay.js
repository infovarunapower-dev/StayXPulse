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

module.exports = { composePoster, BRAND, WIDTH, HEIGHT };
