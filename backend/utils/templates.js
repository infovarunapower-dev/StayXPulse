// ── Base layout wrapper ────────────────────────────────────────────────────────
const layout = (content) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>StayXPulse</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background: #F0F4F8; color: #111827; }
    .wrapper { max-width: 580px; margin: 32px auto; padding: 0 16px 40px; }
    .card { background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #0F2952 0%, #1A4D8F 100%); padding: 28px 36px; }
    .header-logo { font-size: 24px; font-weight: 800; color: #fff; letter-spacing: -0.5px; }
    .header-logo span { color: #F59E0B; }
    .header-sub { font-size: 13px; color: rgba(255,255,255,0.6); margin-top: 3px; }
    .body { padding: 36px; }
    .title { font-size: 22px; font-weight: 700; color: #111827; margin-bottom: 10px; }
    .text  { font-size: 15px; color: #374151; line-height: 1.7; margin-bottom: 14px; }
    .btn-wrap { text-align: center; margin: 28px 0; }
    .btn { display: inline-block; background: #1A4D8F; color: #ffffff !important; text-decoration: none; padding: 13px 32px; border-radius: 8px; font-size: 15px; font-weight: 700; }
    .btn-green { background: #10B981; }
    .box { background: #F0F4F8; border-radius: 10px; padding: 18px 20px; margin: 18px 0; }
    .box-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #E5E7EB; font-size: 14px; }
    .box-row:last-child { border-bottom: none; }
    .box-label { color: #6B7280; font-weight: 600; }
    .box-val   { color: #111827; font-weight: 700; font-family: 'Courier New', monospace; }
    .badge { display: inline-block; background: #D1FAE5; color: #065F46; padding: 5px 14px; border-radius: 20px; font-size: 13px; font-weight: 700; margin-bottom: 16px; }
    .badge-warn { background: #FEF3C7; color: #92400E; }
    .badge-red  { background: #FEE2E2; color: #991B1B; }
    .divider { border: none; border-top: 1px solid #E5E7EB; margin: 24px 0; }
    .footer { padding: 20px 36px; background: #F9FAFB; border-top: 1px solid #E5E7EB; }
    .footer-text { font-size: 12px; color: #9CA3AF; line-height: 1.6; text-align: center; }
    .footer-links { text-align: center; margin-top: 10px; }
    .footer-links a { font-size: 12px; color: #6B7280; text-decoration: none; margin: 0 8px; }
    .note { font-size: 13px; color: #6B7280; background: #FFFBEB; border: 1px solid #FDE68A; border-radius: 8px; padding: 12px 16px; margin-top: 16px; line-height: 1.6; }
    .highlight { color: #1A4D8F; font-weight: 700; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <div class="header-logo">Stay<span>X</span>Pulse</div>
        <div class="header-sub">Smart Hotel Management Platform</div>
      </div>
      <div class="body">${content}</div>
      <div class="footer">
        <div class="footer-text">
          This email was sent by StayXPulse. Please do not reply to this email.<br/>
          If you have questions, contact us at <strong>support@stayxpulse.com</strong>
        </div>
        <div class="footer-links">
          <a href="${process.env.CLIENT_URL}">Dashboard</a>
          <a href="mailto:support@stayxpulse.com">Support</a>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;

// ── 1. Welcome Email ───────────────────────────────────────────────────────────
const welcomeTemplate = ({ hotelName, email, userId, password, trialEndDate }) =>
  layout(`
    <div class="badge">🎉 Registration Successful</div>
    <div class="title">Welcome to StayXPulse, ${hotelName}!</div>
    <p class="text">Your hotel has been registered successfully. You can start using StayXPulse right away with your <span class="highlight">3-day free trial</span>.</p>
    <p class="text">Here are your login credentials — please save them securely:</p>
    <div class="box">
      <div class="box-row"><span class="box-label">Login URL</span>   <span class="box-val">${process.env.CLIENT_URL}/login</span></div>
      <div class="box-row"><span class="box-label">User ID</span>     <span class="box-val">${userId}</span></div>
      <div class="box-row"><span class="box-label">Email</span>       <span class="box-val">${email}</span></div>
      <div class="box-row"><span class="box-label">Password</span>    <span class="box-val">${password}</span></div>
      <div class="box-row"><span class="box-label">Trial Ends</span>  <span class="box-val">${new Date(trialEndDate).toDateString()}</span></div>
    </div>
    <div class="btn-wrap"><a class="btn" href="${process.env.CLIENT_URL}/login">Login to Your Dashboard →</a></div>
    <div class="note">⚠️ Please change your password after first login. Your trial expires on <strong>${new Date(trialEndDate).toDateString()}</strong>.</div>
  `);

// ── 2. Forgot Password ─────────────────────────────────────────────────────────
const forgotPasswordTemplate = ({ name, resetUrl }) =>
  layout(`
    <div class="title">Reset Your Password</div>
    <p class="text">Hi <strong>${name}</strong>,</p>
    <p class="text">We received a request to reset the password for your StayXPulse account.</p>
    <div class="btn-wrap"><a class="btn" href="${resetUrl}">Reset My Password →</a></div>
    <div class="note">🔒 This link expires in <strong>15 minutes</strong>. If you did not request this, you can safely ignore this email.</div>
  `);

// ── 3. Trial Reminder ──────────────────────────────────────────────────────────
const trialReminderTemplate = ({ hotelName, daysLeft, trialEndDate }) =>
  layout(`
    <div class="badge badge-warn">⏰ Trial Ending ${daysLeft <= 1 ? 'Tomorrow' : `in ${daysLeft} Days`}</div>
    <div class="title">Your free trial is ending soon</div>
    <p class="text">Hi <strong>${hotelName}</strong>,</p>
    <p class="text">Your StayXPulse free trial ends on <span class="highlight">${new Date(trialEndDate).toDateString()}</span>.</p>
    <p class="text">Upgrade now to keep access to all your rooms, QR codes, food menu, and order history.</p>
    <div class="btn-wrap"><a class="btn" href="${process.env.CLIENT_URL}/hotel/upgrade">View Plans & Upgrade →</a></div>
    <div class="note">💡 Plans start at just <strong>₹999/month</strong>. Instant activation after payment.</div>
  `);

// ── 4. Subscription Expiry Reminder ───────────────────────────────────────────
const expiryReminderTemplate = ({ hotelName, planName, daysLeft, expiryDate }) =>
  layout(`
    <div class="badge ${daysLeft <= 2 ? 'badge-red' : 'badge-warn'}">⚠️ Subscription Expiring ${daysLeft <= 1 ? 'Tomorrow' : `in ${daysLeft} Days`}</div>
    <div class="title">Your subscription is expiring soon</div>
    <p class="text">Hi <strong>${hotelName}</strong>,</p>
    <p class="text">Your <span class="highlight">${planName}</span> subscription expires on <span class="highlight">${new Date(expiryDate).toDateString()}</span>.</p>
    <div class="btn-wrap"><a class="btn" href="${process.env.CLIENT_URL}/hotel/upgrade">Renew Subscription →</a></div>
  `);

// ── 5. Payment Success ─────────────────────────────────────────────────────────
const paymentSuccessTemplate = ({ hotelName, planName, cycle, amount, invoiceNumber, paymentId, validFrom, validTo }) =>
  layout(`
    <div class="badge">✅ Payment Confirmed</div>
    <div class="title">Subscription Activated!</div>
    <p class="text">Hi <strong>${hotelName}</strong>,</p>
    <p class="text">Your payment was successful and your <span class="highlight">${planName} (${cycle.charAt(0).toUpperCase() + cycle.slice(1)})</span> plan is now active on StayXPulse.</p>
    <div class="box">
      <div class="box-row"><span class="box-label">Plan</span>         <span class="box-val">${planName} — ${cycle.charAt(0).toUpperCase() + cycle.slice(1)}</span></div>
      <div class="box-row"><span class="box-label">Amount Paid</span>  <span class="box-val">₹${Number(amount).toLocaleString('en-IN')}</span></div>
      <div class="box-row"><span class="box-label">Invoice No.</span>  <span class="box-val">${invoiceNumber}</span></div>
      <div class="box-row"><span class="box-label">Payment ID</span>   <span class="box-val">${paymentId}</span></div>
      <div class="box-row"><span class="box-label">Valid From</span>   <span class="box-val">${new Date(validFrom).toDateString()}</span></div>
      <div class="box-row"><span class="box-label">Valid To</span>     <span class="box-val">${new Date(validTo).toDateString()}</span></div>
    </div>
    <div class="btn-wrap"><a class="btn btn-green" href="${process.env.CLIENT_URL}/hotel/dashboard">Go to Dashboard →</a></div>
    <div class="note">📄 Your invoice PDF is attached to this email.</div>
  `);

// ── 6. Password Reset by Admin ─────────────────────────────────────────────────
const passwordResetByAdminTemplate = ({ hotelName, userId, email, newPassword }) =>
  layout(`
    <div class="title">Your Password Has Been Reset</div>
    <p class="text">Hi <strong>${hotelName}</strong>,</p>
    <p class="text">Your StayXPulse account password has been reset by the administrator.</p>
    <div class="box">
      <div class="box-row"><span class="box-label">Login URL</span>   <span class="box-val">${process.env.CLIENT_URL}/login</span></div>
      <div class="box-row"><span class="box-label">User ID</span>     <span class="box-val">${userId}</span></div>
      <div class="box-row"><span class="box-label">Email</span>       <span class="box-val">${email}</span></div>
      <div class="box-row"><span class="box-label">New Password</span><span class="box-val">${newPassword}</span></div>
    </div>
    <div class="btn-wrap"><a class="btn" href="${process.env.CLIENT_URL}/login">Login Now →</a></div>
    <div class="note">🔒 Please change your password immediately after logging in.</div>
  `);

module.exports = {
  welcomeTemplate,
  forgotPasswordTemplate,
  trialReminderTemplate,
  expiryReminderTemplate,
  paymentSuccessTemplate,
  passwordResetByAdminTemplate,
};
