-- Regression test: order headers and item rows are client-read-only.
-- Checkout/lifecycle remain available through SECURITY DEFINER RPCs.
-- Uses fixtures and role changes inside a rollback-only transaction.
begin;
do $$
declare
  v_order uuid := '30000000-0000-4000-8000-000000000099';
  v_business uuid := '10000000-0000-4000-8000-000000000099';
  v_outlet uuid := '20000000-0000-4000-8000-000000000099';
  v_actor uuid := '00000000-0000-0000-0000-000000000001';
begin
  if not exists (select 1 from pg_class where oid='public.otc_orders'::regclass and relrowsecurity) then
    raise exception 'otc_orders must keep RLS enabled';
  end if;
  if not exists (select 1 from pg_class where oid='public.otc_order_items'::regclass and relrowsecurity) then
    raise exception 'otc_order_items must keep RLS enabled';
  end if;
  if not has_table_privilege('authenticated','public.otc_orders','select')
    or not has_table_privilege('authenticated','public.otc_order_items','select') then
    raise exception 'Authenticated business users require read access for owner order views';
  end if;
  if has_table_privilege('anon','public.otc_orders','select')
    or has_table_privilege('anon','public.otc_order_items','select') then
    raise exception 'Anonymous clients must not read order headers/items directly';
  end if;

  if has_table_privilege('authenticated','public.otc_orders','insert')
    or has_table_privilege('authenticated','public.otc_orders','update')
    or has_table_privilege('authenticated','public.otc_orders','delete')
    or has_any_column_privilege('authenticated','public.otc_orders','insert')
    or has_any_column_privilege('authenticated','public.otc_orders','update') then
    raise exception 'Authenticated clients must not directly mutate order headers';
  end if;
  if has_table_privilege('anon','public.otc_orders','insert')
    or has_table_privilege('anon','public.otc_orders','update')
    or has_table_privilege('anon','public.otc_orders','delete')
    or has_any_column_privilege('anon','public.otc_orders','insert')
    or has_any_column_privilege('anon','public.otc_orders','update') then
    raise exception 'Anonymous clients must not directly mutate order headers';
  end if;

  if has_table_privilege('authenticated','public.otc_order_items','insert')
    or has_table_privilege('authenticated','public.otc_order_items','update')
    or has_table_privilege('authenticated','public.otc_order_items','delete')
    or has_any_column_privilege('authenticated','public.otc_order_items','insert')
    or has_any_column_privilege('authenticated','public.otc_order_items','update') then
    raise exception 'Authenticated clients must not directly mutate order items';
  end if;
  if has_table_privilege('anon','public.otc_order_items','insert')
    or has_table_privilege('anon','public.otc_order_items','update')
    or has_table_privilege('anon','public.otc_order_items','delete')
    or has_any_column_privilege('anon','public.otc_order_items','insert')
    or has_any_column_privilege('anon','public.otc_order_items','update') then
    raise exception 'Anonymous clients must not directly mutate order items';
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='otc_orders' and policyname='otc_orders_staff_read' and cmd='SELECT') then
    raise exception 'Business-scoped order SELECT policy is missing';
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='otc_order_items' and policyname='otc_order_items_staff_read' and cmd='SELECT') then
    raise exception 'Business-scoped item SELECT policy is missing';
  end if;

  if not exists (select 1 from pg_proc where oid=to_regprocedure('public.nortago_create_customer_order_idempotent(uuid,uuid,text,text,text,jsonb,text,timestamptz,text,text)') and prosecdef) then
    raise exception 'Idempotent customer checkout must remain SECURITY DEFINER';
  end if;
  if not exists (select 1 from pg_proc where oid=to_regprocedure('public.nortago_get_customer_receipt(uuid)') and prosecdef) then
    raise exception 'Customer receipt RPC must remain SECURITY DEFINER';
  end if;
  if not exists (select 1 from pg_proc where oid=to_regprocedure('public.nortago_update_order_status(uuid,text,text)') and prosecdef) then
    raise exception 'Order lifecycle RPC must remain SECURITY DEFINER';
  end if;
  if not has_function_privilege('anon','public.nortago_create_customer_order_idempotent(uuid,uuid,text,text,text,jsonb,text,timestamptz,text,text)','execute')
    or not has_function_privilege('anon','public.nortago_get_customer_receipt(uuid)','execute')
    or not has_function_privilege('authenticated','public.nortago_update_order_status(uuid,text,text)','execute') then
    raise exception 'Required RPC execution grants are missing';
  end if;
  if has_function_privilege('anon','public.nortago_update_order_status(uuid,text,text)','execute') then
    raise exception 'Anonymous role must not execute order lifecycle RPC';
  end if;

  insert into public.businesses(id) values(v_business);
  insert into public.otc_outlets(id,business_id,name) values(v_outlet,v_business,'RPC-only write fixture');
  insert into public.business_users(business_id,user_id,role) values(v_business,v_actor,'OWNER');
  insert into public.otc_orders(id,business_id,outlet_id,order_no,order_source,fulfillment_type,status,payment_status)
    values(v_order,v_business,v_outlet,'RPC-ONLY-WRITE-SMOKE','CUSTOMER_SELF_ORDER','TAKE_AWAY','NEW','PENDING');
  insert into public.otc_order_items(order_id,product_name_snapshot,unit_price,quantity,line_total)
    values(v_order,'RPC-only write fixture item',1,1,1);
