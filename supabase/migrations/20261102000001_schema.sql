-- =====================================================================
-- GZX Gaming Loyalty System — schema
-- All timestamps are timestamptz (stored in UTC). Business-day math uses
-- the Asia/Baghdad timezone (see app_tz()).
-- =====================================================================

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------
-- Enumerations (as CHECK-constrained text so they are easy to extend)
-- ---------------------------------------------------------------------

create or replace function public.app_tz() returns text
language sql immutable as $$ select 'Asia/Baghdad'::text $$;

-- ---------------------------------------------------------------------
-- staff_profiles
-- ---------------------------------------------------------------------
create table public.staff_profiles (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid not null unique references auth.users(id) on delete cascade,
  full_name     text not null check (char_length(btrim(full_name)) between 1 and 100),
  role          text not null default 'cashier' check (role in ('super_admin', 'cashier')),
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- customers
-- ---------------------------------------------------------------------
create table public.customers (
  id               uuid primary key default gen_random_uuid(),
  name             text not null check (char_length(btrim(name)) between 1 and 100),
  phone            text check (phone is null or phone ~ '^\+?[0-9 ()-]{4,24}$'),
  notes            text check (notes is null or char_length(notes) <= 1000),
  active           boolean not null default true,
  last_visit_at    timestamptz,
  created_by       uuid references public.staff_profiles(id),
  idempotency_key  uuid unique,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index customers_name_trgm_idx on public.customers using gin (name extensions.gin_trgm_ops);
create index customers_phone_idx on public.customers (phone) where phone is not null;
create index customers_created_at_idx on public.customers (created_at desc);
create index customers_last_visit_idx on public.customers (last_visit_at desc nulls last);

-- ---------------------------------------------------------------------
-- loyalty_cards
--   unique_code : permanent six-letter lookup code (A-Z only)
--   qr_token    : opaque, unguessable token encoded in the QR (no PII)
--   status      : active | deactivated | replaced
-- Codes and tokens are never reused, even after a card is replaced.
-- ---------------------------------------------------------------------
create table public.loyalty_cards (
  id                  uuid primary key default gen_random_uuid(),
  customer_id         uuid not null references public.customers(id) on delete restrict,
  unique_code         char(6) not null unique check (unique_code ~ '^[A-Z]{6}$'),
  qr_token            text not null unique check (qr_token ~ '^[A-Za-z0-9_-]{32,64}$'),
  status              text not null default 'active' check (status in ('active', 'deactivated', 'replaced')),
  status_reason       text,
  created_at          timestamptz not null default now(),
  deactivated_at      timestamptz,
  check ((status = 'active') = (deactivated_at is null))
);
-- A customer has at most one current (non-replaced) card.
create unique index loyalty_cards_one_current_per_customer
  on public.loyalty_cards (customer_id) where status <> 'replaced';

-- ---------------------------------------------------------------------
-- loyalty_cycles
--   active    : collecting punches (0-2 recorded, or 0-3 transiently)
--   completed : 3/3 punches, reward available, waiting for redemption
--   redeemed  : reward used, cycle closed (kept forever for history)
-- punch_count is maintained only by add_paid_hour()/void_last_punch()
-- under a row lock, and is cross-checked against punch_transactions.
-- ---------------------------------------------------------------------
create table public.loyalty_cycles (
  id             uuid primary key default gen_random_uuid(),
  customer_id    uuid not null references public.customers(id) on delete restrict,
  card_id        uuid not null references public.loyalty_cards(id) on delete restrict,
  cycle_number   integer not null check (cycle_number >= 1),
  status         text not null default 'active' check (status in ('active', 'completed', 'redeemed')),
  punch_count    smallint not null default 0 check (punch_count between 0 and 3),
  started_at     timestamptz not null default now(),
  completed_at   timestamptz,
  closed_at      timestamptz,
  unique (customer_id, cycle_number),
  check (status <> 'active'    or (punch_count < 3 and completed_at is null and closed_at is null)),
  check (status <> 'completed' or (punch_count = 3 and completed_at is not null and closed_at is null)),
  check (status <> 'redeemed'  or (punch_count = 3 and completed_at is not null and closed_at is not null))
);
-- Exactly one open (active or completed) cycle per customer — and therefore per card.
create unique index loyalty_cycles_one_open_per_customer
  on public.loyalty_cycles (customer_id) where status in ('active', 'completed');
create index loyalty_cycles_card_idx on public.loyalty_cycles (card_id);

-- ---------------------------------------------------------------------
-- punch_transactions — one row = one verified paid gaming hour
-- ---------------------------------------------------------------------
create table public.punch_transactions (
  id                 uuid primary key default gen_random_uuid(),
  customer_id        uuid not null references public.customers(id) on delete restrict,
  card_id            uuid not null references public.loyalty_cards(id) on delete restrict,
  cycle_id           uuid not null references public.loyalty_cycles(id) on delete restrict,
  staff_id           uuid not null references public.staff_profiles(id),
  paid_hours         smallint not null default 1 check (paid_hours = 1),
  punch_number       smallint not null check (punch_number between 1 and 3),
  receipt_reference  text check (receipt_reference is null or char_length(receipt_reference) <= 64),
  notes              text check (notes is null or char_length(notes) <= 500),
  idempotency_key    uuid not null unique,
  created_at         timestamptz not null default now(),
  voided_at          timestamptz,
  voided_by          uuid references public.staff_profiles(id),
  void_reason        text,
  check ((voided_at is null) = (voided_by is null)),
  check (voided_at is null or char_length(btrim(coalesce(void_reason, ''))) >= 3)
);
-- At most one valid punch per slot (1, 2, 3) in a cycle => never more than 3.
create unique index punch_one_per_slot
  on public.punch_transactions (cycle_id, punch_number) where voided_at is null;
create index punch_customer_idx on public.punch_transactions (customer_id, created_at desc);
create index punch_created_idx on public.punch_transactions (created_at desc);

-- ---------------------------------------------------------------------
-- rewards — at most one per cycle
-- reward_type is extensible ('free_hour_and_drink' today; the hour and
-- drink can later be redeemed as separate reward_redemptions.item rows).
-- ---------------------------------------------------------------------
create table public.rewards (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid not null references public.customers(id) on delete restrict,
  cycle_id      uuid not null unique references public.loyalty_cycles(id) on delete restrict,
  reward_type   text not null default 'free_hour_and_drink',
  status        text not null default 'available' check (status in ('available', 'redeemed', 'void')),
  unlocked_at   timestamptz not null default now(),
  redeemed_at   timestamptz,
  check ((status = 'redeemed') = (redeemed_at is not null))
);
create index rewards_status_idx on public.rewards (status, unlocked_at desc);
create index rewards_customer_idx on public.rewards (customer_id);

-- ---------------------------------------------------------------------
-- reward_redemptions — one row per redeemed item of a reward
-- ---------------------------------------------------------------------
create table public.reward_redemptions (
  id               uuid primary key default gen_random_uuid(),
  reward_id        uuid not null references public.rewards(id) on delete restrict,
  customer_id      uuid not null references public.customers(id) on delete restrict,
  staff_id         uuid not null references public.staff_profiles(id),
  item             text not null default 'free_hour_and_drink'
                   check (item in ('free_hour_and_drink', 'free_hour', 'free_drink')),
  idempotency_key  uuid not null unique,
  created_at       timestamptz not null default now(),
  unique (reward_id, item)
);
create index redemptions_created_idx on public.reward_redemptions (created_at desc);

-- ---------------------------------------------------------------------
-- audit_logs — append-only record of every action (also drives history)
-- ---------------------------------------------------------------------
create table public.audit_logs (
  id           bigint generated always as identity primary key,
  actor_id     uuid references public.staff_profiles(id),
  customer_id  uuid references public.customers(id),
  action       text not null,
  metadata     jsonb not null default '{}'::jsonb,
  reason       text,
  created_at   timestamptz not null default now()
);
create index audit_customer_idx on public.audit_logs (customer_id, created_at desc);
create index audit_created_idx on public.audit_logs (created_at desc);

-- ---------------------------------------------------------------------
-- application_settings
-- ---------------------------------------------------------------------
create table public.application_settings (
  id             uuid primary key default gen_random_uuid(),
  setting_key    text not null unique check (setting_key ~ '^[a-z0-9_]{2,64}$'),
  setting_value  jsonb not null,
  updated_at     timestamptz not null default now(),
  updated_by     uuid references public.staff_profiles(id)
);

insert into public.application_settings (setting_key, setting_value) values
  ('lounge_name',             '"GZX Gaming"'),
  ('reward_label',            '"1 FREE HOUR + 1 FREE DRINK"'),
  ('card_tagline',            '"Get the 4th hour FREE + DRINK"'),
  ('lookup_limit_per_minute', '20'),
  ('lookup_failures_per_10min', '15');

-- ---------------------------------------------------------------------
-- lookup_attempts — used for lookup rate limiting / enumeration defense
-- ---------------------------------------------------------------------
create table public.lookup_attempts (
  id            bigint generated always as identity primary key,
  staff_id      uuid not null references public.staff_profiles(id) on delete cascade,
  method        text not null check (method in ('code', 'qr')),
  success       boolean not null,
  attempted_at  timestamptz not null default now()
);
create index lookup_attempts_staff_time_idx on public.lookup_attempts (staff_id, attempted_at desc);

-- =====================================================================
-- Immutability guards: history cannot be edited or deleted, even by the
-- service role. Only the void_* columns of a punch may be set, once.
-- =====================================================================
create or replace function public.forbid_mutation() returns trigger
language plpgsql as $$
begin
  raise exception 'IMMUTABLE: % rows cannot be %', tg_table_name, lower(tg_op)
    using errcode = 'P0001';
end $$;

create trigger audit_logs_immutable before update or delete on public.audit_logs
  for each row execute function public.forbid_mutation();
create trigger redemptions_immutable before update or delete on public.reward_redemptions
  for each row execute function public.forbid_mutation();
create trigger punches_no_delete before delete on public.punch_transactions
  for each row execute function public.forbid_mutation();
create trigger cycles_no_delete before delete on public.loyalty_cycles
  for each row execute function public.forbid_mutation();
create trigger rewards_no_delete before delete on public.rewards
  for each row execute function public.forbid_mutation();
create trigger cards_no_delete before delete on public.loyalty_cards
  for each row execute function public.forbid_mutation();
create trigger customers_no_delete before delete on public.customers
  for each row execute function public.forbid_mutation();

create or replace function public.guard_punch_update() returns trigger
language plpgsql as $$
begin
  if old.voided_at is not null then
    raise exception 'IMMUTABLE: punch already voided' using errcode = 'P0001';
  end if;
  if (new.id, new.customer_id, new.card_id, new.cycle_id, new.staff_id, new.paid_hours,
      new.punch_number, new.receipt_reference, new.notes, new.idempotency_key, new.created_at)
     is distinct from
     (old.id, old.customer_id, old.card_id, old.cycle_id, old.staff_id, old.paid_hours,
      old.punch_number, old.receipt_reference, old.notes, old.idempotency_key, old.created_at) then
    raise exception 'IMMUTABLE: only void fields of a punch can change' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger punches_guard_update before update on public.punch_transactions
  for each row execute function public.guard_punch_update();

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  if (new.name, new.phone, new.notes, new.active) is distinct from (old.name, old.phone, old.notes, old.active) then
    new.updated_at := now();
  end if;
  return new;
end $$;
create trigger customers_touch before update on public.customers
  for each row execute function public.touch_updated_at();
