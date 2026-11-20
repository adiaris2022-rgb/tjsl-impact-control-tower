-- Disposable functional smoke test for per-outlet subscription billing.
-- Creates pending invoices only; no payment provider calls or webhook settlement.
begin;
do $$
declare
  v_business_a uuid := gen_random_uuid();
  v_business_b uuid := gen_random_uuid();
  v_outlet_a uuid := gen_random_uuid();
  v_outlet_b uuid := gen_random_uuid();
  v_monthly jsonb;
  v_monthly_retry jsonb;
  v_yearly_switch jsonb;
  v_yearly_b jsonb;
  v_monthly_plan uuid;
  v_yearly_plan uuid;
  v_plan_id_a uuid;
  v_pending_plan_id_a uuid;
  v_plan_id_b uuid;
  v_pending_plan_id_b uuid;
  v_status_a text;
  v_status_b text;
  v_count integer;
begin
  create or replace function public.has_business_role(p_business_id uuid, p_roles text[])
  returns boolean language sql stable as $stub$ select true $stub$;

  select id into v_monthly_plan from public.subscription_plans
    where plan_code='NORTAGO_OUTLET_MONTHLY' and is_active=true;
  select id into v_yearly_plan from public.subscription_plans
    where plan_code='NORTAGO_OUTLET_YEARLY' and is_active=true;
  if v_monthly_plan is null or v_yearly_plan is null then
    raise exception 'Monthly and yearly subscription plans must exist';
  end if;

  insert into public.businesses(id) values(v_business_a),(v_business_b);
  insert into public.otc_outlets(id,business_id,name,is_active) values
    (v_outlet_a,v_business_a,'Subscription Smoke Outlet A',true),
    (v_outlet_b,v_business_b,'Subscription Smoke Outlet B',true);

  v_monthly := public.nortago_prepare_subscription_invoice(v_business_a,v_outlet_a,'NORTAGO_OUTLET_MONTHLY');
  if v_monthly->>'amount_idr' <> '50000'
    or v_monthly->>'plan_code' <> 'NORTAGO_OUTLET_MONTHLY'
    or v_monthly->>'outlet_id' <> v_outlet_a::text then
    raise exception 'Monthly invoice data mismatch for outlet A: %',v_monthly;
  end if;

  v_monthly_retry := public.nortago_prepare_subscription_invoice(v_business_a,v_outlet_a,'NORTAGO_OUTLET_MONTHLY');
  if v_monthly_retry->>'reused' is distinct from 'true'
    or v_monthly_retry->>'invoice_id' is distinct from v_monthly->>'invoice_id'
    or v_monthly_retry->>'subscription_id' is distinct from v_monthly->>'subscription_id' then
    raise exception 'Repeated invoice preparation must reuse the same open invoice/payment';
  end if;

  v_yearly_switch := public.nortago_prepare_subscription_invoice(v_business_a,v_outlet_a,'NORTAGO_OUTLET_YEARLY');
  if v_yearly_switch->>'amount_idr' <> '500000'
    or v_yearly_switch->>'plan_code' <> 'NORTAGO_OUTLET_YEARLY'
    or v_yearly_switch->>'subscription_id' is distinct from v_monthly->>'subscription_id' then
    raise exception 'Yearly plan switch must stage on the existing outlet subscription';
  end if;

  v_yearly_b := public.nortago_prepare_subscription_invoice(v_business_b,v_outlet_b,'NORTAGO_OUTLET_YEARLY');
  if v_yearly_b->>'amount_idr' <> '500000'
    or v_yearly_b->>'outlet_id' <> v_outlet_b::text
    or v_yearly_b->>'subscription_id' is not distinct from v_monthly->>'subscription_id' then
    raise exception 'Outlet B must receive a separate yearly subscription and invoice';
  end if;

  select plan_id,pending_plan_id,status into v_plan_id_a,v_pending_plan_id_a,v_status_a
  from public.outlet_subscriptions where outlet_id=v_outlet_a;
  if v_plan_id_a is distinct from v_monthly_plan
    or v_pending_plan_id_a is distinct from v_yearly_plan
    or v_status_a <> 'PENDING' then
    raise exception 'Outlet A plan change must remain staged and unpaid';
  end if;

  select plan_id,pending_plan_id,status into v_plan_id_b,v_pending_plan_id_b,v_status_b
  from public.outlet_subscriptions where outlet_id=v_outlet_b;
  if v_plan_id_b is distinct from v_yearly_plan
    or v_pending_plan_id_b is not null
    or v_status_b <> 'PENDING' then
    raise exception 'Outlet B yearly subscription must be isolated and unpaid';
  end if;

  select count(*) into v_count from public.outlet_subscriptions
    where outlet_id in (v_outlet_a,v_outlet_b);
  if v_count <> 2 then raise exception 'Expected exactly one subscription per outlet, got %',v_count; end if;

  select count(*) into v_count from public.subscription_invoices
    where outlet_id=v_outlet_a and status='OPEN';
  if v_count <> 2 then raise exception 'Outlet A should have monthly and yearly open invoices, got %',v_count; end if;
  select count(*) into v_count from public.subscription_invoices
    where outlet_id=v_outlet_b and status='OPEN';
  if v_count <> 1 then raise exception 'Outlet B should have one open invoice, got %',v_count; end if;

  select count(*) into v_count from public.subscription_payments p
    join public.subscription_invoices i on i.id=p.invoice_id
    where i.outlet_id in (v_outlet_a,v_outlet_b) and p.status='PENDING';
  if v_count <> 3 then raise exception 'Expected three pending invoice payment records, got %',v_count; end if;

  if exists (select 1 from public.subscription_payments p
    join public.subscription_invoices i on i.id=p.invoice_id
    where i.outlet_id in (v_outlet_a,v_outlet_b) and p.status <> 'PENDING') then
    raise exception 'Subscription smoke test must not verify payment or activate billing';
  end if;
  if exists (select 1 from public.subscription_webhook_deliveries) then
    raise exception 'No webhook delivery should be created by invoice preparation';
  end if;
end $$;
rollback;
