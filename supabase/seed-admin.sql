-- Run in Supabase → SQL Editor → New query → Run
-- Creates admin immediately (no Vercel needed)
-- Login: usmankhan14700@gmail.com / admin123

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
