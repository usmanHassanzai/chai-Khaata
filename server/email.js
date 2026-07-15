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

function cleanEnvKey(value) {
  return String(value || '').trim().replace(/^["']+|["']+$/g, '');
}

export function getBrevoApiKey() {
  return cleanEnvKey(process.env.BREVO_API_KEY);
}

export function isBrevoConfigured() {
  const key = getBrevoApiKey();
  if (!key || /xkeysib-xxx|change-me|example/i.test(key)) return false;
  return true;
}

/** Verify Brevo API key without sending email. */
export async function testBrevoConnection() {
  if (!isBrevoConfigured()) {
    return { ok: false, reason: 'BREVO_API_KEY not set (or still placeholder)' };
  }
  try {
    const key = getBrevoApiKey();
    const response = await fetchWithTimeout('https://api.brevo.com/v3/account', {
      headers: { accept: 'application/json', 'api-key': key },
    }, 8000);
    if (response.ok) {
      return { ok: true, via: 'brevo' };
    }
    const body = await response.text().catch(() => '');
    if (response.status === 401 || /unauthorized|key not found/i.test(body)) {
      return {
        ok: false,
        reason: 'Brevo API key rejected. Create a NEW key at brevo.com → Settings → SMTP & API → API keys (not SMTP key).',
      };
    }
    return { ok: false, reason: `Brevo ${response.status}: ${body.slice(0, 120)}` };
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'Brevo check failed';
    return { ok: false, reason };
  }
}

/** True when admin signup / notification emails can be sent (SMTP, Brevo, or Resend). */
export function isAdminNotificationConfigured() {
  return isEmailConfigured() || isBrevoConfigured() || isResendConfigured();
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
    connectionTimeout: 12_000,
    greetingTimeout: 12_000,
    socketTimeout: 15_000,
  });
}

function isVercelRuntime() {
  return Boolean(process.env.VERCEL);
}

