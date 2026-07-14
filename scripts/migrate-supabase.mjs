#!/usr/bin/env node
/**
 * Apply missing column migrations via Supabase SQL (uses direct Postgres if DATABASE_URL set,
 * otherwise prints SQL for manual run in SQL Editor).
 */
import dotenv from 'dotenv';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: join(root, '.env') });

const url = process.env.SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

const migrationSql = await readFile(join(root, 'supabase', 'migrate-missing-columns.sql'), 'utf8');

const statements = migrationSql
  .split(';')
  .map((s) => s.replace(/--[^\n]*/g, '').trim())
  .filter(Boolean);

if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

// Try Supabase Management SQL via postgres meta - use rpc if available
// Fallback: run each alter via raw fetch to PostgREST won't work for DDL.
// Use supabase db execute through @supabase/supabase-js v2 - not available.

// Attempt with postgres package if DATABASE_URL provided
const dbUrl = process.env.DATABASE_URL?.trim() || process.env.SUPABASE_DB_URL?.trim();

if (dbUrl) {
  try {
    const pg = await import('pg');
    const client = new pg.default.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
    await client.connect();
    for (const sql of statements) {
      await client.query(`${sql};`);
      console.log(`✓ ${sql.slice(0, 60)}...`);
    }
    await client.end();
    console.log('\n✓ Migration applied\n');
    process.exit(0);
  } catch (err) {
    console.warn('DATABASE_URL migration failed:', err.message);
  }
}

// Verify which columns are missing by attempting insert probe
const supabase = createClient(url, key, { auth: { persistSession: false } });
const { error } = await supabase.from('users').select('payment_ref_id, trial_started_at, trial_ends_at').limit(1);

if (!error) {
  console.log('✓ All columns already exist — no migration needed.\n');
  process.exit(0);
}

console.log(`
✗ Missing columns in Supabase users table.

Open Supabase → SQL Editor → New query → paste and Run:

${migrationSql}

Or run the full file: supabase/schema.sql (safe — uses IF NOT EXISTS)

Then run: USE_FILE_STORAGE=false npm run setup:supabase
`);

process.exit(1);
