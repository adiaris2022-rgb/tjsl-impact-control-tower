-- NORTAGO ORDER: verify the lifecycle RPC has a dedicated, minimal owner boundary.
-- Runs only in disposable PostgreSQL CI. No staging/live database is touched.
begin;

do $$
declare
  v_role_oid oid;
  v_rpc_oid oid;
  v_auth_actor_oid oid;
  v_auth_actor_owner name;
  v_auth_actor_config text[];
  v_auth_actor_security_definer boolean;
  v_count integer;
  v_col record;
  v_priv text;
  v_allowed_select text[] := array['id','business_id','outlet_id','status','fulfillment_type'];
  v_allowed_update text[] := array['status','updated_at'];
  v_allowed_outlet_select text[] := array['id','business_id'];
  v_allowed_audit_insert text[] := array[
    'order_id','business_id','outlet_id','actor_user_id','from_status','to_status','note'
  ];
begin
  select oid into v_role_oid
  from pg_roles where rolname='nortago_order_lifecycle_owner';
  if v_role_oid is null then
    raise exception 'NORTAGO_LIFECYCLE_OWNER_ROLE_MISSING';
  end if;

  if exists (
    select 1 from pg_roles
    where oid=v_role_oid
      and (rolcanlogin or rolinherit or rolsuper or rolcreatedb
        or rolcreaterole or rolreplication or rolbypassrls)
  ) then
    raise exception 'NORTAGO_LIFECYCLE_OWNER_ROLE_ATTRIBUTES_UNSAFE';
  end if;

  if exists (select 1 from pg_auth_members where member=v_role_oid or roleid=v_role_oid) then
    raise exception 'NORTAGO_LIFECYCLE_OWNER_ROLE_MEMBERSHIP_NOT_EMPTY';
  end if;

  if has_schema_privilege('nortago_order_lifecycle_owner','public','create') then
    raise exception 'NORTAGO_LIFECYCLE_OWNER_PUBLIC_CREATE_PRIVILEGE_PRESENT';
  end if;

  select oid into v_rpc_oid
  from pg_proc
  where oid=to_regprocedure('public.nortago_update_order_status(uuid,text,text)');
  if v_rpc_oid is null then
    raise exception 'NORTAGO_LIFECYCLE_RPC_MISSING';
  end if;

  if (select proowner from pg_proc where oid=v_rpc_oid) <> v_role_oid
     or not (select prosecdef from pg_proc where oid=v_rpc_oid) then
    raise exception 'NORTAGO_LIFECYCLE_RPC_OWNER_OR_SECURITY_MODE_INVALID';
  end if;

  select count(*) into v_count
  from pg_proc
  where proowner=v_role_oid and prosecdef;
  if v_count <> 1 then
    raise exception 'NORTAGO_LIFECYCLE_OWNER_MUST_OWN_EXACTLY_ONE_SECURITY_DEFINER_FUNCTION: %',v_count;
  end if;

  select p.oid, pg_get_userbyid(p.proowner), p.proconfig, p.prosecdef
    into v_auth_actor_oid, v_auth_actor_owner, v_auth_actor_config, v_auth_actor_security_definer
  from pg_proc p
  where p.oid=to_regprocedure('public.nortago_order_auth_actor()');

  if v_auth_actor_oid is null
     or v_auth_actor_owner in ('anon','authenticated')
     or not v_auth_actor_security_definer
     or not ('search_path=pg_catalog' = any(coalesce(v_auth_actor_config, array[]::text[]))) then
    raise exception 'NORTAGO_LIFECYCLE_AUTH_ACTOR_BRIDGE_UNSAFE';
  end if;

  if not has_function_privilege('nortago_order_lifecycle_owner','public.nortago_order_auth_actor()','execute')
     or not has_function_privilege('nortago_order_lifecycle_owner','public.has_business_role(uuid,text[])','execute')
     or has_function_privilege('anon','public.nortago_order_auth_actor()','execute')
     or has_function_privilege('authenticated','public.nortago_order_auth_actor()','execute')
     or has_schema_privilege('nortago_order_lifecycle_owner','auth','usage') then
    raise exception 'NORTAGO_LIFECYCLE_OWNER_HELPER_EXECUTE_OR_AUTH_SCHEMA_BOUNDARY_INVALID';
  end if;

  if not exists (
    select 1 from pg_roles
    where rolname='nortago_order_migration_executor_ci'
      and rolcreaterole and not rolsuper and not rolcanlogin
  ) then
    raise exception 'NORTAGO_MANAGED_MIGRATION_EXECUTOR_FIXTURE_MISSING';
  end if;
  if exists (
    select 1 from pg_auth_members m
    join pg_roles executor on executor.oid=m.member
    join pg_roles owner_role on owner_role.oid=m.roleid
    where executor.rolname='nortago_order_migration_executor_ci'
      and owner_role.rolname='nortago_order_lifecycle_owner'
  ) then
    raise exception 'NORTAGO_MIGRATION_EXECUTOR_MEMBERSHIP_NOT_REVOKED';
  end if;

  -- No table-level privileges on the order header; only the listed columns.
  foreach v_priv in array array['select','insert','update','delete','truncate','references','trigger'] loop
    if has_table_privilege('nortago_order_lifecycle_owner','public.otc_orders',v_priv) then
      raise exception 'NORTAGO_LIFECYCLE_OWNER_ORDERS_TABLE_PRIVILEGE_TOO_BROAD: %',v_priv;
    end if;
  end loop;

  for v_col in
    select attname from pg_attribute
    where attrelid='public.otc_orders'::regclass and attnum>0 and not attisdropped
  loop
    if has_column_privilege('nortago_order_lifecycle_owner','public.otc_orders',v_col.attname,'select')
       is distinct from (v_col.attname = any(v_allowed_select)) then
      raise exception 'NORTAGO_LIFECYCLE_OWNER_ORDERS_SELECT_COLUMN_MISMATCH: %',v_col.attname;
    end if;
    if has_column_privilege('nortago_order_lifecycle_owner','public.otc_orders',v_col.attname,'update')
       is distinct from (v_col.attname = any(v_allowed_update)) then
      raise exception 'NORTAGO_LIFECYCLE_OWNER_ORDERS_UPDATE_COLUMN_MISMATCH: %',v_col.attname;
    end if;
    if has_column_privilege('nortago_order_lifecycle_owner','public.otc_orders',v_col.attname,'insert')
       or has_column_privilege('nortago_order_lifecycle_owner','public.otc_orders',v_col.attname,'references') then
      raise exception 'NORTAGO_LIFECYCLE_OWNER_ORDERS_INSERT_OR_REFERENCE_PRIVILEGE_PRESENT: %',v_col.attname;
    end if;
  end loop;

  foreach v_priv in array array['select','insert','update','delete','truncate','references','trigger'] loop
    if has_table_privilege('nortago_order_lifecycle_owner','public.otc_outlets',v_priv) then
      raise exception 'NORTAGO_LIFECYCLE_OWNER_OUTLETS_TABLE_PRIVILEGE_TOO_BROAD: %',v_priv;
    end if;
    if has_table_privilege('nortago_order_lifecycle_owner','public.nortago_order_status_audit',v_priv) then
      raise exception 'NORTAGO_LIFECYCLE_OWNER_AUDIT_TABLE_PRIVILEGE_TOO_BROAD: %',v_priv;
    end if;
    if has_table_privilege('nortago_order_lifecycle_owner','public.otc_order_items',v_priv) then
      raise exception 'NORTAGO_LIFECYCLE_OWNER_ITEMS_TABLE_PRIVILEGE_PRESENT: %',v_priv;
    end if;
  end loop;

  for v_col in
    select attname from pg_attribute
    where attrelid='public.otc_outlets'::regclass and attnum>0 and not attisdropped
  loop
    if has_column_privilege('nortago_order_lifecycle_owner','public.otc_outlets',v_col.attname,'select')
       is distinct from (v_col.attname = any(v_allowed_outlet_select)) then
      raise exception 'NORTAGO_LIFECYCLE_OWNER_OUTLET_SELECT_COLUMN_MISMATCH: %',v_col.attname;
    end if;
    if has_column_privilege('nortago_order_lifecycle_owner','public.otc_outlets',v_col.attname,'insert')
       or has_column_privilege('nortago_order_lifecycle_owner','public.otc_outlets',v_col.attname,'update')
       or has_column_privilege('nortago_order_lifecycle_owner','public.otc_outlets',v_col.attname,'references') then
      raise exception 'NORTAGO_LIFECYCLE_OWNER_OUTLET_MUTATION_PRIVILEGE_PRESENT: %',v_col.attname;
    end if;
  end loop;

  for v_col in
    select attname from pg_attribute
    where attrelid='public.nortago_order_status_audit'::regclass and attnum>0 and not attisdropped
  loop
    if has_column_privilege('nortago_order_lifecycle_owner','public.nortago_order_status_audit',v_col.attname,'insert')
       is distinct from (v_col.attname = any(v_allowed_audit_insert)) then
      raise exception 'NORTAGO_LIFECYCLE_OWNER_AUDIT_INSERT_COLUMN_MISMATCH: %',v_col.attname;
    end if;
    if has_column_privilege('nortago_order_lifecycle_owner','public.nortago_order_status_audit',v_col.attname,'select')
       or has_column_privilege('nortago_order_lifecycle_owner','public.nortago_order_status_audit',v_col.attname,'update')
       or has_column_privilege('nortago_order_lifecycle_owner','public.nortago_order_status_audit',v_col.attname,'references') then
      raise exception 'NORTAGO_LIFECYCLE_OWNER_AUDIT_READ_OR_MUTATION_PRIVILEGE_PRESENT: %',v_col.attname;
    end if;
  end loop;

  for v_col in
    select attname from pg_attribute
    where attrelid='public.otc_order_items'::regclass and attnum>0 and not attisdropped
  loop
    if has_column_privilege('nortago_order_lifecycle_owner','public.otc_order_items',v_col.attname,'select')
       or has_column_privilege('nortago_order_lifecycle_owner','public.otc_order_items',v_col.attname,'insert')
       or has_column_privilege('nortago_order_lifecycle_owner','public.otc_order_items',v_col.attname,'update')
       or has_column_privilege('nortago_order_lifecycle_owner','public.otc_order_items',v_col.attname,'references') then
      raise exception 'NORTAGO_LIFECYCLE_OWNER_ITEMS_COLUMN_PRIVILEGE_PRESENT: %',v_col.attname;
    end if;
  end loop;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='otc_orders'
      and policyname='nortago_lifecycle_owner_orders_select'
      and cmd='SELECT' and roles @> array['nortago_order_lifecycle_owner'::name]
      and qual is not null
  ) or not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='otc_orders'
      and policyname='nortago_lifecycle_owner_orders_update'
      and cmd='UPDATE' and roles @> array['nortago_order_lifecycle_owner'::name]
      and qual is not null and with_check is not null
  ) or not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='otc_outlets'
      and policyname='nortago_lifecycle_owner_outlets_select'
      and cmd='SELECT' and roles @> array['nortago_order_lifecycle_owner'::name]
      and qual is not null
  ) or not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='nortago_order_status_audit'
      and policyname='nortago_lifecycle_owner_audit_insert'
      and cmd='INSERT' and roles @> array['nortago_order_lifecycle_owner'::name]
      and with_check is not null
  ) then
    raise exception 'NORTAGO_LIFECYCLE_OWNER_RLS_POLICIES_INCOMPLETE';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid='public.otc_orders'::regclass
      and tgname='otc_orders_status_rpc_owner_guard'
      and not tgisinternal and tgenabled in ('O','A')
  ) then
    raise exception 'NORTAGO_LIFECYCLE_STATUS_OWNER_GUARD_TRIGGER_MISSING_OR_DISABLED';
  end if;

  if has_table_privilege('authenticated','public.otc_orders','update')
     or has_any_column_privilege('authenticated','public.otc_orders','update') then
    -- This test runs before the separate rollback-only inherited privilege fixture.
    raise exception 'AUTHENTICATED_ORDER_UPDATE_PRIVILEGE_SHOULD_BE_REVOKED';
  end if;
end
$$;

rollback;
