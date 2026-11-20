-- NORTAGO BOS Table Management schema/security smoke assertions.
-- Run only after migration on a disposable/staging database. No live writes.

do $$
begin
  if to_regclass('public.nortago_bos_tables') is null then
    raise exception 'Missing BOS table register';
  end if;
  if not exists (
    select 1 from pg_class where oid='public.nortago_bos_tables'::regclass and relrowsecurity=true
  ) then
    raise exception 'RLS must be enabled on BOS table register';
  end if;
  if to_regprocedure('public.nortago_bos_table_list(uuid)') is null then
    raise exception 'Missing BOS table list RPC';
  end if;
  if to_regprocedure('public.nortago_bos_table_save(uuid,uuid,text,text,integer,text,boolean)') is null then
    raise exception 'Missing BOS table save RPC';
  end if;
  if not exists (
    select 1 from pg_proc
    where oid='public.nortago_bos_table_list(uuid)'::regprocedure and prosecdef=true
  ) then
    raise exception 'Table list RPC must be SECURITY DEFINER';
  end if;
  if not exists (
    select 1 from pg_proc
    where oid='public.nortago_bos_table_save(uuid,uuid,text,text,integer,text,boolean)'::regprocedure and prosecdef=true
  ) then
    raise exception 'Table save RPC must be SECURITY DEFINER';
  end if;
  if has_function_privilege('anon','public.nortago_bos_table_list(uuid)','EXECUTE')
    or has_function_privilege('anon','public.nortago_bos_table_save(uuid,uuid,text,text,integer,text,boolean)','EXECUTE') then
    raise exception 'Anonymous role must not execute BOS table management RPCs';
  end if;
  if not has_function_privilege('authenticated','public.nortago_bos_table_list(uuid)','EXECUTE')
    or not has_function_privilege('authenticated','public.nortago_bos_table_save(uuid,uuid,text,text,integer,text,boolean)','EXECUTE') then
    raise exception 'Authenticated role needs RPC execution grants';
  end if;
  if exists (
    select 1 from pg_policies where schemaname='public' and tablename='nortago_bos_tables'
      and roles && array['anon','authenticated']::name[]
  ) then
    raise exception 'Direct client policies must not exist on BOS table register';
  end if;
  raise notice 'NORTAGO BOS Table Management schema/security smoke checks passed';
end;
$$;