async function fetchWithTimeout(url, options = {}, ms = 10_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

const VERCEL_SMTP_HINT =
  'Gmail SMTP cannot send from Vercel (ports 587/465 blocked). Use free Brevo: sign up at brevo.com, verify your Gmail sender, add BREVO_API_KEY + BREVO_FROM in Vercel, redeploy.';

function parseFromAddress(from) {
  const raw = String(from || '').trim();
  const match = raw.match(/^(.+?)\s*<([^>]+)>$/);
  if (match) return { name: match[1].trim(), email: match[2].trim() };
  if (raw.includes('@')) return { name: 'Patiwala', email: raw };
  return { name: 'Patiwala', email: process.env.SMTP_USER || 'noreply@patiwala.pk' };
}

function mailFromAddress() {
  return process.env.BREVO_FROM || process.env.RESEND_FROM || process.env.SMTP_FROM || process.env.SMTP_USER || 'Patiwala <noreply@patiwala.pk>';
}

/**
 * @param {string} dataUri
 * @returns {{ mime: string, base64: string, ext: string } | null}
 */
export function parseScreenshotDataUri(dataUri) {
  const match = String(dataUri || '').match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  const mime = match[1];
  let ext = 'png';
  if (mime.includes('jpeg') || mime.includes('jpg')) ext = 'jpg';
  else if (mime.includes('webp')) ext = 'webp';
  else if (mime.includes('gif')) ext = 'gif';
  return { mime, base64: match[2], ext };
}

/**
 * @param {string} to
 * @param {string} subject
 * @param {string} text
 * @param {string} html
 * @param {{ name: string, content: string }[]} [attachments]
 */
async function sendViaBrevo(to, subject, text, html, attachments = []) {
  if (!isBrevoConfigured()) return null;

  const key = getBrevoApiKey();
  const sender = parseFromAddress(mailFromAddress());

  const payload = {
    sender,
    to: [{ email: to }],
    subject,
    htmlContent: html,
    textContent: text,
  };
  if (attachments.length) {
    payload.attachment = attachments.map((a) => ({ name: a.name, content: a.content }));
  }

  const response = await fetchWithTimeout('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'api-key': key,
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(formatBrevoError(response.status, body));
  }

  return { sent: true, via: 'brevo' };
}

function formatBrevoError(status, body) {
  const raw = String(body || '');
  if (/aborted|abort/i.test(raw)) {
    return 'Brevo email timed out. Registration was saved — check Admin → Approvals.';
  }
  if (status === 401 || /key not found|unauthorized/i.test(raw)) {
    return 'Brevo API key invalid. In Vercel set BREVO_API_KEY to a new key from brevo.com → Settings → SMTP & API, then redeploy.';
  }
  if (status === 403 && /sender.*not.*valid|not verified|unverified/i.test(raw)) {
    return 'Brevo: verify your sender email at brevo.com → Senders, then set BREVO_FROM to that address in Vercel.';
  }
  return `Brevo ${status}: ${raw.slice(0, 180)}`;
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
  const response = await fetchWithTimeout('https://api.resend.com/emails', {
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
    throw new Error(formatResendError(response.status, body));
  }

  return { sent: true, via: 'resend' };
}

function formatResendError(status, body) {
  const raw = String(body || '');
  if (status === 403 && /only send testing emails to your own email/i.test(raw)) {
    return 'Resend test mode: verify your domain at resend.com/domains to email all users. Until then, only your Resend account email can receive mail.';
  }
  if (status === 403 && /verify a domain/i.test(raw)) {
    return 'Verify patiwala.pk at resend.com/domains, then set RESEND_FROM to Patiwala <noreply@patiwala.pk> in Vercel.';
  }
  return `Resend ${status}: ${raw.slice(0, 180)}`;
}

/**
 * @param {string} to
 * @param {string} subject
 * @param {string} text
 * @param {string} html
 */
async function sendViaSmtp(to, subject, text, html) {
  if (!isEmailConfigured()) return null;
  if (isVercelRuntime()) {
    throw new Error(VERCEL_SMTP_HINT);
  }

  const transporter = createTransporter();
  const sendPromise = transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
    html,
  });

  const timeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('SMTP timed out after 15s')), 15_000);
  });

  await Promise.race([sendPromise, timeout]);
  return { sent: true, via: 'smtp' };
}

/**
 * @param {string} to
 * @param {string} subject
 * @param {string} text
 * @param {string} html
 * @param {{ name: string, content: string }[]} [attachments]
 */
