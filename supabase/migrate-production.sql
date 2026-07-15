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
