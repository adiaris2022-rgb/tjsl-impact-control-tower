-- NORTAGO BOS table management schema/security smoke assertions.
do $$
declare
  v_list text;
  v_save text;
begin
 if to_regclass('public.nortago_bos_tables') is null then raise exception 'Missing table registry'; end if;
 if not exists(select 1 from pg_class where oid='public.nortago_bos_tables'::regclass and relrowsecurity=true) then raise exception 'Table registry RLS required'; end if;
 if to_regprocedure('public.nortago_bos_table_list(uuid)') is null or to_regprocedure('public.nortago_bos_table_save(uuid,uuid,text,text,integer,text,boolean)') is null then raise exception 'Missing table RPC'; end if;
 if not exists(select 1 from pg_proc where oid='public.nortago_bos_table_list(uuid)'::regprocedure and prosecdef=true) or not exists(select 1 from pg_proc where oid='public.nortago_bos_table_save(uuid,uuid,text,text,integer,text,boolean)'::regprocedure and prosecdef=true) then raise exception 'Table RPCs must be SECURITY DEFINER'; end if;
 if has_function_privilege('anon','public.nortago_bos_table_list(uuid)','EXECUTE') or has_function_privilege('anon','public.nortago_bos_table_save(uuid,uuid,text,text,integer,text,boolean)','EXECUTE') then raise exception 'Anonymous table RPC access denied'; end if;
 if not has_function_privilege('authenticated','public.nortago_bos_table_list(uuid)','EXECUTE') or not has_function_privilege('authenticated','public.nortago_bos_table_save(uuid,uuid,text,text,integer,text,boolean)','EXECUTE') then raise exception 'Authenticated table RPC grants missing'; end if;
 if exists(select 1 from pg_policies where schemaname='public' and tablename='nortago_bos_tables' and roles && array['anon','authenticated']::name[]) then raise exception 'Direct table registry policies must not exist'; end if;
 if not exists(select 1 from pg_indexes where schemaname='public' and indexname='nortago_bos_tables_id_outlet_unique') then raise exception 'Composite table/outlet key missing'; end if;
 v_list:=pg_get_functiondef('public.nortago_bos_table_list(uuid)'::regprocedure);
 v_save:=pg_get_functiondef('public.nortago_bos_table_save(uuid,uuid,text,text,integer,text,boolean)'::regprocedure);
 if position('nortago_outlet_has_bos' in v_list)=0 or position('has_business_role' in v_list)=0 then raise exception 'Table list must enforce BOS and outlet role'; end if;
 if position('nortago_outlet_has_bos' in v_save)=0 or position('has_business_role' in v_save)=0 then raise exception 'Table save must enforce BOS and outlet role'; end if;
 raise notice 'NORTAGO BOS table management schema/security checks passed';
end;
$$;
