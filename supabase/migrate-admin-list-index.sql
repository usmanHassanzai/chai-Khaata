-- Run in Supabase SQL Editor on existing projects (optional performance boost for admin list)
create index if not exists users_role_status_created_idx on public.users (role, status, created_at desc);
