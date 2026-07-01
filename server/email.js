import nodemailer from 'nodemailer';

export function isEmailConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
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
