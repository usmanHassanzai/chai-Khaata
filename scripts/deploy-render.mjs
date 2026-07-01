#!/usr/bin/env node
/**
 * Prepare and print steps to deploy Chai Khata API on Render (Option B).
 * Run: node scripts/deploy-render.mjs
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
║  Chai Khata — Deploy to Render (permanent cloud sync)        ║
╚══════════════════════════════════════════════════════════════╝

Phones on ANY network (4G, different Wi‑Fi) will sync via your public URL.

── Step 1: Push code to GitHub ──
`);

if (!isGit) {
  console.log(`  cd "${root}"
  git init
  git add .
  git commit -m "Prepare Chai Khata for Render deploy"
  gh repo create chai-khata --private --source=. --push
  # Or create repo on github.com manually, then:
  # git remote add origin https://github.com/YOUR_USER/chai-khata.git
  # git push -u origin main
`);
} else if (!hasRemote) {
  console.log(`  git add .
  git commit -m "Prepare Chai Khata for Render deploy"
  gh repo create chai-khata --private --source=. --push
`);
} else {
  console.log(`  Repo: ${hasRemote}
  git add . && git commit -m "Render deploy" && git push
`);
}

console.log(`── Step 2: Create Render service ──

  1. Open https://dashboard.render.com
  2. New → Blueprint → connect your GitHub repo
  3. Render reads render.yaml automatically
  4. When prompted, set secrets:
     • ADMIN_PASSWORD  (your admin login password)
     • TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM  (for SMS OTP)
  5. Deploy (first build ~2–3 min)

  Manual alternative: New → Web Service → same repo
     Build:  npm install
     Start:  node server/index.js
     Health: /api/health
     Plan:   Starter ($7/mo — includes 1 GB disk for shop data)

── Step 3: Copy your public URL ──

  After deploy, Render shows:  https://chai-khata-api.onrender.com
  Test in browser:             https://YOUR-URL.onrender.com/api/health

── Step 4: Configure every phone ──

  Settings → Cloud Sync
  • Cloud Server URL: https://YOUR-URL.onrender.com
  • Test Connection → Save
  • Log out → log in (same account on all phones)

── Step 5 (optional): Bake URL into APK ──

  VITE_DEFAULT_CLOUD_URL=https://YOUR-URL.onrender.com npm run android:apk

Note: Starter plan keeps users + ledger data on disk across redeploys.
Free tier without disk loses data when Render redeploys — not recommended.
`);
