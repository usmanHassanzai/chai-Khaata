import nodemailer from 'nodemailer';

export function isEmailConfigured() {
  const pass = String(process.env.SMTP_PASS || '').trim();
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !pass) return false;
  if (/your-gmail-app-password|change-me|example/i.test(pass)) return false;
  return true;
}

export function isResendConfigured() {
  const key = String(process.env.RESEND_API_KEY || '').trim();
  if (!key || /re_xxx|change-me|example/i.test(key)) return false;
  return true;
}

/** True when admin signup / notification emails can be sent (SMTP or Resend). */
export function isAdminNotificationConfigured() {
  return isEmailConfigured() || isResendConfigured();
}

function createTransporter() {
  if (!isEmailConfigured()) {
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

function mailFromAddress() {
  return process.env.RESEND_FROM || process.env.SMTP_FROM || process.env.SMTP_USER || 'Patiwala <noreply@patiwala.pk>';
}

/**
 * @param {string} to
 * @param {string} subject
 * @param {string} text
 * @param {string} html
 */
async function sendViaResend(to, subject, text, html) {
  if (!isResendConfigured()) return null;

  const key = String(process.env.RESEND_API_KEY).trim();
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: mailFromAddress(),
      to: [to],
      subject,
      text,
      html,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Resend ${response.status}: ${body.slice(0, 200)}`);
  }

  return { sent: true, via: 'resend' };
}

/**
 * @param {string} to
 * @param {string} subject
 * @param {string} text
 * @param {string} html
 */
async function sendViaSmtp(to, subject, text, html) {
  if (!isEmailConfigured()) return null;

  const transporter = createTransporter();
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
    html,
  });
  return { sent: true, via: 'smtp' };
}

/**
 * @param {string} to
 * @param {string} subject
 * @param {string} text
 * @param {string} html
 */
async function sendPlainEmail(to, subject, text, html) {
  if (!isAdminNotificationConfigured()) {
    console.log(`[Chai Khata Email → ${to}] ${subject}\n${text}`);
    return { sent: false, reason: 'Email not configured — add SMTP_* or RESEND_API_KEY to server env' };
  }

  try {
    const smtpResult = await sendViaSmtp(to, subject, text, html);
    if (smtpResult?.sent) {
      console.log(`[Chai Khata] Email sent (SMTP): ${subject} → ${to}`);
      return smtpResult;
    }
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'SMTP send failed';
    console.warn(`[Chai Khata] SMTP failed for ${to}: ${reason}`);
    if (!isResendConfigured()) {
      return { sent: false, reason: `SMTP failed: ${reason}` };
    }
  }

  try {
    const resendResult = await sendViaResend(to, subject, text, html);
    if (resendResult?.sent) {
      console.log(`[Chai Khata] Email sent (Resend): ${subject} → ${to}`);
      return resendResult;
    }
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'Resend send failed';
    console.error(`[Chai Khata] Resend failed for ${to}:`, reason);
    return { sent: false, reason: `Email failed: ${reason}` };
  }

  return { sent: false, reason: 'Email delivery not configured' };
}

/**
 * @param {string} to
 * @param {string} otp
 * @param {string} username
 * @param {string} [introLine]
 */
export async function sendOtpEmail(to, otp, username, introLine) {
  const subject = 'Chai Khata — Password Reset OTP';
  const text = `${introLine ? `${introLine}\n\n` : ''}Hello ${username},\n\nYour password reset OTP is: ${otp}\n\nThis code expires in 10 minutes.\n\n— Chai Khata`;
  const html = `
    <p>${introLine ? introLine : `Hello <strong>${username}</strong>,`}</p>
    <p>Your password reset OTP is:</p>
    <h2 style="letter-spacing:4px;color:#2d6a4f">${otp}</h2>
    <p>Expires in 10 minutes.</p>
    <p>— Chai Khata</p>
  `;

  if (!isAdminNotificationConfigured()) {
    console.log(`[Chai Khata OTP → email ${to}] User: ${username}, OTP: ${otp} (email not configured — add SMTP_* or RESEND_API_KEY)`);
    return { sent: false, reason: 'Email not configured on server — add SMTP or Resend settings' };
  }

  return sendPlainEmail(to, subject, text, html);
}

/**
 * @param {string} adminEmail
 * @param {import('./store.js').UserRecord} user
 * @param {string} password
 * @param {number} fee
 * @param {{ label?: string, price?: number } | null} plan
 */
export async function sendAdminSignupEmail(adminEmail, user, password, fee, plan) {
  const subject = `[Patiwala] New registration — ${user.paymentRefId || user.username}`;
  const text = `New Patiwala registration (pending approval)

Payment ID:   ${user.paymentRefId || '—'}
Username:     ${user.username}
Email:        ${user.email}
Phone:        ${user.phone || '—'}
Shop:         ${user.shopName || '—'}
Plan:         ${plan?.label || user.subscriptionPlan || '—'} — Rs ${fee}
Password:     ${password}
Registered:   ${user.createdAt}

User must send payment via Easypaisa, UBL, Nayapay or JS Bank and WhatsApp screenshot with Payment ID.
Approve in Admin → Approvals after verifying payment.`;

  return sendAdminPlainEmail(adminEmail, subject, text, `
    <h2>New Patiwala registration</h2>
    <p>A new shop owner signed up and is waiting for your approval.</p>
    <p><strong>Payment ID:</strong> <code style="font-size:18px;color:#2d6a4f">${user.paymentRefId || '—'}</code></p>
    <table cellpadding="6" style="border-collapse:collapse">
      <tr><td>Username</td><td><strong>${user.username}</strong></td></tr>
      <tr><td>Email</td><td>${user.email}</td></tr>
      <tr><td>Phone</td><td>${user.phone || '—'}</td></tr>
      <tr><td>Shop</td><td>${user.shopName || '—'}</td></tr>
      <tr><td>Plan</td><td>${plan?.label || '—'} — Rs ${fee.toLocaleString()}</td></tr>
      <tr><td>Password</td><td><code>${password}</code></td></tr>
      <tr><td>Registered</td><td>${user.createdAt || '—'}</td></tr>
    </table>
    <p>Verify payment screenshot on WhatsApp, then approve in Admin panel.</p>
  `);
}

/** @param {string} adminEmail @param {import('./store.js').UserRecord} user */
export async function sendAdminPendingLoginEmail(adminEmail, user) {
  const subject = `[Patiwala] Pending user login — ${user.paymentRefId || user.username}`;
  const text = `Pending user logged in (1-day preview)

Payment ID: ${user.paymentRefId || '—'}
Username:   ${user.username}
Email:      ${user.email}
Phone:      ${user.phone || '—'}

Approve after payment verification in Admin → Approvals.`;

  return sendAdminPlainEmail(adminEmail, subject, text, `
    <h2>Pending user login</h2>
    <p><strong>Payment ID:</strong> <code>${user.paymentRefId || '—'}</code></p>
    <p>${user.username} (${user.email}) started a 1-day preview while waiting for approval.</p>
  `);
}

/**
 * Daily reminder to shop owner before subscription expires.
 * @param {string} to
 * @param {import('./store.js').UserRecord} user
 * @param {number} daysLeft
 * @param {string} planLabel
 * @param {string} renewUrl
 */
export async function sendSubscriptionExpiryReminder(to, user, daysLeft, planLabel, renewUrl) {
  const expires = user.subscriptionExpiresAt
    ? new Date(user.subscriptionExpiresAt).toLocaleDateString('en-PK', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'Asia/Karachi',
    })
    : '—';

  const dayWord = daysLeft === 1 ? '1 day' : `${daysLeft} days`;
  const subject = `[Patiwala] Subscription expires in ${dayWord} — ${user.shopName || user.username}`;
  const text = `Hello ${user.username},

Your Patiwala subscription (${planLabel}) will expire in ${dayWord}.

Expiry date: ${expires}
Shop: ${user.shopName || '—'}
Payment ID: ${user.paymentRefId || '—'}

Renew now to keep using your inventory system:
${renewUrl}

Send payment screenshot on WhatsApp after paying so admin can extend your subscription.

— Patiwala Team`;

  const html = `
    <h2>Subscription expiring soon</h2>
    <p>Hello <strong>${user.username}</strong>,</p>
    <p>Your Patiwala subscription (<strong>${planLabel}</strong>) expires in <strong style="color:#b45309">${dayWord}</strong>.</p>
    <table cellpadding="6" style="border-collapse:collapse">
      <tr><td>Expiry date</td><td><strong>${expires}</strong></td></tr>
      <tr><td>Shop</td><td>${user.shopName || '—'}</td></tr>
      <tr><td>Payment ID</td><td><code>${user.paymentRefId || '—'}</code></td></tr>
    </table>
    <p><a href="${renewUrl}" style="display:inline-block;padding:10px 18px;background:#2d6a4f;color:#fff;text-decoration:none;border-radius:8px">Renew subscription</a></p>
    <p>After payment, send your screenshot on WhatsApp so admin can extend your account.</p>
    <p>— Patiwala Team</p>
  `;

  return sendPlainEmail(to, subject, text, html);
}

/**
 * @param {string} to
 * @param {import('./store.js').UserRecord} user
 * @param {string} password
 * @param {boolean} [wasGenerated]
 */
export async function sendUserPasswordRecoveryEmail(to, user, password, wasGenerated = false) {
  const subject = '[Patiwala] Your account password';
  const intro = wasGenerated
    ? 'You requested your password. A new temporary password was created for your account:'
    : 'You requested your password. Here is your Patiwala login password:';

  const text = `Hello ${user.username},

${intro}

Email:    ${user.email}
Username: ${user.username}
Password: ${password}

Log in at Patiwala and change your password in Settings → Account if you wish.

If you did not request this, contact admin immediately.

— Patiwala Team`;

  const html = `
    <h2>Your Patiwala password</h2>
    <p>Hello <strong>${user.username}</strong>,</p>
    <p>${intro}</p>
    <table cellpadding="6" style="border-collapse:collapse">
      <tr><td>Email</td><td>${user.email}</td></tr>
      <tr><td>Username</td><td><strong>${user.username}</strong></td></tr>
      <tr><td>Password</td><td><code style="font-size:16px;color:#2d6a4f">${password}</code></td></tr>
    </table>
    ${wasGenerated ? '<p><em>This is a new temporary password because your old one was not stored.</em></p>' : ''}
    <p>Log in and change your password in <strong>Settings → Account</strong> if you want.</p>
    <p>— Patiwala Team</p>
  `;

  return sendPlainEmail(to, subject, text, html);
}

/** @param {string} adminEmail @param {import('./store.js').UserRecord} user @param {boolean} [wasGenerated] */
export async function sendAdminPasswordRecoveryEmail(adminEmail, user, wasGenerated = false) {
  const subject = `[Patiwala] Password recovery — ${user.username}`;
  const text = `Password recovery requested

Username: ${user.username}
Email:    ${user.email}
Phone:    ${user.phone || '—'}
Shop:     ${user.shopName || '—'}
${wasGenerated ? 'Note: A new temporary password was generated and emailed to the user.' : 'Note: Stored signup password was emailed to the user.'}`;

  return sendAdminPlainEmail(adminEmail, subject, text, `
    <h2>Password recovery requested</h2>
    <p><strong>${user.username}</strong> (${user.email}) requested their password.</p>
    <p>Password was sent to their registered email.</p>
    ${wasGenerated ? '<p><em>A new temporary password was generated.</em></p>' : ''}
  `);
}

/**
 * @param {string} to
 * @param {string} subject
 * @param {string} text
 * @param {string} html
 */
async function sendAdminPlainEmail(to, subject, text, html) {
  return sendPlainEmail(to, subject, text, html);
}
