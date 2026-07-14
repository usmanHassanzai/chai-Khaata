#!/usr/bin/env node
/**
 * Run subscription expiry reminder emails (same logic as Vercel daily cron).
 * Usage: npm run cron:subscription-reminders
 */
import dotenv from 'dotenv';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: join(root, '.env') });

const { runSubscriptionExpiryReminders } = await import('../server/subscriptionReminders.js');

console.log('Running subscription expiry reminders...\n');

try {
  const result = await runSubscriptionExpiryReminders();
  console.log(JSON.stringify({ ok: true, ...result }, null, 2));
  if (result.errors?.length) {
    process.exitCode = 1;
  }
} catch (err) {
  console.error('Failed:', err instanceof Error ? err.message : err);
  process.exit(1);
}
