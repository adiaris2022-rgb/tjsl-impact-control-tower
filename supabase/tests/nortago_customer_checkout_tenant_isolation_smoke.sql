-- Public customer checkout tenant-isolation smoke tests.
-- Runs on a disposable CI database and rolls back all fixtures.
begin;
do $$
declare
  v_business_a uuid := gen_random_uuid();
  v_business_b uuid := gen_random_uuid();
  v_outlet_a uuid := gen_random_uuid();
  v_outlet_b uuid := gen_random_uuid();
  v_product_a uuid := gen_random_uuid();
  v_product_b uuid := gen_random_uuid();
  v_bad_key_a uuid := gen_random_uuid();
  v_bad_key_b uuid := gen_random_uuid();
  v_items_a jsonb;
  v_items_b jsonb;
  v_rejected boolean := false;
  v_receipt_missing jsonb;
  v_count integer;
begin
  insert into public.businesses(id) values(v_business_a),(v_business_b);
  insert into public.otc_outlets(id,business_id,name,is_active) values
    (v_outlet_a,v_business_a,'Tenant Isolation Outlet A',true),
    (v_outlet_b,v_business_b,'Tenant Isolation Outlet B',true);
  insert into public.otc_products(id,business_id,name,base_price,is_active) values
    (v_product_a,v_business_a,'Tenant Product A',25000,true),
    (v_product_b,v_business_b,'Tenant Product B',10000,true);
  insert into public.otc_outlet_products(outlet_id,product_id,price,is_available) values
    (v_outlet_a,v_product_a,25000,true),
    (v_outlet_b,v_product_b,10000,true),
    (v_outlet_b,v_product_a,25000,true);
  v_items_a := jsonb_build_array(jsonb_build_object('product_id',v_product_a,'quantity',1));
  v_items_b := jsonb_build_array(jsonb_build_object('product_id',v_product_b,'quantity',1));

  -- Outlet A must reject business B's product.
  begin
    perform public.nortago_create_customer_order_idempotent(
      v_outlet_a,v_bad_key_a,'Tenant Smoke','081234567890','TAKE_AWAY',
      v_items_b,'Cash',null,null,null
    );
    raise exception 'Expected cross-business product rejection at outlet A';
  exception when others then
    if sqlerrm = 'Ada produk tidak tersedia atau jumlah item tidak valid' then
      v_rejected := true;
    else
      raise;
    end if;
  end;
  if not v_rejected then raise exception 'Cross-business checkout isolation failed'; end if;
  select count(*) into v_count from public.otc_orders where checkout_idempotency_key=v_bad_key_a;
  if v_count <> 0 then raise exception 'Rejected cross-business checkout created an order'; end if;

  -- Outlet B has a mapping for Product A, but the product's business still must match.
  v_rejected := false;
  begin
    perform public.nortago_create_customer_order_idempotent(
      v_outlet_b,v_bad_key_b,'Tenant Smoke','081234567890','TAKE_AWAY',
      v_items_a,'Cash',null,null,null
    );
    raise exception 'Expected outlet/business product mismatch rejection at outlet B';
  exception when others then
    if sqlerrm = 'Ada produk tidak tersedia atau jumlah item tidak valid' then
      v_rejected := true;
    else
      raise;
    end if;
  end;
  if not v_rejected then raise exception 'Outlet/product business isolation failed'; end if;
  select count(*) into v_count from public.otc_orders where checkout_idempotency_key=v_bad_key_b;
  if v_count <> 0 then raise exception 'Rejected outlet/business checkout created an order'; end if;

  -- Unknown capability tokens must not expose receipt data.
  v_receipt_missing := public.nortago_get_customer_receipt(gen_random_uuid());
  if v_receipt_missing is not null then
    raise exception 'Unknown receipt token must not return customer data';
  end;
end $$;
rollback;
