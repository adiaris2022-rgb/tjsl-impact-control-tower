-- NORTAGO Order lifecycle RPC smoke tests.
-- CI's has_business_role stub denies access; verify privilege boundaries and denial path.
begin;
do $$
declare
  v_business uuid := gen_random_uuid();
  v_outlet uuid := gen_random_uuid();
  v_order uuid := gen_random_uuid();
  v_error text;
begin
  if to_regclass('public.nortago_order_status_audit') is null then
    raise exception 'Missing order lifecycle audit table';
  end if;
  if to_regprocedure('public.nortago_update_order_status(uuid,text,text)') is null then
    raise exception 'Missing order lifecycle RPC';
  end if;
  if has_function_privilege('anon','public.nortago_update_order_status(uuid,text,text)','execute') then
    raise exception 'Anonymous role must not execute lifecycle RPC';
  end if;
  if not has_function_privilege('authenticated','public.nortago_update_order_status(uuid,text,text)','execute') then
    raise exception 'Authenticated role should be granted lifecycle RPC';
  end if;

  insert into public.businesses(id) values(v_business);
  insert into public.otc_outlets(id,business_id,name) values(v_outlet,v_business,'Lifecycle smoke outlet');
  insert into public.otc_orders(id,business_id,outlet_id,order_no,order_source,fulfillment_type,status)
    values(v_order,v_business,v_outlet,'SMOKE-'||substr(v_order::text,1,8),'CUSTOMER_SELF_ORDER','TAKE_AWAY','NEW');

  begin
    perform public.nortago_update_order_status(v_order,'PROCESSING',null);
    raise exception 'Expected business role denial but RPC unexpectedly succeeded';
  exception when others then
    v_error := sqlerrm;
    if v_error not like '%NORTAGO_ORDER_FORBIDDEN%' then
      raise exception 'Expected NORTAGO_ORDER_FORBIDDEN, got: %', v_error;
    end if;
  end;

  if (select status from public.otc_orders where id=v_order) <> 'NEW' then
    raise exception 'Denied lifecycle action modified order status';
  end if;
end $$;
rollback;
