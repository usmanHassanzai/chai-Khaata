import dotenv from 'dotenv';
import localtunnel from 'localtunnel';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const port = Number(process.env.PORT) || 3001;

console.log('\n🌐 Starting public tunnel (works on any mobile network)…');
console.log(`   Make sure the auth server is running on port ${port} first:`);
console.log('   npm run start:server\n');

const tunnel = await localtunnel({ port });

console.log('══════════════════════════════════════════════════');
console.log('  PUBLIC URL (use on ALL phones, any Wi‑Fi / 4G):');
console.log(`  ${tunnel.url}`);
console.log('══════════════════════════════════════════════════');
console.log('\n1. Phone → Settings → Cloud Sync → paste URL above → Save');
console.log('2. Log out → log in again (same account on every phone)');
console.log('\nKeep this terminal open. URL changes if you restart the tunnel.\n');

tunnel.on('close', () => {
  console.log('Tunnel closed.');
  process.exit(0);
});

process.on('SIGINT', () => {
  tunnel.close();
});
