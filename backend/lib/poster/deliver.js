const { sendEmail } = require('../../utils/mailer');

// ── Delivery (optional, best-effort) ─────────────────────────────────────────
// Each channel is skipped silently when its env vars are absent, and a failure
// in one never blocks the other — the poster is already safe in storage by the
// time this runs. Email rides the existing Brevo/SMTP mailer rather than
// adding a second provider (the scaffold's Resend was swapped for it).

async function deliverEmail({ imageUrl, pngBuffer, copy, theme }) {
  const to = process.env.POSTER_EMAIL_TO;
  if (!to) return { skipped: true };

  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
      <h2 style="color:#0D9488">Today's StayXPulse poster is ready 🎨</h2>
      <p><strong>Theme:</strong> ${theme.key}</p>
      <p><img src="${imageUrl}" alt="Daily poster" style="width:100%;border-radius:12px"/></p>
      <p><strong>Suggested caption:</strong></p>
      <p style="background:#F2F7F5;padding:12px 16px;border-radius:8px;white-space:pre-wrap">${copy.caption}</p>
      <p><a href="${imageUrl}">Open full-size image</a></p>
    </div>`;

  await sendEmail({
    to,
    subject: `🎨 StayXPulse daily poster — ${copy.headline}`,
    html,
    attachments: [
      { filename: 'stayxpulse-poster.png', content: pngBuffer, contentType: 'image/png' },
    ],
  });
  return { sent: true };
}

// WhatsApp Cloud API: sends the hosted image with the caption. Needs a Meta
// Business app with the WhatsApp product, a permanent token, and a recipient
// who has opted in (or a template for cold sends).
async function deliverWhatsApp({ imageUrl, copy }) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const to = process.env.POSTER_WHATSAPP_TO; // E.164 without '+', e.g. 91XXXXXXXXXX
  if (!token || !phoneId || !to) return { skipped: true };

  const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'image',
      image: { link: imageUrl, caption: copy.caption.slice(0, 1024) },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`WhatsApp API ${res.status}: ${body.slice(0, 300)}`);
  }
  return { sent: true };
}

async function deliver(payload) {
  const results = {};
  try {
    results.email = await deliverEmail(payload);
  } catch (e) {
    console.error('Poster email delivery failed:', e.message);
    results.email = { error: e.message };
  }
  try {
    results.whatsapp = await deliverWhatsApp(payload);
  } catch (e) {
    console.error('Poster WhatsApp delivery failed:', e.message);
    results.whatsapp = { error: e.message };
  }
  return results;
}

module.exports = { deliver };
