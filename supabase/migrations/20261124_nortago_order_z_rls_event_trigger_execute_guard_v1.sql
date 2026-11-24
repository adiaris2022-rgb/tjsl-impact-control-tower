-- NORTAGO ORDER: remove client EXECUTE from the optional Supabase RLS DDL event helper.
-- The event trigger itself remains enabled; PostgreSQL invokes it internally for DDL.
-- Conditional because not every approved staging target has this platform helper.
-- No global default privileges, event-trigger definitions, or unrelated functions are changed.

do $$
declare
  v_function oid := to_regprocedure('public.rls_auto_enable()');
  v_owner oid;
  v_is_security_definer boolean;
  v_return_type oid;
  v_owner_is_superuser boolean;
begin
  if v_function is null then
    raise notice 'NORTAGO_RLS_EVENT_HELPER_NOT_PRESENT; no ACL change required';
    return;
  end if;

  select p.proowner, p.prosecdef, p.prorettype
    into v_owner, v_is_security_definer, v_return_type
  from pg_proc p
  where p.oid=v_function;

  if not v_is_security_definer
     or v_return_type <> 'pg_catalog.event_trigger'::regtype then
    raise exception 'NORTAGO_RLS_EVENT_HELPER_CONTRACT_MISMATCH';
  end if;

  if not exists (
    select 1 from pg_event_trigger e
    where e.evtfoid=v_function and e.evtenabled in ('O','A')
  ) then
    raise exception 'NORTAGO_RLS_EVENT_HELPER_NOT_ATTACHED_TO_ENABLED_EVENT_TRIGGER';
  end if;

  select r.rolsuper into v_owner_is_superuser
  from pg_roles r
  where r.rolname=current_user;

  if current_user <> pg_get_userbyid(v_owner)
     and not coalesce(v_owner_is_superuser,false)
     and not pg_has_role(current_user,v_owner,'MEMBER') then
    raise exception 'NORTAGO_RLS_EVENT_HELPER_ACL_CHANGE_REQUIRES_OWNER_OR_SUPERUSER';
  end if;

  execute 'revoke all on function public.rls_auto_enable() from public';
  if to_regrole('anon') is not null then
    execute 'revoke all on function public.rls_auto_enable() from anon';
  end if;
  if to_regrole('authenticated') is not null then
    execute 'revoke all on function public.rls_auto_enable() from authenticated';
  end if;

  if to_regrole('anon') is not null
     and has_function_privilege('anon',v_function,'execute') then
    raise exception 'NORTAGO_RLS_EVENT_HELPER_ANON_EXECUTE_STILL_EFFECTIVE';
  end if;
  if to_regrole('authenticated') is not null
     and has_function_privilege('authenticated',v_function,'execute') then
    raise exception 'NORTAGO_RLS_EVENT_HELPER_AUTHENTICATED_EXECUTE_STILL_EFFECTIVE';
  end if;

  if not exists (
    select 1 from pg_event_trigger e
    where e.evtfoid=v_function and e.evtenabled in ('O','A')
  ) then
    raise exception 'NORTAGO_RLS_EVENT_TRIGGER_MUST_REMAIN_ENABLED';
  end if;
end
$$;
