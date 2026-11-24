-- NORTAGO ORDER catalog smoke: PRODUCT and SERVICE are both checkoutable.
-- Runs against a disposable PostgreSQL CI database and rolls back fixtures.
begin;
do $$
declare
  v_business uuid := gen_random_uuid();
  v_outlet uuid := gen_random_uuid();
  v_product uuid := gen_random_uuid();
  v_service uuid := gen_random_uuid();
  v_invalid uuid := gen_random_uuid();
  v_key uuid := gen_random_uuid();
  v_result jsonb;
  v_receipt jsonb;
  v_token uuid;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='otc_products' and column_name='product_type'
  ) then
    raise exception 'Catalog product_type column is missing';
  end if;

  insert into public.businesses(id) values(v_business);
  insert into public.otc_outlets(id,business_id,name,is_active) values(v_outlet,v_business,'Catalog Service Smoke',true);
  insert into public.otc_products(id,business_id,name,base_price,is_active,product_type) values
    (v_product,v_business,'Smoke Product',10000,true,'PRODUCT'),
    (v_service,v_business,'Smoke Service',120000,true,'SERVICE');
  insert into public.otc_outlet_products(outlet_id,product_id,price,is_available) values
    (v_outlet,v_product,10000,true),
    (v_outlet,v_service,120000,true);

  if (select product_type from public.otc_products where id=v_product) <> 'PRODUCT'
    or (select product_type from public.otc_products where id=v_service) <> 'SERVICE' then
    raise exception 'Catalog PRODUCT/SERVICE types were not stored correctly';
  end if;

  begin
    insert into public.otc_products(id,business_id,name,base_price,product_type)
    values(v_invalid,v_business,'Invalid Catalog Type',1,'OTHER');
    raise exception 'Invalid catalog type was accepted';
  exception when check_violation then
    null;
  end;

  -- Prove the service uses the normal checkout and receipt path, with outlet price snapshot.
  v_result := public.nortago_create_customer_order_idempotent(
    v_outlet,v_key,'Catalog Service Smoke','081234567890','TAKE_AWAY',
    jsonb_build_array(jsonb_build_object('product_id',v_service,'quantity',2)),
    'Cash',null,null,null
  );
  v_token := (v_result->>'receipt_token')::uuid;
  if v_token is null then raise exception 'Service checkout did not return receipt token'; end if;
  v_receipt := public.nortago_get_customer_receipt(v_token);
  if v_receipt is null then raise exception 'Service receipt was not returned'; end if;
  if (v_receipt->'order'->>'total')::numeric <> 240000 then
    raise exception 'Service checkout total must use outlet price and quantity';
  end if;
  if jsonb_array_length(v_receipt->'items') <> 1
    or v_receipt->'items'->0->>'product_name_snapshot' <> 'Smoke Service'
    or (v_receipt->'items'->0->>'quantity')::integer <> 2
    or (v_receipt->'items'->0->>'line_total')::numeric <> 240000 then
    raise exception 'Service receipt line snapshot is invalid';
  end if;
end $$;
rollback;
