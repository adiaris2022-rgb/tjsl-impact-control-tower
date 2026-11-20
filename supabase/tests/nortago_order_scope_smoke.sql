-- Order-only release boundary smoke checks.
-- Reservation/Dine-In RPCs must remain non-executable by client roles.

do $$
begin
  if has_function_privilege('anon', 'public.nortago_create_customer_reservation(uuid,text,text,timestamp with time zone,integer,text)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.nortago_create_customer_reservation(uuid,text,text,timestamp with time zone,integer,text)', 'EXECUTE') then
    raise exception 'Order must not expose reservation creation RPC to client roles';
  end if;

  if has_function_privilege('anon', 'public.nortago_update_reservation_status(uuid,text)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.nortago_update_reservation_status(uuid,text)', 'EXECUTE') then
    raise exception 'Order must not expose reservation management RPC to client roles';
  end if;

  if not has_function_privilege('anon', 'public.nortago_create_customer_order_idempotent(uuid,uuid,text,text,text,jsonb,text,timestamp with time zone,text,text)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.nortago_create_customer_order_idempotent(uuid,uuid,text,text,text,jsonb,text,timestamp with time zone,text,text)', 'EXECUTE') then
    raise exception 'Idempotent customer order checkout RPC must remain executable';
  end if;
  if has_function_privilege('anon', 'public.nortago_create_customer_order(uuid,text,text,text,jsonb,text,timestamp with time zone,text,text)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.nortago_create_customer_order(uuid,text,text,text,jsonb,text,timestamp with time zone,text,text)', 'EXECUTE') then
    raise exception 'Legacy customer checkout RPC must remain disabled';
  end if;

  if not has_function_privilege('anon', 'public.nortago_get_customer_receipt(uuid)', 'EXECUTE') then
    raise exception 'Public capability-token receipt RPC must remain executable';
  end if;

  if not has_function_privilege('authenticated', 'public.nortago_prepare_subscription_invoice(uuid,uuid,text)', 'EXECUTE')
    or has_function_privilege('anon', 'public.nortago_prepare_subscription_invoice(uuid,uuid,text)', 'EXECUTE') then
    raise exception 'Subscription invoice preparation must remain authenticated-only';
  end if;

  if has_function_privilege('anon', 'public.nortago_settle_subscription_payment(text,text,text,text,text,bigint,text,jsonb)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.nortago_settle_subscription_payment(text,text,text,text,text,bigint,text,jsonb)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.nortago_settle_subscription_payment(text,text,text,text,text,bigint,text,jsonb)', 'EXECUTE') then
    raise exception 'Webhook settlement must remain service-role-only';
  end if;

  raise notice 'NORTAGO Order-only scope and client RPC privileges verified';
end;
$$;


-- Database-level Order scope: Dine-In and Walk-In are blocked even for staff table writes.
begin;
do $$
declare
  v_business_id uuid := gen_random_uuid();
  v_outlet_id uuid := gen_random_uuid();
  v_dine_in_blocked boolean := false;
  v_walk_in_blocked boolean := false;
  v_allowed_order_id uuid;
begin
  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.otc_orders'::regclass
      and tgname = 'otc_orders_order_only_scope_guard'
      and not tgisinternal
  ) then
    raise exception 'Order-only Dine-In/Walk-In guard trigger is missing';
  end if;

  insert into public.businesses(id) values (v_business_id);
  insert into public.otc_outlets(id,business_id,name,is_active)
    values (v_outlet_id,v_business_id,'Scope Smoke Outlet',true);

  begin
    insert into public.otc_orders(business_id,outlet_id,order_no,order_source,fulfillment_type)
      values (v_business_id,v_outlet_id,'SCOPE-DINEIN-'||replace(v_business_id::text,'-',''),'CUSTOMER_SELF_ORDER','DINE_IN');
  exception when others then
    if sqlerrm = 'ORDER_ONLY_DINE_IN_DISABLED' then v_dine_in_blocked := true; else raise; end if;
  end;

  begin
    insert into public.otc_orders(business_id,outlet_id,order_no,order_source,fulfillment_type)
      values (v_business_id,v_outlet_id,'SCOPE-WALKIN-'||replace(v_business_id::text,'-',''),'STAFF_WALK_IN','TAKE_AWAY');
  exception when others then
    if sqlerrm = 'ORDER_ONLY_WALK_IN_DISABLED' then v_walk_in_blocked := true; else raise; end if;
  end;

  if not v_dine_in_blocked or not v_walk_in_blocked then
    raise exception 'Order-only guard did not block Dine-In and Walk-In';
  end if;

  insert into public.otc_orders(business_id,outlet_id,order_no,order_source,fulfillment_type)
    values (v_business_id,v_outlet_id,'SCOPE-TAKEAWAY-'||replace(v_business_id::text,'-',''),'CUSTOMER_SELF_ORDER','TAKE_AWAY')
    returning id into v_allowed_order_id;
  if v_allowed_order_id is null then raise exception 'Valid online Take Away order was not accepted'; end if;
end;
$$;
rollback;


-- Database-level release boundary: Dine-In and Walk-In must be rejected.
begin;
do $$
declare
  v_business_id uuid := gen_random_uuid();
  v_outlet_id uuid := gen_random_uuid();
  v_dine_in_blocked boolean := false;
  v_walk_in_blocked boolean := false;
  v_allowed_order_id uuid;
begin
  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.otc_orders'::regclass
      and tgname = 'otc_orders_order_only_scope_guard'
      and not tgisinternal
  ) then
    raise exception 'Order-only Dine-In/Walk-In guard trigger is missing';
  end if;

  insert into public.businesses(id) values (v_business_id);
  insert into public.otc_outlets(id,business_id,name,is_active)
    values (v_outlet_id,v_business_id,'Scope Smoke Outlet',true);

  begin
    insert into public.otc_orders(business_id,outlet_id,order_no,order_source,fulfillment_type)
      values (v_business_id,v_outlet_id,'SCOPE-DINEIN-'||replace(v_business_id::text,'-',''),'CUSTOMER_SELF_ORDER','DINE_IN');
  exception when others then
    if sqlerrm = 'ORDER_ONLY_DINE_IN_DISABLED' then v_dine_in_blocked := true; else raise; end if;
  end;

  begin
    insert into public.otc_orders(business_id,outlet_id,order_no,order_source,fulfillment_type)
      values (v_business_id,v_outlet_id,'SCOPE-WALKIN-'||replace(v_business_id::text,'-',''),'STAFF_WALK_IN','TAKE_AWAY');
  exception when others then
    if sqlerrm = 'ORDER_ONLY_WALK_IN_DISABLED' then v_walk_in_blocked := true; else raise; end if;
  end;

  if not v_dine_in_blocked or not v_walk_in_blocked then
    raise exception 'Order-only guard did not block Dine-In and Walk-In';
  end if;

  insert into public.otc_orders(business_id,outlet_id,order_no,order_source,fulfillment_type)
    values (v_business_id,v_outlet_id,'SCOPE-TAKEAWAY-'||replace(v_business_id::text,'-',''),'CUSTOMER_SELF_ORDER','TAKE_AWAY')
    returning id into v_allowed_order_id;
  if v_allowed_order_id is null then raise exception 'Valid online Take Away order was not accepted'; end if;
end;
$$;
rollback;
