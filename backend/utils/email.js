const { sendEmail, TEST_MODE } = require('./mailer');
const {
  welcomeTemplate,
  forgotPasswordTemplate,
  trialReminderTemplate,
  expiryReminderTemplate,
  paymentSuccessTemplate,
  passwordResetByAdminTemplate,
} = require('./templates');

// ── 1. Welcome email after hotel registration ──────────────────────────────────
const sendWelcomeEmail = ({ hotelName, email, userId, password, trialEndDate }) =>
  sendEmail({
    to:      email,
    subject: `🎉 Welcome to StayXPulse — Your Login Credentials`,
    html:    welcomeTemplate({ hotelName, email, userId, password, trialEndDate }),
  });

// ── 2. Forgot password ─────────────────────────────────────────────────────────
const sendForgotPasswordEmail = ({ email, name, resetUrl }) =>
  sendEmail({
    to:      email,
    subject: `🔒 StayXPulse — Password Reset Request`,
    html:    forgotPasswordTemplate({ name, resetUrl }),
  });

// ── 3. Trial reminder ──────────────────────────────────────────────────────────
const sendTrialReminderEmail = ({ hotelName, email, daysLeft, trialEndDate }) =>
  sendEmail({
    to:      email,
    subject: `⏰ StayXPulse — Your free trial ends in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`,
    html:    trialReminderTemplate({ hotelName, daysLeft, trialEndDate }),
  });

// ── 4. Subscription expiry reminder ───────────────────────────────────────────
const sendExpiryReminderEmail = ({ hotelName, email, planName, daysLeft, expiryDate }) =>
  sendEmail({
    to:      email,
    subject: `⚠️ StayXPulse — Subscription expiring in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`,
    html:    expiryReminderTemplate({ hotelName, planName, daysLeft, expiryDate }),
  });

// ── 5. Payment success + invoice ───────────────────────────────────────────────
const sendPaymentSuccessEmail = ({ hotelName, email, plan, cycle, amount, invoiceNumber, validFrom, validTo, paymentId, pdfBuffer }) =>
  sendEmail({
    to:          email,
    subject:     `✅ StayXPulse Payment Confirmed · ${invoiceNumber}`,
    html:        paymentSuccessTemplate({ hotelName, planName: plan, cycle, amount, invoiceNumber, paymentId, validFrom, validTo }),
    attachments: pdfBuffer ? [{ filename: `Invoice_${invoiceNumber}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }] : [],
  });

// ── 6. Password reset by admin ─────────────────────────────────────────────────
const sendPasswordResetByAdminEmail = ({ hotelName, email, userId, newPassword }) =>
  sendEmail({
    to:      email,
    subject: `🔑 StayXPulse — Your password has been reset`,
    html:    passwordResetByAdminTemplate({ hotelName, userId, email, newPassword }),
  });

module.exports = {
  sendWelcomeEmail,
  sendForgotPasswordEmail,
  sendTrialReminderEmail,
  sendExpiryReminderEmail,
  sendPaymentSuccessEmail,
  sendPasswordResetByAdminEmail,
  TEST_MODE,
};
