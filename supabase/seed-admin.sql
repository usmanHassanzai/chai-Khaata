-- Run in Supabase SQL Editor ONLY if /api/health bootstrap fails
-- Creates admin: usmankhan14700@gmail.com / password: admin123
-- Change password later in the app after first login

insert into public.users (
  id,
  username,
  email,
  phone,
  password_hash,
  shop_name,
  status,
  role,
  created_at,
  approved_at,
  payment_due,
  payment_due_note
) values (
  'admin-chai-khata-001',
  'admin',
  'usmankhan14700@gmail.com',
  '03462204903',
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
  'Chai Khata Admin',
  'approved',
  'admin',
  now(),
  now(),
  0,
  ''
)
on conflict (id) do update set
  email = excluded.email,
  password_hash = excluded.password_hash,
  status = 'approved',
  role = 'admin',
  approved_at = now();
