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
create index if not exists users_role_status_created_idx on public.users (role, status, created_at desc);

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

-- Normalized per-user ledger tables (row-level sync; replaces snapshot-only storage)
create table if not exists public.ledger_dealers (
  user_id text not null references public.users (id) on delete cascade,
  id bigint not null,
  name text not null,
  phone text default '',
  address text default '',
  opening_due numeric not null default 0,
  removed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.ledger_customers (
  user_id text not null references public.users (id) on delete cascade,
  id bigint not null,
  customer_id text not null,
  name text not null,
  phone text default '',
  address text default '',
  profile_picture text,
  notes text default '',
  register_date text,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.ledger_purchases (
  user_id text not null references public.users (id) on delete cascade,
  id bigint not null,
  date text not null,
  dealer_id bigint not null,
  tea_name text not null,
  bags_ordered numeric not null default 0,
  bags_received numeric not null default 0,
  bag_weight_kg numeric not null default 0,
  miss_weight_kg numeric not null default 0,
  price_per_kg numeric not null default 0,
  deposit_paid numeric not null default 0,
  bill_image text,
  notes text default '',
  cont_no text,
  lot_no text,
  country text,
  grade text,
  invoice_number text,
  previous_bags_received numeric,
  previous_receive_date text,
  last_received_at timestamptz,
  last_received_bags numeric,
  last_received_kg numeric,
  receive_receipt_image text,
  previous_deposit_paid numeric,
  last_payment_amount numeric,
  last_payment_at timestamptz,
  payment_receipt_image text,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.ledger_sales (
  user_id text not null references public.users (id) on delete cascade,
  id bigint not null,
  date text not null,
  tea_name text not null,
  quantity_kg numeric not null default 0,
  bags_sold numeric,
  bag_weight_kg numeric,
  sale_price_per_kg numeric not null default 0,
  purchase_price_per_kg numeric,
  customer_id bigint,
  amount_received numeric not null default 0,
  bill_image text,
  notes text default '',
  last_payment_at timestamptz,
  payment_receipt_image text,
  previous_amount_received numeric,
  last_payment_amount numeric,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.ledger_payments (
  user_id text not null references public.users (id) on delete cascade,
  id bigint not null,
  date text not null,
  customer_id bigint,
  dealer_id bigint,
  amount numeric not null default 0,
  note text default '',
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.ledger_settings (
  user_id text primary key references public.users (id) on delete cascade,
  id text not null default 'settings',
  low_stock_threshold_kg numeric not null default 50,
  language text not null default 'ur-roman',
  shop_name text,
  shop_logo text,
  shop_phone text,
  shop_address text,
  updated_at timestamptz not null default now()
);

create index if not exists ledger_dealers_user_updated_idx on public.ledger_dealers (user_id, updated_at desc);
create index if not exists ledger_customers_user_updated_idx on public.ledger_customers (user_id, updated_at desc);
create index if not exists ledger_purchases_user_updated_idx on public.ledger_purchases (user_id, updated_at desc);
create index if not exists ledger_sales_user_updated_idx on public.ledger_sales (user_id, updated_at desc);
create index if not exists ledger_payments_user_updated_idx on public.ledger_payments (user_id, updated_at desc);

-- Server uses service_role key (bypasses RLS). No public access needed.
alter table public.users enable row level security;
alter table public.otps enable row level security;
alter table public.payment_submissions enable row level security;
alter table public.ledger_snapshots enable row level security;
alter table public.ledger_dealers enable row level security;
alter table public.ledger_customers enable row level security;
alter table public.ledger_purchases enable row level security;
alter table public.ledger_sales enable row level security;
alter table public.ledger_payments enable row level security;
alter table public.ledger_settings enable row level security;

-- Dues payment on customer sales (run once if table already exists)
alter table public.ledger_sales add column if not exists last_payment_at timestamptz;
alter table public.ledger_sales add column if not exists payment_receipt_image text;
alter table public.ledger_sales add column if not exists previous_amount_received numeric;
alter table public.ledger_sales add column if not exists last_payment_amount numeric;

-- Maal receipt history on dealer purchases (run once if table already exists)
alter table public.ledger_purchases add column if not exists previous_bags_received numeric;
alter table public.ledger_purchases add column if not exists previous_receive_date text;
alter table public.ledger_purchases add column if not exists last_received_at timestamptz;
alter table public.ledger_purchases add column if not exists last_received_bags numeric;
alter table public.ledger_purchases add column if not exists last_received_kg numeric;
alter table public.ledger_purchases add column if not exists receive_receipt_image text;
alter table public.ledger_purchases add column if not exists previous_deposit_paid numeric;
alter table public.ledger_purchases add column if not exists last_payment_amount numeric;
alter table public.ledger_purchases add column if not exists last_payment_at timestamptz;
alter table public.ledger_purchases add column if not exists payment_receipt_image text;

-- Payment ledger rows linked to sales / purchases (each dues payment = new row)
alter table public.ledger_payments add column if not exists sale_id bigint;
alter table public.ledger_payments add column if not exists purchase_id bigint;
alter table public.ledger_payments add column if not exists paid_at timestamptz;
alter table public.ledger_payments add column if not exists receipt_image text;
alter table public.ledger_payments add column if not exists previous_paid numeric;
alter table public.ledger_payments add column if not exists balance_after numeric;

create index if not exists ledger_payments_sale_idx on public.ledger_payments (user_id, sale_id);
create index if not exists ledger_payments_purchase_idx on public.ledger_payments (user_id, purchase_id);
