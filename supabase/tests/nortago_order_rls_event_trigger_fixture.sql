-- Disposable-CI fixture only: reproduce the optional Supabase RLS DDL event helper.
-- Never run this fixture against staging or production.
drop event trigger if exists ensure_rls;
create or replace function public.rls_auto_enable()
returns event_trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  cmd record;
  tbl name;
begin
  for cmd in
    select *
    from pg_event_trigger_ddl_commands()
    where command_tag in ('CREATE TABLE','CREATE TABLE AS','SELECT INTO')
      and object_type in ('table','partitioned table')
  loop
    if cmd.schema_name is not null
       and cmd.schema_name='public'
       and cmd.schema_name not in ('pg_catalog','information_schema')
       and cmd.schema_name not like 'pg_toast%'
       and cmd.schema_name not like 'pg_temp%' then
      begin
        select c.relname into tbl
        from pg_catalog.pg_class c
        where c.oid=cmd.objid;
        execute format('alter table if exists %I.%I enable row level security',cmd.schema_name,tbl);
      exception when others then
        raise log 'rls_auto_enable fixture failed for %',cmd.object_identity;
      end;
    end if;
  end loop;
end;
$function$;
create event trigger ensure_rls
on ddl_command_end
execute function public.rls_auto_enable();

do $$
begin
  if not has_function_privilege('anon','public.rls_auto_enable()','execute')
     or not has_function_privilege('authenticated','public.rls_auto_enable()','execute') then
    raise exception 'RLS_EVENT_HELPER_FIXTURE_MUST_REPRODUCE_CLIENT_EXECUTE';
  end if;
  if not exists (
    select 1 from pg_event_trigger e
    where e.evtname='ensure_rls'
      and e.evtfoid='public.rls_auto_enable()'::regprocedure
      and e.evtenabled in ('O','A')
  ) then
    raise exception 'RLS_EVENT_HELPER_FIXTURE_EVENT_TRIGGER_MISSING';
  end if;
end
$$;
