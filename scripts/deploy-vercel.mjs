#!/usr/bin/env node
/**
 * Steps to deploy Chai Khata on Supabase + Vercel (free tier).
 * Run: npm run deploy:vercel
 */
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function run(cmd) {
  try {
    return execSync(cmd, { cwd: root, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return '';
  }
}

const isGit = existsSync(join(root, '.git'));
const hasRemote = isGit && run('git remote get-url origin');

console.log(`
╔══════════════════════════════════════════════════════════════╗
║  Chai Khata — Supabase + Vercel (free cloud sync)            ║
╚══════════════════════════════════════════════════════════════╝

── Step 1: Create Supabase project (free) ──

  1. https://supabase.com → New project
  2. SQL Editor → paste contents of supabase/schema.sql → Run
  3. Settings → API → copy:
     • Project URL          → SUPABASE_URL
     • service_role secret  → SUPABASE_SERVICE_ROLE_KEY  (keep private!)

── Step 2: Push code to GitHub ──
`);

if (!isGit) {
  console.log(`  cd "${root}"
  git init -b main && git add . && git commit -m "Supabase + Vercel deploy"
  gh auth login && gh repo create chai-khata --private --source=. --push
`);
} else if (!hasRemote) {
  console.log(`  git add . && git commit -m "Supabase + Vercel deploy"
  gh auth login && gh repo create chai-khata --private --source=. --push
`);
} else {
  console.log(`  Repo: ${hasRemote}
  git add . && git commit -m "Supabase + Vercel deploy" && git push
`);
}

console.log(`── Step 3: Deploy API on Vercel (free) ──

  1. https://vercel.com → Add New → Project → import GitHub repo
  2. Framework: Other (uses vercel.json + api/index.js)
  3. Environment variables (Production):

     SUPABASE_URL=https://xxxx.supabase.co
     SUPABASE_SERVICE_ROLE_KEY=eyJ...
     JWT_SECRET=<long random string>
     ADMIN_EMAIL=usmankhan14700@gmail.com
     ADMIN_PASSWORD=admin123
     PUBLIC_SERVER_URL=https://patiwala.pk
     CLIENT_ORIGIN=https://patiwala.pk
     VITE_DEFAULT_CLOUD_URL=https://patiwala.pk
     CORS_ALLOW_ALL=true
     TWILIO_ACCOUNT_SID=...
     TWILIO_AUTH_TOKEN=...
     TWILIO_FROM=+1...
     SMTP_HOST=smtp.gmail.com
     SMTP_USER=...
     SMTP_PASS=...

  4. Deploy → copy URL: https://chai-khata-xxxx.vercel.app

── Step 4: Test ──

  https://YOUR-APP.vercel.app/api/health
  → should show: "ok": true, "storage": "supabase"

── Step 5: Every phone ──

  Settings → Cloud Sync → URL: https://YOUR-APP.vercel.app
  Test Connection → Save → log out → log in (same account)

── Step 6 (optional): Bake URL into APK ──

  VITE_DEFAULT_CLOUD_URL=https://YOUR-APP.vercel.app npm run android:apk

Local dev with Supabase: copy SUPABASE_* into .env, then npm run start:server
`);
