-- Effective public-catalog privilege contract after the least-privilege migration.
do $$
declare
  v_table regclass;
  v_role text;
  v_col record;
begin
  foreach v_table in array array[
    'public.otc_outlets'::regclass,
    'public.otc_products'::regclass,
    'public.otc_outlet_products'::regclass
  ] loop
    if not has_table_privilege('anon',v_table,'select')
       or not has_table_privilege('authenticated',v_table,'select') then
      raise exception 'PUBLIC_CATALOG_SELECT_MISSING: %',v_table;
    end if;

    foreach v_role in array array['anon','authenticated'] loop
      if has_table_privilege(v_role,v_table,'insert')
         or has_table_privilege(v_role,v_table,'update')
         or has_table_privilege(v_role,v_table,'delete')
         or has_table_privilege(v_role,v_table,'truncate')
         or has_table_privilege(v_role,v_table,'references')
         or has_table_privilege(v_role,v_table,'trigger')
         or has_table_privilege(v_role,v_table,'maintain') then
        raise exception 'PUBLIC_CATALOG_UNEXPECTED_TABLE_LEVEL_MUTATION_OR_DDL_PRIVILEGE: %, %',v_role,v_table;
      end if;
    end loop;

    if not (select relrowsecurity from pg_class where oid=v_table) then
      raise exception 'PUBLIC_CATALOG_RLS_DISABLED: %',v_table;
    end if;

    if exists (
      select 1
      from aclexplode(coalesce((select relacl from pg_class where oid=v_table),acldefault('r',(select relowner from pg_class where oid=v_table)))) a
      where a.grantee=0
    ) then
      raise exception 'PUBLIC_CATALOG_PUBLIC_ROLE_PRIVILEGE_REMAINS: %',v_table;
    end if;

    if not has_table_privilege('service_role',v_table,'truncate')
       or not has_table_privilege('service_role',v_table,'references')
       or not has_table_privilege('service_role',v_table,'trigger')
       or not has_table_privilege('service_role',v_table,'maintain') then
      raise exception 'SERVICE_ROLE_DEFAULT_PRIVILEGES_CHANGED: %',v_table;
    end if;
  end loop;

  if not has_column_privilege('authenticated','public.otc_products','name','update')
     or not has_column_privilege('authenticated','public.otc_products','description','update')
     or not has_column_privilege('authenticated','public.otc_products','category','update')
     or not has_column_privilege('authenticated','public.otc_products','image_url','update')
     or not has_column_privilege('authenticated','public.otc_products','is_active','update') then
    raise exception 'AUTHENTICATED_PRODUCT_CATALOG_UPDATE_COLUMNS_MISSING';
  end if;
  if not has_column_privilege('authenticated','public.otc_outlet_products','price','update')
     or not has_column_privilege('authenticated','public.otc_outlet_products','is_available','update') then
    raise exception 'AUTHENTICATED_OUTLET_PRODUCT_UPDATE_COLUMNS_MISSING';
  end if;

  if has_any_column_privilege('anon','public.otc_outlets','update')
     or has_any_column_privilege('anon','public.otc_products','update')
     or has_any_column_privilege('anon','public.otc_outlet_products','update')
     or has_any_column_privilege('authenticated','public.otc_outlets','update')
     or has_column_privilege('authenticated','public.otc_products','business_id','update')
     or has_column_privilege('authenticated','public.otc_products','base_price','update')
     or has_column_privilege('authenticated','public.otc_outlet_products','outlet_id','update')
     or has_column_privilege('authenticated','public.otc_outlet_products','product_id','update')
     or has_column_privilege('authenticated','public.otc_outlet_products','allow_dp','update')
     or has_column_privilege('authenticated','public.otc_outlet_products','allow_full_payment','update')
     or has_column_privilege('authenticated','public.otc_outlet_products','dp_type','update')
     or has_column_privilege('authenticated','public.otc_outlet_products','dp_value','update') then
    raise exception 'AUTHENTICATED_OR_ANON_UNEXPECTED_CATALOG_COLUMN_UPDATE_PRIVILEGE';
  end if;

  -- No stale column-level INSERT or REFERENCES grants may survive for clients.
  for v_col in
    select c.oid::regclass as relation, a.attname
    from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    join pg_attribute a on a.attrelid=c.oid
    where n.nspname='public'
      and c.relname = any(array['otc_outlets','otc_products','otc_outlet_products'])
      and a.attnum > 0 and not a.attisdropped
  loop
    if has_column_privilege('anon',v_col.relation,v_col.attname,'insert')
       or has_column_privilege('authenticated',v_col.relation,v_col.attname,'insert')
       or has_column_privilege('anon',v_col.relation,v_col.attname,'references')
       or has_column_privilege('authenticated',v_col.relation,v_col.attname,'references') then
      raise exception 'PUBLIC_CATALOG_STALE_CLIENT_COLUMN_INSERT_OR_REFERENCES_PRIVILEGE: %, %',
        v_col.relation,v_col.attname;
    end if;
  end loop;

  for v_col in
    select attname
    from pg_attribute
    where attrelid='public.otc_products'::regclass
      and attnum>0 and not attisdropped
      and attname not in ('name','description','category','image_url','is_active')
  loop
    if has_column_privilege('authenticated','public.otc_products',v_col.attname,'update') then
      raise exception 'UNEXPECTED_PRODUCT_UPDATE_COLUMN: %',v_col.attname;
    end if;
  end loop;

  for v_col in
    select attname
    from pg_attribute
    where attrelid='public.otc_outlet_products'::regclass
      and attnum>0 and not attisdropped
      and attname not in ('price','is_available')
  loop
    if has_column_privilege('authenticated','public.otc_outlet_products',v_col.attname,'update') then
      raise exception 'UNEXPECTED_OUTLET_PRODUCT_UPDATE_COLUMN: %',v_col.attname;
    end if;
  end loop;
end
$$;
