-- Regression evidence for the pre-hardening lifecycle bypass.
-- CI grants Supabase-like client DML and applies the lifecycle/RLS migrations first.
-- This test intentionally proves that FOR ALL business-membership RLS alone does not
-- force status changes through the lifecycle RPC. Fixtures are rolled back.
begin;
do $$
declare
  v_order uuid := '30000000-0000-4000-8000-000000000098';
  v_business uuid := '10000000-0000-4000-8000-000000000098';
  v_outlet uuid := '20000000-0000-4000-8000-000000000098';
  v_actor uuid := '00000000-0000-0000-0000-000000000001';
begin
  if not has_table_privilege('authenticated','public.otc_orders','update')
    or not has_any_column_privilege('authenticated','public.otc_orders','update') then
    raise exception 'Baseline fixture must simulate client UPDATE grants before hardening';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='otc_orders'
      and policyname='otc_orders_staff_manage' and cmd='ALL'
  ) then
    raise exception 'Baseline FOR ALL business-membership policy is missing';
  end if;

  insert into public.businesses(id) values(v_business);
  insert into public.otc_outlets(id,business_id,name,is_active)
    values(v_outlet,v_business,'Baseline bypass fixture',true);
  insert into public.business_users(business_id,user_id,role)
    values(v_business,v_actor,'OWNER');
  insert into public.otc_orders(id,business_id,outlet_id,order_no,order_source,fulfillment_type,status,payment_status)
    values(v_order,v_business,v_outlet,'BASELINE-DIRECT-STATUS','CUSTOMER_SELF_ORDER','TAKE_AWAY','NEW','PENDING');
end $$;

set local role authenticated;
do $$
begin
  update public.otc_orders set status='PROCESSING',updated_at=now()
    where id='30000000-0000-4000-8000-000000000098';
  if not found then
    raise exception 'Baseline direct status update should succeed under simulated DML grants and FOR ALL policy';
  end if;
  if (select status from public.otc_orders where id='30000000-0000-4000-8000-000000000098') <> 'PROCESSING' then
    raise exception 'Baseline direct status update was not retained';
  end if;
end $$;
reset role;

do $$
begin
  if exists (
    select 1 from public.nortago_order_status_audit
    where order_id='30000000-0000-4000-8000-000000000098'
  ) then
    raise exception 'Baseline direct status update unexpectedly created lifecycle audit';
  end if;
end $$;
rollback;
