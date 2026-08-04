// ── Poster background via Imagen ──────────────────────────────────────────────
// Calls the Imagen :predict endpoint on the Gemini API and returns a PNG/JPEG
// buffer. 3:4 portrait is the closest supported ratio to the final 1080×1350
// canvas — overlay.js covers the difference with a resize.

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

async function generateImage(imagePrompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
  const model = process.env.GEMINI_IMAGE_MODEL || 'imagen-3.0-generate-002';

  const res = await fetch(`${GEMINI_URL}/${model}:predict?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      instances: [{ prompt: imagePrompt }],
      parameters: {
        sampleCount: 1,
        aspectRatio: '3:4',
        // Poster backgrounds must never contain generated humans-as-subjects
        // going wrong; keep the safest setting the API allows by default.
        personGeneration: 'allow_adult',
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Imagen API ${res.status}: ${body.slice(0, 300)}`);
  }

  const json = await res.json();
  const b64 = json?.predictions?.[0]?.bytesBase64Encoded;
  if (!b64) throw new Error('Imagen returned no image (possibly safety-filtered prompt)');
  return Buffer.from(b64, 'base64');
}

module.exports = { generateImage };
