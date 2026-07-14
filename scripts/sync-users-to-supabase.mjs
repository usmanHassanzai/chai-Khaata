#!/usr/bin/env node
/**
 * Copy local server/data/users.json into Supabase (production database).
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env
 *
 * Run: npm run sync:users
 */
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { userToRow } from '../server/persistence/supabase.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: join(root, '.env') });

const url = process.env.SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!url || !key) {
  console.error('\nMissing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env\n');
  process.exit(1);
}

if (key.startsWith('sb_publishable_')) {
  console.error('\nUse the Secret (service_role) key, not the Publishable key.\n');
  process.exit(1);
}

const usersFile = join(root, 'server', 'data', 'users.json');
let users = [];
try {
  users = JSON.parse(await readFile(usersFile, 'utf8'));
} catch (err) {
  console.error(`\nCould not read ${usersFile}:`, err.message);
  process.exit(1);
}

if (!users.length) {
  console.log('\nNo local users to sync.\n');
  process.exit(0);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

console.log(`\nSyncing ${users.length} user(s) to Supabase...\n`);

for (const user of users) {
  const row = userToRow({
    ...user,
    email: String(user.email || '').trim().toLowerCase(),
    username: String(user.username || '').trim().toLowerCase(),
    paymentDue: Math.max(0, Number(user.paymentDue) || 0),
  });

  const { error } = await supabase.from('users').upsert(row, { onConflict: 'id' });
  if (error) {
    console.error(`  ✗ ${user.email || user.username}: ${error.message}`);
  } else {
    console.log(`  ✓ ${user.email || user.username} (${user.role}, ${user.status})`);
  }
}

console.log('\nDone. Redeploy Vercel if needed, then log in at https://patiwala.pk/login\n');
