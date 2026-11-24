-- NORTAGO ORDER — read-only staging security audit
-- Run only in an owner-approved staging SQL session. This file contains SELECTs only.
-- Never run this against production as a substitute for approval or expose credentials/PII.
--
-- Expected release stack: anon/authenticated are read-only for order header/items,
-- authenticated business-scoped SELECT, and enabled status-owner guard trigger.
-- service_role and table/function owners are privileged; report their access for review.

-- 1) Effective table and column privileges. PostgreSQL privilege functions include inherited grants.
select
  role_name,
  has_table_privilege(role_name, 'public.otc_orders', 'select') as orders_select,
  has_table_privilege(role_name, 'public.otc_orders', 'insert') as orders_insert,
  has_table_privilege(role_name, 'public.otc_orders', 'update') as orders_table_update,
  has_table_privilege(role_name, 'public.otc_orders', 'delete') as orders_delete,
  has_table_privilege(role_name, 'public.otc_orders', 'truncate') as orders_truncate,
  has_table_privilege(role_name, 'public.otc_orders', 'references') as orders_references,
  has_table_privilege(role_name, 'public.otc_orders', 'trigger') as orders_trigger,
  has_any_column_privilege(role_name, 'public.otc_orders', 'insert') as orders_column_insert,
  has_any_column_privilege(role_name, 'public.otc_orders', 'update') as orders_column_update,
  has_column_privilege(role_name, 'public.otc_orders', 'status', 'update') as orders_status_update,
  has_table_privilege(role_name, 'public.otc_order_items', 'select') as items_select,
  has_table_privilege(role_name, 'public.otc_order_items', 'insert') as items_insert,
  has_table_privilege(role_name, 'public.otc_order_items', 'update') as items_update,
  has_table_privilege(role_name, 'public.otc_order_items', 'delete') as items_delete,
  has_table_privilege(role_name, 'public.otc_order_items', 'truncate') as items_truncate,
  has_table_privilege(role_name, 'public.otc_order_items', 'references') as items_references,
  has_table_privilege(role_name, 'public.otc_order_items', 'trigger') as items_trigger,
  has_any_column_privilege(role_name, 'public.otc_order_items', 'insert') as items_column_insert,
  has_any_column_privilege(role_name, 'public.otc_order_items', 'update') as items_column_update
from (values ('anon'), ('authenticated'), ('service_role')) as roles(role_name)
order by role_name;

-- 2) RLS enabled/forced state, table owner, and owner-role attributes (BYPASSRLS/superuser).
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
  to_regclass('public.otc_orders'),
  to_regclass('public.otc_order_items'),
  to_regclass('public.nortago_order_status_audit')
)
order by table_name;

-- 3) Effective RLS policy definitions. Review USING and WITH CHECK, not just policy names.
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('otc_orders', 'otc_order_items', 'nortago_order_status_audit')
order by tablename, policyname;

-- 4) Trigger state, exact definition, trigger function owner/security/ACL and client EXECUTE.
select
  t.tgname as trigger_name,
  t.tgenabled as enabled_state, -- O=origin/local, A=always, D=disabled, R=replica
  pg_get_triggerdef(t.oid, true) as trigger_definition,
  p.oid::regprocedure as trigger_function,
  p.prosecdef as trigger_function_security_definer,
  pg_get_userbyid(p.proowner) as trigger_function_owner,
  p.proacl as trigger_function_acl,
  has_function_privilege('anon', p.oid, 'execute') as anon_can_execute_trigger_function,
  has_function_privilege('authenticated', p.oid, 'execute') as authenticated_can_execute_trigger_function,
  pg_get_functiondef(p.oid) as trigger_function_definition
from pg_trigger t
join pg_proc p on p.oid = t.tgfoid
where t.tgrelid = 'public.otc_orders'::regclass
  and not t.tgisinternal
order by t.tgname;

-- 5) Lifecycle RPC owner, SECURITY DEFINER flag, configuration, ACL, effective EXECUTE.
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

-- 6) Compare guard and RPC owners. Same-owner SECURITY DEFINER functions are within
-- the guard's trust boundary; inspect the complete writer inventory before accepting it.
select
  guard_owner.rolname as guard_function_owner,
  rpc_owner.rolname as lifecycle_rpc_owner,
  guard.prosecdef as guard_is_security_definer,
  rpc.prosecdef as rpc_is_security_definer,
  guard_owner.rolsuper as guard_owner_superuser,
  guard_owner.rolbypassrls as guard_owner_bypasses_rls,
  guard_owner.rolinherit as guard_owner_inherits
