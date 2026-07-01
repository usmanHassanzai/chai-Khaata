import { randomInt } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as sb from './persistence/supabase.js';
import { isSupabaseEnabled } from './supabase.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');
const OTPS_FILE = join(DATA_DIR, 'otps.json');

const OTP_TTL_MS = 10 * 60 * 1000;

/** @typedef {'email' | 'phone'} OtpChannel */

/**
 * @typedef {Object} OtpRecord
 * @property {string} userId
 * @property {string} otp
 * @property {OtpChannel} channel
 * @property {string} sentTo
 * @property {string} expiresAt
 * @property {string} createdAt
 */

async function ensureOtpsFile() {
  await mkdir(DATA_DIR, { recursive: true });
  try {
    await readFile(OTPS_FILE, 'utf8');
  } catch {
    await writeFile(OTPS_FILE, '[]', 'utf8');
  }
}

/** @returns {Promise<OtpRecord[]>} */
async function readOtps() {
  await ensureOtpsFile();
  const raw = await readFile(OTPS_FILE, 'utf8');
  return JSON.parse(raw);
}

/** @param {OtpRecord[]} otps */
async function writeOtps(otps) {
  await ensureOtpsFile();
  await writeFile(OTPS_FILE, JSON.stringify(otps, null, 2), 'utf8');
}

export function generateOtp() {
  return String(randomInt(100000, 999999));
}

/** @param {string} userId @param {OtpChannel} channel @param {string} sentTo */
export async function createOtp(userId, channel, sentTo) {
  const record = {
    userId,
    otp: generateOtp(),
    channel,
    sentTo,
    expiresAt: new Date(Date.now() + OTP_TTL_MS).toISOString(),
    createdAt: new Date().toISOString(),
  };

  if (isSupabaseEnabled()) return sb.sbCreateOtp(record);

  const otps = await readOtps();

  const filtered = otps.filter((o) => o.userId !== userId);
  filtered.push(record);
  await writeOtps(filtered);
  return record;
}

/** @param {string} userId @param {string} otp */
export async function verifyOtp(userId, otp) {
  if (isSupabaseEnabled()) {
    const record = await sb.sbGetOtp(userId);
    if (!record) return { valid: false, reason: 'NO_OTP' };
    if (new Date(record.expiresAt) < new Date()) {
      await sb.sbDeleteOtp(userId);
      return { valid: false, reason: 'EXPIRED' };
    }
    if (record.otp !== String(otp).trim()) {
      return { valid: false, reason: 'INVALID' };
    }
    return { valid: true, record };
  }

  const otps = await readOtps();
  const record = otps.find((o) => o.userId === userId);
  if (!record) return { valid: false, reason: 'NO_OTP' };
  if (new Date(record.expiresAt) < new Date()) {
    await writeOtps(otps.filter((o) => o.userId !== userId));
    return { valid: false, reason: 'EXPIRED' };
  }
  if (record.otp !== String(otp).trim()) {
    return { valid: false, reason: 'INVALID' };
  }
  return { valid: true, record };
}

/** @param {string} userId */
export async function clearOtp(userId) {
  if (isSupabaseEnabled()) {
    await sb.sbDeleteOtp(userId);
    return;
  }

  const otps = await readOtps();
  await writeOtps(otps.filter((o) => o.userId !== userId));
}

/** @returns {Promise<OtpRecord[]>} */
export async function listActiveOtps() {
  if (isSupabaseEnabled()) return sb.sbListActiveOtps();

  const otps = await readOtps();
  const now = new Date();
  const active = otps.filter((o) => new Date(o.expiresAt) > now);
  if (active.length !== otps.length) {
    await writeOtps(active);
  }
  return active;
}

/** @param {string} userId */
export async function getOtpForUser(userId) {
  const otps = await listActiveOtps();
  return otps.find((o) => o.userId === userId) ?? null;
}
