// ── Poster copy via Gemini ────────────────────────────────────────────────────
// One text call returns everything the pipeline needs: headline/subtext for the
// overlay, a caption for social posting, and the prompt for the image model.
// Uses the REST API via global fetch (Node 18+) — no SDK dependency.

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

async function generateCopy(theme) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
  // The -latest alias tracks Google's newest flash model — pinned versions
  // (e.g. gemini-2.5-flash) get retired for new API keys.
  const model = process.env.GEMINI_TEXT_MODEL || 'gemini-flash-latest';

  const prompt = `You are the marketing copywriter for StayXPulse, a hotel guest-services SaaS in India (https://stayxpulse.sunver.in). Guests scan a per-room QR code to order food and raise service requests; hotel admins manage rooms, menus, orders and analytics from one dashboard. Pricing starts with a 3-day free trial.

Today's marketing angle: ${theme.angle}

Write today's social-media poster copy. Rules:
- headline: max 6 words, punchy, no period at the end
- subtext: max 14 words, one concrete benefit, plain language
- caption: 2-3 sentences for Instagram/WhatsApp, friendly but professional, end with 2-4 relevant hashtags and the URL stayxpulse.sunver.in
- imagePrompt: a rich text-to-image prompt for the poster BACKGROUND only. Scene direction: ${theme.mood}. Must contain NO text, NO logos, NO people's faces in close-up. Leave the lower third visually calm/dark so text can be overlaid.

Return JSON only.`;

  const res = await fetch(
    `${GEMINI_URL}/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.9,
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              headline: { type: 'STRING' },
              subtext: { type: 'STRING' },
              caption: { type: 'STRING' },
              imagePrompt: { type: 'STRING' },
            },
            required: ['headline', 'subtext', 'caption', 'imagePrompt'],
          },
        },
      }),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini text API ${res.status}: ${body.slice(0, 300)}`);
  }

  const json = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini returned no text candidate');
  return JSON.parse(text);
}

module.exports = { generateCopy };
