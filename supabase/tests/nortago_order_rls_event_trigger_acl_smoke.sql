-- Disposable PostgreSQL regression for optional RLS event-trigger helper ACL hardening.
begin;
do $$
declare
  v_function oid := to_regprocedure('public.rls_auto_enable()');
begin
  if v_function is null then
    raise exception 'RLS_EVENT_HELPER_FIXTURE_MISSING';
  end if;
  if has_function_privilege('anon',v_function,'execute')
     or has_function_privilege('authenticated',v_function,'execute') then
    raise exception 'RLS_EVENT_HELPER_CLIENT_EXECUTE_MUST_BE_REVOKED';
  end if;
  if not exists (
    select 1 from pg_event_trigger e
    where e.evtname='ensure_rls'
      and e.evtfoid=v_function
      and e.evtenabled in ('O','A')
  ) then
    raise exception 'RLS_EVENT_TRIGGER_MUST_REMAIN_ENABLED';
  end if;
end
$$;

create table public.nortago_rls_auto_enable_probe(id integer primary key);

do $$
begin
  if not coalesce((
    select c.relrowsecurity
    from pg_class c
    where c.oid='public.nortago_rls_auto_enable_probe'::regclass
  ),false) then
    raise exception 'RLS_EVENT_TRIGGER_DID_NOT_ENABLE_RLS_AFTER_CLIENT_EXECUTE_REVOKE';
  end if;
end
$$;
drop table public.nortago_rls_auto_enable_probe;
rollback;
