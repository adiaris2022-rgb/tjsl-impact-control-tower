-- Disposable fixture test for customer checkout idempotency.
begin;
do $$
declare
  v_business_id uuid := gen_random_uuid();
  v_outlet_id uuid := gen_random_uuid();
  v_product_id uuid := gen_random_uuid();
  v_key uuid := gen_random_uuid();
  v_items jsonb;
  v_first jsonb;
  v_second jsonb;
  v_conflict_raised boolean := false;
  v_order_count integer;
  v_item_count integer;
begin
  insert into public.businesses(id) values (v_business_id);
  insert into public.otc_outlets(id,business_id,name,is_active)
    values (v_outlet_id,v_business_id,'Idempotency Smoke Outlet',true);
  insert into public.otc_products(id,business_id,name,base_price,is_active)
    values (v_product_id,v_business_id,'Smoke Product',25000,true);
  insert into public.otc_outlet_products(outlet_id,product_id,price,is_available)
    values (v_outlet_id,v_product_id,25000,true);
  v_items := jsonb_build_array(jsonb_build_object('product_id',v_product_id,'quantity',2));

  v_first := public.nortago_create_customer_order_idempotent(
    v_outlet_id,v_key,'Smoke Customer','081234567890','TAKE_AWAY',
    v_items,'Cash',null,null,null
  );
  v_second := public.nortago_create_customer_order_idempotent(
    v_outlet_id,v_key,'Smoke Customer','081234567890','TAKE_AWAY',
    v_items,'Cash',null,null,null
  );

  if v_first->>'order_no' is distinct from v_second->>'order_no'
    or v_first->>'receipt_token' is distinct from v_second->>'receipt_token'
    or v_second->>'reused' is distinct from 'true' then
    raise exception 'Retry must return the same order and receipt capability';
  end if;

  begin
    perform public.nortago_create_customer_order_idempotent(
      v_outlet_id,v_key,'Different Customer','081234567890','TAKE_AWAY',
      v_items,'Cash',null,null,null
    );
  exception when others then
    if sqlerrm = 'CHECKOUT_IDEMPOTENCY_CONFLICT' then
      v_conflict_raised := true;
    else
      raise;
    end if;
  end;
  if not v_conflict_raised then
    raise exception 'Idempotency key reuse with different payload must be rejected';
  end if;

  select count(*) into v_order_count from public.otc_orders
  where checkout_idempotency_key = v_key;
  select count(*) into v_item_count from public.otc_order_items i
  join public.otc_orders o on o.id = i.order_id
  where o.checkout_idempotency_key = v_key;
  if v_order_count <> 1 or v_item_count <> 1 then
    raise exception 'Retry must not duplicate order or item rows';
  end if;
end;
$$;
rollback;
