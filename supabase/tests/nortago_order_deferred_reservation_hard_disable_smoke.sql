-- NORTAGO ORDER deferred reservation hard-disable regression.
-- The table/functions remain only for migration-history compatibility; no API role
-- may read/write/truncate the deferred reservation feature.
begin;

do $nortago_reservation_privilege_matrix$
declare
  v_role text;
begin
  if not (select relrowsecurity from pg_class where oid='public.otc_reservations'::regclass) then
    raise exception 'DEFERRED_RESERVATION_RLS_MUST_REMAIN_ENABLED';
  end if;

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
      raise exception 'DEFERRED_RESERVATION_TABLE_ACCESS_REMAINS: %',v_role;
    end if;
  end loop;

  if has_function_privilege('anon','public.nortago_create_customer_reservation(uuid,text,text,timestamp with time zone,integer,text)','execute')
     or has_function_privilege('authenticated','public.nortago_create_customer_reservation(uuid,text,text,timestamp with time zone,integer,text)','execute')
     or has_function_privilege('service_role','public.nortago_create_customer_reservation(uuid,text,text,timestamp with time zone,integer,text)','execute')
     or has_function_privilege('anon','public.nortago_update_reservation_status(uuid,text)','execute')
     or has_function_privilege('authenticated','public.nortago_update_reservation_status(uuid,text)','execute')
     or has_function_privilege('service_role','public.nortago_update_reservation_status(uuid,text)','execute') then
    raise exception 'DEFERRED_RESERVATION_RPC_EXECUTE_REMAINS';
  end if;
end
$nortago_reservation_privilege_matrix$;

set local role anon;
do $nortago_reservation_anon$
begin
  begin
    perform 1 from public.otc_reservations;
    raise exception 'ANON_RESERVATION_READ_UNEXPECTEDLY_ALLOWED';
  exception when insufficient_privilege then null;
  end;
  begin
    execute 'truncate table public.otc_reservations';
    raise exception 'ANON_RESERVATION_TRUNCATE_UNEXPECTEDLY_ALLOWED';
  exception when insufficient_privilege then null;
  end;
end
$nortago_reservation_anon$;
reset role;

set local role authenticated;
do $nortago_reservation_authenticated$
begin
  begin
    perform 1 from public.otc_reservations;
    raise exception 'AUTH_RESERVATION_READ_UNEXPECTEDLY_ALLOWED';
  exception when insufficient_privilege then null;
  end;
  begin
    execute 'truncate table public.otc_reservations';
    raise exception 'AUTH_RESERVATION_TRUNCATE_UNEXPECTEDLY_ALLOWED';
  exception when insufficient_privilege then null;
  end;
end
$nortago_reservation_authenticated$;
reset role;

set local role service_role;
do $nortago_reservation_service$
begin
  begin
    perform 1 from public.otc_reservations;
    raise exception 'SERVICE_ROLE_RESERVATION_READ_UNEXPECTEDLY_ALLOWED';
  exception when insufficient_privilege then null;
  end;
  begin
    execute 'truncate table public.otc_reservations';
    raise exception 'SERVICE_ROLE_RESERVATION_TRUNCATE_UNEXPECTEDLY_ALLOWED';
  exception when insufficient_privilege then null;
  end;
end
$nortago_reservation_service$;
reset role;

rollback;
