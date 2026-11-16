-- NORTAGO Order Subscription Engine schema smoke checks.
-- Run only after applying the migration to a disposable/staging database.
-- This script is read-only and does not create or mutate business data.

do $$
declare
  v_monthly bigint;
  v_yearly bigint;
  v_rls boolean;
begin
  select amount_idr into v_monthly
  from public.subscription_plans
  where plan_code = 'NORTAGO_OUTLET_MONTHLY' and is_active = true;

  select amount_idr into v_yearly
  from public.subscription_plans
  where plan_code = 'NORTAGO_OUTLET_YEARLY' and is_active = true;

  if v_monthly is distinct from 50000 then
    raise exception 'Expected monthly outlet plan price 50000 IDR; got %', v_monthly;
  end if;

  if v_yearly is distinct from 500000 then
    raise exception 'Expected yearly outlet plan price 500000 IDR; got %', v_yearly;
  end if;

  select relrowsecurity into v_rls
  from pg_class
  where oid = 'public.subscription_payments'::regclass;

  if v_rls is distinct from true then
    raise exception 'RLS must be enabled on subscription_payments';
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'outlet_subscriptions'
      and indexname = 'outlet_subscriptions_one_current_per_outlet_uidx'
  ) then
    raise exception 'Missing one-current-subscription-per-outlet unique index';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.outlet_subscriptions'::regclass
      and tgname = 'outlet_subscriptions_business_guard'
      and not tgisinternal
  ) then
    raise exception 'Missing outlet/business consistency trigger';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'subscription_payments'
      and roles && array['anon','authenticated']::name[]
  ) then
    raise exception 'subscription_payments must not expose client-facing RLS policies';
  end if;


  if to_regprocedure('public.nortago_create_customer_order(uuid,text,text,text,jsonb,text,timestamp with time zone,text,text)') is null then
    raise exception 'Missing atomic server-priced customer checkout RPC';
  end if;

  if to_regprocedure('public.nortago_get_customer_receipt(uuid)') is null then
    raise exception 'Missing capability-token receipt RPC';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'otc_orders'
      and column_name = 'receipt_access_token'
  ) then
    raise exception 'Missing private receipt access token column';
  end if;


  if not exists (
    select 1 from pg_proc
    where oid = 'public.nortago_check_outlet_business()'::regprocedure
  ) then
    raise exception 'Missing outlet/business consistency trigger function';
  end if;

  if not exists (
    select 1 from pg_proc
    where oid = 'public.nortago_create_customer_order(uuid,text,text,text,jsonb,text,timestamp with time zone,text,text)'::regprocedure
      and prosecdef = true
  ) then
    raise exception 'Customer checkout RPC must be SECURITY DEFINER';
  end if;

  if not has_function_privilege('anon', 'public.nortago_create_customer_order(uuid,text,text,text,jsonb,text,timestamp with time zone,text,text)', 'EXECUTE') then
    raise exception 'Anonymous customer checkout RPC is not executable';
  end if;

  if not has_function_privilege('anon', 'public.nortago_get_customer_receipt(uuid)', 'EXECUTE') then
    raise exception 'Anonymous receipt RPC is not executable';
  end if;


  if to_regclass('public.otc_reservations') is null then
    raise exception 'Missing persistent Dine-In reservation table';
  end if;

  if to_regprocedure('public.nortago_create_customer_reservation(uuid,text,text,timestamp with time zone,integer,text)') is null then
    raise exception 'Missing customer reservation RPC';
  end if;

  if not has_function_privilege('anon', 'public.nortago_create_customer_reservation(uuid,text,text,timestamp with time zone,integer,text)', 'EXECUTE') then
    raise exception 'Anonymous customer reservation RPC is not executable';
  end if;

  if not exists (
    select 1 from pg_class
    where oid = 'public.otc_reservations'::regclass and relrowsecurity = true
  ) then
    raise exception 'RLS must be enabled on otc_reservations';
  end if;

  raise notice 'NORTAGO subscription, checkout, receipt, and reservation smoke checks passed';
end;
$$;
