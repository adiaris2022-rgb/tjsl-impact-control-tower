-- Append-only privilege contract for order lifecycle audit.
-- Runs independently from row-visibility tests to keep role/RLS fixtures isolated.
begin;
do $$
begin
  if not exists (select 1 from pg_class where oid='public.nortago_order_status_audit'::regclass and relrowsecurity) then
    raise exception 'Audit table must have RLS enabled';
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='nortago_order_status_audit' and policyname='nortago_order_status_audit_manager_read') then
    raise exception 'Expected business-scoped audit SELECT policy is missing';
  end if;
  if has_table_privilege('anon','public.nortago_order_status_audit','select') then
    raise exception 'Anonymous role must not read audit records';
  end if;
  if not has_table_privilege('authenticated','public.nortago_order_status_audit','select') then
    raise exception 'Authenticated role should have SELECT under business-scoped RLS';
  end if;
  if has_table_privilege('authenticated','public.nortago_order_status_audit','insert') then
    raise exception 'Authenticated role must not insert audit records directly';
  end if;
  if has_table_privilege('authenticated','public.nortago_order_status_audit','update') then
    raise exception 'Authenticated role must not update audit records directly';
  end if;
  if has_table_privilege('authenticated','public.nortago_order_status_audit','delete') then
    raise exception 'Authenticated role must not delete audit records directly';
  end if;
end $$;
rollback;
