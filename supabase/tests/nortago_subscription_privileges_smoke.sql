-- NORTAGO ORDER subscription ACL regression.
-- Uses the PostgreSQL 17 creator-default fixture from the workflow.
-- Verifies actual role privileges and the exact direct reads/writes used by the UI/API.
begin;

do $nortago_subscription_acl_matrix$
declare
  v_table text;
  v_role text;
  v_policy text;
begin
  foreach v_table in array array[
    'subscription_plans',
    'outlet_subscriptions',
    'subscription_invoices',
    'subscription_payments',
    'subscription_events',
    'subscription_webhook_deliveries'
  ] loop
    if not (select relrowsecurity from pg_class where oid=format('public.%I',v_table)::regclass) then
      raise exception 'SUBSCRIPTION_RLS_DISABLED: %',v_table;
    end if;

    foreach v_role in array array['anon','authenticated','service_role'] loop
      if has_table_privilege(v_role,format('public.%I',v_table),'insert')
         or has_table_privilege(v_role,format('public.%I',v_table),'update')
         or has_table_privilege(v_role,format('public.%I',v_table),'delete')
         or has_table_privilege(v_role,format('public.%I',v_table),'truncate')
         or has_table_privilege(v_role,format('public.%I',v_table),'references')
         or has_table_privilege(v_role,format('public.%I',v_table),'trigger')
         or has_table_privilege(v_role,format('public.%I',v_table),'maintain') then
        raise exception 'SUBSCRIPTION_UNEXPECTED_TABLE_MUTATION_OR_DDL_PRIVILEGE: %, %',v_role,v_table;
      end if;
    end loop;
  end loop;

  if not has_table_privilege('anon','public.subscription_plans','select')
     or not has_table_privilege('authenticated','public.subscription_plans','select')
     or not has_table_privilege('authenticated','public.outlet_subscriptions','select')
     or has_table_privilege('anon','public.outlet_subscriptions','select') then
    raise exception 'SUBSCRIPTION_UI_SELECT_ALLOWLIST_MISMATCH';
  end if;

  if has_table_privilege('anon','public.subscription_invoices','select')
     or has_table_privilege('authenticated','public.subscription_invoices','select')
     or has_table_privilege('anon','public.subscription_payments','select')
     or has_table_privilege('authenticated','public.subscription_payments','select')
     or has_table_privilege('anon','public.subscription_events','select')
     or has_table_privilege('authenticated','public.subscription_events','select')
     or has_table_privilege('anon','public.subscription_webhook_deliveries','select')
     or has_table_privilege('authenticated','public.subscription_webhook_deliveries','select') then
    raise exception 'SUBSCRIPTION_PRIVATE_TABLE_CLIENT_SELECT_REMAINS';
  end if;

  if not has_column_privilege('service_role','public.subscription_invoices','id','select')
     or not has_column_privilege('service_role','public.subscription_invoices','invoice_no','select')
     or not has_column_privilege('service_role','public.subscription_invoices','amount_idr','select')
     or not has_column_privilege('service_role','public.subscription_invoices','currency','select')
     or not has_column_privilege('service_role','public.subscription_payments','id','select')
     or not has_column_privilege('service_role','public.subscription_payments','invoice_id','select')
     or not has_column_privilege('service_role','public.subscription_payments','provider','select')
     or not has_column_privilege('service_role','public.subscription_payments','provider_reference','select')
     or not has_column_privilege('service_role','public.subscription_payments','amount_idr','select')
     or not has_column_privilege('service_role','public.subscription_payments','currency','select')
     or not has_column_privilege('service_role','public.subscription_payments','idempotency_key','select') then
    raise exception 'SUBSCRIPTION_SERVICE_READ_COLUMNS_MISSING';
  end if;

  if not has_column_privilege('service_role','public.subscription_payments','idempotency_key','update')
     or not has_column_privilege('service_role','public.subscription_payments','provider_reference','update')
     or not has_column_privilege('service_role','public.subscription_payments','provider_payload','update')
     or has_column_privilege('service_role','public.subscription_payments','status','update')
     or has_column_privilege('service_role','public.subscription_payments','verified_at','update')
     or has_column_privilege('service_role','public.subscription_invoices','status','update') then
    raise exception 'SUBSCRIPTION_SERVICE_UPDATE_ALLOWLIST_MISMATCH';
  end if;

  if has_any_column_privilege('anon','public.subscription_payments','select')
     or has_any_column_privilege('authenticated','public.subscription_payments','select')
     or has_any_column_privilege('anon','public.subscription_payments','update')
     or has_any_column_privilege('authenticated','public.subscription_payments','update')
     or has_any_column_privilege('anon','public.subscription_payments','insert')
     or has_any_column_privilege('authenticated','public.subscription_payments','insert') then
    raise exception 'SUBSCRIPTION_PAYMENT_CLIENT_COLUMN_PRIVILEGE_REMAINS';
  end if;

  select qual into v_policy from pg_policies
  where schemaname='public' and tablename='subscription_plans'
    and policyname='subscription_plans_read_active' and cmd='SELECT';
  if v_policy is null or position('is_active' in v_policy)=0 then
    raise exception 'SUBSCRIPTION_PLAN_ACTIVE_READ_POLICY_MISSING_OR_CHANGED';
  end if;

  select qual into v_policy from pg_policies
  where schemaname='public' and tablename='outlet_subscriptions'
    and policyname='outlet_subscriptions_owner_read' and cmd='SELECT';
  if v_policy is null or position('has_business_role' in v_policy)=0 then
    raise exception 'OUTLET_SUBSCRIPTION_BUSINESS_READ_POLICY_MISSING_OR_CHANGED';
  end if;

  if not has_function_privilege('authenticated','public.nortago_prepare_subscription_invoice(uuid,uuid,text)','execute')
     or has_function_privilege('anon','public.nortago_prepare_subscription_invoice(uuid,uuid,text)','execute') then
    raise exception 'SUBSCRIPTION_PREPARE_RPC_EXECUTE_BOUNDARY_CHANGED';
  end if;
  if not has_function_privilege('service_role','public.nortago_settle_subscription_payment(text,text,text,text,text,bigint,text,jsonb)','execute')
     or has_function_privilege('anon','public.nortago_settle_subscription_payment(text,text,text,text,text,bigint,text,jsonb)','execute')
     or has_function_privilege('authenticated','public.nortago_settle_subscription_payment(text,text,text,text,text,bigint,text,jsonb)','execute') then
    raise exception 'SUBSCRIPTION_SETTLEMENT_RPC_EXECUTE_BOUNDARY_CHANGED';
  end if;