end $$;

set local role authenticated;
do $$
declare
  v_count integer;
begin
  select count(*) into v_count from public.otc_orders where id='30000000-0000-4000-8000-000000000099';
  if v_count <> 1 then raise exception 'Authorized owner must see the scoped order'; end if;
  select count(*) into v_count from public.otc_order_items where order_id='30000000-0000-4000-8000-000000000099';
  if v_count <> 1 then raise exception 'Authorized owner must see scoped order items'; end if;

  begin
    update public.otc_orders set status='PROCESSING' where id='30000000-0000-4000-8000-000000000099';
    raise exception 'Direct status update unexpectedly succeeded';
  exception when insufficient_privilege then
    null;
  end;
  begin
    insert into public.otc_orders(business_id,outlet_id,order_no,fulfillment_type,status,payment_status)
    values('10000000-0000-4000-8000-000000000099','20000000-0000-4000-8000-000000000099','DIRECT-INSERT-DENIED','TAKE_AWAY','NEW','PENDING');
    raise exception 'Direct order insert unexpectedly succeeded';
  exception when insufficient_privilege then
    null;
  end;
  begin
    insert into public.otc_order_items(order_id,product_name_snapshot,unit_price,quantity,line_total)
    values('30000000-0000-4000-8000-000000000099','Direct item insert denied',1,1,1);
    raise exception 'Direct item insert unexpectedly succeeded';
  exception when insufficient_privilege then
    null;
  end;
  begin
    update public.otc_order_items set quantity=2 where order_id='30000000-0000-4000-8000-000000000099';
    raise exception 'Direct item update unexpectedly succeeded';
  exception when insufficient_privilege then
    null;
  end;
  begin
    delete from public.otc_order_items where order_id='30000000-0000-4000-8000-000000000099';
    raise exception 'Direct item delete unexpectedly succeeded';
  exception when insufficient_privilege then
    null;
  end;
  perform public.nortago_update_order_status('30000000-0000-4000-8000-000000000099','PROCESSING','rpc-only write smoke');
  if (select status from public.otc_orders where id='30000000-0000-4000-8000-000000000099') <> 'PROCESSING' then
    raise exception 'Approved lifecycle RPC did not advance the order';
  end if;
  select count(*) into v_count from public.nortago_order_status_audit where order_id='30000000-0000-4000-8000-000000000099';
  if v_count <> 1 then raise exception 'Approved lifecycle RPC must append exactly one audit event'; end if;
  if (select payment_status from public.otc_orders where id='30000000-0000-4000-8000-000000000099') <> 'PENDING' then
    raise exception 'Lifecycle RPC must not change payment status';
  end if;
end $;
reset role;

do $$
begin
  if (select status from public.otc_orders where id='30000000-0000-4000-8000-000000000099') <> 'PROCESSING' then
    raise exception 'Approved lifecycle RPC status was not retained';
  end if;
  if (select quantity from public.otc_order_items where order_id='30000000-0000-4000-8000-000000000099') <> 1 then
    raise exception 'Direct item mutation changed the item';
  end if;
  if (select payment_status from public.otc_orders where id='30000000-0000-4000-8000-000000000099') <> 'PENDING' then
    raise exception 'Lifecycle RPC must leave payment status unchanged';
  end if;
  if (select count(*) from public.nortago_order_status_audit where order_id='30000000-0000-4000-8000-000000000099') <> 1 then
    raise exception 'Lifecycle RPC audit row missing';
  end if;
end $$;
rollback;
