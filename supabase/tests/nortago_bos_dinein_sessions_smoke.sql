-- NORTAGO BOS Dine-In session schema and privilege assertions; staging/disposable DB only.
do $$
begin
 if to_regclass('public.nortago_bos_table_sessions') is null then raise exception 'Missing session table'; end if;
 if not exists(select 1 from pg_class where oid='public.nortago_bos_table_sessions'::regclass and relrowsecurity=true) then raise exception 'RLS required'; end if;
 if to_regprocedure('public.nortago_bos_session_list(uuid)') is null or to_regprocedure('public.nortago_bos_session_open(uuid,uuid,text,integer,text)') is null or to_regprocedure('public.nortago_bos_session_close(uuid)') is null then raise exception 'Missing session RPC'; end if;
 if not exists(select 1 from pg_proc where oid='public.nortago_bos_session_list(uuid)'::regprocedure and prosecdef=true) or not exists(select 1 from pg_proc where oid='public.nortago_bos_session_open(uuid,uuid,text,integer,text)'::regprocedure and prosecdef=true) or not exists(select 1 from pg_proc where oid='public.nortago_bos_session_close(uuid)'::regprocedure and prosecdef=true) then raise exception 'RPCs must be SECURITY DEFINER'; end if;
 if has_function_privilege('anon','public.nortago_bos_session_list(uuid)','EXECUTE') or has_function_privilege('anon','public.nortago_bos_session_open(uuid,uuid,text,integer,text)','EXECUTE') or has_function_privilege('anon','public.nortago_bos_session_close(uuid)','EXECUTE') then raise exception 'Anonymous RPC access denied'; end if;
 if exists(select 1 from pg_policies where schemaname='public' and tablename='nortago_bos_table_sessions' and roles && array['anon','authenticated']::name[]) then raise exception 'No direct client policies'; end if;
 raise notice 'NORTAGO BOS Dine-In session smoke checks passed';
end;
$$;
