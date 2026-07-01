/** @typedef {{ sent: boolean, reason?: string, sid?: string, via?: string }} SmsResult */

export function isSmsConfigured() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID
    && process.env.TWILIO_AUTH_TOKEN
    && process.env.TWILIO_FROM,
  );
}

/** Normalize Pakistani mobile to E.164 (+92...) */
export function normalizePhoneE164(phone) {
  const raw = String(phone).trim();
  if (raw.startsWith('+')) {
    return raw.replace(/\s/g, '');
  }
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('92') && digits.length >= 12) {
    return `+${digits}`;
  }
  if (digits.startsWith('0') && digits.length >= 10) {
    return `+92${digits.slice(1)}`;
  }
  if (digits.length === 10) {
    return `+92${digits}`;
  }
  return `+${digits}`;
}

/**
 * Send OTP SMS via Twilio REST API.
 * @param {string} phone
 * @param {string} otp
 * @param {string} username
 * @returns {Promise<SmsResult>}
 */
export async function sendOtpSms(phone, otp, username) {
  const to = normalizePhoneE164(phone);

  if (!isSmsConfigured()) {
    console.log(`[Chai Khata OTP → SMS ${to}] User: ${username}, OTP: ${otp} (Twilio not configured)`);
    return {
      sent: false,
      reason: 'Twilio not configured — set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM in .env',
    };
  }

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM;

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
    const params = new URLSearchParams({
      To: to,
      From: from,
      Body: `Chai Khata — Hello ${username}, your password reset OTP is ${otp}. Valid 10 minutes. Do not share.`,
    });

    const auth = Buffer.from(`${sid}:${token}`).toString('base64');
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const reason = parseTwilioResponse(data, res.status);
      console.error(`[Chai Khata] Twilio SMS failed (${res.status}):`, reason);
      return { sent: false, reason };
    }

    console.log(`[Chai Khata] Twilio SMS sent to ${to} (sid: ${data.sid})`);
    return { sent: true, sid: data.sid, via: 'sms' };
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'SMS send failed';
    console.error(`[Chai Khata] Twilio SMS error for ${to}:`, reason);
    return { sent: false, reason: `SMS failed: ${reason}` };
  }
}

/** @param {Record<string, unknown>} data @param {number} status */
function parseTwilioResponse(data, status) {
  const code = Number(data.code);
  const msg = data.message ? String(data.message) : '';

  if (code === 21211) return 'Invalid phone number. Use format 03XXXXXXXXX';
  if (code === 21608) return 'Twilio trial: verify this phone number in Twilio Console first';
  if (code === 21614) return 'This number cannot receive SMS';
  if (code === 20003) return 'Twilio auth failed — check TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN';
  if (code === 21606) return 'TWILIO_FROM number is not a valid Twilio phone number';
  if (msg) return msg;
  return `Twilio error (${status})`;
}

export function twilioConfigSummary() {
  if (!isSmsConfigured()) {
    return { configured: false, from: null };
  }
  return {
    configured: true,
    from: process.env.TWILIO_FROM,
    accountSid: `${process.env.TWILIO_ACCOUNT_SID?.slice(0, 8)}…`,
  };
}