from pg_proc guard
join pg_roles guard_owner on guard_owner.oid = guard.proowner
join pg_proc rpc on rpc.oid = pg_catalog.to_regprocedure('public.nortago_update_order_status(uuid,text,text)')
join pg_roles rpc_owner on rpc_owner.oid = rpc.proowner
where guard.oid = pg_catalog.to_regprocedure('public.nortago_order_status_rpc_owner_guard()');

-- 7) Role attributes and inherited memberships (recursive membership closure).
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
  granted_oid::regrole as related_role,
  depth,
  pg_has_role(member_oid::regrole, granted_oid::regrole, 'MEMBER') as is_member,
  pg_has_role(member_oid::regrole, granted_oid::regrole, 'USAGE') as privileges_inherited_without_set_role,
  pg_has_role(member_oid::regrole, granted_oid::regrole, 'SET') as can_set_role
from role_closure
where member_oid::regrole::text in ('anon', 'authenticated', 'service_role')
order by client_role, depth, related_role;

-- 8) Actual status/payment_status column definitions and CHECK constraints.
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

-- 9) Migration ledger presence. First query returns NULL if the ledger table is absent.
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
-- * anon/authenticated has any direct INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER or column mutation on orders/items;
-- * RLS is disabled or policies do not match approved tenant boundaries;
-- * status-owner guard trigger is missing, disabled, or not BEFORE UPDATE OF status;
-- * trigger function is SECURITY DEFINER or callable by anon/authenticated;
-- * lifecycle RPC is not SECURITY DEFINER, authenticated EXECUTE is missing, or anon EXECUTE is present;
-- * role inheritance/BYPASSRLS/function ownership is unexplained;
-- * applied migration ledger differs from the reviewed release stack.
-- service_role is privileged by design; review its actual grants/role attributes separately.

-- 10) Inventory public functions that reference OTC order/item tables.
-- Review all SECURITY DEFINER candidates and follow indirect calls manually.
-- This is a source inventory, not a complete dynamic-SQL or indirect-call detector.
select
  p.oid::regprocedure as function_signature,
  pg_get_userbyid(p.proowner) as function_owner,
  p.prosecdef as security_definer,
  p.proacl as function_acl,
  pg_get_functiondef(p.oid) as function_definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and (p.prosrc ilike '%otc_orders%' or p.prosrc ilike '%otc_order_items%')
order by p.oid::regprocedure::text;
-- 11) Inventory every SECURITY DEFINER function sharing the lifecycle RPC owner,
-- across non-system schemas. The status guard trusts owner identity, so any
-- same-owner SECURITY DEFINER function is inside that trust boundary. Review
-- definitions for indirect/dynamic writes, grants, and caller reachability.
with lifecycle_owner as (
  select proowner
  from pg_proc
  where oid = pg_catalog.to_regprocedure('public.nortago_update_order_status(uuid,text,text)')
)
select
  n.nspname as schema_name,
  p.oid::regprocedure as function_signature,
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
join pg_namespace n on n.oid = p.pronamespace
join pg_roles owner_role on owner_role.oid = p.proowner
join lifecycle_owner lo on lo.proowner = p.proowner
where p.prosecdef
  and n.nspname not in ('pg_catalog', 'information_schema')
  and n.nspname not like 'pg_toast%'
order by n.nspname, p.oid::regprocedure::text;


-- 12) Inspect the actual business-role helper and Supabase auth identity helper.
-- The repository CI helper is a fixture; do not assume it matches staging.
select
  n.nspname as schema_name,
  p.oid::regprocedure as helper_signature,
  pg_get_userbyid(p.proowner) as function_owner,
  p.prosecdef as security_definer,
  p.proconfig as function_configuration,
  p.proacl as function_acl,
  has_function_privilege('anon', p.oid, 'execute') as anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'execute') as authenticated_can_execute,
  has_function_privilege('service_role', p.oid, 'execute') as service_role_can_execute,
  pg_get_functiondef(p.oid) as function_definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where p.oid = pg_catalog.to_regprocedure('public.has_business_role(uuid,text[])');

select
  n.nspname as schema_name,
  p.oid::regprocedure as auth_identity_helper,
  pg_get_userbyid(p.proowner) as function_owner,
  p.prosecdef as security_definer,
  p.proconfig as function_configuration,
  p.proacl as function_acl,
  has_function_privilege('anon', p.oid, 'execute') as anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'execute') as authenticated_can_execute,
  pg_get_functiondef(p.oid) as function_definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where p.oid = pg_catalog.to_regprocedure('auth.uid()');

