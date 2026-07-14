#!/usr/bin/env node
/**
 * Create local admin for development (file storage).
 * Run: npm run seed:local-admin
 */
import bcrypt from 'bcryptjs';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: join(root, '.env') });

const DATA_DIR = join(root, 'server', 'data');
const USERS_FILE = join(DATA_DIR, 'users.json');
const email = (process.env.ADMIN_EMAIL || 'usmankhan14700@gmail.com').trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD || 'admin123';

await mkdir(DATA_DIR, { recursive: true });

let users = [];
try {
  users = JSON.parse(await readFile(USERS_FILE, 'utf8'));
} catch {
  users = [];
}

const passwordHash = await bcrypt.hash(password, 10);
const existing = users.find((u) => u.role === 'admin' || u.email === email);

if (existing) {
  existing.email = email;
  existing.passwordHash = passwordHash;
  existing.status = 'approved';
  existing.role = 'admin';
  existing.username = existing.username || 'admin';
  existing.shopName = existing.shopName || 'Patiwala Admin';
  existing.approvedAt = existing.approvedAt || new Date().toISOString();
} else {
  users.push({
    id: 'admin-local-001',
    username: 'admin',
    email,
    phone: '03462204903',
    passwordHash,
    shopName: 'Patiwala Admin',
    status: 'approved',
    role: 'admin',
    createdAt: new Date().toISOString(),
    approvedAt: new Date().toISOString(),
    paymentDue: 0,
  });
}

await writeFile(USERS_FILE, JSON.stringify(users, null, 2));
console.log(`\n✓ Local admin ready`);
console.log(`  Email:    ${email}`);
console.log(`  Username: admin`);
console.log(`  Password: ${password}`);
console.log(`\nNow run: npm run dev`);
console.log(`Open:    http://localhost:5173/login\n`);
