import dotenv from 'dotenv';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: join(root, '.env') });

export const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
export const ADMIN_EMAIL = String(process.env.ADMIN_EMAIL || 'usmankhan14700@gmail.com').trim().toLowerCase();
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
export const PORT = Number(process.env.PORT) || 3001;
