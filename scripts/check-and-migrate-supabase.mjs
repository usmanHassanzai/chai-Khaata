#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: join(root, '.env') });

const url = process.env.SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!url || !key) {
  console.error('MISSING_ENV');
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

const tables = ['users', 'ledger_snapshots', 'payment_submissions', 'otps'];
const results = {};

for (const t of tables) {
  const { error } = await sb.from(t).select('*').limit(1);
  results[t] = error ? error.message : 'ok';
}

console.log(JSON.stringify({ url: url.replace(/https:\/\/([^.]+).*/, 'https://$1.supabase.co'), results }, null, 2));

const missing = Object.entries(results).filter(([, v]) => v !== 'ok');
if (missing.length) {
  console.log('\nTABLES_NEED_SCHEMA=true');
  process.exit(2);
}

console.log('\nALL_TABLES_OK=true');
