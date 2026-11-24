-- NORTAGO Order-only release boundary smoke checks.
-- Reservation RPCs and webhook settlement remain restricted; Dine-In/Walk-In
-- records are rejected on insert and cannot be lifecycle-advanced through RPC.

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
end;
$$;

-- Database-level insert boundary: Dine-In and Walk-In are blocked, online Take Away is allowed.
begin;
do $$
declare
  v_business_id uuid := gen_random_uuid();
  v_outlet_id uuid := gen_random_uuid();
  v_dine_in_blocked boolean := false;
  v_walk_in_blocked boolean := false;
  v_pos_integrated_blocked boolean := false;
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

  begin
    insert into public.otc_orders(business_id,outlet_id,order_no,order_source,fulfillment_type)
      values (v_business_id,v_outlet_id,'SCOPE-POS-'||replace(v_business_id::text,'-',''),'POS_INTEGRATED','TAKE_AWAY');
  exception when others then
    if sqlerrm = 'ORDER_ONLY_POS_DISABLED' then v_pos_integrated_blocked := true; else raise; end if;
  end;

  if not v_dine_in_blocked or not v_walk_in_blocked or not v_pos_integrated_blocked then
    raise exception 'Order-only guard did not block Dine-In, Walk-In, and POS-integrated orders';
  end if;

  insert into public.otc_orders(business_id,outlet_id,order_no,order_source,fulfillment_type)
    values (v_business_id,v_outlet_id,'SCOPE-TAKEAWAY-'||replace(v_business_id::text,'-',''),'CUSTOMER_SELF_ORDER','TAKE_AWAY')
    returning id into v_allowed_order_id;
  if v_allowed_order_id is null then raise exception 'Valid online Take Away order was not accepted'; end if;
end;
$$;
rollback;

-- Lifecycle guard: legacy out-of-scope rows must not be status-advanced by the RPC.
-- Trigger is disabled only to seed pre-existing rows in this disposable CI transaction.
begin;
do $$
declare
  v_business_id uuid := '40000000-0000-4000-8000-000000000001';
  v_outlet_id uuid := '50000000-0000-4000-8000-000000000001';
  v_actor uuid := '00000000-0000-0000-0000-000000000001';
begin
  insert into public.businesses(id) values(v_business_id);
  insert into public.otc_outlets(id,business_id,name,is_active) values(v_outlet_id,v_business_id,'Legacy Scope Fixture',true);
  insert into public.business_users(business_id,user_id,role) values(v_business_id,v_actor,'OWNER');

  alter table public.otc_orders disable trigger otc_orders_order_only_scope_guard;
  begin
    insert into public.otc_orders(id,business_id,outlet_id,order_no,order_source,fulfillment_type,status,payment_status)
      values
        ('60000000-0000-4000-8000-000000000001',v_business_id,v_outlet_id,'LEGACY-DINE-IN','CUSTOMER_SELF_ORDER','DINE_IN','NEW','PENDING'),
        ('60000000-0000-4000-8000-000000000002',v_business_id,v_outlet_id,'LEGACY-WALK-IN','STAFF_WALK_IN','TAKE_AWAY','NEW','PENDING'),
        ('60000000-0000-4000-8000-000000000003',v_business_id,v_outlet_id,'VALID-TAKE-AWAY','CUSTOMER_SELF_ORDER','TAKE_AWAY','NEW','PENDING'),
        ('60000000-0000-4000-8000-000000000004',v_business_id,v_outlet_id,'LEGACY-POS-INTEGRATED','POS_INTEGRATED','TAKE_AWAY','NEW','PENDING');
  exception when others then
    alter table public.otc_orders enable trigger otc_orders_order_only_scope_guard;
    raise;
  end;
  alter table public.otc_orders enable trigger otc_orders_order_only_scope_guard;
end;
$$;

set local role authenticated;
do $$
declare
  v_dine_in_blocked boolean := false;
  v_walk_in_blocked boolean := false;
  v_pos_integrated_blocked boolean := false;
  v_status text;
  v_audit_count integer;
begin
  -- A supported order still transitions and audits through the RPC.
  perform public.nortago_update_order_status('60000000-0000-4000-8000-000000000003','PROCESSING','scope lifecycle smoke');
  select status into v_status from public.otc_orders where id='60000000-0000-4000-8000-000000000003';
  if v_status <> 'PROCESSING' then raise exception 'Supported Take Away lifecycle transition failed'; end if;
  select count(*) into v_audit_count from public.nortago_order_status_audit where order_id='60000000-0000-4000-8000-000000000003';
  if v_audit_count <> 1 then raise exception 'Supported Take Away lifecycle transition must audit once'; end if;

  begin
    perform public.nortago_update_order_status('60000000-0000-4000-8000-000000000001','PROCESSING','legacy dine-in must remain excluded');
    raise exception 'Legacy Dine-In lifecycle RPC unexpectedly succeeded';
  exception when others then
    if sqlerrm = 'ORDER_ONLY_DINE_IN_DISABLED' then v_dine_in_blocked := true;
    elsif sqlerrm = 'Legacy Dine-In lifecycle RPC unexpectedly succeeded' then raise;
    else raise;
    end if;
  end;

  begin
    perform public.nortago_update_order_status('60000000-0000-4000-8000-000000000002','PROCESSING','legacy walk-in must remain excluded');
    raise exception 'Legacy Walk-In lifecycle RPC unexpectedly succeeded';
  exception when others then
    if sqlerrm = 'ORDER_ONLY_WALK_IN_DISABLED' then v_walk_in_blocked := true;
    elsif sqlerrm = 'Legacy Walk-In lifecycle RPC unexpectedly succeeded' then raise;
    else raise;
    end if;
  end;

  begin
    perform public.nortago_update_order_status('60000000-0000-4000-8000-000000000004','PROCESSING','legacy POS-integrated order must remain excluded');
    raise exception 'Legacy POS-integrated lifecycle RPC unexpectedly succeeded';
  exception when others then
    if sqlerrm = 'ORDER_ONLY_POS_DISABLED' then v_pos_integrated_blocked := true;
    elsif sqlerrm = 'Legacy POS-integrated lifecycle RPC unexpectedly succeeded' then raise;
    else raise;
    end if;
  end;

  if not v_dine_in_blocked or not v_walk_in_blocked or not v_pos_integrated_blocked then
    raise exception 'Order-only scope guard did not reject legacy Dine-In, Walk-In, and POS-integrated lifecycle transitions';
  end if;
  select status into v_status from public.otc_orders where id='60000000-0000-4000-8000-000000000001';
  if v_status <> 'NEW' then raise exception 'Legacy Dine-In status changed'; end if;
  select status into v_status from public.otc_orders where id='60000000-0000-4000-8000-000000000002';
  if v_status <> 'NEW' then raise exception 'Legacy Walk-In status changed'; end if;
  select status into v_status from public.otc_orders where id='60000000-0000-4000-8000-000000000004';
  if v_status <> 'NEW' then raise exception 'Legacy POS-integrated status changed'; end if;
  select count(*) into v_audit_count from public.nortago_order_status_audit
    where order_id in ('60000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000002','60000000-0000-4000-8000-000000000004');
  if v_audit_count <> 0 then raise exception 'Blocked out-of-scope lifecycle transitions must not create audit events'; end if;
end;
$$;
reset role;
rollback;
