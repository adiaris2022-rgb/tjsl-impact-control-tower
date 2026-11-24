-- NORTAGO ORDER tenant isolation and public-catalog access regression.
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
  v_fn record;
begin
  for v_fn in
    select p.oid::regprocedure as signature, p.prosecdef, p.proconfig,
           pg_get_userbyid(p.proowner) as function_owner,
           pg_get_userbyid(c.relowner) as table_owner
    from pg_proc p
    join pg_class c on c.oid = case p.proname
      when 'nortago_guard_outlet_product_business_match' then 'public.otc_outlet_products'::regclass
      when 'nortago_guard_product_business_reassignment' then 'public.otc_products'::regclass
      when 'nortago_guard_outlet_business_reassignment' then 'public.otc_outlets'::regclass
    end
    where p.oid in (
      'public.nortago_guard_outlet_product_business_match()'::regprocedure,
      'public.nortago_guard_product_business_reassignment()'::regprocedure,
      'public.nortago_guard_outlet_business_reassignment()'::regprocedure
    )
  loop
    if not v_fn.prosecdef or v_fn.function_owner is distinct from v_fn.table_owner
       or coalesce(array_to_string(v_fn.proconfig, ','),'') not like '%search_path=pg_catalog, public, pg_temp%' then
      raise exception 'TENANT_GUARD_FUNCTION_MUST_BE_TABLE_OWNER_SECURITY_DEFINER_WITH_FIXED_SEARCH_PATH: %',v_fn.signature;
    end if;
  end loop;

  if has_function_privilege('anon','public.nortago_guard_outlet_product_business_match()','execute')
     or has_function_privilege('authenticated','public.nortago_guard_outlet_product_business_match()','execute')
     or has_function_privilege('service_role','public.nortago_guard_outlet_product_business_match()','execute')
     or has_function_privilege('anon','public.nortago_guard_product_business_reassignment()','execute')
     or has_function_privilege('authenticated','public.nortago_guard_product_business_reassignment()','execute')
     or has_function_privilege('service_role','public.nortago_guard_product_business_reassignment()','execute')
     or has_function_privilege('anon','public.nortago_guard_outlet_business_reassignment()','execute')
     or has_function_privilege('authenticated','public.nortago_guard_outlet_business_reassignment()','execute')
     or has_function_privilege('service_role','public.nortago_guard_outlet_business_reassignment()','execute') then
    raise exception 'TENANT_GUARD_TRIGGER_FUNCTIONS_MUST_NOT_BE_CLIENT_OR_SERVICE_CALLABLE';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid='public.otc_outlet_products'::regclass
      and tgname='otc_outlet_products_business_match_guard'
      and not tgisinternal and tgenabled in ('O','A')
  ) or not exists (
    select 1 from pg_trigger
    where tgrelid='public.otc_products'::regclass
      and tgname='otc_products_business_reassignment_guard'
      and not tgisinternal and tgenabled in ('O','A')
  ) or not exists (
    select 1 from pg_trigger
    where tgrelid='public.otc_outlets'::regclass
      and tgname='otc_outlets_business_reassignment_guard'
      and not tgisinternal and tgenabled in ('O','A')
  ) then
    raise exception 'TENANT_GUARD_TRIGGER_MISSING_OR_DISABLED';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='otc_outlet_products'
      and policyname='otc_outlet_products_staff_manage'
      and cmd='ALL'
      and qual like '%p.business_id = o.business_id%'
      and with_check like '%p.business_id = o.business_id%'
  ) then
    raise exception 'OUTLET_PRODUCT_STAFF_POLICY_MUST_ENFORCE_BUSINESS_MATCH';
  end if;

  insert into public.businesses(id) values(v_business_a),(v_business_b);
  insert into public.otc_outlets(id,business_id,name,is_active) values
    (v_outlet_a,v_business_a,'Tenant Guard Outlet A',true),
    (v_outlet_b,v_business_b,'Tenant Guard Outlet B',true);
  insert into public.otc_products(id,business_id,name,description,category,image_url,base_price,is_active) values
    (v_product_a,v_business_a,'Tenant Guard Product A','A','Test',null,10000,true),
    (v_product_b,v_business_b,'Tenant Guard Product B','B','Test',null,20000,true);
  insert into public.business_users(business_id,user_id,role) values
    (v_business_a,v_actor,'OWNER'),
    (v_business_b,v_actor,'OWNER');
end
$$;

set local role anon;
do $$
begin
  if not exists (select 1 from public.otc_outlets where id='92000000-0000-4000-8000-000000000001') then
    raise exception 'ANON_CANNOT_READ_ACTIVE_OUTLET';
  end if;
  if not exists (select 1 from public.otc_products where id='93000000-0000-4000-8000-000000000001') then
    raise exception 'ANON_CANNOT_READ_ACTIVE_PRODUCT';
  end if;
  if not exists (select 1 from public.otc_outlet_products where outlet_id='92000000-0000-4000-8000-000000000001' and product_id='93000000-0000-4000-8000-000000000001') then
    -- The mapping is inserted by a privileged server path below; this early
    -- check is intentionally delayed until after the authenticated setup.
    null;
  end if;
end
$$;
reset role;

set local role authenticated;
do $$
begin
  update public.otc_products set name='Tenant Guard Product A Updated', is_active=true
  where id='93000000-0000-4000-8000-000000000001';

  begin
    update public.otc_products set business_id='91000000-0000-4000-8000-000000000002'
    where id='93000000-0000-4000-8000-000000000001';
    raise exception 'Expected business_id direct update rejection';
  exception when insufficient_privilege then
    null;
  end;

  begin
    update public.otc_outlet_products set product_id='93000000-0000-4000-8000-000000000002'
    where outlet_id='92000000-0000-4000-8000-000000000001'
      and product_id='93000000-0000-4000-8000-000000000001';
    raise exception 'Expected mapping-key direct update rejection';
  exception when insufficient_privilege then
    null;
  end;

  begin
    update public.otc_outlets set business_id='91000000-0000-4000-8000-000000000002'
    where id='92000000-0000-4000-8000-000000000001';
    raise exception 'Expected outlet business_id direct update rejection';
  exception when insufficient_privilege then
    null;
  end;

  begin
    insert into public.otc_outlet_products(outlet_id,product_id,price,is_available)
    values('92000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001',10000,true);
    raise exception 'Expected direct mapping insert rejection';
  exception when insufficient_privilege then
    null;
  end;
end
$$;
reset role;

-- Privileged server-side writes still hit the tenant guard even though clients
-- cannot mutate mapping keys or parent business_id values directly.
do $$
declare
  v_error text;
begin
  insert into public.otc_outlet_products(outlet_id,product_id,price,is_available) values
    ('92000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001',11000,true),
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

rollback;
