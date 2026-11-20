-- NORTAGO BOS Walk-In & Queue schema/security/idempotency assertions.
-- Run only after the migration on a disposable CI database.

do $$
declare
  v_add text;
  v_update text;
begin
  if to_regclass('public.nortago_bos_queue_entries') is null or to_regclass('public.nortago_bos_queue_counters') is null then
    raise exception 'Missing BOS queue storage';
  end if;
  if not exists (select 1 from pg_class where oid='public.nortago_bos_queue_entries'::regclass and relrowsecurity=true)
    or not exists (select 1 from pg_class where oid='public.nortago_bos_queue_counters'::regclass and relrowsecurity=true) then
    raise exception 'RLS must be enabled on queue storage';
  end if;
  if to_regprocedure('public.nortago_bos_queue_list(uuid)') is null
    or to_regprocedure('public.nortago_bos_queue_add(uuid,text,integer,text,uuid)') is null
    or to_regprocedure('public.nortago_bos_queue_update(uuid,text,uuid)') is null then
    raise exception 'Missing BOS queue RPC';
  end if;
  if not exists (select 1 from pg_proc where oid='public.nortago_bos_queue_list(uuid)'::regprocedure and prosecdef=true)
    or not exists (select 1 from pg_proc where oid='public.nortago_bos_queue_add(uuid,text,integer,text,uuid)'::regprocedure and prosecdef=true)
    or not exists (select 1 from pg_proc where oid='public.nortago_bos_queue_update(uuid,text,uuid)'::regprocedure and prosecdef=true) then
    raise exception 'Queue RPCs must be SECURITY DEFINER';
  end if;
  if has_function_privilege('anon','public.nortago_bos_queue_list(uuid)','EXECUTE')
    or has_function_privilege('anon','public.nortago_bos_queue_add(uuid,text,integer,text,uuid)','EXECUTE')
    or has_function_privilege('anon','public.nortago_bos_queue_update(uuid,text,uuid)','EXECUTE') then
    raise exception 'Anonymous queue RPC execution must be denied';
  end if;
  if not has_function_privilege('authenticated','public.nortago_bos_queue_list(uuid)','EXECUTE')
    or not has_function_privilege('authenticated','public.nortago_bos_queue_add(uuid,text,integer,text,uuid)','EXECUTE')
    or not has_function_privilege('authenticated','public.nortago_bos_queue_update(uuid,text,uuid)','EXECUTE') then
    raise exception 'Authenticated role must have queue RPC grants';
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename in ('nortago_bos_queue_entries','nortago_bos_queue_counters') and roles && array['anon','authenticated']::name[]) then
    raise exception 'Direct client policies must not exist on BOS queue tables';
  end if;
  if not exists(select 1 from pg_indexes where schemaname='public' and indexname='nortago_bos_queue_request_unique') then
    raise exception 'Missing queue request idempotency index';
  end if;
  if not exists(select 1 from pg_constraint where conname='nortago_bos_queue_entries_table_outlet_fkey' and conrelid='public.nortago_bos_queue_entries'::regclass) then
    raise exception 'Missing composite table/outlet foreign key';
  end if;
  v_add:=pg_get_functiondef('public.nortago_bos_queue_add(uuid,text,integer,text,uuid)'::regprocedure);
  v_update:=pg_get_functiondef('public.nortago_bos_queue_update(uuid,text,uuid)'::regprocedure);
  if position('request_id' in v_add)=0 or position('conflict' in lower(v_add))=0 then raise exception 'Queue add RPC must support request idempotency'; end if;
  if position('v_table_capacity < v_entry.party_size' in v_update)=0 then raise exception 'Queue RPC must enforce table capacity'; end if;
  if position('Invalid queue status transition' in v_update)=0 then raise exception 'Queue RPC must enforce lifecycle transitions'; end if;
  if position('nortago_bos_table_sessions' in v_update)=0 then raise exception 'Queue seating must guard open Dine-In sessions'; end if;
  if position('Asia/Jakarta' in pg_get_functiondef('public.nortago_bos_queue_list(uuid)'::regprocedure))=0 then raise exception 'Queue list must use Jakarta business day'; end if;
  raise notice 'NORTAGO BOS Walk-In and Queue schema/security/idempotency checks passed';
end;
$$;