end
$nortago_subscription_acl_matrix$;

-- Seed two businesses to prove the authenticated Owner UI read remains tenant-scoped.
insert into public.businesses(id) values
  ('81000000-0000-4000-8000-000000000001'),
  ('81000000-0000-4000-8000-000000000002');
insert into public.otc_outlets(id,business_id,name,is_active) values
  ('82000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001','Subscription ACL A',true),
  ('82000000-0000-4000-8000-000000000002','81000000-0000-4000-8000-000000000002','Subscription ACL B',true);
insert into public.business_users(business_id,user_id,role) values
  ('81000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000001','OWNER');

insert into public.outlet_subscriptions(business_id,outlet_id,plan_id,status)
select '81000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000001',id,'PENDING'
from public.subscription_plans where plan_code='NORTAGO_OUTLET_MONTHLY';
insert into public.outlet_subscriptions(business_id,outlet_id,plan_id,status)
select '81000000-0000-4000-8000-000000000002','82000000-0000-4000-8000-000000000002',id,'PENDING'
from public.subscription_plans where plan_code='NORTAGO_OUTLET_MONTHLY';

insert into public.subscription_invoices
  (id,business_id,outlet_id,subscription_id,invoice_no,amount_idr,currency,status)
select
  '83000000-0000-4000-8000-000000000001',
  s.business_id,s.outlet_id,s.id,'NORTAGO-ACL-INV-001',50000,'IDR','OPEN'
from public.outlet_subscriptions s
where s.outlet_id='82000000-0000-4000-8000-000000000001';

insert into public.subscription_payments
  (id,invoice_id,provider,provider_reference,idempotency_key,amount_idr,currency,status)
values
  ('84000000-0000-4000-8000-000000000001',
   '83000000-0000-4000-8000-000000000001',
   'ORDERHERO_LINKBAYAR','NORTAGO-ACL-REF-001','NORTAGO-ACL-KEY-001',50000,'IDR','PENDING');

