#!/usr/bin/env node
/**
 * Auto-configure Twilio: find or buy a FROM number, update .env, test SMS.
 * Usage: node scripts/setup-twilio.mjs [testPhone]
 */
import dotenv from 'dotenv';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const envPath = join(root, '.env');

dotenv.config({ path: envPath });

const sid = process.env.TWILIO_ACCOUNT_SID;
const token = process.env.TWILIO_AUTH_TOKEN;
const testPhone = process.argv[2] || '03462204903';

if (!sid || !token) {
  console.error('❌ Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in .env first');
  process.exit(1);
}

const auth = Buffer.from(`${sid}:${token}`).toString('base64');
const jsonHeaders = { Authorization: `Basic ${auth}` };
const formHeaders = { ...jsonHeaders, 'Content-Type': 'application/x-www-form-urlencoded' };

async function twilioGet(path) {
  const res = await fetch(`https://api.twilio.com/2010-04-01${path}`, { headers: jsonHeaders });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

async function twilioPost(path, params) {
  const res = await fetch(`https://api.twilio.com/2010-04-01${path}`, {
    method: 'POST',
    headers: formHeaders,
    body: new URLSearchParams(params),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

function updateEnvFrom(phone) {
  let env = readFileSync(envPath, 'utf8');
  if (/^TWILIO_FROM=.*/m.test(env)) {
    env = env.replace(/^TWILIO_FROM=.*/m, `TWILIO_FROM=${phone}`);
  } else {
    env += `\nTWILIO_FROM=${phone}\n`;
  }
  writeFileSync(envPath, env, 'utf8');
  process.env.TWILIO_FROM = phone;
  console.log(`✅ Updated .env TWILIO_FROM=${phone}`);
}

async function ensureTwilioNumber() {
  console.log('Fetching Twilio phone numbers…');
  const numbers = await twilioGet(`/Accounts/${sid}/IncomingPhoneNumbers.json`);
  if (!numbers.ok) {
    throw new Error(numbers.data.message || `Twilio API error (${numbers.status})`);
  }

  const list = numbers.data.incoming_phone_numbers || [];
  if (list.length > 0) {
    return list[0].phone_number;
  }

  console.log('No number found — searching for available US SMS number…');
  const available = await twilioGet(
    `/Accounts/${sid}/AvailablePhoneNumbers/US/Local.json?SmsEnabled=true&PageSize=1`,
  );
  const candidate = available.data.available_phone_numbers?.[0]?.phone_number;
  if (!candidate) {
    throw new Error('No SMS-capable numbers available. Buy one in Twilio Console.');
  }

  console.log(`Provisioning ${candidate}…`);
  const bought = await twilioPost(`/Accounts/${sid}/IncomingPhoneNumbers.json`, {
    PhoneNumber: candidate,
  });
  if (!bought.ok || !bought.data.phone_number) {
    throw new Error(bought.data.message || 'Could not provision Twilio number');
  }
  return bought.data.phone_number;
}

try {
  const from = await ensureTwilioNumber();
  console.log(`Using Twilio number: ${from}`);

  if (process.env.TWILIO_FROM !== from) {
    updateEnvFrom(from);
  } else {
    console.log(`TWILIO_FROM already set to ${from}`);
  }

  const { isSmsConfigured, sendOtpSms } = await import('../server/twilio.js');
  if (!isSmsConfigured()) {
    throw new Error('SMS still not configured after update');
  }

  console.log(`\nSending test OTP to ${testPhone}…`);
  const result = await sendOtpSms(testPhone, '123456', 'Chai Khata');

  if (result.sent) {
    console.log('✅ Test SMS sent successfully!', result.sid ? `(sid: ${result.sid})` : '');
    console.log('\nTwilio setup complete. Restart the server: npm run dev');
  } else {
    console.error('❌ Test SMS failed:', result.reason);
    if (String(result.reason).includes('21608') || String(result.reason).toLowerCase().includes('verify')) {
      console.error('\nTrial account: verify your phone at');
      console.error('https://console.twilio.com/us1/develop/phone-numbers/manage/verified');
    }
    process.exit(1);
  }
} catch (err) {
  console.error('❌', err instanceof Error ? err.message : err);
  process.exit(1);
}
