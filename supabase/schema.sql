-- Chai Khata — run in Supabase SQL Editor (https://supabase.com/dashboard)
-- Project → SQL → New query → paste → Run

create table if not exists public.users (
  id text primary key,
  username text not null,
  email text not null,
  phone text default '',
  password_hash text not null,
  registration_password text,
  shop_name text default '',
  status text not null default 'pending',
  role text not null default 'user',
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  payment_due numeric not null default 0,
  payment_due_note text default '',
  last_paid_at timestamptz,
  registration_fee numeric,
  payment_fee_date text,
  subscription_plan text,
  subscription_starts_at timestamptz,
  subscription_expires_at timestamptz,
  signup_snapshot jsonb,
  payment_ref_id text,
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  last_expiry_reminder_date text
);

-- Migration for existing projects (run if table already exists):
-- alter table public.users add column if not exists payment_ref_id text;
-- alter table public.users add column if not exists trial_started_at timestamptz;
-- alter table public.users add column if not exists trial_ends_at timestamptz;

create unique index if not exists users_username_lower_idx on public.users (lower(username));
create unique index if not exists users_email_lower_idx on public.users (lower(email));
create index if not exists users_role_idx on public.users (role);
create index if not exists users_status_idx on public.users (status);

create table if not exists public.otps (
  user_id text primary key references public.users (id) on delete cascade,
  otp text not null,
  channel text not null,
  sent_to text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists otps_expires_at_idx on public.otps (expires_at);

create table if not exists public.payment_submissions (
  id text primary key,
  user_id text not null references public.users (id) on delete cascade,
  username text not null,
  email text not null,
  phone text default '',
  payment_due numeric not null default 0,
  subscription_plan text,
  kind text default 'payment_due',
  screenshot text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reject_note text
);

create index if not exists payment_submissions_user_status_idx
  on public.payment_submissions (user_id, status);
create index if not exists payment_submissions_status_created_idx
  on public.payment_submissions (status, created_at desc);

create table if not exists public.ledger_snapshots (
  user_id text primary key references public.users (id) on delete cascade,
  updated_at timestamptz not null,
  payload jsonb not null default '{}'::jsonb
);

create index if not exists ledger_snapshots_updated_at_idx on public.ledger_snapshots (updated_at);

-- Server uses service_role key (bypasses RLS). No public access needed.
alter table public.users enable row level security;
alter table public.otps enable row level security;
alter table public.payment_submissions enable row level security;
alter table public.ledger_snapshots enable row level security;
