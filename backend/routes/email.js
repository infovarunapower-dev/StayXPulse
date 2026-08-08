const express  = require('express');
const router   = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { verifyConnection, TEST_MODE, PROVIDER } = require('../utils/mailer');
const {
  sendWelcomeEmail,
  sendForgotPasswordEmail,
  sendTrialReminderEmail,
  sendExpiryReminderEmail,
  sendPaymentSuccessEmail,
  sendPasswordResetByAdminEmail,
} = require('../utils/email');

const { listTemplates, saveOverride, resetOverride } = require('../utils/emailOverrides');

const SA = [protect, authorize('superadmin')];

// ── Editable email content ─────────────────────────────────────────────────────
router.get('/templates', SA, async (req, res) => {
  try { res.json({ success: true, data: await listTemplates() }); }
  catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.put('/templates/:type', SA, async (req, res) => {
  try {
    await saveOverride(req.params.type, req.body || {});
    res.json({ success: true, message: 'Email content saved' });
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
});

router.delete('/templates/:type', SA, async (req, res) => {
  try {
    await resetOverride(req.params.type);
    res.json({ success: true, message: 'Reset to default' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── GET email status ───────────────────────────────────────────────────────────
router.get('/status', SA, async (req, res) => {
  const connection = await verifyConnection();
  res.json({
    success: true,
    data: {
      testMode:   TEST_MODE,
      provider:   PROVIDER,
      brevoKeySet: !!process.env.BREVO_API_KEY,
      smtpHost:   process.env.SMTP_HOST,
      smtpPort:   process.env.SMTP_PORT,
      smtpUser:   process.env.SMTP_USER,
      fromName:   process.env.FROM_NAME,
      fromEmail:  process.env.FROM_EMAIL,
      connection,
    },
  });
});

// ── POST send test email ───────────────────────────────────────────────────────
router.post('/test', SA, async (req, res) => {
  const { type, to } = req.body;
  if (!type || !to) return res.status(400).json({ success: false, message: 'type and to are required' });

  const MOCK = {
    hotelName:     'Test Hotel',
    email:         to,
    userId:        'HTL001',
    password:      'TestPass@123',
    trialEndDate:  new Date(Date.now() + 3 * 86400000),
    name:          'Test User',
    resetUrl:      `${require('../utils/clientUrl')}/reset-password/mock-token-123`,
    daysLeft:      2,
    planName:      'Professional',
    cycle:         'monthly',
    amount:        2499,
    invoiceNumber: 'SXP2026001',
    paymentId:     'pay_MockPaymentId123',
    validFrom:     new Date(),
    validTo:       new Date(Date.now() + 30 * 86400000),
    expiryDate:    new Date(Date.now() + 2 * 86400000),
    newPassword:   'NewPass@456',
    plan:          'Professional',
  };

  let result;
  try {
    switch (type) {
      case 'welcome':
        result = await sendWelcomeEmail({ ...MOCK });
        break;
      case 'forgot-password':
        result = await sendForgotPasswordEmail({ email: to, name: MOCK.name, resetUrl: MOCK.resetUrl });
        break;
      case 'trial-reminder':
        result = await sendTrialReminderEmail({ hotelName: MOCK.hotelName, email: to, daysLeft: MOCK.daysLeft, trialEndDate: MOCK.trialEndDate });
        break;
      case 'expiry-reminder':
        result = await sendExpiryReminderEmail({ hotelName: MOCK.hotelName, email: to, planName: MOCK.planName, daysLeft: MOCK.daysLeft, expiryDate: MOCK.expiryDate });
        break;
      case 'payment-success':
        result = await sendPaymentSuccessEmail({ hotelName: MOCK.hotelName, email: to, plan: MOCK.plan, cycle: MOCK.cycle, amount: MOCK.amount, invoiceNumber: MOCK.invoiceNumber, validFrom: MOCK.validFrom, validTo: MOCK.validTo, paymentId: MOCK.paymentId });
        break;
      case 'password-reset':
        result = await sendPasswordResetByAdminEmail({ hotelName: MOCK.hotelName, email: to, userId: MOCK.userId, newPassword: MOCK.newPassword });
        break;
      default:
        return res.status(400).json({ success: false, message: `Unknown email type: ${type}` });
    }

    // sendEmail returns {success:false, error} on failure (it never throws), so
    // report the true delivery outcome — this endpoint's whole job is to confirm
    // email actually works.
    const delivered = TEST_MODE || result?.success;
    res.json({
      success: delivered,
      message: TEST_MODE
        ? `✅ Test mode: Email logged to console (not sent). Check your backend terminal.`
        : delivered
          ? `✅ Email sent to ${to}`
          : `❌ Delivery failed: ${result?.error || 'unknown error'}`,
      data: result,
      testMode: TEST_MODE,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
