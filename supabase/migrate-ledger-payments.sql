-- Fix: "column ledger_payments.sale_id does not exist"
-- Run once in Supabase → SQL Editor (safe to re-run)

-- Payment ledger rows linked to sales / purchases
alter table public.ledger_payments add column if not exists sale_id bigint;
alter table public.ledger_payments add column if not exists purchase_id bigint;
alter table public.ledger_payments add column if not exists paid_at timestamptz;
alter table public.ledger_payments add column if not exists receipt_image text;
alter table public.ledger_payments add column if not exists previous_paid numeric;
alter table public.ledger_payments add column if not exists balance_after numeric;

create index if not exists ledger_payments_sale_idx on public.ledger_payments (user_id, sale_id);
create index if not exists ledger_payments_purchase_idx on public.ledger_payments (user_id, purchase_id);

-- Related columns often missing on older projects
alter table public.ledger_sales add column if not exists last_payment_at timestamptz;
alter table public.ledger_sales add column if not exists payment_receipt_image text;
alter table public.ledger_sales add column if not exists previous_amount_received numeric;
alter table public.ledger_sales add column if not exists last_payment_amount numeric;
alter table public.ledger_sales add column if not exists history jsonb default '[]'::jsonb;

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
alter table public.ledger_purchases add column if not exists history jsonb default '[]'::jsonb;

alter table public.ledger_dealers add column if not exists history jsonb default '[]'::jsonb;
alter table public.ledger_customers add column if not exists history jsonb default '[]'::jsonb;
