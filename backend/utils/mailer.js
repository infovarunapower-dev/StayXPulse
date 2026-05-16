const nodemailer = require('nodemailer');

// ── Determine mode ─────────────────────────────────────────────────────────────
const TEST_MODE = process.env.EMAIL_TEST_MODE === 'true';

// ── Gmail transporter ──────────────────────────────────────────────────────────
const createTransporter = () => {
  if (TEST_MODE) return null; // no real transporter in test mode

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

// ── Core send function ─────────────────────────────────────────────────────────
const sendEmail = async ({ to, subject, html, attachments = [] }) => {
  const from = `"${process.env.FROM_NAME || 'HotelIQ'}" <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`;

  if (TEST_MODE) {
    // Log to console instead of sending
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

  // Real send with retry
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const info = await transporter.sendMail({ from, to, subject, html, attachments });
      console.log(`📧 Email sent → ${to} [${subject}] (${info.messageId})`);
      return { success: true, mode: 'live', messageId: info.messageId };
    } catch (err) {
      lastError = err;
      console.error(`📧 Email attempt ${attempt}/3 failed → ${to}: ${err.message}`);
      if (attempt < 3) await new Promise(r => setTimeout(r, 1000 * attempt)); // wait before retry
    }
  }
  console.error(`📧 Email permanently failed → ${to}: ${lastError.message}`);
  return { success: false, error: lastError.message };
};

// ── Verify SMTP connection ─────────────────────────────────────────────────────
const verifyConnection = async () => {
  if (TEST_MODE) return { success: true, mode: 'test', message: 'Test mode — no SMTP connection needed' };
  try {
    await transporter.verify();
    return { success: true, mode: 'live', message: 'SMTP connection verified ✅' };
  } catch (err) {
    return { success: false, mode: 'live', message: err.message };
  }
};

module.exports = { sendEmail, verifyConnection, TEST_MODE };
