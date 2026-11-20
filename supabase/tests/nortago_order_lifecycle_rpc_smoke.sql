-- NORTAGO Order lifecycle RPC smoke tests.
-- Uses the CI auth.uid() stub and temporarily toggles the CI business-role stub.
begin;
do $$
declare
  v_business_a uuid := gen_random_uuid();
  v_business_b uuid := gen_random_uuid();
  v_outlet_a uuid := gen_random_uuid();
  v_outlet_b uuid := gen_random_uuid();
  v_order_takeaway uuid := gen_random_uuid();
  v_order_preorder uuid := gen_random_uuid();
  v_order_delivery uuid := gen_random_uuid();
  v_order_mismatch uuid := gen_random_uuid();
  v_actor uuid := '00000000-0000-0000-0000-000000000001'::uuid;
  v_error text;
  v_count integer;
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
  if not has_table_privilege('authenticated','public.nortago_order_status_audit','select') then
    raise exception 'Authenticated role should have SELECT for policy-protected audit';
  end if;
  if has_table_privilege('authenticated','public.nortago_order_status_audit','insert') then
    raise exception 'Authenticated role must not directly insert audit records';
  end if;

  insert into public.businesses(id) values(v_business_a),(v_business_b);
  insert into public.otc_outlets(id,business_id,name) values
    (v_outlet_a,v_business_a,'Lifecycle outlet A'),
    (v_outlet_b,v_business_b,'Lifecycle outlet B');
  insert into public.otc_orders(id,business_id,outlet_id,order_no,order_source,fulfillment_type,status,payment_status)
    values
    (v_order_takeaway,v_business_a,v_outlet_a,'SMOKE-TAKEAWAY','CUSTOMER_SELF_ORDER','TAKE_AWAY','NEW','PENDING'),
    (v_order_preorder,v_business_a,v_outlet_a,'SMOKE-PREORDER','CUSTOMER_SELF_ORDER','PRE_ORDER','NEW','PENDING'),
    (v_order_delivery,v_business_a,v_outlet_a,'SMOKE-DELIVERY','CUSTOMER_SELF_ORDER','DELIVERY','NEW','PENDING'),
    (v_order_mismatch,v_business_b,v_outlet_a,'SMOKE-MISMATCH','CUSTOMER_SELF_ORDER','TAKE_AWAY','NEW','PENDING');

  -- Deny non-members before exercising successful actions.
  begin
    perform public.nortago_update_order_status(v_order_takeaway,'PROCESSING',null);
    raise exception 'Expected role denial but RPC unexpectedly succeeded';
  exception when others then
    v_error := sqlerrm;
    if v_error not like '%NORTAGO_ORDER_FORBIDDEN%' then
      raise exception 'Expected NORTAGO_ORDER_FORBIDDEN, got: %', v_error;
    end if;
  end;
  if (select status from public.otc_orders where id=v_order_takeaway) <> 'NEW' then
    raise exception 'Denied lifecycle action modified order status';
  end if;

  -- CI-only role stub is switched to allow testing server-side transitions.
  create or replace function public.has_business_role(p_business_id uuid, p_roles text[])
  returns boolean language sql stable as $$ select true $$;

  -- Takeaway must follow pickup handoff states; delivery handoff is rejected.
  perform public.nortago_update_order_status(v_order_takeaway,'PROCESSING','  started  ');
  perform public.nortago_update_order_status(v_order_takeaway,'READY',null);
  begin
    perform public.nortago_update_order_status(v_order_takeaway,'HANDED_OVER_TO_DELIVERY',null);
    raise exception 'Takeaway must not transition to delivery handoff';
  exception when others then
    v_error := sqlerrm;
    if v_error not like '%NORTAGO_ORDER_TRANSITION_INVALID%' then
      raise exception 'Expected invalid takeaway transition, got: %',v_error;
    end if;
  end;
  perform public.nortago_update_order_status(v_order_takeaway,'WAITING_PICKUP',null);
  perform public.nortago_update_order_status(v_order_takeaway,'PICKUP_VERIFIED',null);
  perform public.nortago_update_order_status(v_order_takeaway,'SUCCESS',null);
  begin
    perform public.nortago_update_order_status(v_order_takeaway,'PO_SUCCESS',null);
    raise exception 'PO_SUCCESS must not be allowed for Takeaway';
  exception when others then
    v_error := sqlerrm;
    if v_error not like '%NORTAGO_ORDER_TRANSITION_INVALID%' then
      raise exception 'Expected non-Pre-Order final transition denial, got: %',v_error;
    end if;
  end;
  if (select status from public.otc_orders where id=v_order_takeaway) <> 'SUCCESS' then
    raise exception 'Takeaway final status mismatch';
  end if;
  select count(*) into v_count from public.nortago_order_status_audit where order_id=v_order_takeaway;
  if v_count <> 5 then raise exception 'Expected 5 takeaway audit events, got %',v_count; end if;
  if not exists (select 1 from public.nortago_order_status_audit
    where order_id=v_order_takeaway and from_status='NEW' and to_status='PROCESSING'
      and actor_user_id=v_actor and note='started') then
    raise exception 'Lifecycle audit must capture actor, transition, and trimmed note';
  end if;

  -- Pre-Order may complete through pickup and then use its distinct terminal status.
  perform public.nortago_update_order_status(v_order_preorder,'PROCESSING',null);
  perform public.nortago_update_order_status(v_order_preorder,'READY',null);
  perform public.nortago_update_order_status(v_order_preorder,'WAITING_PICKUP',null);
  perform public.nortago_update_order_status(v_order_preorder,'PICKUP_VERIFIED',null);
  perform public.nortago_update_order_status(v_order_preorder,'SUCCESS',null);
  perform public.nortago_update_order_status(v_order_preorder,'PO_SUCCESS',null);
  if (select status from public.otc_orders where id=v_order_preorder) <> 'PO_SUCCESS' then
    raise exception 'Pre-Order terminal status mismatch';
  end if;

  -- Delivery must hand over to courier, not enter the pickup branch.
  perform public.nortago_update_order_status(v_order_delivery,'PROCESSING',null);
  perform public.nortago_update_order_status(v_order_delivery,'READY',null);
  begin
    perform public.nortago_update_order_status(v_order_delivery,'WAITING_PICKUP',null);
    raise exception 'Delivery must not transition to pickup';
  exception when others then
    v_error := sqlerrm;
    if v_error not like '%NORTAGO_ORDER_TRANSITION_INVALID%' then
      raise exception 'Expected invalid delivery pickup transition, got: %',v_error;
    end if;
  end;
  perform public.nortago_update_order_status(v_order_delivery,'HANDED_OVER_TO_DELIVERY',null);
  perform public.nortago_update_order_status(v_order_delivery,'SUCCESS',null);
  if (select status from public.otc_orders where id=v_order_delivery) <> 'SUCCESS' then
    raise exception 'Delivery terminal status mismatch';
  end if;

  -- A business membership on the order's business must not authorize a mismatched outlet.
  begin
    perform public.nortago_update_order_status(v_order_mismatch,'PROCESSING',null);
    raise exception 'Expected outlet/business mismatch denial';
  exception when others then
    v_error := sqlerrm;
    if v_error not like '%NORTAGO_ORDER_OUTLET_BUSINESS_MISMATCH%' then
      raise exception 'Expected outlet/business mismatch denial, got: %',v_error;
    end if;
  end;
  if (select status from public.otc_orders where id=v_order_mismatch) <> 'NEW' then
    raise exception 'Outlet/business mismatch changed order status';
  end if;
  if exists (select 1 from public.nortago_order_status_audit where order_id=v_order_mismatch) then
    raise exception 'Outlet/business mismatch must not create audit event';
  end if;

  -- Payment state is not coupled to lifecycle updates.
  if (select payment_status from public.otc_orders where id=v_order_takeaway) <> 'PENDING' then
    raise exception 'Lifecycle action unexpectedly changed payment state';
  end if;
end $$;
rollback;
