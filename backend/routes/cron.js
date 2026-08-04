const express = require('express');
const router = express.Router();

const { pickTheme } = require('../lib/poster/themes');
const { generateCopy } = require('../lib/poster/generateCopy');
const { generateImage } = require('../lib/poster/generateImage');
const { composePoster, fallbackBackground } = require('../lib/poster/overlay');
const { savePoster } = require('../lib/poster/storage');
const { deliver } = require('../lib/poster/deliver');

// ── Cron auth ─────────────────────────────────────────────────────────────────
// Vercel invokes cron paths with `Authorization: Bearer ${CRON_SECRET}` when
// that env var exists on the project. Refusing to run without the secret set
// keeps the endpoint from being a free image-generation API for anyone who
// finds the URL (each run bills Gemini + Imagen).
const requireCronSecret = (req, res, next) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return res.status(503).json({ success: false, message: 'CRON_SECRET not configured' });
  }
  if (req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  next();
};

// ── GET /api/cron/daily-poster ────────────────────────────────────────────────
// The whole pipeline in one request: theme → copy → background → overlay →
// storage → delivery. GET because that's what Vercel cron issues. Typical run
// is 15-30s; vercel.json already grants the backend 60s maxDuration.
router.get('/daily-poster', requireCronSecret, async (req, res) => {
  try {
    const theme = await pickTheme();
    const copy = await generateCopy(theme);
    // AI background is best-effort: the free Gemini tier has no image quota,
    // and even paid image calls can be safety-filtered. The branded gradient
    // fallback means the daily poster always ships.
    let background;
    let usedFallback = false;
    try {
      background = await generateImage(copy.imagePrompt);
    } catch (e) {
      console.error('Image generation failed, using branded fallback:', e.message);
      background = await fallbackBackground(theme.key);
      usedFallback = true;
    }
    const pngBuffer = await composePoster(background, copy);
    const { imageUrl } = await savePoster({ pngBuffer, theme, copy });
    const delivery = await deliver({ imageUrl, pngBuffer, copy, theme });

    res.json({
      success: true,
      usedFallbackBackground: usedFallback,
      theme: theme.key,
      headline: copy.headline,
      caption: copy.caption,
      imageUrl,
      delivery,
    });
  } catch (err) {
    console.error('Daily poster failed:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
