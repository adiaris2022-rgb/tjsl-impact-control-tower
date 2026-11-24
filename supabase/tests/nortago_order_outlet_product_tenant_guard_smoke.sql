-- NORTAGO ORDER tenant isolation: outlet/product mappings must stay within one business.
-- Disposable PostgreSQL fixtures; all writes are rolled back.
begin;
do $$
declare
  v_actor uuid := '00000000-0000-0000-0000-000000000001';
  v_business_a uuid := '91000000-0000-4000-8000-000000000001';
  v_business_b uuid := '91000000-0000-4000-8000-000000000002';
  v_outlet_a uuid := '92000000-0000-4000-8000-000000000001';
  v_outlet_b uuid := '92000000-0000-4000-8000-000000000002';
  v_product_a uuid := '93000000-0000-4000-8000-000000000001';
  v_product_b uuid := '93000000-0000-4000-8000-000000000002';
begin
  if has_function_privilege('anon','public.nortago_guard_outlet_product_business_match()','execute')
     or has_function_privilege('authenticated','public.nortago_guard_outlet_product_business_match()','execute')
     or has_function_privilege('anon','public.nortago_guard_product_business_reassignment()','execute')
     or has_function_privilege('authenticated','public.nortago_guard_product_business_reassignment()','execute')
     or has_function_privilege('anon','public.nortago_guard_outlet_business_reassignment()','execute')
     or has_function_privilege('authenticated','public.nortago_guard_outlet_business_reassignment()','execute') then
    raise exception 'TENANT_GUARD_TRIGGER_FUNCTIONS_MUST_NOT_BE_CLIENT_CALLABLE';
  end if;

  insert into public.businesses(id) values(v_business_a),(v_business_b);
  insert into public.otc_outlets(id,business_id,name,is_active) values
    (v_outlet_a,v_business_a,'Tenant Guard Outlet A',true),
    (v_outlet_b,v_business_b,'Tenant Guard Outlet B',true);
  insert into public.otc_products(id,business_id,name,base_price,is_active) values
    (v_product_a,v_business_a,'Tenant Guard Product A',10000,true),
    (v_product_b,v_business_b,'Tenant Guard Product B',20000,true);
  insert into public.business_users(business_id,user_id,role) values
    (v_business_a,v_actor,'OWNER'),
    (v_business_b,v_actor,'OWNER');
end
$$;

create or replace function auth.uid() returns uuid language sql stable
as $$ select '00000000-0000-0000-0000-000000000001'::uuid $$;
set local role authenticated;

do $$
declare
  v_error text;
begin
  -- Same-business mappings remain permitted.
  insert into public.otc_outlet_products(outlet_id,product_id,price,is_available)
  values('92000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001',10000,true),
        ('92000000-0000-4000-8000-000000000002','93000000-0000-4000-8000-000000000002',20000,true);

  begin
    insert into public.otc_outlet_products(outlet_id,product_id,price,is_available)
    values('92000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000002',20000,true);
    raise exception 'Expected cross-business outlet/product insert rejection';
  exception when others then
    v_error := sqlerrm;
    if v_error not like '%NORTAGO_OUTLET_PRODUCT_BUSINESS_MISMATCH%' then
      raise exception 'Unexpected cross-business insert error: %',v_error;
    end if;
  end;

  begin
    update public.otc_outlet_products
    set product_id='93000000-0000-4000-8000-000000000002'
    where outlet_id='92000000-0000-4000-8000-000000000001'
      and product_id='93000000-0000-4000-8000-000000000001';
    raise exception 'Expected cross-business mapping update rejection';
  exception when others then
    v_error := sqlerrm;
    if v_error not like '%NORTAGO_OUTLET_PRODUCT_BUSINESS_MISMATCH%' then
      raise exception 'Unexpected cross-business update error: %',v_error;
    end if;
  end;

  begin
    update public.otc_products
    set business_id='91000000-0000-4000-8000-000000000002'
    where id='93000000-0000-4000-8000-000000000001';
    raise exception 'Expected product business reassignment rejection';
  exception when others then
    v_error := sqlerrm;
    if v_error not like '%NORTAGO_PRODUCT_BUSINESS_CHANGE_BREAKS_OUTLET_MAPPING%' then
      raise exception 'Unexpected product reassignment error: %',v_error;
    end if;
  end;

  begin
    update public.otc_outlets
    set business_id='91000000-0000-4000-8000-000000000002'
    where id='92000000-0000-4000-8000-000000000001';
    raise exception 'Expected outlet business reassignment rejection';
  exception when others then
    v_error := sqlerrm;
    if v_error not like '%NORTAGO_OUTLET_BUSINESS_CHANGE_BREAKS_PRODUCT_MAPPING%' then
      raise exception 'Unexpected outlet reassignment error: %',v_error;
    end if;
  end;
end
$$;

reset role;
do $$
begin
  if exists (
    select 1 from public.otc_outlet_products op
    join public.otc_outlets o on o.id=op.outlet_id
    join public.otc_products p on p.id=op.product_id
    where o.business_id is distinct from p.business_id
  ) then
    raise exception 'CROSS_BUSINESS_MAPPING_PERSISTED_AFTER_REJECTIONS';
  end if;
end
$$;
rollback;
