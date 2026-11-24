-- Disposable PostgreSQL CI fixture: model the managed Supabase migration executor.
-- This is not applied to Supabase staging or production.
do $$
begin
  if not exists (select 1 from pg_roles where rolname='nortago_order_migration_executor_ci') then
    create role nortago_order_migration_executor_ci
      nologin noinherit createrole nosuperuser nocreatedb noreplication nobypassrls;
  end if;
end
$$;

grant usage on schema public, auth to nortago_order_migration_executor_ci;
grant create on schema public to nortago_order_migration_executor_ci with grant option;

alter table public.otc_orders owner to nortago_order_migration_executor_ci;
alter table public.otc_outlets owner to nortago_order_migration_executor_ci;
alter table public.otc_order_items owner to nortago_order_migration_executor_ci;
alter table public.nortago_order_status_audit owner to nortago_order_migration_executor_ci;

alter function public.nortago_update_order_status(uuid,text,text)
  owner to nortago_order_migration_executor_ci;

grant execute on function public.has_business_role(uuid,text[])
  to nortago_order_migration_executor_ci with grant option;

-- Simulate an interrupted prior owner migration that left only the trusted
-- migration executor as a temporary SET-only member. The candidate migration must
-- remove this residue, recreate the temporary membership, and revoke it again.
do $$
begin
  if not exists (select 1 from pg_roles where rolname='nortago_order_lifecycle_owner') then
    create role nortago_order_lifecycle_owner
      nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
  end if;
end
$$;
-- Prove the non-superuser CREATEROLE executor can grant itself SET-only membership,
-- create a role, and drop that probe role. The migration must clean the membership.
set session authorization nortago_order_migration_executor_ci;
grant nortago_order_lifecycle_owner to nortago_order_migration_executor_ci
  with inherit false, set true, admin false;
create role nortago_order_migration_create_probe
  nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
drop role nortago_order_migration_create_probe;
reset session authorization;

-- Diagnostic evidence for any pre-existing owner-role membership in the disposable database.
select rolname, oid
from pg_roles
where rolname='nortago_order_lifecycle_owner';

select
  member::regrole as member_role,
  roleid::regrole as granted_role,
  admin_option,
  inherit_option,
  set_option
from pg_auth_members
where member=(select oid from pg_roles where rolname='nortago_order_lifecycle_owner')
   or roleid=(select oid from pg_roles where rolname='nortago_order_lifecycle_owner')
order by 1,2;
