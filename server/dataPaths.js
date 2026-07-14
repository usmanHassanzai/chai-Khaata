import { access, copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLE_DATA_DIR = join(__dirname, 'data');

/** Vercel / AWS Lambda — filesystem under /var/task is read-only; use /tmp. */
export function isServerlessEnv() {
  return Boolean(
    process.env.VERCEL
    || process.env.AWS_LAMBDA_FUNCTION_NAME
    || process.env.LAMBDA_TASK_ROOT
    || (typeof process.cwd === 'function' && process.cwd().startsWith('/var/task')),
  );
}

/** Writable data directory (local disk or /tmp on serverless). */
export function getDataDir() {
  if (process.env.DATA_DIR?.trim()) return process.env.DATA_DIR.trim();
  if (isServerlessEnv()) return '/tmp/chai-khaata-data';
  return BUNDLE_DATA_DIR;
}

export function getBundleDataDir() {
  return BUNDLE_DATA_DIR;
}

let dataDirReady = false;

/** Create writable data dir; on serverless copy bundled JSON seeds once per instance. */
export async function ensureDataDir() {
  const dir = getDataDir();
  await mkdir(dir, { recursive: true });

  if (dataDirReady) return dir;
  dataDirReady = true;

  if (!isServerlessEnv() || dir === BUNDLE_DATA_DIR) return dir;

  const seeds = [
    { name: 'users.json', fallback: '[]' },
    { name: 'otps.json', fallback: '[]' },
    { name: 'payment-submissions.json', fallback: '[]' },
  ];

  for (const { name, fallback } of seeds) {
    const dest = join(dir, name);
    try {
      await access(dest);
      continue;
    } catch {
      /* copy or create */
    }
    try {
      await copyFile(join(BUNDLE_DATA_DIR, name), dest);
    } catch {
      await writeFile(dest, fallback, 'utf8');
    }
  }

  const ledgerBundle = join(BUNDLE_DATA_DIR, 'ledger');
  const ledgerDest = join(dir, 'ledger');
  await mkdir(ledgerDest, { recursive: true });
  try {
    const { readdir } = await import('node:fs/promises');
    const files = await readdir(ledgerBundle).catch(() => []);
    for (const file of files) {
      const destFile = join(ledgerDest, file);
      try {
        await access(destFile);
      } catch {
        try {
          await copyFile(join(ledgerBundle, file), destFile);
        } catch {
          /* ignore */
        }
      }
    }
  } catch {
    /* no bundled ledger */
  }

  return dir;
}

/** @param {string} filename e.g. users.json */
export function dataFile(filename) {
  return join(getDataDir(), filename);
}

/** @param {string} filename */
export async function readDataJson(filename, fallback = '[]') {
  await ensureDataDir();
  const path = dataFile(filename);
  try {
    return await readFile(path, 'utf8');
  } catch {
    await writeFile(path, fallback, 'utf8');
    return fallback;
  }
}

/** Ledger subfolder inside data dir */
export async function ensureLedgerDir() {
  const dir = join(getDataDir(), 'ledger');
  await mkdir(dir, { recursive: true });
  return dir;
}

export async function ledgerFile(userId) {
  const dir = await ensureLedgerDir();
  return join(dir, `${userId}.json`);
}
