-- Disposable fixture test for customer checkout idempotency and checkout-to-receipt.
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
  v_receipt jsonb;
  v_receipt_item jsonb;
  v_conflict_raised boolean := false;
  v_order_count integer;
  v_item_count integer;
begin
  if not has_function_privilege('anon', 'public.nortago_create_customer_order_idempotent(uuid,uuid,text,text,text,jsonb,text,timestamp with time zone,text,text)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.nortago_create_customer_order_idempotent(uuid,uuid,text,text,text,jsonb,text,timestamp with time zone,text,text)', 'EXECUTE') then
    raise exception 'Idempotent customer checkout must be callable by public checkout roles';
  end if;
  if has_function_privilege('anon', 'public.nortago_create_customer_order(uuid,text,text,text,jsonb,text,timestamp with time zone,text,text)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.nortago_create_customer_order(uuid,text,text,text,jsonb,text,timestamp with time zone,text,text)', 'EXECUTE') then
    raise exception 'Legacy customer checkout RPC must be disabled for client roles';
  end if;

  insert into public.businesses(id) values (v_business_id);
  insert into public.otc_outlets(id,business_id,name,is_active)
    values (v_outlet_id,v_business_id,'Idempotency Smoke Outlet',true);
  insert into public.otc_products(id,business_id,name,base_price,is_active)
    values (v_product_id,v_business_id,'Smoke Product',30000,true);
  -- Outlet override deliberately differs from the product base price.
  insert into public.otc_outlet_products(outlet_id,product_id,price,is_available)
    values (v_outlet_id,v_product_id,25000,true);
  -- Include forged client price fields: checkout must ignore them and use outlet price.
  v_items := jsonb_build_array(jsonb_build_object('product_id',v_product_id,'quantity',2,'price',1,'unit_price',1));

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

  -- Validate the complete customer receipt path using the capability returned by checkout.
  v_receipt := public.nortago_get_customer_receipt((v_first->>'receipt_token')::uuid);
  if v_receipt is null or v_receipt->'order' is null or v_receipt->'items' is null then
    raise exception 'Checkout receipt token must return order and item data';
  end if;
  if v_receipt->'order'->>'order_no' is distinct from v_first->>'order_no'
    or v_receipt->'order'->>'customer_name' is distinct from 'Smoke Customer'
    or v_receipt->'order'->>'fulfillment_type' is distinct from 'TAKE_AWAY'
    or v_receipt->'order'->>'status' is distinct from 'NEW'
    or v_receipt->'order'->>'payment_status' is distinct from 'PENDING'
    or (v_receipt->'order'->>'subtotal')::numeric is distinct from 50000
    or (v_receipt->'order'->>'total')::numeric is distinct from 50000 then
    raise exception 'Receipt order header did not match checkout';
  end if;
  if jsonb_array_length(v_receipt->'items') <> 1 then
    raise exception 'Receipt should return exactly one order item';
  end if;
  v_receipt_item := v_receipt->'items'->0;
  if v_receipt_item->>'product_name_snapshot' is distinct from 'Smoke Product'
    or (v_receipt_item->>'unit_price')::numeric is distinct from 25000
    or (v_receipt_item->>'quantity')::integer is distinct from 2
    or (v_receipt_item->>'line_total')::numeric is distinct from 50000 then
    raise exception 'Receipt item data or outlet price override mismatch: %',v_receipt_item;
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
