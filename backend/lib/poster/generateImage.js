// ── Poster background via the Gemini API ─────────────────────────────────────
// Two families, auto-detected from the model name:
//   • gemini-*-image  → :generateContent, works on the FREE tier (default)
//   • imagen-*        → :predict, needs a paid-tier API key, higher fidelity
// Both return a PNG/JPEG buffer. 3:4 portrait is the closest supported ratio
// to the final 1080×1350 canvas — overlay.js covers the difference.

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

async function generateViaGemini(model, apiKey, imagePrompt) {
  const res = await fetch(`${GEMINI_URL}/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: imagePrompt }] }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: { aspectRatio: '3:4' },
      },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini image API ${res.status}: ${body.slice(0, 300)}`);
  }
  const json = await res.json();
  const parts = json?.candidates?.[0]?.content?.parts || [];
  const img = parts.find((p) => p.inlineData?.data);
  if (!img) throw new Error('Gemini returned no image (possibly safety-filtered prompt)');
  return Buffer.from(img.inlineData.data, 'base64');
}

async function generateViaImagen(model, apiKey, imagePrompt) {
  const res = await fetch(`${GEMINI_URL}/${model}:predict?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      instances: [{ prompt: imagePrompt }],
      parameters: { sampleCount: 1, aspectRatio: '3:4', personGeneration: 'allow_adult' },
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

async function generateImage(imagePrompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
  const model = process.env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-image';
  return model.startsWith('imagen-')
    ? generateViaImagen(model, apiKey, imagePrompt)
    : generateViaGemini(model, apiKey, imagePrompt);
}

module.exports = { generateImage };
