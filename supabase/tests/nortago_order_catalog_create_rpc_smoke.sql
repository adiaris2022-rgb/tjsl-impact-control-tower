-- Atomic catalog-create RPC tests: auth, membership, validation, and outlet mapping.
-- Fixtures are disposable and rolled back.
begin;
do $$
declare
  v_actor uuid := '00000000-0000-0000-0000-000000000001';
  v_business_a uuid := '81000000-0000-4000-8000-000000000001';
  v_business_b uuid := '81000000-0000-4000-8000-000000000002';
  v_outlet_a uuid := '82000000-0000-4000-8000-000000000001';
  v_outlet_b uuid := '82000000-0000-4000-8000-000000000002';
  v_outlet_inactive uuid := '82000000-0000-4000-8000-000000000003';
begin
  if has_function_privilege('anon','public.nortago_create_catalog_item_for_outlet(uuid,text,text,text,text,numeric,text)','execute')
    or has_function_privilege('public','public.nortago_create_catalog_item_for_outlet(uuid,text,text,text,text,numeric,text)','execute') then
    raise exception 'Catalog-create RPC must not be executable by anon or PUBLIC';
  end if;
  if not has_function_privilege('authenticated','public.nortago_create_catalog_item_for_outlet(uuid,text,text,text,text,numeric,text)','execute') then
    raise exception 'Authenticated must be granted catalog-create RPC execute';
  end if;

  insert into public.businesses(id) values(v_business_a),(v_business_b);
  insert into public.otc_outlets(id,business_id,name,is_active) values
    (v_outlet_a,v_business_a,'Catalog RPC Outlet A',true),
    (v_outlet_b,v_business_b,'Catalog RPC Outlet B',true),
    (v_outlet_inactive,v_business_a,'Catalog RPC Inactive Outlet',false);
  insert into public.business_users(business_id,user_id,role) values(v_business_a,v_actor,'OWNER');
end $$;

create or replace function auth.uid() returns uuid language sql stable as $$ select '00000000-0000-0000-0000-000000000001'::uuid $$;
set local role authenticated;
do $$
declare
  v_service jsonb;
  v_product jsonb;
  v_error text;
begin
  v_service := public.nortago_create_catalog_item_for_outlet(
    '82000000-0000-4000-8000-000000000001',
    'Atomic Smoke Service','service detail','Services',null,120000,'SERVICE'
  );
  v_product := public.nortago_create_catalog_item_for_outlet(
    '82000000-0000-4000-8000-000000000001',
    'Atomic Smoke Product','product detail','Goods','https://example.com/catalog.png',25000,'PRODUCT'
  );
  if v_service->>'product_type' <> 'SERVICE' or (v_service->>'price')::numeric <> 120000 then
    raise exception 'SERVICE RPC response is incorrect';
  end if;
  if v_product->>'product_type' <> 'PRODUCT' or (v_product->>'price')::numeric <> 25000 then
    raise exception 'PRODUCT RPC response is incorrect';
  end if;

  begin
    perform public.nortago_create_catalog_item_for_outlet(
      '82000000-0000-4000-8000-000000000002','Cross Business Item',null,null,null,100,'PRODUCT'
    );
    raise exception 'Expected non-member business denial';
  exception when others then
    v_error := sqlerrm;
    if v_error not like '%NORTAGO_CATALOG_FORBIDDEN%' then raise exception 'Unexpected membership error: %',v_error; end if;
  end;
  begin
    perform public.nortago_create_catalog_item_for_outlet(
      '82000000-0000-4000-8000-000000000003','Inactive Outlet Item',null,null,null,100,'PRODUCT'
    );
    raise exception 'Expected inactive outlet denial';
  exception when others then
    v_error := sqlerrm;
    if v_error not like '%NORTAGO_CATALOG_OUTLET_NOT_AVAILABLE%' then raise exception 'Unexpected inactive-outlet error: %',v_error; end if;
  end;
  begin
    perform public.nortago_create_catalog_item_for_outlet(
      '82000000-0000-4000-8000-000000000001','Invalid Type Item',null,null,null,100,'OTHER'
    );
    raise exception 'Expected invalid catalog type denial';
  exception when others then
    v_error := sqlerrm;
    if v_error not like '%NORTAGO_CATALOG_PRODUCT_TYPE_INVALID%' then raise exception 'Unexpected type error: %',v_error; end if;
  end;
  begin
    perform public.nortago_create_catalog_item_for_outlet(
      '82000000-0000-4000-8000-000000000001','Negative Price Item',null,null,null,-1,'PRODUCT'
    );
    raise exception 'Expected negative price denial';
  exception when others then
    v_error := sqlerrm;
    if v_error not like '%NORTAGO_CATALOG_PRICE_INVALID%' then raise exception 'Unexpected price error: %',v_error; end if;
  end;
  begin
    perform public.nortago_create_catalog_item_for_outlet(
      '82000000-0000-4000-8000-000000000001','Invalid Image Item',null,null,'javascript:alert(1)',100,'PRODUCT'
    );
    raise exception 'Expected invalid image URL denial';
  exception when others then
    v_error := sqlerrm;
    if v_error not like '%NORTAGO_CATALOG_IMAGE_URL_INVALID%' then raise exception 'Unexpected image URL error: %',v_error; end if;
  end;
  begin
    perform public.nortago_create_catalog_item_for_outlet(
      '82000000-0000-4000-8000-000000000001','   ',null,null,null,100,'PRODUCT'
    );
    raise exception 'Expected blank name denial';
  exception when others then
    v_error := sqlerrm;
    if v_error not like '%NORTAGO_CATALOG_NAME_INVALID%' then raise exception 'Unexpected name error: %',v_error; end if;
  end;
end $$;
reset role;
create or replace function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
set local role authenticated;
do $$
declare
  v_error text;
begin
  begin
    perform public.nortago_create_catalog_item_for_outlet(
      '82000000-0000-4000-8000-000000000001','Unauthenticated Item',null,null,null,100,'PRODUCT'
    );
    raise exception 'Expected unauthenticated denial';
  exception when others then
    v_error := sqlerrm;
    if v_error not like '%NORTAGO_CATALOG_AUTH_REQUIRED%' then raise exception 'Unexpected auth error: %',v_error; end if;
  end;
end $$;
reset role;
create or replace function auth.uid() returns uuid language sql stable as $$ select '00000000-0000-0000-0000-000000000001'::uuid $$;
do $$
declare
  v_count integer;
begin
  select count(*) into v_count from public.otc_products where business_id='81000000-0000-4000-8000-000000000001';
  if v_count <> 2 then raise exception 'Expected exactly two valid catalog products, got %',v_count; end if;
  if not exists (
    select 1 from public.otc_outlet_products op join public.otc_products p on p.id=op.product_id
    where op.outlet_id='82000000-0000-4000-8000-000000000001'
      and p.name='Atomic Smoke Service' and op.price=120000 and op.is_available
  ) then raise exception 'Service/outlet price mapping missing'; end if;
  if not exists (
    select 1 from public.otc_outlet_products op join public.otc_products p on p.id=op.product_id
    where op.outlet_id='82000000-0000-4000-8000-000000000001'
      and p.name='Atomic Smoke Product' and op.price=25000 and op.is_available
  ) then raise exception 'Product/outlet price mapping missing'; end if;
end $$;
rollback;
