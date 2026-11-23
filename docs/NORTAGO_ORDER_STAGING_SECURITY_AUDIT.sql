-- NORTAGO ORDER — read-only staging security audit
-- Run only in an owner-approved staging SQL session. This file contains SELECTs only.
-- Never run this against production as a substitute for approval or expose credentials/PII.
--
-- Expected release stack: RPC-only mutation of otc_orders/otc_order_items by anon/authenticated,
-- business-scoped SELECT for authenticated, and the enabled status-owner guard trigger.
-- service_role and table/function owners are privileged; their access is reported, not assumed safe.

-- 1) Effective table and column privileges (role membership is included by PostgreSQL privilege checks).
select
  role_name,
  has_table_privilege(role_name, 'public.otc_orders', 'select') as orders_select,
  has_table_privilege(role_name, 'public.otc_orders', 'insert') as orders_insert,
  has_table_privilege(role_name, 'public.otc_orders', 'update') as orders_table_update,
  has_table_privilege(role_name, 'public.otc_orders', 'delete') as orders_delete,
  has_table_privilege(role_name, 'public.otc_orders', 'truncate') as orders_truncate,
  has_any_column_privilege(role_name, 'public.otc_orders', 'insert') as orders_column_insert,
  has_any_column_privilege(role_name, 'public.otc_orders', 'update') as orders_column_update,
  has_column_privilege(role_name, 'public.otc_orders', 'status', 'update') as orders_status_update,
  has_table_privilege(role_name, 'public.otc_order_items', 'select') as items_select,
  has_table_privilege(role_name, 'public.otc_order_items', 'insert') as items_insert,
  has_table_privilege(role_name, 'public.otc_order_items', 'update') as items_update,
  has_table_privilege(role_name, 'public.otc_order_items', 'delete') as items_delete,
  has_table_privilege(role_name, 'public.otc_order_items', 'truncate') as items_truncate,
  has_any_column_privilege(role_name, 'public.otc_order_items', 'insert') as items_column_insert,
  has_any_column_privilege(role_name, 'public.otc_order_items', 'update') as items_column_update
from (values ('anon'), ('authenticated'), ('service_role')) as roles(role_name)
order by role_name;

-- 2) RLS enabled/forced state, table owner, and role attributes (BYPASSRLS/superuser).
select
  c.oid::regclass as table_name,
  pg_get_userbyid(c.relowner) as table_owner,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced,
  owner_role.rolsuper as owner_is_superuser,
  owner_role.rolbypassrls as owner_bypasses_rls
from pg_class c
join pg_roles owner_role on owner_role.oid = c.relowner
where c.oid in (
  'public.otc_orders'::regclass,
  'public.otc_order_items'::regclass,
  'public.nortago_order_status_audit'::regclass
)
order by table_name;

-- 3) Effective RLS policy definitions. Review USING and WITH CHECK, not just policy names.
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('otc_orders', 'otc_order_items', 'nortago_order_status_audit')
order by tablename, policyname;

-- 4) Trigger state and exact trigger/function definitions for order status writes.
select
  t.tgname as trigger_name,
  t.tgenabled as enabled_state, -- O=origin/local, A=always, D=disabled, R=replica
  pg_get_triggerdef(t.oid, true) as trigger_definition,
  p.oid::regprocedure as trigger_function,
  p.prosecdef as trigger_function_security_definer,
  pg_get_userbyid(p.proowner) as trigger_function_owner,
  has_function_privilege('anon', p.oid, 'execute') as anon_can_execute_trigger_function,
  has_function_privilege('authenticated', p.oid, 'execute') as authenticated_can_execute_trigger_function
from pg_trigger t
join pg_proc p on p.oid = t.tgfoid
where t.tgrelid = 'public.otc_orders'::regclass
  and not t.tgisinternal
order by t.tgname;

-- 5) Lifecycle RPC owner, SECURITY DEFINER flag, configuration, ACL, and effective EXECUTE.
select
  p.oid::regprocedure as lifecycle_rpc,
  pg_get_userbyid(p.proowner) as function_owner,
  owner_role.rolsuper as owner_is_superuser,
  owner_role.rolbypassrls as owner_bypasses_rls,
  p.prosecdef as security_definer,
  p.proconfig as function_configuration,
  p.proacl as function_acl,
  has_function_privilege('anon', p.oid, 'execute') as anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'execute') as authenticated_can_execute,
  has_function_privilege('service_role', p.oid, 'execute') as service_role_can_execute,
  pg_get_functiondef(p.oid) as function_definition
from pg_proc p
join pg_roles owner_role on owner_role.oid = p.proowner
where p.oid = pg_catalog.to_regprocedure('public.nortago_update_order_status(uuid,text,text)');

-- 6) Role attributes and inherited memberships (recursive membership closure).
select rolname, rolinherit, rolbypassrls, rolsuper, rolcreaterole, rolcanlogin
from pg_roles
where rolname in ('anon', 'authenticated', 'service_role')
order by rolname;

with recursive role_closure(member_oid, granted_oid, depth) as (
  select m.member, m.roleid, 1
  from pg_auth_members m
  union all
  select c.member_oid, m.roleid, c.depth + 1
  from role_closure c
  join pg_auth_members m on m.member = c.granted_oid
  where c.depth < 32
)
select distinct
  member_oid::regrole as client_role,
  granted_oid::regrole as inherited_role,
  depth
from role_closure
where member_oid::regrole::text in ('anon', 'authenticated', 'service_role')
order by client_role, depth, inherited_role;

-- 7) Actual status column definition and CHECK constraints.
select
  a.attname as column_name,
  pg_catalog.format_type(a.atttypid, a.atttypmod) as column_type,
  a.attnotnull as not_null,
  pg_get_expr(d.adbin, d.adrelid) as default_expression
from pg_attribute a
left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
where a.attrelid = 'public.otc_orders'::regclass
  and a.attname in ('status', 'payment_status')
  and not a.attisdropped;

select conname, pg_get_constraintdef(oid, true) as constraint_definition
from pg_constraint
where conrelid = 'public.otc_orders'::regclass
  and contype = 'c'
order by conname;

-- 8) Migration ledger presence. First query returns NULL if the ledger table is absent.
select to_regclass('supabase_migrations.schema_migrations') as migration_ledger;

-- Run the following query only if the preceding result is non-NULL:
-- select version, name
-- from supabase_migrations.schema_migrations
-- where version in (
--   '20260928',
--   '20261117',
--   '20261120',
--   '20261121',
--   '20261122',
--   '20261123'
-- )
-- order by version, name;

-- Stop the release audit if:
-- * anon/authenticated has any direct INSERT/UPDATE/DELETE/TRUNCATE/column mutation on orders/items;
-- * RLS is disabled or policies do not match approved tenant boundaries;
-- * status-owner guard trigger is missing, disabled, or not BEFORE UPDATE OF status;
-- * trigger function is SECURITY DEFINER or callable by anon/authenticated;
-- * lifecycle RPC is not SECURITY DEFINER, authenticated EXECUTE is missing, or anon EXECUTE is present;
-- * role inheritance/BYPASSRLS/function ownership is unexplained;
-- * applied migration ledger differs from the reviewed release stack.
-- service_role is privileged by design; review its actual grants/role attributes separately.
