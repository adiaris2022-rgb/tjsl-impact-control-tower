-- NORTAGO BOS Dine-In session schema/security/integration smoke assertions.
-- Run only after the migration on a disposable CI database.
do $$
declare
  v_open text;
  v_close text;
  v_queue_update text;
begin
 if to_regclass('public.nortago_bos_table_sessions') is null then raise exception 'Missing session table'; end if;
 if not exists(select 1 from pg_class where oid='public.nortago_bos_table_sessions'::regclass and relrowsecurity=true) then raise exception 'RLS required'; end if;
 if to_regprocedure('public.nortago_bos_session_list(uuid)') is null
   or to_regprocedure('public.nortago_bos_session_open(uuid,uuid,text,integer,text,uuid,uuid)') is null
   or to_regprocedure('public.nortago_bos_session_close(uuid)') is null then raise exception 'Missing session RPC'; end if;
 if not exists(select 1 from pg_proc where oid='public.nortago_bos_session_list(uuid)'::regprocedure and prosecdef=true)
   or not exists(select 1 from pg_proc where oid='public.nortago_bos_session_open(uuid,uuid,text,integer,text,uuid,uuid)'::regprocedure and prosecdef=true)
   or not exists(select 1 from pg_proc where oid='public.nortago_bos_session_close(uuid)'::regprocedure and prosecdef=true) then raise exception 'RPCs must be SECURITY DEFINER'; end if;
 if has_function_privilege('anon','public.nortago_bos_session_list(uuid)','EXECUTE')
   or has_function_privilege('anon','public.nortago_bos_session_open(uuid,uuid,text,integer,text,uuid,uuid)','EXECUTE')
   or has_function_privilege('anon','public.nortago_bos_session_close(uuid)','EXECUTE') then raise exception 'Anonymous RPC access denied'; end if;
 if not has_function_privilege('authenticated','public.nortago_bos_session_list(uuid)','EXECUTE')
   or not has_function_privilege('authenticated','public.nortago_bos_session_open(uuid,uuid,text,integer,text,uuid,uuid)','EXECUTE')
   or not has_function_privilege('authenticated','public.nortago_bos_session_close(uuid)','EXECUTE') then raise exception 'Authenticated RPC grants missing'; end if;
 if exists(select 1 from pg_policies where schemaname='public' and tablename='nortago_bos_table_sessions' and roles && array['anon','authenticated']::name[]) then raise exception 'No direct client policies'; end if;
 if not exists(select 1 from pg_indexes where schemaname='public' and indexname='nortago_bos_table_sessions_one_open_per_table') then raise exception 'One-open-session-per-table index required'; end if;
 if not exists(select 1 from pg_indexes where schemaname='public' and indexname='nortago_bos_table_sessions_one_queue_link') then raise exception 'Queue/session link must be unique'; end if;
 if not exists(select 1 from pg_indexes where schemaname='public' and indexname='nortago_bos_table_sessions_request_unique') then raise exception 'Session request idempotency index missing'; end if;
 if not exists(select 1 from pg_constraint where conname='nortago_bos_table_sessions_table_outlet_fkey' and conrelid='public.nortago_bos_table_sessions'::regclass) then raise exception 'Session table/outlet composite FK missing'; end if;
 if not exists(select 1 from pg_constraint where conname='nortago_bos_table_sessions_queue_entry_outlet_fkey' and conrelid='public.nortago_bos_table_sessions'::regclass) then raise exception 'Session queue/outlet composite FK missing'; end if;
 v_open:=pg_get_functiondef('public.nortago_bos_session_open(uuid,uuid,text,integer,text,uuid,uuid)'::regprocedure);
 v_close:=pg_get_functiondef('public.nortago_bos_session_close(uuid)'::regprocedure);
 v_queue_update:=pg_get_functiondef('public.nortago_bos_queue_update(uuid,text,uuid)'::regprocedure);
 if position('p_queue_id' in v_open)=0 or position('request_id' in v_open)=0 then raise exception 'Session opening must link queue and support idempotency'; end if;
 if position('COMPLETED' in v_close)=0 then raise exception 'Session close must complete linked queue entry'; end if;
 if position('v_table_capacity < v_entry.party_size' in v_queue_update)=0 then raise exception 'Queue RPC must enforce table capacity'; end if;
 if position('Invalid queue status transition' in v_queue_update)=0 then raise exception 'Queue RPC must enforce lifecycle transitions'; end if;
 if position('nortago_bos_table_sessions' in v_queue_update)=0 then raise exception 'Queue seating must guard open Dine-In sessions'; end if;
 raise notice 'NORTAGO BOS Dine-In schema/security/integration checks passed';
end;
$$;
