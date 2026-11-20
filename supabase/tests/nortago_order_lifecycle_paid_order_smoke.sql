-- Paid orders must remain PAID while fulfillment lifecycle advances.
-- Uses disposable CI business membership/auth fixtures and rolls back.
begin;
do $$
declare
  v_business uuid := gen_random_uuid();
  v_outlet uuid := gen_random_uuid();
  v_order uuid := gen_random_uuid();
  v_actor uuid := '00000000-0000-0000-0000-000000000001'::uuid;
  v_transitions text[];
  v_count integer;
begin
  insert into public.businesses(id) values (v_business);
  insert into public.otc_outlets(id,business_id,name) values (v_outlet,v_business,'Paid Lifecycle Outlet');
  insert into public.business_users(business_id,user_id,role) values (v_business,v_actor,'OWNER');
  insert into public.otc_orders(id,business_id,outlet_id,order_no,order_source,fulfillment_type,status,payment_status)
  values (v_order,v_business,v_outlet,'SMOKE-PAID-LIFECYCLE','CUSTOMER_SELF_ORDER','TAKE_AWAY','PAID','PAID');

  perform public.nortago_update_order_status(v_order,'PROCESSING','paid-order start');
  perform public.nortago_update_order_status(v_order,'READY',null);
  perform public.nortago_update_order_status(v_order,'WAITING_PICKUP',null);
  perform public.nortago_update_order_status(v_order,'PICKUP_VERIFIED',null);
  perform public.nortago_update_order_status(v_order,'SUCCESS',null);

  if (select status from public.otc_orders where id=v_order) <> 'SUCCESS' then
    raise exception 'Paid order fulfillment did not reach SUCCESS';
  end if;
  if (select payment_status from public.otc_orders where id=v_order) <> 'PAID' then
    raise exception 'Fulfillment lifecycle must preserve PAID payment status';
  end if;

  select array_agg(to_status order by id) into v_transitions
  from public.nortago_order_status_audit where order_id=v_order;
  if v_transitions is distinct from array['PROCESSING','READY','WAITING_PICKUP','PICKUP_VERIFIED','SUCCESS']::text[] then
    raise exception 'Paid-order audit transitions mismatch: %',v_transitions;
  end if;
  select count(*) into v_count from public.nortago_order_status_audit
  where order_id=v_order and actor_user_id=v_actor;
  if v_count <> 5 then
    raise exception 'Expected five actor-attributed audit events, got %',v_count;
  end if;
end $$;
rollback;