-- Anon can read only active plan metadata, not outlet or private billing records.
set local role anon;
do $nortago_subscription_anon$
declare v_count integer;
begin
  select count(*) into v_count from public.subscription_plans;
  if v_count <> 2 then raise exception 'ANON_SUBSCRIPTION_PLAN_READ_FAILED: %',v_count; end if;
  begin
    perform 1 from public.outlet_subscriptions;
    raise exception 'ANON_OUTLET_SUBSCRIPTION_READ_UNEXPECTEDLY_ALLOWED';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.subscription_payments;
    raise exception 'ANON_SUBSCRIPTION_PAYMENT_READ_UNEXPECTEDLY_ALLOWED';
  exception when insufficient_privilege then null;
  end;
end
$nortago_subscription_anon$;
reset role;

-- Authenticated Owner sees only its own business subscription and active plans.
set local role authenticated;
do $nortago_subscription_authenticated$
declare v_count integer;
begin
  select count(*) into v_count from public.subscription_plans;
  if v_count <> 2 then raise exception 'AUTH_SUBSCRIPTION_PLAN_READ_FAILED: %',v_count; end if;

  select count(*) into v_count from public.outlet_subscriptions;
  if v_count <> 1 then raise exception 'AUTH_OUTLET_SUBSCRIPTION_TENANT_SCOPE_FAILED: %',v_count; end if;

  begin
    perform 1 from public.subscription_invoices;
    raise exception 'AUTH_SUBSCRIPTION_INVOICE_READ_UNEXPECTEDLY_ALLOWED';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.subscription_payments;
    raise exception 'AUTH_SUBSCRIPTION_PAYMENT_READ_UNEXPECTEDLY_ALLOWED';
  exception when insufficient_privilege then null;
  end;
end
$nortago_subscription_authenticated$;
reset role;

-- Trusted API service_role can execute the exact read/update shapes used by
-- checkout and webhook routes, but cannot change payment settlement state directly.
set local role service_role;
do $nortago_subscription_service$
declare
  v_idempotency text;
  v_invoice_no text;
  v_amount bigint;
  v_currency text;
begin
  select p.idempotency_key,i.invoice_no,i.amount_idr,i.currency
    into v_idempotency,v_invoice_no,v_amount,v_currency
  from public.subscription_payments p
  join public.subscription_invoices i on i.id=p.invoice_id
  where p.id='84000000-0000-4000-8000-000000000001'
    and p.invoice_id='83000000-0000-4000-8000-000000000001'
    and p.provider='ORDERHERO_LINKBAYAR'
    and p.provider_reference='NORTAGO-ACL-REF-001';

  if v_idempotency <> 'NORTAGO-ACL-KEY-001'
     or v_invoice_no <> 'NORTAGO-ACL-INV-001'
     or v_amount <> 50000
     or v_currency <> 'IDR' then
    raise exception 'SERVICE_ROLE_CHECKOUT_WEBHOOK_READ_SHAPE_FAILED';
  end if;

  update public.subscription_payments
  set idempotency_key='NORTAGO-ACL-KEY-002'
  where id='84000000-0000-4000-8000-000000000001'
    and invoice_id='83000000-0000-4000-8000-000000000001'
    and idempotency_key='NORTAGO-ACL-KEY-001';
  if not found then raise exception 'SERVICE_ROLE_IDEMPOTENCY_ROTATION_UPDATE_FAILED'; end if;

  update public.subscription_payments
  set provider_reference='NORTAGO-ACL-REF-002',
      provider_payload='{"status":"open"}'::jsonb
  where id='84000000-0000-4000-8000-000000000001'
    and invoice_id='83000000-0000-4000-8000-000000000001';
  if not found then raise exception 'SERVICE_ROLE_PROVIDER_REFERENCE_UPDATE_FAILED'; end if;

  begin
    update public.subscription_payments
    set status='VERIFIED'
    where id='84000000-0000-4000-8000-000000000001';
    raise exception 'SERVICE_ROLE_DIRECT_PAYMENT_SETTLEMENT_UNEXPECTEDLY_ALLOWED';
  exception when insufficient_privilege then null;
  end;
end
$nortago_subscription_service$;
reset role;

rollback;
