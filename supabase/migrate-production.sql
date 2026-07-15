-- Run this in Supabase → SQL Editor if registration fails on patiwala.pk
-- Safe to run multiple times (IF NOT EXISTS)

alter table public.users add column if not exists phone text default '';
alter table public.users add column if not exists registration_password text;
alter table public.users add column if not exists shop_name text default '';
alter table public.users add column if not exists payment_due numeric not null default 0;
alter table public.users add column if not exists payment_due_note text default '';
alter table public.users add column if not exists last_paid_at timestamptz;
alter table public.users add column if not exists registration_fee numeric;
alter table public.users add column if not exists payment_fee_date text;
alter table public.users add column if not exists subscription_plan text;
alter table public.users add column if not exists subscription_starts_at timestamptz;
alter table public.users add column if not exists subscription_expires_at timestamptz;
alter table public.users add column if not exists signup_snapshot jsonb;
alter table public.users add column if not exists payment_ref_id text;
alter table public.users add column if not exists trial_started_at timestamptz;
alter table public.users add column if not exists trial_ends_at timestamptz;
alter table public.users add column if not exists last_expiry_reminder_date text;
alter table public.users add column if not exists renewal_grace_ends_at timestamptz;

create unique index if not exists users_username_lower_idx on public.users (lower(username));
create unique index if not exists users_email_lower_idx on public.users (lower(email));

-- Performance indexes for 500+ concurrent users (safe to re-run)
create index if not exists users_status_role_idx on public.users (status, role);
create index if not exists users_created_at_desc_idx on public.users (created_at desc);
create index if not exists users_role_created_at_idx on public.users (role, created_at desc);
create index if not exists users_payment_ref_id_idx on public.users (payment_ref_id) where payment_ref_id is not null;

create index if not exists payment_submissions_status_created_idx on public.payment_submissions (status, created_at desc);
create index if not exists payment_submissions_user_status_idx on public.payment_submissions (user_id, status);

create index if not exists ledger_snapshots_user_id_idx on public.ledger_snapshots (user_id);

create index if not exists otps_expires_at_idx on public.otps (expires_at);
create index if not exists otps_user_id_idx on public.otps (user_id);
