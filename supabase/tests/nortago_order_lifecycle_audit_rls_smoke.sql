-- Audit visibility and append-only privilege test: business A cannot see business B audit.
-- Disposable fixed-ID fixtures are always rolled back.
begin;
do $$
declare
  v_business_a uuid := '10000000-0000-4000-8000-000000000001';
  v_business_b uuid := '10000000-0000-4000-8000-000000000002';
  v_outlet_a uuid := '20000000-0000-4000-8000-000000000001';
  v_outlet_b uuid := '20000000-0000-4000-8000-000000000002';
  v_order_a uuid := '30000000-0000-4000-8000-000000000001';
  v_order_b uuid := '30000000-0000-4000-8000-000000000002';
  v_actor uuid := '00000000-0000-4000-8000-000000000001';
begin
  insert into public.businesses(id) values (v_business_a),(v_business_b);
  insert into public.otc_outlets(id,business_id,name) values
    (v_outlet_a,v_business_a,'Audit RLS Outlet A'),
    (v_outlet_b,v_business_b,'Audit RLS Outlet B');
  insert into public.otc_orders(id,business_id,outlet_id,order_no,order_source,fulfillment_type,status,payment_status) values
    (v_order_a,v_business_a,v_outlet_a,'AUDIT-RLS-A','CUSTOMER_SELF_ORDER','TAKE_AWAY','NEW','PENDING'),
    (v_order_b,v_business_b,v_outlet_b,'AUDIT-RLS-B','CUSTOMER_SELF_ORDER','TAKE_AWAY','NEW','PENDING');
  insert into public.business_users(business_id,user_id,role) values (v_business_a,v_actor,'OWNER');
  insert into public.nortago_order_status_audit(order_id,business_id,outlet_id,actor_user_id,from_status,to_status,note) values
    (v_order_a,v_business_a,v_outlet_a,v_actor,'NEW','PROCESSING','business A event'),
    (v_order_b,v_business_b,v_outlet_b,v_actor,'NEW','PROCESSING','business B event');

  if not exists (select 1 from pg_class where oid='public.nortago_order_status_audit'::regclass and relrowsecurity) then
    raise exception 'Audit table must have RLS enabled';
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='nortago_order_status_audit' and policyname='nortago_order_status_audit_manager_read') then
    raise exception 'Expected business-scoped audit SELECT policy is missing';
  end if;
  if has_table_privilege('anon','public.nortago_order_status_audit','select') then
    raise exception 'Anonymous role must not read audit records';
  end if;
  if not has_table_privilege('authenticated','public.nortago_order_status_audit','select') then
    raise exception 'Authenticated role should have SELECT under business-scoped RLS';
  end if;
  if has_table_privilege('authenticated','public.nortago_order_status_audit','insert') then
    raise exception 'Authenticated role must not insert audit records directly';
  end if;
  if has_table_privilege('authenticated','public.nortago_order_status_audit','update') then
    raise exception 'Authenticated role must not update audit records directly';
  end if;
  if has_table_privilege('authenticated','public.nortago_order_status_audit','delete') then
    raise exception 'Authenticated role must not delete audit records directly';
  end if;
end $$;
set local role authenticated;
do $$
declare
  v_business_a uuid := '10000000-0000-4000-8000-000000000001';
  v_business_b uuid := '10000000-0000-4000-8000-000000000002';
  v_count integer;
begin
  select count(*) into v_count
    from public.nortago_order_status_audit
    where business_id=v_business_a;
  if v_count <> 1 then
    raise exception 'Business A should see its own audit event; got %',v_count;
  end if;

  select count(*) into v_count
    from public.nortago_order_status_audit
    where business_id=v_business_b;
  if v_count <> 0 then
    raise exception 'Business A must not see Business B audit events; got %',v_count;
  end if;
end $$;
reset role;
rollback;
