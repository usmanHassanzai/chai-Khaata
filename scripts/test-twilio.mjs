#!/usr/bin/env node
/**
 * Test Twilio SMS setup.
 * Usage: node scripts/test-twilio.mjs 03001234567
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const phone = process.argv[2];
if (!phone) {
  console.error('Usage: node scripts/test-twilio.mjs <phone>');
  console.error('Example: node scripts/test-twilio.mjs 03001234567');
  process.exit(1);
}

const { isSmsConfigured, sendOtpSms, twilioConfigSummary } = await import('../server/twilio.js');

const config = twilioConfigSummary();
console.log('Twilio config:', config);

if (!isSmsConfigured()) {
  console.error('\n❌ Twilio not configured. Edit .env and set:');
  console.error('   TWILIO_ACCOUNT_SID');
  console.error('   TWILIO_AUTH_TOKEN');
  console.error('   TWILIO_FROM');
  process.exit(1);
}

console.log(`\nSending test OTP SMS to ${phone}…`);
const result = await sendOtpSms(phone, '123456', 'test-user');

if (result.sent) {
  console.log('✅ SMS sent successfully!', result.sid ? `(sid: ${result.sid})` : '');
} else {
  console.error('❌ SMS failed:', result.reason);
  console.error('\nTrial account? Verify your phone in Twilio Console → Phone Numbers → Verified Caller IDs');
  process.exit(1);
}
