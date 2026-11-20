-- Disposable fixture test for customer checkout idempotency.
begin;
do $$
declare
  v_business_id uuid := gen_random_uuid();
  v_business_b uuid := gen_random_uuid();
  v_outlet_id uuid := gen_random_uuid();
  v_outlet_b uuid := gen_random_uuid();
  v_product_id uuid := gen_random_uuid();
  v_product_b uuid := gen_random_uuid();
  v_key uuid := gen_random_uuid();
  v_items_other jsonb;
  v_cross_tenant_rejected boolean := false;
  v_receipt_missing jsonb;
  v_items jsonb;
  v_first jsonb;
  v_second jsonb;
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

  insert into public.businesses(id) values (v_business_id),(v_business_b);
  insert into public.otc_outlets(id,business_id,name,is_active)
    values (v_outlet_id,v_business_id,'Idempotency Smoke Outlet A',true),
           (v_outlet_b,v_business_b,'Tenant Isolation Outlet B',true);
  insert into public.otc_products(id,business_id,name,base_price,is_active)
    values (v_product_id,v_business_id,'Smoke Product A',25000,true),
           (v_product_b,v_business_b,'Tenant Product B',10000,true);
  insert into public.otc_outlet_products(outlet_id,product_id,price,is_available)
    values (v_outlet_id,v_product_id,25000,true),
           (v_outlet_b,v_product_b,10000,true),
           (v_outlet_b,v_product_id,25000,true);
  v_items := jsonb_build_array(jsonb_build_object('product_id',v_product_id,'quantity',2));
  v_items_other := jsonb_build_array(jsonb_build_object('product_id',v_product_b,'quantity',1));

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

  -- Cross-business product must not be accepted by outlet A.
  begin
    perform public.nortago_create_customer_order_idempotent(
      v_outlet_id,gen_random_uuid(),'Tenant Test','081234567890','TAKE_AWAY',
      v_items_other,'Cash',null,null,null
    );
    raise exception 'Cross-business product must be rejected at outlet A';
  exception when others then
    if sqlerrm = 'Ada produk tidak tersedia atau jumlah item tidak valid' then
      v_cross_tenant_rejected := true;
    else
      raise;
    end if;
  end;
  if not v_cross_tenant_rejected then raise exception 'Cross-business product isolation failed'; end if;

  -- Product A is also rejected at outlet B even if an outlet-product row exists.
  v_cross_tenant_rejected := false;
  begin
    perform public.nortago_create_customer_order_idempotent(
      v_outlet_b,gen_random_uuid(),'Tenant Test','081234567890','TAKE_AWAY',
      jsonb_build_array(jsonb_build_object('product_id',v_product_id,'quantity',1)),
      'Cash',null,null,null
    );
    raise exception 'Product A must not be accepted by outlet B';
  exception when others then
    if sqlerrm = 'Ada produk tidak tersedia atau jumlah item tidak valid' then
      v_cross_tenant_rejected := true;
    else
      raise;
    end if;
  end;
  if not v_cross_tenant_rejected then raise exception 'Outlet/product tenant isolation failed'; end if;

  -- Receipt access is capability-based: an unknown token returns no receipt.
  v_receipt_missing := public.nortago_get_customer_receipt(gen_random_uuid());
  if v_receipt_missing is not null then
    raise exception 'Unknown receipt token must not return customer data';
  end;
end;
$;
rollback;
