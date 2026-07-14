#!/usr/bin/env node
/**
 * Custom domain setup for patiwala.pk on Vercel.
 * Run: node scripts/setup-domain.mjs
 */
const DOMAIN = 'patiwala.pk';
const WWW = `www.${DOMAIN}`;
const APP_URL = `https://${DOMAIN}`;

console.log(`
╔══════════════════════════════════════════════════════════════╗
║  Deploy Chai Khata on ${DOMAIN.padEnd(28)}║
╚══════════════════════════════════════════════════════════════╝

Your app URL will be: ${APP_URL}

── STEP 1: Push latest code to GitHub ──

  cd ~/chai-khaata
  git add .
  git commit -m "Configure patiwala.pk domain"
  git push origin main

  (Vercel auto-deploys when you push)

── STEP 2: Add domain in Vercel ──

  1. Go to https://vercel.com → your chai-khata project
  2. Settings → Domains
  3. Add: ${DOMAIN}
  4. Add: ${WWW}
  5. Vercel shows DNS records — copy them

── STEP 3: DNS at your domain registrar (.pk) ──

  Log in where you bought ${DOMAIN} (PKNIC / Namecheap / etc.)

  Add these records (Vercel may show slightly different values — use Vercel's):

  ┌──────────┬──────┬─────────────────────────┐
  │ Type     │ Name │ Value                   │
  ├──────────┼──────┼─────────────────────────┤
  │ A        │ @    │ 76.76.21.21             │
  │ CNAME    │ www  │ cname.vercel-dns.com    │
  └──────────┴──────┴─────────────────────────┘

  Save DNS → wait 15 min to 48 hours (usually under 1 hour)

── STEP 4: Vercel environment variables (Production) ──

  Add or update ALL of these:

  PUBLIC_SERVER_URL=${APP_URL}
  CLIENT_ORIGIN=${APP_URL}
  ALLOWED_ORIGINS=https://${WWW}
  VITE_DEFAULT_CLOUD_URL=${APP_URL}

  Keep existing:
  SUPABASE_URL=...
  SUPABASE_SERVICE_ROLE_KEY=...  (Secret key sb_secret_...)
  JWT_SECRET=...
  ADMIN_EMAIL=usmankhan14700@gmail.com
  ADMIN_PASSWORD=admin123
  CORS_ALLOW_ALL=true

  Then: Deployments → Redeploy (required after env change)

── STEP 5: Test ──

  ${APP_URL}/api/health
  → should show "ok": true

  ${APP_URL}/login
  → login with ADMIN_EMAIL + ADMIN_PASSWORD from Vercel env

── Step 7: Move local users to Supabase (optional) ──

  Local accounts (server/data/users.json) are NOT on Vercel automatically.
  On your PC with SUPABASE_* in .env:
  npm run sync:users

  Or register again on ${APP_URL}/register

── STEP 6: Phones / APK ──

  Settings → Cloud Sync → URL: ${APP_URL}
  Or rebuild APK:
  VITE_DEFAULT_CLOUD_URL=${APP_URL} npm run android:apk

── Optional: redirect www → root ──

  In Vercel Domains, set ${WWW} to redirect to ${DOMAIN}

── Troubleshooting ──

  • DNS not working? Check https://dnschecker.org for ${DOMAIN}
  • SSL error? Wait for Vercel to issue certificate (automatic)
  • API 404? Redeploy after latest code push
  • Login fails? Fix Supabase Secret key + run admin SQL

`);
