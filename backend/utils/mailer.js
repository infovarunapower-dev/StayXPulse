const nodemailer = require('nodemailer');

// ── Mode / provider ───────────────────────────────────────────────────────────
// TEST_MODE  : log instead of sending (nothing reaches the recipient).
// PROVIDER   : 'brevo' uses the Brevo HTTP API; 'smtp' uses nodemailer.
//              Auto-detects Brevo when BREVO_API_KEY is present, so switching
//              provider is just an env var — no redeploy of code needed.
const TEST_MODE = process.env.EMAIL_TEST_MODE === 'true';
const PROVIDER  = (process.env.EMAIL_PROVIDER || (process.env.BREVO_API_KEY ? 'brevo' : 'smtp')).toLowerCase();

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_URL     = 'https://api.brevo.com/v3/smtp/email';

const fromName  = () => process.env.FROM_NAME  || 'StayXPulse';
const fromEmail = () => process.env.FROM_EMAIL || process.env.SMTP_USER;

// ── SMTP transporter (fallback provider) ──────────────────────────────────────
const createTransporter = () => {
  if (TEST_MODE || PROVIDER !== 'smtp') return null;

  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST   || 'smtp.gmail.com',
    port:   parseInt(process.env.SMTP_PORT || '587'),
    secure: false, // TLS
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS, // Gmail App Password
    },
    tls: { rejectUnauthorized: false },
  });
};

let transporter = createTransporter();

// ── Brevo HTTP API send ───────────────────────────────────────────────────────
// Chosen over Brevo's SMTP relay deliberately: no TLS handshake to fail on a
// cold lambda, and failures come back as a readable JSON message instead of an
// opaque SMTP code.
const sendViaBrevo = async ({ to, subject, html, attachments }) => {
  const body = {
    sender:      { name: fromName(), email: fromEmail() },
    to:          [{ email: to }],
    subject,
    htmlContent: html,
  };

  if (attachments && attachments.length > 0) {
    body.attachment = attachments.map(a => ({
      name:    a.filename,
      content: Buffer.isBuffer(a.content) ? a.content.toString('base64') : Buffer.from(a.content).toString('base64'),
    }));
  }

  const res = await fetch(BREVO_URL, {
    method:  'POST',
    headers: { 'api-key': BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
    body:    JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    // Brevo returns {code, message} — surface it verbatim; "sender not valid"
    // and "unauthorized" are the two you will actually hit in setup.
    throw new Error(`Brevo ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = await res.json().catch(() => ({}));
  return data.messageId || 'sent';
};

// ── Core send function ─────────────────────────────────────────────────────────
const sendEmail = async ({ to, subject, html, attachments = [] }) => {
  const from = `"${fromName()}" <${fromEmail()}>`;

  if (TEST_MODE) {
    console.log('\n' + '─'.repeat(60));
    console.log('📧 EMAIL (TEST MODE — not actually sent)');
    console.log('─'.repeat(60));
    console.log(`  From    : ${from}`);
    console.log(`  To      : ${to}`);
    console.log(`  Subject : ${subject}`);
    if (attachments.length > 0) {
      console.log(`  Attachments: ${attachments.map(a => a.filename).join(', ')}`);
    }
    console.log('─'.repeat(60) + '\n');
    return { success: true, mode: 'test', to, subject };
  }

  if (PROVIDER === 'brevo' && !BREVO_API_KEY) {
    console.error('📧 EMAIL_PROVIDER=brevo but BREVO_API_KEY is not set');
    return { success: false, error: 'BREVO_API_KEY is not configured', provider: 'brevo' };
  }

  // Real send with retry
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const messageId = PROVIDER === 'brevo'
        ? await sendViaBrevo({ to, subject, html, attachments })
        : (await transporter.sendMail({ from, to, subject, html, attachments })).messageId;

      console.log(`📧 Email sent via ${PROVIDER} → ${to} [${subject}] (${messageId})`);
      return { success: true, mode: 'live', provider: PROVIDER, messageId };
    } catch (err) {
      lastError = err;
      console.error(`📧 Email attempt ${attempt}/3 failed (${PROVIDER}) → ${to}: ${err.message}`);
      if (attempt < 3) await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }
  console.error(`📧 Email permanently failed (${PROVIDER}) → ${to}: ${lastError.message}`);
  return { success: false, error: lastError.message, provider: PROVIDER };
};

// ── Verify the provider is actually usable ────────────────────────────────────
const verifyConnection = async () => {
  if (TEST_MODE) return { success: true, mode: 'test', message: 'Test mode — nothing is sent' };

  if (PROVIDER === 'brevo') {
    if (!BREVO_API_KEY) return { success: false, mode: 'live', provider: 'brevo', message: 'BREVO_API_KEY is not set' };
    try {
      const res = await fetch('https://api.brevo.com/v3/account', {
        headers: { 'api-key': BREVO_API_KEY, accept: 'application/json' },
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        return { success: false, mode: 'live', provider: 'brevo', message: `Brevo ${res.status}: ${text.slice(0, 200)}` };
      }
      const acc = await res.json();
      const credits = acc?.plan?.[0]?.credits;
      return {
        success: true, mode: 'live', provider: 'brevo',
        message: `Brevo connected as ${acc.email}${credits != null ? ` · ${credits} credits left` : ''} ✅`,
      };
    } catch (err) {
      return { success: false, mode: 'live', provider: 'brevo', message: err.message };
    }
  }

  try {
    await transporter.verify();
    return { success: true, mode: 'live', provider: 'smtp', message: 'SMTP connection verified ✅' };
  } catch (err) {
    return { success: false, mode: 'live', provider: 'smtp', message: err.message };
  }
};

module.exports = { sendEmail, verifyConnection, TEST_MODE, PROVIDER };