-- 13) Inspect the membership relation only if it exists. Review actual RLS,
-- table owner, effective privileges, and policy predicates before granting access.
select
  c.oid::regclass as membership_relation,
  pg_get_userbyid(c.relowner) as table_owner,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced,
  has_table_privilege('authenticated', c.oid, 'select') as authenticated_can_select,
  has_table_privilege('service_role', c.oid, 'select') as service_role_can_select
from pg_class c
where c.oid = pg_catalog.to_regclass('public.business_users');

select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'business_users'
order by policyname;

-- 14) Inspect the proposed dedicated lifecycle owner role if it exists.
-- Zero rows means the role has not been created; that is not evidence of safety.
select
  r.rolname,
  r.rolcanlogin,
  r.rolinherit,
  r.rolsuper,
  r.rolcreatedb,
  r.rolcreaterole,
  r.rolreplication,
  r.rolbypassrls,
  has_schema_privilege(r.rolname, 'public', 'usage') as public_schema_usage,
  has_schema_privilege(r.rolname, 'public', 'create') as public_schema_create
from pg_roles r
where r.rolname = 'nortago_order_lifecycle_owner';

select
  member_role.rolname as member_role,
  granted_role.rolname as granted_role,
  m.admin_option
from pg_auth_members m
join pg_roles member_role on member_role.oid = m.member
join pg_roles granted_role on granted_role.oid = m.roleid
where member_role.rolname = 'nortago_order_lifecycle_owner'
   or granted_role.rolname = 'nortago_order_lifecycle_owner'
order by member_role.rolname, granted_role.rolname;

select
  n.nspname as schema_name,
  p.oid::regprocedure as owned_function,
  p.prosecdef as security_definer,
  p.proconfig as function_configuration,
  p.proacl as function_acl,
  pg_get_functiondef(p.oid) as function_definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where p.proowner = (select oid from pg_roles where rolname = 'nortago_order_lifecycle_owner')
order by n.nspname, p.oid::regprocedure::text;

-- 15) Inspect outlet/product business consistency before applying the tenant guard.
-- All statements in this section are read-only. Any non-zero mismatch count
-- is a migration blocker requiring owner review; never auto-repair rows.
select
  count(*) as total_outlet_product_mappings,
  count(*) filter (where o.business_id is distinct from p.business_id) as cross_business_mapping_count
from public.otc_outlet_products op
join public.otc_outlets o on o.id = op.outlet_id
join public.otc_products p on p.id = op.product_id;

select
  op.outlet_id,
  op.product_id,
  o.business_id as outlet_business_id,
  p.business_id as product_business_id
from public.otc_outlet_products op
join public.otc_outlets o on o.id = op.outlet_id
join public.otc_products p on p.id = op.product_id
where o.business_id is distinct from p.business_id
order by op.outlet_id, op.product_id
limit 100;

-- Inspect RLS and effective client table privileges for the mapping and parent tables.
select
  c.oid::regclass as relation_name,
  pg_get_userbyid(c.relowner) as table_owner,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced,
  has_table_privilege('anon', c.oid, 'select') as anon_can_select,
  has_table_privilege('anon', c.oid, 'insert') as anon_can_insert,
  has_table_privilege('anon', c.oid, 'update') as anon_can_update,
  has_table_privilege('authenticated', c.oid, 'select') as authenticated_can_select,
  has_table_privilege('authenticated', c.oid, 'insert') as authenticated_can_insert,
  has_table_privilege('authenticated', c.oid, 'update') as authenticated_can_update
from pg_class c
where c.oid in (
  pg_catalog.to_regclass('public.otc_outlet_products'),
  pg_catalog.to_regclass('public.otc_outlets'),
  pg_catalog.to_regclass('public.otc_products')
)
order by c.oid::regclass::text;

select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('otc_outlet_products','otc_outlets','otc_products')
order by tablename, policyname;

-- Confirm all three server-side guards are enabled and their trigger functions
-- remain SECURITY INVOKER and non-callable directly by anon/authenticated.
select
  t.tgrelid::regclass as relation_name,
  t.tgname as trigger_name,
  t.tgenabled as trigger_enabled,
  p.oid::regprocedure as trigger_function,
  pg_get_userbyid(p.proowner) as function_owner,
  p.prosecdef as security_definer,
  p.proconfig as function_configuration,
  p.proacl as function_acl,
  has_function_privilege('anon', p.oid, 'execute') as anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'execute') as authenticated_can_execute
from pg_trigger t
join pg_proc p on p.oid = t.tgfoid
where not t.tgisinternal
  and t.tgname in (
    'otc_outlet_products_business_match_guard',
    'otc_products_business_reassignment_guard',
    'otc_outlets_business_reassignment_guard',
    'otc_outlet_products_service_payment_terms_owner_guard'
  )
