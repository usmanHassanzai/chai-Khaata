#!/usr/bin/env node
/**
 * Starts auth server + Vite together (no extra packages needed).
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORTS = [3001, 5173, 5174];

if (!existsSync(join(root, 'node_modules'))) {
  console.error('\n❌ node_modules not found. Run this first:\n   npm install\n');
  process.exit(1);
}

const viteBin = join(root, 'node_modules', 'vite', 'bin', 'vite.js');
if (!existsSync(viteBin)) {
  console.error('\n❌ Vite not installed. Run:\n   npm install\n');
  process.exit(1);
}

function freePort(port) {
  const fuser = spawnSync('fuser', [`${port}/tcp`], { encoding: 'utf8' });
  if (fuser.status !== 0) return;

  console.log(`   Port ${port} was busy — stopping old process...`);
  spawnSync('fuser', ['-k', `${port}/tcp`], { stdio: 'ignore' });
}

console.log('\n🍵 Chai Khata — starting auth server + web app...\n');

for (const port of PORTS) {
  freePort(port);
}

const children = [];
let stopping = false;

function run(name, command, args) {
  const child = spawn(command, args, {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
    shell: false,
  });

  child.on('exit', (code, signal) => {
    if (stopping) return;
    if (signal) {
      console.error(`\n[${name}] stopped (${signal})`);
    } else if (code && code !== 0) {
      console.error(`\n[${name}] exited with code ${code}`);
      if (name === 'auth' && code === 1) {
        console.error('Tip: Port 3001 may still be in use. Run: npm run free-ports\n');
      }
    }
    shutdown(code ?? 1);
  });

  child.on('error', (err) => {
    console.error(`\n[${name}] failed to start:`, err.message);
    shutdown(1);
  });

  children.push(child);
  return child;
}

function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    try {
      child.kill('SIGTERM');
    } catch {
      /* ignore */
    }
  }
  setTimeout(() => process.exit(code), 300);
}

process.on('SIGINT', () => {
  console.log('\nStopping...');
  shutdown(0);
});
process.on('SIGTERM', () => shutdown(0));

run('auth', process.execPath, ['server/index.js']);
run('web', process.execPath, [viteBin, '--host']);

console.log('   Auth API:  http://localhost:3001/api/health');
console.log('   Web app:   http://localhost:5173');
console.log('   Storage:   file (local) unless USE_FILE_STORAGE=false + valid Supabase\n');
