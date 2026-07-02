#!/usr/bin/env node
/** Quick check that auth API routes respond (run after deploy). */
const base = process.argv[2] || 'https://chai-khaata.vercel.app';

async function check(name, url, options) {
  try {
    const res = await fetch(`${base}${url}`, options);
    const text = await res.text();
    let body = text.slice(0, 200);
    try {
      body = JSON.stringify(JSON.parse(text)).slice(0, 200);
    } catch {
      /* keep text */
    }
    const ok = res.ok ? 'OK' : 'FAIL';
    console.log(`${ok} ${res.status} ${name}: ${body}`);
    return res.ok;
  } catch (err) {
    console.log(`FAIL ${name}: ${err instanceof Error ? err.message : err}`);
    return false;
  }
}

console.log(`Testing ${base}\n`);

await check('health', '/api/health');
await check('auth config', '/api/auth/config');
await check('login', '/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ login: 'usmankhan14700@gmail.com', password: 'admin123' }),
});
