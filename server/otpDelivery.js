import { sendOtpEmail, isAdminNotificationConfigured, isBrevoConfigured, testBrevoConnection } from './email.js';
import { sendOtpSms, isSmsConfigured, twilioConfigSummary } from './twilio.js';
import { cached } from './responseCache.js';

const BREVO_HEALTH_TTL_MS = Number(process.env.BREVO_HEALTH_CACHE_MS) || 300_000;

/**
 * Deliver OTP via email or phone. Falls back to email when SMS fails.
 * @param {{ channel: 'email' | 'phone', email: string, phone: string, username: string, otp: string }}
 */
export async function deliverOtp({ channel, email, phone, username, otp }) {
  if (channel === 'email') {
    if (!email) {
      return { sent: false, reason: 'No email on this account' };
    }
    return sendOtpEmail(email, otp, username);
  }

  if (!phone) {
    return { sent: false, reason: 'No phone number on this account' };
  }

  const phoneResult = await sendOtpSms(phone, otp, username);
  if (phoneResult.sent) {
    return { ...phoneResult, via: 'sms' };
  }

  // Twilio failed — try email as fallback
  if (email) {
    const emailResult = await sendOtpEmail(
      email,
      otp,
      username,
      `You requested OTP via phone. SMS could not be delivered (${phoneResult.reason}). Your code:`,
    );
    if (emailResult.sent) {
      return {
        sent: true,
        via: 'email',
        reason: 'SMS failed — OTP sent to your registered email instead',
      };
    }
    return {
      sent: false,
      reason: emailResult.reason || phoneResult.reason || 'Could not send OTP',
    };
  }

  return phoneResult;
}

export function otpDeliveryStatus() {
  return {
    emailConfigured: isAdminNotificationConfigured(),
    adminNotificationsConfigured: isAdminNotificationConfigured(),
    brevoConfigured: isBrevoConfigured(),
    smsConfigured: isSmsConfigured(),
    twilio: twilioConfigSummary(),
  };
}

export async function otpDeliveryHealth() {
  const status = otpDeliveryStatus();
  const brevo = isBrevoConfigured()
    ? await cached('brevo:health', () => testBrevoConnection(), BREVO_HEALTH_TTL_MS)
    : { ok: false, reason: 'BREVO_API_KEY not set' };
  return { ...status, brevo };
}
