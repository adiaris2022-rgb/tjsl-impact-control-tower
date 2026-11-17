-- NORTAGO Order: secure per-outlet subscription invoice creation and settlement.
-- Server-side billing only. Apply to staging first; never expose service-role credentials.

create table if not exists public.subscription_webhook_deliveries (
  delivery_id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now(),
  outcome text not null default 'RECEIVED'
);

alter table public.subscription_webhook_deliveries enable row level security;
revoke all on public.subscription_webhook_deliveries from public, anon, authenticated;

create or replace function public.nortago_prepare_subscription_invoice(
  p_business_id uuid,
  p_outlet_id uuid,
  p_plan_code text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_outlet public.otc_outlets%rowtype;
  v_plan public.subscription_plans%rowtype;
  v_subscription public.outlet_subscriptions%rowtype;
  v_invoice_id uuid;
  v_invoice_no text;
  v_payment_id uuid;
  v_idempotency text;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.has_business_role(p_business_id, array['OWNER','PROGRAM_MANAGER']) then
    raise exception 'BILLING_FORBIDDEN';
  end if;

  select * into v_outlet from public.otc_outlets
  where id = p_outlet_id and business_id = p_business_id and is_active = true;
  if not found then raise exception 'OUTLET_NOT_FOUND_OR_INACTIVE'; end if;

  select * into v_plan from public.subscription_plans
  where plan_code = p_plan_code and is_active = true
    and effective_from <= now()
    and (effective_until is null or effective_until > now());
  if not found then raise exception 'PLAN_NOT_AVAILABLE'; end if;

  select * into v_subscription from public.outlet_subscriptions
  where outlet_id = p_outlet_id
    and status in ('PENDING','TRIALING','ACTIVE','PAST_DUE','SUSPENDED')
  order by created_at desc limit 1 for update;

  if not found then
    insert into public.outlet_subscriptions
      (business_id,outlet_id,plan_id,status,auto_renew)
    values (p_business_id,p_outlet_id,v_plan.id,'PENDING',false)
    returning * into v_subscription;
  else
    update public.outlet_subscriptions
      set plan_id = v_plan.id, updated_at = now()
      where id = v_subscription.id
      returning * into v_subscription;
  end if;

  v_invoice_no := 'NGSUB-' || to_char(clock_timestamp(),'YYYYMMDDHH24MISS') || '-' ||
    upper(substr(replace(gen_random_uuid()::text,'-',''),1,10));
  v_idempotency := v_invoice_no;

  insert into public.subscription_invoices
    (business_id,outlet_id,subscription_id,invoice_no,amount_idr,currency,status,due_at)
  values
    (p_business_id,p_outlet_id,v_subscription.id,v_invoice_no,v_plan.amount_idr,'IDR','OPEN',now()+interval '1 day')
  returning id into v_invoice_id;

  insert into public.subscription_payments
    (invoice_id,provider,idempotency_key,amount_idr,currency,status)
  values
    (v_invoice_id,'ORDERHERO_LINKBAYAR',v_idempotency,v_plan.amount_idr,'IDR','PENDING')
  returning id into v_payment_id;

  insert into public.subscription_events
    (business_id,outlet_id,subscription_id,invoice_id,event_type,actor_user_id,event_data)
  values
    (p_business_id,p_outlet_id,v_subscription.id,v_invoice_id,'INVOICE_CREATED',v_user,
     jsonb_build_object('plan_code',v_plan.plan_code,'amount_idr',v_plan.amount_idr));

  return jsonb_build_object(
    'invoice_id',v_invoice_id,'invoice_no',v_invoice_no,
    'payment_id',v_payment_id,'subscription_id',v_subscription.id,
    'business_id',p_business_id,'outlet_id',p_outlet_id,
    'plan_code',v_plan.plan_code,'billing_interval',v_plan.billing_interval,
    'amount_idr',v_plan.amount_idr,'currency','IDR'
  );
end;
$$;

create or replace function public.nortago_settle_subscription_payment(
  p_delivery_id text,
  p_event_type text,
  p_invoice_no text,
  p_provider_reference text,
  p_provider_status text,
  p_amount_idr bigint,
  p_currency text,
  p_provider_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_invoice public.subscription_invoices%rowtype;
  v_payment public.subscription_payments%rowtype;
  v_plan public.subscription_plans%rowtype;
  v_subscription public.outlet_subscriptions%rowtype;
  v_now timestamptz := now();
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_inserted integer;
begin
  if p_delivery_id is null or length(p_delivery_id) < 8 then raise exception 'INVALID_DELIVERY_ID'; end if;
  if p_event_type not in ('payment_request.paid','payment_request.cancelled','payment_request.expired') then
    raise exception 'UNSUPPORTED_EVENT';
  end if;

  insert into public.subscription_webhook_deliveries(delivery_id,event_type)
  values (p_delivery_id,p_event_type)
  on conflict (delivery_id) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    return jsonb_build_object('ok',true,'duplicate',true);
  end if;

  select * into v_invoice from public.subscription_invoices
  where invoice_no = p_invoice_no for update;
  if not found then raise exception 'INVOICE_NOT_FOUND'; end if;

  select * into v_payment from public.subscription_payments
  where invoice_id = v_invoice.id and provider = 'ORDERHERO_LINKBAYAR'
  for update;
  if not found then raise exception 'PAYMENT_RECORD_NOT_FOUND'; end if;

  if p_event_type = 'payment_request.paid' then
    if p_provider_status <> 'paid' or p_amount_idr <> v_invoice.amount_idr
      or p_currency <> 'IDR' then raise exception 'PROVIDER_PAYMENT_MISMATCH'; end if;

    if v_invoice.status = 'PAID' then
      update public.subscription_webhook_deliveries set outcome='ALREADY_SETTLED'
      where delivery_id=p_delivery_id;
      return jsonb_build_object('ok',true,'already_paid',true);
    end if;

    select * into v_subscription from public.outlet_subscriptions
    where id = v_invoice.subscription_id for update;
    select * into v_plan from public.subscription_plans
    where id = v_subscription.plan_id;

    v_period_start := case
      when v_subscription.current_period_end is not null
        and v_subscription.current_period_end > v_now
      then v_subscription.current_period_end
      else v_now end;
    v_period_end := case
      when v_plan.billing_interval='MONTHLY' then v_period_start + interval '1 month'
      else v_period_start + interval '1 year' end;

    update public.subscription_invoices
      set status='PAID', paid_at=v_now
      where id=v_invoice.id;
    update public.subscription_payments
      set status='VERIFIED', provider_reference=p_provider_reference,
          verified_at=v_now, provider_payload=coalesce(p_provider_payload,'{}'::jsonb)
      where id=v_payment.id;
    update public.outlet_subscriptions
      set status='ACTIVE', current_period_start=v_period_start,
          current_period_end=v_period_end, next_due_at=v_period_end,
          auto_renew=false, updated_at=v_now
      where id=v_subscription.id;
    insert into public.subscription_events
      (business_id,outlet_id,subscription_id,invoice_id,event_type,event_data)
    values
      (v_invoice.business_id,v_invoice.outlet_id,v_invoice.subscription_id,v_invoice.id,
       'PAYMENT_VERIFIED',jsonb_build_object('provider_reference',p_provider_reference,
       'amount_idr',p_amount_idr,'delivery_id',p_delivery_id,
       'period_start',v_period_start,'period_end',v_period_end));
    update public.subscription_webhook_deliveries set outcome='SETTLED'
      where delivery_id=p_delivery_id;
    return jsonb_build_object('ok',true,'activated_outlet_id',v_invoice.outlet_id,
      'period_start',v_period_start,'period_end',v_period_end);
  end if;

  if v_invoice.status <> 'PAID' then
    update public.subscription_invoices
      set status=case when p_event_type='payment_request.expired' then 'FAILED' else 'VOID' end
      where id=v_invoice.id;
    update public.subscription_payments set status='FAILED',
      provider_reference=coalesce(p_provider_reference,provider_reference),
      provider_payload=coalesce(p_provider_payload,'{}'::jsonb)
      where id=v_payment.id and status <> 'VERIFIED';
  end if;
  update public.subscription_webhook_deliveries set outcome=upper(replace(p_event_type,'.','_'))
    where delivery_id=p_delivery_id;
  return jsonb_build_object('ok',true,'updated',true);
end;
$$;

revoke all on function public.nortago_prepare_subscription_invoice(uuid,uuid,text) from public, anon;
grant execute on function public.nortago_prepare_subscription_invoice(uuid,uuid,text) to authenticated;
revoke all on function public.nortago_settle_subscription_payment(text,text,text,text,text,bigint,text,jsonb) from public, anon, authenticated;\ngrant execute on function public.nortago_settle_subscription_payment(text,text,text,text,text,bigint,text,jsonb) to service_role;
