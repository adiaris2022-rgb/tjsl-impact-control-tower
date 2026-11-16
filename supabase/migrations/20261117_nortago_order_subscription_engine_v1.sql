-- NORTAGO Order Subscription Engine foundation
-- Per-outlet billing. Safe to review; do not apply to production without approval.
-- Prices are integer IDR. Payment verification remains server-controlled.

create table if not exists public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  plan_code text not null unique,
  billing_interval text not null check (billing_interval in ('MONTHLY','YEARLY')),
  amount_idr bigint not null check (amount_idr > 0),
  currency char(3) not null default 'IDR' check (currency = 'IDR'),
  entitlements jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  effective_from timestamptz not null default now(),
  effective_until timestamptz,
  created_at timestamptz not null default now(),
  check (effective_until is null or effective_until > effective_from)
);

create table if not exists public.outlet_subscriptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  outlet_id uuid not null references public.otc_outlets(id) on delete restrict,
  plan_id uuid not null references public.subscription_plans(id) on delete restrict,
  status text not null default 'PENDING'
    check (status in ('PENDING','TRIALING','ACTIVE','PAST_DUE','SUSPENDED','CANCELED','EXPIRED')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  next_due_at timestamptz,
  grace_period_end timestamptz,
  auto_renew boolean not null default false,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (current_period_end is null or current_period_start is null or current_period_end > current_period_start),
  check (grace_period_end is null or next_due_at is null or grace_period_end >= next_due_at)
);

create unique index if not exists outlet_subscriptions_one_current_per_outlet_uidx
  on public.outlet_subscriptions(outlet_id)
  where status in ('PENDING','TRIALING','ACTIVE','PAST_DUE','SUSPENDED');
create index if not exists outlet_subscriptions_business_idx
  on public.outlet_subscriptions(business_id, created_at desc);
create index if not exists outlet_subscriptions_due_idx
  on public.outlet_subscriptions(status, next_due_at);

create table if not exists public.subscription_invoices (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  outlet_id uuid not null references public.otc_outlets(id) on delete restrict,
  subscription_id uuid not null references public.outlet_subscriptions(id) on delete restrict,
  invoice_no text not null unique,
  amount_idr bigint not null check (amount_idr >= 0),
  currency char(3) not null default 'IDR' check (currency = 'IDR'),
  period_start timestamptz,
  period_end timestamptz,
  status text not null default 'OPEN'
    check (status in ('DRAFT','OPEN','PAID','FAILED','VOID','REFUNDED')),
  due_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  check (period_end is null or period_start is null or period_end > period_start)
);
create index if not exists subscription_invoices_outlet_idx
  on public.subscription_invoices(outlet_id, created_at desc);

create table if not exists public.subscription_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.subscription_invoices(id) on delete restrict,
  provider text not null,
  provider_reference text,
  idempotency_key text not null unique,
  amount_idr bigint not null check (amount_idr >= 0),
  currency char(3) not null default 'IDR' check (currency = 'IDR'),
  status text not null default 'PENDING'
    check (status in ('PENDING','VERIFIED','FAILED','REFUNDED')),
  verified_at timestamptz,
  provider_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(provider, provider_reference)
);

create table if not exists public.subscription_events (
  id bigint generated always as identity primary key,
  business_id uuid not null references public.businesses(id) on delete restrict,
  outlet_id uuid not null references public.otc_outlets(id) on delete restrict,
  subscription_id uuid references public.outlet_subscriptions(id) on delete restrict,
  invoice_id uuid references public.subscription_invoices(id) on delete restrict,
  event_type text not null,
  actor_user_id uuid,
  event_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists subscription_events_outlet_created_idx
  on public.subscription_events(outlet_id, created_at desc);

-- Enforce tenant/outlet consistency even for privileged server-side writes.
create or replace function public.nortago_check_outlet_business()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.otc_outlets o
    where o.id = new.outlet_id and o.business_id = new.business_id
  ) then
    raise exception 'outlet_id does not belong to business_id';
  end if;
  return new;
end;
$$;

drop trigger if exists outlet_subscriptions_business_guard on public.outlet_subscriptions;
create trigger outlet_subscriptions_business_guard
before insert or update of business_id, outlet_id on public.outlet_subscriptions
for each row execute function public.nortago_check_outlet_business();

drop trigger if exists subscription_invoices_business_guard on public.subscription_invoices;
create trigger subscription_invoices_business_guard
before insert or update of business_id, outlet_id on public.subscription_invoices
for each row execute function public.nortago_check_outlet_business();

drop trigger if exists subscription_events_business_guard on public.subscription_events;
create trigger subscription_events_business_guard
before insert or update of business_id, outlet_id on public.subscription_events
for each row execute function public.nortago_check_outlet_business();

alter table public.subscription_plans enable row level security;
alter table public.outlet_subscriptions enable row level security;
alter table public.subscription_invoices enable row level security;
alter table public.subscription_payments enable row level security;
alter table public.subscription_events enable row level security;

-- Plans are public catalog metadata; no client write access.
drop policy if exists subscription_plans_read_active on public.subscription_plans;
create policy subscription_plans_read_active on public.subscription_plans
  for select to anon, authenticated using (is_active = true);

-- Business owners/managers can read only their own billing records.
-- All writes remain server-side until trusted billing endpoints/webhooks exist.
drop policy if exists outlet_subscriptions_owner_read on public.outlet_subscriptions;
create policy outlet_subscriptions_owner_read on public.outlet_subscriptions
  for select to authenticated
  using (public.has_business_role(business_id, array['OWNER','PROGRAM_MANAGER']));

drop policy if exists subscription_invoices_owner_read on public.subscription_invoices;
create policy subscription_invoices_owner_read on public.subscription_invoices
  for select to authenticated
  using (public.has_business_role(business_id, array['OWNER','PROGRAM_MANAGER']));

drop policy if exists subscription_events_owner_read on public.subscription_events;
create policy subscription_events_owner_read on public.subscription_events
  for select to authenticated
  using (public.has_business_role(business_id, array['OWNER','PROGRAM_MANAGER']));

-- Intentionally no anon/authenticated policies for subscription_payments:
-- payment records and provider payloads are server-only.
-- Intentionally no client write policies on subscription tables.
