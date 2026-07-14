#!/usr/bin/env node
/** Debug Supabase login — run: USE_FILE_STORAGE=false node scripts/debug-supabase-login.mjs */
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: join(root, '.env') });

const email = (process.env.ADMIN_EMAIL || 'usmankhan14700@gmail.com').trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD || 'admin123';

process.env.USE_FILE_STORAGE = 'false';

const { findUserByLogin } = await import('../server/store.js');
const { ensureBootstrapAdmin } = await import('../server/bootstrap.js');
const { performLogin } = await import('../server/authLogin.js');

console.log('\n── Bootstrap ──');
const boot = await ensureBootstrapAdmin();
console.log(JSON.stringify(boot, null, 2));

console.log('\n── Find user by email ──');
const user = await findUserByLogin(email);
if (!user) {
  console.log('✗ User NOT found for:', email);
  process.exit(1);
}
console.log('✓ Found:', { id: user.id, email: user.email, username: user.username, role: user.role, status: user.status });
console.log('  passwordHash prefix:', user.passwordHash?.slice(0, 20) + '...');

console.log('\n── bcrypt.compare ──');
const match = await bcrypt.compare(password, user.passwordHash);
console.log(match ? '✓ Password matches ADMIN_PASSWORD from .env' : '✗ Password does NOT match ADMIN_PASSWORD from .env');

console.log('\n── performLogin ──');
try {
  const result = await performLogin(email, password);
  console.log('✓ Login OK:', result.user.email, result.user.role);
} catch (err) {
  console.log('✗ Login failed:', err.code, err.message);
}

console.log('\nIf bcrypt fails here but works after setup:supabase, Vercel ADMIN_PASSWORD differs from .env\n');