order by t.tgname;


-- 15. Effective authenticated grants needed by the outlet/product tenant guard.
-- SELECT ... FOR SHARE also requires UPDATE privilege on the locked parent tables.
select
  'authenticated' as role_name,
  'otc_outlet_products' as table_name,
  has_table_privilege('authenticated','public.otc_outlet_products','select') as can_select,
  has_table_privilege('authenticated','public.otc_outlet_products','insert') as can_insert,
  has_table_privilege('authenticated','public.otc_outlet_products','update') as can_update,
  has_table_privilege('authenticated','public.otc_outlets','select') as can_select_outlets,
  has_table_privilege('authenticated','public.otc_outlets','update') as can_lock_outlets_for_share,
  has_table_privilege('authenticated','public.otc_products','select') as can_select_products,
  has_table_privilege('authenticated','public.otc_products','update') as can_lock_products_for_share,
  has_column_privilege('authenticated','public.otc_outlet_products','outlet_id','select') as can_read_outlet_id,
  has_column_privilege('authenticated','public.otc_outlet_products','product_id','select') as can_read_product_id,
  has_column_privilege('authenticated','public.otc_outlets','business_id','select') as can_read_outlet_business,
  has_column_privilege('authenticated','public.otc_products','business_id','select') as can_read_product_business;

-- 16. Catalog tenant-guard RLS policy and trigger state/function definitions.
select
  schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname='public'
  and tablename in ('otc_outlet_products','otc_outlets','otc_products')
order by tablename, policyname;

select
  c.relname as table_name,
  t.tgname as trigger_name,
  t.tgenabled as trigger_enabled,
  pg_get_userbyid(p.proowner) as trigger_function_owner,
  p.prosecdef as trigger_function_security_definer,
  p.proconfig as trigger_function_configuration,
  has_function_privilege('anon',p.oid,'execute') as anon_can_execute,
  has_function_privilege('authenticated',p.oid,'execute') as authenticated_can_execute,
  pg_get_functiondef(p.oid) as trigger_function_definition
from pg_trigger t
join pg_class c on c.oid=t.tgrelid
join pg_proc p on p.oid=t.tgfoid
where not t.tgisinternal
  and t.tgname in (
    'otc_outlet_products_business_match_guard',
    'otc_products_business_reassignment_guard',
    'otc_outlets_business_reassignment_guard',
    'otc_outlet_products_service_payment_terms_owner_guard'
  )
order by c.relname,t.tgname;

-- 17. Existing cross-business mappings must be zero before the tenant guard migration.
select
  count(*) as cross_business_mapping_count
from public.otc_outlet_products op
join public.otc_outlets o on o.id=op.outlet_id
join public.otc_products p on p.id=op.product_id
where o.business_id is distinct from p.business_id;


-- 18. Seller-configurable service payment terms: owner RPC, trigger, and stored outlet configuration.
select
  p.oid::regprocedure as function_name,
  pg_get_userbyid(p.proowner) as function_owner,
  p.prosecdef as security_definer,
  p.proconfig as function_configuration,
  has_function_privilege('anon',p.oid,'execute') as anon_can_execute,
  has_function_privilege('authenticated',p.oid,'execute') as authenticated_can_execute
from pg_proc p
where p.oid in (
  to_regprocedure('public.nortago_update_service_payment_terms(uuid,uuid,boolean,boolean,text,numeric)'),
  to_regprocedure('public.nortago_guard_service_payment_terms_owner()')
)
order by p.oid::regprocedure::text;

select
  t.tgname as trigger_name,
  t.tgenabled as trigger_enabled,
  p.prosecdef as trigger_function_security_definer,
  p.proconfig as trigger_function_configuration,
  has_function_privilege('anon',p.oid,'execute') as anon_can_execute,
  has_function_privilege('authenticated',p.oid,'execute') as authenticated_can_execute,
  pg_get_functiondef(p.oid) as trigger_function_definition
from pg_trigger t
join pg_proc p on p.oid=t.tgfoid
where t.tgrelid='public.otc_outlet_products'::regclass
  and t.tgname='otc_outlet_products_service_payment_terms_owner_guard'
  and not t.tgisinternal;

select
  count(*) as service_outlet_mappings,
  count(*) filter (where allow_full_payment) as full_payment_enabled,
  count(*) filter (where allow_dp) as dp_enabled,
  count(*) filter (where not allow_full_payment and not allow_dp) as invalid_payment_option_rows
from public.otc_outlet_products op
join public.otc_products p on p.id=op.product_id
where p.product_type='SERVICE';
