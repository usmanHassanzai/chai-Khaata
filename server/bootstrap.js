import bcrypt from 'bcryptjs';
import { ensureDefaultAdmin } from './store.js';
import { isSupabaseEnabled } from './supabase.js';

let bootstrapped = false;

/** Creates default admin in Supabase/file store on first API call. */
export async function ensureBootstrapAdmin() {
  if (!isSupabaseEnabled()) {
    return { ok: true, storage: 'file', skipped: true };
  }

  if (bootstrapped) {
    return { ok: true, storage: 'supabase', skipped: true };
  }

  const adminEmail = String(process.env.ADMIN_EMAIL || 'usmankhan14700@gmail.com').trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const passwordHash = await bcrypt.hash(adminPassword, 10);
  const admin = await ensureDefaultAdmin(adminEmail, passwordHash);

  bootstrapped = true;
  return {
    ok: true,
    storage: 'supabase',
    email: admin.email,
    username: admin.username,
    role: admin.role,
    status: admin.status,
  };
}
