const CLIENT_URL = require('./clientUrl');

// Email clients cannot resolve bundled assets or data: URIs reliably (Gmail
// strips them), so the logo has to be a plain hosted URL. /logo.png is routed
// explicitly in vercel.json ahead of the SPA catch-all.
const LOGO_URL = process.env.EMAIL_LOGO_URL || `${CLIENT_URL}/logo.png`;
const YEAR = new Date().getFullYear();
const HOST = CLIENT_URL.replace(/^https?:\/\//, '');

// ─────────────────────────────────────────────────────────────────────────────
//  StayXPulse transactional email — "Luxe" identity
//
//  Five-star hospitality treatment: deep charcoal ground, champagne-gold
//  accents, a centred serif wordmark and hairline ornaments. Built entirely
//  with TABLES + inline styles (never flexbox/grid) so Gmail, Outlook and Apple
//  Mail all render it identically. Intentionally dark-themed for a premium feel;
//  every colour is tuned for contrast on the charcoal ground.
// ─────────────────────────────────────────────────────────────────────────────
const K = {
  page:'#131217', card:'#1B1A21', panel:'#211F28', ivory:'#ECE6D8', body:'#A69F8E', mut:'#6F6A5E',
  gold:'#C6A15B', goldLt:'#E4C888', goldDim:'#8C7746', line:'#2C2A32', goldLine:'rgba(198,161,91,0.34)',
  ink:'#141319',
  okBg:'#1A2320',  okInk:'#8FBFA0',  okBd:'rgba(120,170,140,.30)',
  warnBg:'#241F19', warnInk:'#D8B77E', warnBd:'rgba(198,161,91,.35)',
  dangBg:'#241A1A', dangInk:'#D79C8F', dangBd:'rgba(190,110,90,.35)',
};
const SANS  = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const SERIF = "Georgia,'Times New Roman','Hoefler Text',serif";
const MONO  = "'SFMono-Regular',Consolas,'Liberation Mono',Menlo,'Courier New',monospace";
const DIA   = '◆'; // ◆

// ── Gold call-to-action button (bulletproof in Outlook) ─────────────────────
const button = (href, label) => `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:12px auto 4px;">
    <tr>
      <td align="center" bgcolor="${K.gold}" style="border-radius:3px;">
        <a href="${href}" target="_blank"
           style="display:inline-block;padding:16px 46px;font-family:${SANS};font-size:12px;line-height:1;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:${K.ink};text-decoration:none;border-radius:3px;">
          ${label}
        </a>
      </td>
    </tr>
  </table>`;

// ── Key/value detail card ───────────────────────────────────────────────────
// rows: [{ label, value, mono? }]
const detailCard = (rows) => {
  const body = rows.map((r, i) => {
    const bb = i === rows.length - 1 ? '' : `border-bottom:1px solid ${K.line};`;
    const vf = r.mono ? `font-family:${MONO};` : `font-family:${SANS};`;
    return `
      <tr>
        <td style="padding:15px 0;${bb}font-family:${SANS};font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:${K.gold};font-weight:700;vertical-align:top;white-space:nowrap;">${r.label}</td>
        <td style="padding:15px 0 15px 22px;${bb}${vf}font-size:14px;color:${K.ivory};font-weight:600;text-align:right;word-break:break-word;">${r.value}</td>
      </tr>`;
  }).join('');
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="background:${K.panel};border:1px solid ${K.goldLine};border-radius:5px;margin:26px 0;">
      <tr><td style="padding:4px 28px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${body}</table>
      </td></tr>
    </table>`;
};

// ── Notice strip ────────────────────────────────────────────────────────────
const notice = (html, kind = 'warn') => {
  const m = {
    warn:    { bg: K.warnBg, ink: K.warnInk, bd: K.warnBd },
    success: { bg: K.okBg,   ink: K.okInk,   bd: K.okBd },
    danger:  { bg: K.dangBg, ink: K.dangInk, bd: K.dangBd },
  }[kind] || {};
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
      <tr><td style="background:${m.bg};border:1px solid ${m.bd};border-left:3px solid ${K.gold};border-radius:3px;padding:15px 20px;font-family:${SANS};font-size:13px;line-height:1.65;color:${m.ink};">
        ${html}
      </td></tr>
    </table>`;
};

const eyebrow  = (t) => `<div style="font-family:${SANS};font-size:10.5px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;color:${K.gold};text-align:center;margin-bottom:10px;">${t}</div>`;
const h1       = (t) => `<h1 style="margin:0 0 16px;font-family:${SERIF};font-size:30px;line-height:1.18;font-weight:700;color:${K.ivory};letter-spacing:-0.2px;text-align:center;">${t}</h1>`;
const para     = (t) => `<p style="margin:0 0 15px;font-family:${SANS};font-size:15px;line-height:1.8;color:${K.body};text-align:center;">${t}</p>`;
const ornament = `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:2px auto 22px;">
    <tr>
      <td style="width:56px;border-bottom:1px solid ${K.goldLine};font-size:0;line-height:0;">&nbsp;</td>
      <td style="padding:0 12px;color:${K.gold};font-size:9px;line-height:1;">${DIA}</td>
      <td style="width:56px;border-bottom:1px solid ${K.goldLine};font-size:0;line-height:0;">&nbsp;</td>
    </tr>
  </table>`;

// ── Base layout wrapper ─────────────────────────────────────────────────────
const layout = (eyebrowText, content, preheader = '') => `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="color-scheme" content="dark only" />
  <title>StayXPulse</title>
</head>
<body style="margin:0;padding:0;background:${K.page};-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preheader}</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${K.page};">
    <tr><td align="center" style="padding:44px 14px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">

        <!-- Gold rail -->
        <tr><td style="height:3px;background:${K.gold};background:linear-gradient(90deg,${K.goldDim},${K.goldLt},${K.goldDim});border-radius:3px 3px 0 0;font-size:0;line-height:0;">&nbsp;</td></tr>

        <!-- Header (centred wordmark) -->
        <tr>
          <td style="background:${K.card};padding:34px 44px 26px;border-left:1px solid ${K.line};border-right:1px solid ${K.line};text-align:center;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
              <tr>
                <td style="padding-right:11px;vertical-align:middle;"><img src="${LOGO_URL}" alt="" width="32" height="32" style="display:block;border:0;border-radius:6px;"/></td>
                <td style="vertical-align:middle;"><div style="font-family:${SERIF};font-size:22px;font-weight:700;color:${K.ivory};letter-spacing:.5px;line-height:1;">Stay<span style="color:${K.gold};">X</span>Pulse</div></td>
              </tr>
            </table>
            <div style="font-family:${SANS};font-size:9.5px;letter-spacing:.28em;text-transform:uppercase;color:${K.mut};margin-top:12px;">Smart Hotel Management</div>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="background:${K.card};padding:14px 44px 36px;border-left:1px solid ${K.line};border-right:1px solid ${K.line};">
            ${eyebrowText ? eyebrow(eyebrowText) : ''}${content}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:${K.page};border:1px solid ${K.line};border-top:none;border-radius:0 0 5px 5px;padding:28px 44px 32px;text-align:center;">
            <div style="font-family:${SANS};font-size:12.5px;color:${K.mut};line-height:1.7;">
              Questions? Write to <a href="mailto:stayxpulse@sunver.in" style="color:${K.gold};text-decoration:none;">stayxpulse@sunver.in</a>
            </div>
            <div style="margin-top:14px;">
              <a href="${CLIENT_URL}" style="font-family:${SANS};font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;color:${K.goldDim};text-decoration:none;margin:0 12px;">Dashboard</a>
              <a href="${CLIENT_URL}/hotel/upgrade" style="font-family:${SANS};font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;color:${K.goldDim};text-decoration:none;margin:0 12px;">Plans</a>
              <a href="mailto:stayxpulse@sunver.in" style="font-family:${SANS};font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;color:${K.goldDim};text-decoration:none;margin:0 12px;">Support</a>
            </div>
            <div style="margin-top:20px;font-family:${SERIF};font-size:11px;color:${K.mut};line-height:1.7;font-style:italic;">
              &copy; ${YEAR} StayXPulse &mdash; A product of Sunver Coresynergy. All rights reserved.
            </div>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

// ── 1. Welcome Email ────────────────────────────────────────────────────────
const welcomeTemplate = ({ hotelName, email, userId, password, trialEndDate }) =>
  layout('Registration Successful', `
    ${h1('Welcome to StayXPulse')}
    ${ornament}
    ${para(`<strong style="color:${K.ivory};">${hotelName}</strong>, your account is ready. Begin with a <strong style="color:${K.ivory};">14-day complimentary trial</strong> &mdash; no card required.`)}
    ${para('Here are your sign-in credentials. Please keep them somewhere safe:')}
    ${detailCard([
      { label: 'Login URL', value: `<a href="${CLIENT_URL}/login" style="color:${K.goldLt};text-decoration:none;">${HOST}/login</a>` },
      { label: 'User ID',   value: userId, mono: true },
      { label: 'Email',     value: email,  mono: true },
      { label: 'Password',  value: password, mono: true },
      { label: 'Trial Ends',value: new Date(trialEndDate).toDateString() },
    ])}
    ${button(`${CLIENT_URL}/login`, 'Enter your dashboard')}
    ${notice(`For your security, please change your password after your first sign-in. Your trial ends on <strong>${new Date(trialEndDate).toDateString()}</strong>.`, 'warn')}
  `, `Welcome to StayXPulse — your ${hotelName} account and trial are ready.`);

// ── 2. Forgot Password ──────────────────────────────────────────────────────
const forgotPasswordTemplate = ({ name, resetUrl }) =>
  layout('Account Security', `
    ${h1('Reset your password')}
    ${ornament}
    ${para(`Hi <strong style="color:${K.ivory};">${name}</strong>, we received a request to reset the password for your StayXPulse account. Choose a new one below.`)}
    ${button(resetUrl, 'Reset my password')}
    ${notice(`This link expires in <strong>1 hour</strong>. If you didn&rsquo;t request a reset, you can safely ignore this email &mdash; your password won&rsquo;t change.`, 'warn')}
  `, 'Reset your StayXPulse password (link valid for 1 hour).');

// ── 3. Trial Reminder ───────────────────────────────────────────────────────
const trialReminderTemplate = ({ hotelName, daysLeft, trialEndDate }) =>
  layout(`Trial ending ${daysLeft <= 1 ? 'tomorrow' : `in ${daysLeft} days`}`, `
    ${h1('Your free trial is ending soon')}
    ${ornament}
    ${para(`<strong style="color:${K.ivory};">${hotelName}</strong>, your StayXPulse trial ends on <strong style="color:${K.ivory};">${new Date(trialEndDate).toDateString()}</strong>. Upgrade now to keep uninterrupted access to your rooms, QR codes, menu and order history.`)}
    ${button(`${CLIENT_URL}/hotel/upgrade`, 'View plans & upgrade')}
  `, `Your StayXPulse trial ends ${new Date(trialEndDate).toDateString()}.`);

// ── 4. Subscription Expiry Reminder ─────────────────────────────────────────
const expiryReminderTemplate = ({ hotelName, planName, daysLeft, expiryDate }) =>
  layout(`Subscription expiring ${daysLeft <= 1 ? 'tomorrow' : `in ${daysLeft} days`}`, `
    ${h1('Your subscription is expiring')}
    ${ornament}
    ${para(`<strong style="color:${K.ivory};">${hotelName}</strong>, your <strong style="color:${K.ivory};">${planName}</strong> subscription expires on <strong style="color:${K.ivory};">${new Date(expiryDate).toDateString()}</strong>. Renew now to avoid any interruption to your guests&rsquo; service.`)}
    ${button(`${CLIENT_URL}/hotel/upgrade`, 'Renew subscription')}
    ${notice(`Renew before it lapses to keep your rooms, menu and orders live without a break.`, daysLeft <= 2 ? 'danger' : 'warn')}
  `, `Your ${planName} plan expires ${new Date(expiryDate).toDateString()}.`);

// ── 5. Payment Success ──────────────────────────────────────────────────────
const paymentSuccessTemplate = ({ hotelName, planName, cycle, amount, invoiceNumber, paymentId, validFrom, validTo }) => {
  const Cyc = cycle.charAt(0).toUpperCase() + cycle.slice(1);
  return layout('Payment Confirmed', `
    ${h1('Your subscription is active')}
    ${ornament}
    ${para(`<strong style="color:${K.ivory};">${hotelName}</strong>, thank you. Your payment succeeded and your <strong style="color:${K.ivory};">${planName} (${Cyc})</strong> plan is now live.`)}
    ${detailCard([
      { label: 'Plan',        value: `${planName} — ${Cyc}` },
      { label: 'Amount Paid', value: `&#8377;${Number(amount).toLocaleString('en-IN')}` },
      { label: 'Invoice No.', value: invoiceNumber, mono: true },
      { label: 'Payment ID',  value: paymentId, mono: true },
      { label: 'Valid From',  value: new Date(validFrom).toDateString() },
      { label: 'Valid To',    value: new Date(validTo).toDateString() },
    ])}
    ${button(`${CLIENT_URL}/hotel/dashboard`, 'Go to dashboard')}
    ${notice('Your GST tax invoice (PDF) is attached to this email for your records.', 'success')}
  `, `Payment confirmed — ${planName} plan active. Invoice ${invoiceNumber}.`);
};

// ── 6. Password Reset by Admin ──────────────────────────────────────────────
const passwordResetByAdminTemplate = ({ hotelName, userId, email, newPassword }) =>
  layout('Account Security', `
    ${h1('Your password has been reset')}
    ${ornament}
    ${para(`<strong style="color:${K.ivory};">${hotelName}</strong>, an administrator has reset the password for your StayXPulse account. Use the new credentials below to sign in.`)}
    ${detailCard([
      { label: 'Login URL',    value: `<a href="${CLIENT_URL}/login" style="color:${K.goldLt};text-decoration:none;">${HOST}/login</a>` },
      { label: 'User ID',      value: userId, mono: true },
      { label: 'Email',        value: email, mono: true },
      { label: 'New Password', value: newPassword, mono: true },
    ])}
    ${button(`${CLIENT_URL}/login`, 'Sign in now')}
    ${notice('Please change this password immediately after signing in.', 'warn')}
  `, 'Your StayXPulse password has been reset.');

// ── 7. New App Version Available ────────────────────────────────────────────
const bulletList = (items) => (items && items.length) ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0;">
      ${items.map(it => `<tr>
        <td style="padding:6px 12px 6px 0;vertical-align:top;color:${K.gold};font-size:9px;line-height:2;">${DIA}</td>
        <td style="padding:6px 0;font-family:${SANS};font-size:14px;line-height:1.6;color:${K.body};">${it}</td>
      </tr>`).join('')}
    </table>` : '';

const appUpdateTemplate = ({ hotelName, version, downloadUrl, notes = [] }) => {
  const v = (version || '').toString().replace(/^v/i, '').trim();
  return layout('App Update', `
    ${h1('A new app version is ready')}
    ${ornament}
    ${para(`<strong style="color:${K.ivory};">${hotelName}</strong>, an updated StayXPulse Android app${v ? ` (<strong style="color:${K.ivory};">v${v}</strong>)` : ''} is now available. Install it to get the latest features and improvements.`)}
    ${bulletList(notes)}
    ${button(downloadUrl, 'Download the latest app')}
    ${notice('Install it over your current app — your data and login stay exactly the same. On the phone you may need to allow installs from your browser.', 'success')}
  `, `A new StayXPulse app version${v ? ` (v${v})` : ''} is ready to download.`);
};

module.exports = {
  welcomeTemplate,
  forgotPasswordTemplate,
  trialReminderTemplate,
  expiryReminderTemplate,
  paymentSuccessTemplate,
  passwordResetByAdminTemplate,
  appUpdateTemplate,
};
