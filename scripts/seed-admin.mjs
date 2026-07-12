/**
 * Seed admin user directly into Supabase (run locally with env vars set).
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... ADMIN_PASSWORD=admin123 node scripts/seed-admin.mjs
 */
import bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = (process.env.ADMIN_EMAIL || 'usmankhan14700@gmail.com').trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD || 'admin123';

if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const passwordHash = bcrypt.hashSync(password, 10);

const row = {
  id: 'admin-chai-khata-001',
  username: 'admin',
  email,
  phone: '03462204903',
  password_hash: passwordHash,
  shop_name: 'Chai Khata Admin',
  status: 'approved',
  role: 'admin',
  created_at: new Date().toISOString(),
  approved_at: new Date().toISOString(),
  payment_due: 0,
  payment_due_note: '',
};

const { data, error } = await supabase.from('users').upsert(row, { onConflict: 'id' }).select('*').single();

if (error) {
  console.error('Failed:', error.message);
  if (error.message?.includes('row-level security') || error.code === '42501') {
    console.error('Use the Secret (service_role) key, not Publishable key.');
  }
  process.exit(1);
}

console.log('Admin created:', { email: data.email, username: data.username, role: data.role });
console.log('Login password:', password);
