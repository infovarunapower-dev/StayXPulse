const { sendEmail, TEST_MODE } = require('./mailer');
const {
  welcomeTemplate,
  forgotPasswordTemplate,
  trialReminderTemplate,
  expiryReminderTemplate,
  paymentSuccessTemplate,
  passwordResetByAdminTemplate,
  appUpdateTemplate,
  renderSubject,
} = require('./templates');
const { getOverride } = require('./emailOverrides');

// ── 1. Welcome email after hotel registration ──────────────────────────────────
const sendWelcomeEmail = async ({ hotelName, email, userId, password, trialEndDate }) => {
  const ov = await getOverride('welcome');
  const data = { hotelName, userId, email, trialEndDate: new Date(trialEndDate).toDateString() };
  return sendEmail({
    to:      email,
    subject: renderSubject('welcome', ov, data),
    html:    welcomeTemplate({ hotelName, email, userId, password, trialEndDate, ov }),
  });
};

// ── 2. Forgot password ─────────────────────────────────────────────────────────
const sendForgotPasswordEmail = async ({ email, name, resetUrl }) => {
  const ov = await getOverride('forgot-password');
  return sendEmail({
    to:      email,
    subject: renderSubject('forgot-password', ov, { name }),
    html:    forgotPasswordTemplate({ name, resetUrl, ov }),
  });
};

// ── 3. Trial reminder ──────────────────────────────────────────────────────────
const sendTrialReminderEmail = async ({ hotelName, email, daysLeft, trialEndDate }) => {
  const ov = await getOverride('trial-reminder');
  return sendEmail({
    to:      email,
    subject: renderSubject('trial-reminder', ov, { hotelName, daysLeft, trialEndDate: new Date(trialEndDate).toDateString() }),
    html:    trialReminderTemplate({ hotelName, daysLeft, trialEndDate, ov }),
  });
};

// ── 4. Subscription expiry reminder ───────────────────────────────────────────
const sendExpiryReminderEmail = async ({ hotelName, email, planName, daysLeft, expiryDate }) => {
  const ov = await getOverride('expiry-reminder');
  return sendEmail({
    to:      email,
    subject: renderSubject('expiry-reminder', ov, { hotelName, planName, daysLeft, expiryDate: new Date(expiryDate).toDateString() }),
    html:    expiryReminderTemplate({ hotelName, planName, daysLeft, expiryDate, ov }),
  });
};

// ── 5. Payment success + invoice ───────────────────────────────────────────────
const sendPaymentSuccessEmail = async ({ hotelName, email, plan, cycle, amount, invoiceNumber, validFrom, validTo, paymentId, pdfBuffer }) => {
  const ov = await getOverride('payment-success');
  return sendEmail({
    to:          email,
    subject:     renderSubject('payment-success', ov, { hotelName, planName: plan, cycle, amount: Number(amount).toLocaleString('en-IN'), invoiceNumber }),
    html:        paymentSuccessTemplate({ hotelName, planName: plan, cycle, amount, invoiceNumber, paymentId, validFrom, validTo, ov }),
    attachments: pdfBuffer ? [{ filename: `Invoice_${invoiceNumber}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }] : [],
  });
};

// ── 6. Password reset by admin ─────────────────────────────────────────────────
const sendPasswordResetByAdminEmail = async ({ hotelName, email, userId, newPassword }) => {
  const ov = await getOverride('password-reset');
  return sendEmail({
    to:      email,
    subject: renderSubject('password-reset', ov, { hotelName, userId, email }),
    html:    passwordResetByAdminTemplate({ hotelName, userId, email, newPassword, ov }),
  });
};

// ── 7. New app version available ───────────────────────────────────────────────
const sendAppUpdateEmail = ({ hotelName, email, version, downloadUrl, notes }) =>
  sendEmail({
    to:      email,
    subject: `📱 StayXPulse — A new app version${version ? ` (v${String(version).replace(/^v/i,'')})` : ''} is available`,
    html:    appUpdateTemplate({ hotelName, version, downloadUrl, notes }),
  });

module.exports = {
  sendWelcomeEmail,
  sendForgotPasswordEmail,
  sendTrialReminderEmail,
  sendExpiryReminderEmail,
  sendPaymentSuccessEmail,
  sendPasswordResetByAdminEmail,
  sendAppUpdateEmail,
  TEST_MODE,
};
