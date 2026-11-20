-- NORTAGO BOS Walk-In & Queue schema/security smoke assertions.
-- Run after migration in disposable/staging only.

do $$
begin
  if to_regclass('public.nortago_bos_queue_entries') is null or to_regclass('public.nortago_bos_queue_counters') is null then
    raise exception 'Missing BOS queue storage';
  end if;
  if not exists (select 1 from pg_class where oid='public.nortago_bos_queue_entries'::regclass and relrowsecurity=true)
    or not exists (select 1 from pg_class where oid='public.nortago_bos_queue_counters'::regclass and relrowsecurity=true) then
    raise exception 'RLS must be enabled on queue storage';
  end if;
  if to_regprocedure('public.nortago_bos_queue_list(uuid)') is null
    or to_regprocedure('public.nortago_bos_queue_add(uuid,text,integer,text)') is null
    or to_regprocedure('public.nortago_bos_queue_update(uuid,text,uuid)') is null then
    raise exception 'Missing BOS queue RPC';
  end if;
  if not exists (select 1 from pg_proc where oid='public.nortago_bos_queue_list(uuid)'::regprocedure and prosecdef=true)
    or not exists (select 1 from pg_proc where oid='public.nortago_bos_queue_add(uuid,text,integer,text)'::regprocedure and prosecdef=true)
    or not exists (select 1 from pg_proc where oid='public.nortago_bos_queue_update(uuid,text,uuid)'::regprocedure and prosecdef=true) then
    raise exception 'Queue RPCs must be SECURITY DEFINER';
  end if;
  if has_function_privilege('anon','public.nortago_bos_queue_list(uuid)','EXECUTE')
    or has_function_privilege('anon','public.nortago_bos_queue_add(uuid,text,integer,text)','EXECUTE')
    or has_function_privilege('anon','public.nortago_bos_queue_update(uuid,text,uuid)','EXECUTE') then
    raise exception 'Anonymous queue RPC execution must be denied';
  end if;
  if not has_function_privilege('authenticated','public.nortago_bos_queue_list(uuid)','EXECUTE')
    or not has_function_privilege('authenticated','public.nortago_bos_queue_add(uuid,text,integer,text)','EXECUTE')
    or not has_function_privilege('authenticated','public.nortago_bos_queue_update(uuid,text,uuid)','EXECUTE') then
    raise exception 'Authenticated role must have queue RPC grants';
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename in ('nortago_bos_queue_entries','nortago_bos_queue_counters') and roles && array['anon','authenticated']::name[]) then
    raise exception 'Direct client policies must not exist on BOS queue tables';
  end if;
  raise notice 'NORTAGO BOS Walk-In and Queue schema/security smoke checks passed';
end;
$$;