-- Run in Supabase SQL Editor if setup fails with "payment_ref_id" missing
-- (New projects: prefer running the full supabase/schema.sql instead)

alter table public.users add column if not exists payment_ref_id text;
alter table public.users add column if not exists trial_started_at timestamptz;
alter table public.users add column if not exists trial_ends_at timestamptz;
alter table public.users add column if not exists last_expiry_reminder_date text;
