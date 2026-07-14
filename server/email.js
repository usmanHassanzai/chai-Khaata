import nodemailer from 'nodemailer';

export function isEmailConfigured() {
  const pass = String(process.env.SMTP_PASS || '').trim();
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !pass) return false;
  if (/your-gmail-app-password|change-me|example/i.test(pass)) return false;
  return true;
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

/**
 * @param {string} to
 * @param {string} otp
 * @param {string} username
 * @param {string} [introLine]
 */
export async function sendOtpEmail(to, otp, username, introLine) {
  if (!isEmailConfigured()) {
    console.log(`[Chai Khata OTP → email ${to}] User: ${username}, OTP: ${otp} (SMTP not configured — add SMTP_* to .env)`);
    return { sent: false, reason: 'Email not configured on server — add SMTP settings to .env file' };
  }

  const transporter = createTransporter();

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject: 'Chai Khata — Password Reset OTP',
      text: `${introLine ? `${introLine}\n\n` : ''}Hello ${username},\n\nYour password reset OTP is: ${otp}\n\nThis code expires in 10 minutes.\n\n— Chai Khata`,
      html: `
        <p>${introLine ? introLine : `Hello <strong>${username}</strong>,`}</p>
        <p>Your password reset OTP is:</p>
        <h2 style="letter-spacing:4px;color:#2d6a4f">${otp}</h2>
        <p>Expires in 10 minutes.</p>
        <p>— Chai Khata</p>
      `,
    });
    console.log(`[Chai Khata] OTP email sent to ${to}`);
    return { sent: true };
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'Email send failed';
    console.error(`[Chai Khata] OTP email failed for ${to}:`, reason);
    return { sent: false, reason: `Email failed: ${reason}` };
  }
}

/**
 * @param {string} adminEmail
 * @param {import('./store.js').UserRecord} user
 * @param {string} password
 * @param {number} fee
 * @param {{ label?: string, price?: number } | null} plan
 */
export async function sendAdminSignupEmail(adminEmail, user, password, fee, plan) {
  const subject = `[Patiwala] New signup — ${user.paymentRefId || user.username}`;
  const text = `New Patiwala signup (pending payment verification)

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
    <h2>New Patiwala signup</h2>
    <p><strong>Payment ID:</strong> <code style="font-size:18px;color:#2d6a4f">${user.paymentRefId || '—'}</code></p>
    <table cellpadding="6" style="border-collapse:collapse">
      <tr><td>Username</td><td><strong>${user.username}</strong></td></tr>
      <tr><td>Email</td><td>${user.email}</td></tr>
      <tr><td>Phone</td><td>${user.phone || '—'}</td></tr>
      <tr><td>Shop</td><td>${user.shopName || '—'}</td></tr>
      <tr><td>Plan</td><td>${plan?.label || '—'} — Rs ${fee.toLocaleString()}</td></tr>
      <tr><td>Password</td><td><code>${password}</code></td></tr>
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
 * @param {string} to
 * @param {string} subject
 * @param {string} text
 * @param {string} html
 */
async function sendAdminPlainEmail(to, subject, text, html) {
  if (!isEmailConfigured()) {
    console.log(`[Chai Khata Admin email → ${to}] ${subject}\n${text}`);
    return { sent: false, reason: 'SMTP not configured' };
  }

  const transporter = createTransporter();
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      text,
      html,
    });
    console.log(`[Chai Khata] Admin email sent: ${subject}`);
    return { sent: true };
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'Email send failed';
    console.error('[Chai Khata] Admin email failed:', reason);
    return { sent: false, reason };
  }
}
