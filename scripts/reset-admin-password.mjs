#!/usr/bin/env node
/**
 * Force-reset admin password in Supabase to match ADMIN_PASSWORD in .env
 * Run: USE_FILE_STORAGE=false ADMIN_SYNC_PASSWORD=true npm run reset:admin
 */
import dotenv from 'dotenv';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: join(root, '.env') });

process.env.USE_FILE_STORAGE = 'false';
process.env.ADMIN_SYNC_PASSWORD = 'true';

const email = (process.env.ADMIN_EMAIL || 'usmankhan14700@gmail.com').trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD || 'admin123';

const { ensureBootstrapAdmin } = await import('../server/bootstrap.js');
const { performLogin } = await import('../server/authLogin.js');

console.log(`\nResetting admin password for ${email}...\n`);

const boot = await ensureBootstrapAdmin();
if (boot.ok === false) {
  console.error('✗ Bootstrap failed:', boot.error);
  process.exit(1);
}

try {
  await performLogin(email, password);
  console.log('✓ Password reset and verified');
  console.log(`  Email:    ${email}`);
  console.log(`  Password: ${password}`);
  console.log('\nLog in at https://patiwala.pk/login\n');
} catch (err) {
  console.error('✗ Login test failed:', err.message);
  process.exit(1);
}