async function sendPlainEmail(to, subject, text, html, attachments = []) {
  if (!isAdminNotificationConfigured()) {
    console.log(`[Chai Khata Email → ${to}] ${subject}\n${text}`);
    return { sent: false, reason: 'Email not configured — add SMTP_*, BREVO_API_KEY, or RESEND_API_KEY to server env' };
  }

  // Brevo + Resend use HTTPS — work on Vercel. Gmail SMTP ports are blocked on serverless.
  if (isBrevoConfigured()) {
    try {
      const brevoResult = await sendViaBrevo(to, subject, text, html, attachments);
      if (brevoResult?.sent) {
        console.log(`[Chai Khata] Email sent (Brevo): ${subject} → ${to}`);
        return brevoResult;
      }
    } catch (err) {
      const reason =
        err instanceof Error && err.name === 'AbortError'
          ? 'Brevo email timed out'
          : err instanceof Error
            ? err.message
            : 'Brevo send failed';
      console.error(`[Chai Khata] Brevo failed for ${to}:`, reason);
      if (isVercelRuntime() || !isResendConfigured() && (!isEmailConfigured() || isVercelRuntime())) {
        return { sent: false, reason: `Email failed: ${reason}` };
      }
    }
  }

  if (isVercelRuntime() && isBrevoConfigured()) {
    return { sent: false, reason: 'Brevo email failed on server — check BREVO_API_KEY in Vercel' };
  }

  if (isResendConfigured()) {
    try {
      const resendResult = await sendViaResend(to, subject, text, html);
      if (resendResult?.sent) {
        console.log(`[Chai Khata] Email sent (Resend): ${subject} → ${to}`);
        return resendResult;
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Resend send failed';
      console.error(`[Chai Khata] Resend failed for ${to}:`, reason);
      if (!isBrevoConfigured() && (!isEmailConfigured() || isVercelRuntime())) {
        return { sent: false, reason: `Email failed: ${reason}` };
      }
    }
  }

  if (isVercelRuntime() && isEmailConfigured() && !isBrevoConfigured() && !isResendConfigured()) {
    return { sent: false, reason: VERCEL_SMTP_HINT };
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
    if (!isBrevoConfigured() && !isResendConfigured()) {
      return { sent: false, reason: `SMTP failed: ${reason}` };
    }
  }

  if (isBrevoConfigured()) {
  try {
    const brevoResult = await sendViaBrevo(to, subject, text, html, attachments);
    if (brevoResult?.sent) {
      console.log(`[Chai Khata] Email sent (Brevo fallback): ${subject} → ${to}`);
      return brevoResult;
    }
  } catch (err) {
      const reason =
        err instanceof Error && err.name === 'AbortError'
          ? 'Brevo email timed out'
          : err instanceof Error
            ? err.message
            : 'Brevo send failed';
      console.error(`[Chai Khata] Brevo failed for ${to}:`, reason);
      if (!isResendConfigured()) {
        return { sent: false, reason: `Email failed: ${reason}` };
      }
    }
  }

  try {
    const resendResult = await sendViaResend(to, subject, text, html);
    if (resendResult?.sent) {
      console.log(`[Chai Khata] Email sent (Resend fallback): ${subject} → ${to}`);
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
    console.log(`[Chai Khata OTP → email ${to}] User: ${username}, OTP: ${otp} (email not configured — add SMTP, Brevo, or Resend settings)`);
    return { sent: false, reason: 'Email not configured on server — add SMTP or Brevo settings' };
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
  const text = `Pending user logged in (free preview)

Payment ID: ${user.paymentRefId || '—'}
Username:   ${user.username}
Email:      ${user.email}
Phone:      ${user.phone || '—'}

Approve after payment verification in Admin → Approvals.`;

  return sendAdminPlainEmail(adminEmail, subject, text, `
    <h2>Pending user login</h2>
    <p><strong>Payment ID:</strong> <code>${user.paymentRefId || '—'}</code></p>
    <p>${user.username} (${user.email}) started a free preview while waiting for approval.</p>
  `);
}

/**
 * Admin email when a user submits subscription renewal payment proof (includes screenshot).
 * @param {string} adminEmail
 * @param {import('./store.js').UserRecord} user
 * @param {import('./paymentSubmissions.js').PaymentSubmission} submission
 * @param {{ label?: string, price?: number } | null} plan
 * @param {string} screenshotDataUri
 */
export async function sendAdminRenewalPaymentEmail(adminEmail, user, submission, plan, screenshotDataUri) {
  const planLabel = plan?.label || submission.subscriptionPlan || '—';
  const amount = submission.paymentDue ?? plan?.price ?? 0;
  const subject = `[Patiwala] Subscription renewal — ${user.shopName || user.username}`;
  const parsed = parseScreenshotDataUri(screenshotDataUri);
  const attachments = parsed
    ? [{ name: `renewal-${user.username}-${submission.id.slice(0, 8)}.${parsed.ext}`, content: parsed.base64 }]
    : [];

  const text = `Subscription renewal payment submitted

User:         ${user.username}
Email:        ${user.email}
Phone:        ${user.phone || '—'}
Shop:         ${user.shopName || '—'}
Payment ID:   ${user.paymentRefId || '—'}
Plan:         ${planLabel} — Rs ${Number(amount).toLocaleString()}
Expires:      ${user.subscriptionExpiresAt || '—'}
Submitted:    ${submission.createdAt}

Payment screenshot is attached to this email.
User may also send the screenshot on WhatsApp — verify and approve in Admin → Payment Proofs.`;

  const screenshotHtml = parsed
    ? `<p><strong>Payment screenshot:</strong></p>
       <p><img src="data:${parsed.mime};base64,${parsed.base64}" alt="Payment screenshot" style="max-width:100%;max-height:480px;border:1px solid #ddd;border-radius:8px" /></p>
       <p><em>Also attached to this email.</em></p>`
    : '<p><em>Screenshot could not be embedded — check Admin → Payment Proofs in the app.</em></p>';

  const html = `
    <h2>Subscription renewal submitted</h2>
    <p>A shop owner submitted renewal payment proof. Screenshot is attached.</p>
    <table cellpadding="6" style="border-collapse:collapse">
      <tr><td>Username</td><td><strong>${user.username}</strong></td></tr>
      <tr><td>Email</td><td>${user.email}</td></tr>
      <tr><td>Phone</td><td>${user.phone || '—'}</td></tr>
      <tr><td>Shop</td><td>${user.shopName || '—'}</td></tr>
      <tr><td>Payment ID</td><td><code>${user.paymentRefId || '—'}</code></td></tr>
      <tr><td>Plan</td><td>${planLabel} — Rs ${Number(amount).toLocaleString()}</td></tr>
      <tr><td>Subscription expires</td><td>${user.subscriptionExpiresAt || '—'}</td></tr>
      <tr><td>Submitted</td><td>${submission.createdAt}</td></tr>
    </table>
    ${screenshotHtml}
    <p>Approve in <strong>Admin → Payment Proofs</strong> after verifying payment (WhatsApp screenshot may also arrive separately).</p>
  `;

  return sendPlainEmail(adminEmail, subject, text, html, attachments);
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

/**
 * @param {string} adminEmail
 * @param {import('./store.js').UserRecord} user
 * @param {boolean} [wasGenerated]
 * @param {{ userEmailSent?: boolean, userEmailFailed?: boolean, failureReason?: string, password?: string }} [opts]
 */
export async function sendAdminPasswordRecoveryEmail(adminEmail, user, wasGenerated = false, opts = {}) {
  const { userEmailSent, userEmailFailed, failureReason, password } = opts;

  const subject = userEmailFailed
    ? `[Patiwala] ACTION NEEDED — password not delivered to ${user.username}`
    : `[Patiwala] Password recovery — ${user.username}`;

  const deliveryNote = userEmailFailed
    ? `FAILED to email user (${failureReason || 'unknown error'}).
Send the password to ${user.email} manually (WhatsApp / phone).`
    : userEmailSent
      ? 'Password was sent to their registered email successfully.'
      : 'Password recovery requested.';

  const passwordBlock =
    userEmailFailed && password
      ? `\nPassword to send manually: ${password}\n`
      : '';

  const text = `Password recovery requested

Username: ${user.username}
Email:    ${user.email}
Phone:    ${user.phone || '—'}
Shop:     ${user.shopName || '—'}
${passwordBlock}
${deliveryNote}
${wasGenerated ? 'Note: A new temporary password was generated.' : ''}`;

  const passwordHtml =
    userEmailFailed && password
      ? `<p><strong>Send this password to the user manually:</strong></p>
         <p><code style="font-size:18px;color:#b45309">${password}</code></p>`
      : '';

  const statusHtml = userEmailFailed
    ? `<p style="color:#b45309"><strong>User did NOT receive the email.</strong> ${failureReason || ''}</p>`
    : '<p>Password was sent to their registered email.</p>';

  return sendAdminPlainEmail(adminEmail, subject, text, `
    <h2>Password recovery requested</h2>
    <p><strong>${user.username}</strong> (${user.email}) requested their password.</p>
    ${statusHtml}
    ${passwordHtml}
    ${wasGenerated ? '<p><em>A new temporary password was generated.</em></p>' : ''}
  `);
}

/**
 * @param {string} to
 * @param {string} subject
 * @param {string} text
 * @param {string} html
 * @param {{ name: string, content: string }[]} [attachments]
 */
async function sendAdminPlainEmail(to, subject, text, html, attachments = []) {
  return sendPlainEmail(to, subject, text, html, attachments);
}
