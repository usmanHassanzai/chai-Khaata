#!/usr/bin/env node
/**
 * Connect a new Supabase project to Chai Khata.
 *
 * 1. Create project at https://supabase.com/dashboard
 * 2. SQL Editor → paste supabase/schema.sql → Run
 * 3. Settings → API → copy Project URL + Secret key into .env
 * 4. Run: npm run setup:supabase
 */
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = join(root, '.env');

dotenv.config({ path: envPath });

const DASHBOARD_URL_PATTERN = /supabase\.com\/dashboard/i;

function printHeader(title) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${'═'.repeat(60)}\n`);
}

function printVercelBlock(url, key, jwt) {
  console.log(`── Copy these into Vercel → Settings → Environment Variables ──\n`);
  console.log(`SUPABASE_URL=${url}`);
  console.log(`SUPABASE_SERVICE_ROLE_KEY=${key}`);
  console.log(`JWT_SECRET=${jwt}`);
  console.log(`ADMIN_EMAIL=${process.env.ADMIN_EMAIL || 'usmankhan14700@gmail.com'}`);
  console.log(`ADMIN_PASSWORD=${process.env.ADMIN_PASSWORD || 'admin123'}`);
  console.log(`PUBLIC_SERVER_URL=https://patiwala.pk`);
  console.log(`CLIENT_ORIGIN=https://patiwala.pk`);
  console.log(`VITE_DEFAULT_CLOUD_URL=https://patiwala.pk`);
  console.log(`CORS_ALLOW_ALL=true`);
  console.log(`\nThen: Deployments → Redeploy\n`);
}

async function ensureEnvTemplate() {
  if (existsSync(envPath)) return;

  const example = join(root, '.env.example');
  let content = '';
  try {
    content = await readFile(example, 'utf8');
  } catch {
    content = 'ADMIN_EMAIL=usmankhan14700@gmail.com\nADMIN_PASSWORD=admin123\n';
  }

  content += `\nJWT_SECRET=${randomBytes(32).toString('hex')}\n`;
  content += `SUPABASE_URL=\nSUPABASE_SERVICE_ROLE_KEY=\n`;
  await writeFile(envPath, content, 'utf8');
  console.log(`Created ${envPath} — add your Supabase keys, then run this again.\n`);
}

printHeader('Chai Khata — Connect new Supabase project');

console.log(`Before running this script:
  1. https://supabase.com/dashboard → New project
  2. Wait until project status is "Active" (1–2 min)
  3. SQL Editor → New query → paste ALL of supabase/schema.sql → Run
  4. Settings → API → copy:
       • Project URL          → SUPABASE_URL
       • Secret key (service) → SUPABASE_SERVICE_ROLE_KEY
     (NOT the dashboard link, NOT the Publishable key)
`);

await ensureEnvTemplate();

const url = String(process.env.SUPABASE_URL || '').trim();
const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

if (!url || !key || url.includes('YOUR_PROJECT') || key.includes('your-service')) {
  console.log(`✗ Missing Supabase keys in .env\n`);
  console.log(`Edit ${envPath} and set:\n`);
  console.log(`  SUPABASE_URL=https://xxxxxxxx.supabase.co`);
  console.log(`  SUPABASE_SERVICE_ROLE_KEY=eyJ... or sb_secret_...\n`);
  process.exit(1);
}

if (DASHBOARD_URL_PATTERN.test(url)) {
  console.log(`✗ Wrong SUPABASE_URL — you pasted a dashboard link.\n`);
  console.log(`Use Settings → API → Project URL (ends with .supabase.co)\n`);
  process.exit(1);
}

if (!url.includes('supabase.co') && !url.includes('supabase.in')) {
  console.log(`✗ SUPABASE_URL must look like https://xxxxx.supabase.co\n`);
  process.exit(1);
}

if (key.startsWith('sb_publishable_')) {
  console.log(`✗ Wrong key — use the Secret / service_role key, not Publishable.\n`);
  process.exit(1);
}

const jwt = process.env.JWT_SECRET?.trim() || randomBytes(32).toString('hex');

console.log('Testing Supabase connection...');

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { error: pingError } = await supabase.from('users').select('id').limit(1);

if (pingError) {
  console.log(`\n✗ Connection failed: ${pingError.message}\n`);

  if (/relation.*users.*does not exist/i.test(pingError.message)) {
    console.log(`→ Run supabase/schema.sql in Supabase SQL Editor, then try again.\n`);
  } else if (/invalid api key|jwt/i.test(pingError.message)) {
    console.log(`→ Check SUPABASE_SERVICE_ROLE_KEY — use the Secret key from Settings → API.\n`);
  } else if (/fetch failed|network|enotfound/i.test(pingError.message)) {
    console.log(`→ Check SUPABASE_URL — must be https://YOUR-PROJECT.supabase.co\n`);
  }

  process.exit(1);
}

console.log('✓ Connected to Supabase');
console.log('✓ users table exists');

const { error: ledgerTableError } = await supabase.from('ledger_snapshots').select('user_id').limit(1);
if (ledgerTableError) {
  console.log(`\n✗ ledger_snapshots table missing or inaccessible: ${ledgerTableError.message}\n`);
  console.log('→ Run supabase/schema.sql in Supabase SQL Editor (includes ledger_snapshots), then try again.\n');
  process.exit(1);
}
console.log('✓ ledger_snapshots table exists\n');

console.log('Creating admin user in Supabase...');

const { ensureBootstrapAdmin } = await import('../server/bootstrap.js');
process.env.JWT_SECRET = jwt;

const bootstrap = await ensureBootstrapAdmin();

if (bootstrap.ok === false) {
  console.log(`✗ Admin setup failed: ${bootstrap.error}`);
  if (bootstrap.hint) console.log(`  Hint: ${bootstrap.hint}`);
  process.exit(1);
}

if (bootstrap.storage !== 'supabase') {
  console.log(`✗ Admin was NOT saved to Supabase (used ${bootstrap.storage} instead).`);
  console.log(`  Usually the users table is missing columns — run supabase/schema.sql in SQL Editor.\n`);
  console.log(`  Or run this in SQL Editor:\n`);
  console.log(await readFile(join(root, 'supabase', 'migrate-missing-columns.sql'), 'utf8'));
  console.log(`\n  Then run: USE_FILE_STORAGE=false npm run setup:supabase\n`);
  process.exit(1);
}

console.log(`✓ Admin ready in Supabase`);
console.log(`  Email:    ${bootstrap.email}`);
console.log(`  Username: ${bootstrap.username}`);
console.log(`  Password: ${process.env.ADMIN_PASSWORD || 'admin123'}\n`);

const usersFile = join(root, 'server', 'data', 'users.json');
if (existsSync(usersFile)) {
  console.log('Syncing local users from server/data/users.json...');
  const { execSync } = await import('node:child_process');
  try {
    execSync('node scripts/sync-users-to-supabase.mjs', { cwd: root, stdio: 'inherit' });
  } catch {
    console.log('(Skipped user sync — run npm run sync:users manually if needed)\n');
  }
}

printVercelBlock(url, key, jwt);

console.log(`── Test after Vercel redeploy ──\n`);
console.log(`  https://patiwala.pk/api/health   → connected: true`);
console.log(`  https://patiwala.pk/login        → admin email + password\n`);
