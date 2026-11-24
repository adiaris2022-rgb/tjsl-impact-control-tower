-- NORTAGO ORDER: keep the deferred reservation foundation inaccessible to all API roles.
-- Reservation is outside the Order release. Keep legacy objects for migration-history
-- compatibility, but remove every direct table privilege and RPC EXECUTE path.
-- The customer route is a static unavailable page; no reservation workflow is exposed.

do $nortago_reservation_disable_preflight$
declare
  v_executor oid := (select oid from pg_roles where rolname=current_user);
  v_table oid := to_regclass('public.otc_reservations');
  v_create_rpc oid := to_regprocedure(
    'public.nortago_create_customer_reservation(uuid,text,text,timestamp with time zone,integer,text)'
  );
  v_update_rpc oid := to_regprocedure('public.nortago_update_reservation_status(uuid,text)');
begin
  if v_table is null then
    raise exception 'NORTAGO_DEFERRED_RESERVATION_TABLE_MISSING';
  end if;
  if (select relowner from pg_class where oid=v_table) <> v_executor then
    raise exception 'NORTAGO_DEFERRED_RESERVATION_EXECUTOR_MUST_OWN_TABLE';
  end if;
  if not (select relrowsecurity from pg_class where oid=v_table) then
    raise exception 'NORTAGO_DEFERRED_RESERVATION_RLS_MUST_REMAIN_ENABLED';
  end if;
  if v_create_rpc is null or v_update_rpc is null then
    raise exception 'NORTAGO_DEFERRED_RESERVATION_RPC_MISSING';
  end if;
end
$nortago_reservation_disable_preflight$;

revoke all on table public.otc_reservations
  from public, anon, authenticated, service_role;

-- Clear stale per-column grants as well as table-level defaults.
do $nortago_reservation_column_acl$
declare
  v_column record;
begin
  for v_column in
    select a.attname
    from pg_attribute a
    where a.attrelid='public.otc_reservations'::regclass
      and a.attnum > 0
      and not a.attisdropped
  loop
    execute format(
      'revoke all privileges (%I) on table public.otc_reservations from public, anon, authenticated, service_role',
      v_column.attname
    );
  end loop;
end
$nortago_reservation_column_acl$;

revoke all on function public.nortago_create_customer_reservation(
  uuid,text,text,timestamptz,integer,text
) from public, anon, authenticated, service_role;
revoke all on function public.nortago_update_reservation_status(uuid,text)
  from public, anon, authenticated, service_role;

do $nortago_reservation_disable_assert$
declare
  v_role text;
begin
  foreach v_role in array array['anon','authenticated','service_role'] loop
    if has_table_privilege(v_role,'public.otc_reservations','select')
       or has_table_privilege(v_role,'public.otc_reservations','insert')
       or has_table_privilege(v_role,'public.otc_reservations','update')
       or has_table_privilege(v_role,'public.otc_reservations','delete')
       or has_table_privilege(v_role,'public.otc_reservations','truncate')
       or has_table_privilege(v_role,'public.otc_reservations','references')
       or has_table_privilege(v_role,'public.otc_reservations','trigger')
       or has_table_privilege(v_role,'public.otc_reservations','maintain')
       or has_any_column_privilege(v_role,'public.otc_reservations','select')
       or has_any_column_privilege(v_role,'public.otc_reservations','insert')
       or has_any_column_privilege(v_role,'public.otc_reservations','update')
       or has_any_column_privilege(v_role,'public.otc_reservations','references') then
      raise exception 'NORTAGO_DEFERRED_RESERVATION_TABLE_PRIVILEGE_REMAINS: %',v_role;
    end if;
  end loop;

  if has_function_privilege('anon','public.nortago_create_customer_reservation(uuid,text,text,timestamp with time zone,integer,text)','execute')
     or has_function_privilege('authenticated','public.nortago_create_customer_reservation(uuid,text,text,timestamp with time zone,integer,text)','execute')
     or has_function_privilege('service_role','public.nortago_create_customer_reservation(uuid,text,text,timestamp with time zone,integer,text)','execute')
     or has_function_privilege('anon','public.nortago_update_reservation_status(uuid,text)','execute')
     or has_function_privilege('authenticated','public.nortago_update_reservation_status(uuid,text)','execute')
     or has_function_privilege('service_role','public.nortago_update_reservation_status(uuid,text)','execute') then
    raise exception 'NORTAGO_DEFERRED_RESERVATION_RPC_EXECUTE_REMAINS';
  end if;

  if not (select relrowsecurity from pg_class where oid='public.otc_reservations'::regclass) then
    raise exception 'NORTAGO_DEFERRED_RESERVATION_RLS_WAS_DISABLED';
  end if;
end
$nortago_reservation_disable_assert$;
