# NORTAGO ORDER — RPC-only write gate and staging UAT

## Why this gate exists

Owner Order lifecycle changes must go through `nortago_update_order_status`, which validates authentication, business membership, outlet/business consistency, fulfillment-specific status transitions, and records an audit event. Client table DML could bypass that workflow if the effective Supabase grants permit it.

PR #26 makes client table access read-only for order headers and order items:

- `PUBLIC`, `anon`, and `authenticated`: no direct INSERT, UPDATE, or DELETE on `otc_orders` or `otc_order_items`, including column-level INSERT/UPDATE privileges.
- `authenticated`: SELECT only, subject to business-scoped RLS.
- Checkout/idempotency, customer receipt, and lifecycle remain SECURITY DEFINER RPC paths; no client table mutation is required by the reviewed `app/otc` checkout, Owner Inbox, or Owner Report pages.

## Security review: baseline bypass and RPC-only hardening

### What the migrations actually enforce
- `20260928_otc_commerce_core_v1.sql` enables RLS, but `otc_orders_staff_manage` and `otc_order_items_staff_manage` are **FOR ALL** policies for business-membership roles (OWNER, PROGRAM_MANAGER, PARTNER, STAFF). The core migration does not itself declare explicit table DML grants.
- `20261120_nortago_order_lifecycle_rpc_v1.sql` implements `nortago_update_order_status` as SECURITY DEFINER: it requires `auth.uid()`, checks business membership, verifies outlet/business consistency, validates fulfillment-specific transitions, and inserts an audit event. The migration does not install a status-audit trigger that forces direct table writes through this RPC.
- `20261120_nortago_order_release_scope_guard_v1.sql` has a trigger on INSERT/UPDATE of `order_source`, `fulfillment_type`, and `status`; it rejects Dine-In and STAFF_WALK_IN but does not validate the lifecycle transition or create audit rows.
- Therefore the direct-status bypass is **confirmed in the disposable CI grant simulation**, not confirmed against live Supabase effective grants. Broad client DML grants plus the core FOR ALL business-membership policy allow direct status updates that skip RPC validation/audit.

### PR #26 prevention
- `20261121_nortago_order_rpc_only_write_privileges_v1.sql` revokes table-level and explicit column-level INSERT/UPDATE/DELETE privileges from PUBLIC, anon, and authenticated on both `otc_orders` and `otc_order_items`; it grants authenticated SELECT only.
- The migration replaces the broad order/item FOR ALL policies with business-scoped SELECT-only policies. RLS remains enabled on both tables.
- Checkout/idempotency and receipt remain SECURITY DEFINER RPCs; lifecycle remains the authenticated SECURITY DEFINER `nortago_update_order_status`. The client UI does not need direct table writes for these flows.

### PR #33 defense-in-depth status guard (separate draft branch)
- Migration `20261123_nortago_order_status_rpc_owner_guard_v1.sql` adds a SECURITY INVOKER trigger on changed `otc_orders.status`. It dynamically reads the lifecycle RPC owner and rejects a status mutation unless the current database user is that trusted owner, returning `NORTAGO_ORDER_STATUS_RPC_ONLY`.
- Client execute grants on the trigger function are revoked; the guard does not change checkout, `payment_status`, or business RLS.
- The rollback-only regression fixture deliberately gives `authenticated` an inherited column UPDATE(status) privilege and a narrow update policy, verifies the effective privilege exists, then proves direct status UPDATE is rejected, order status/audit remain unchanged, and the approved lifecycle RPC still transitions and audits once without changing payment status.
- PR #33 exact head `09eea46dfb5926ccf0508d73e379c44fa0901868`: CI Run #268 PASS (both jobs); exact-head Vercel status Success. This remains draft/unmerged and is not applied to staging/live.

### Regression evidence
- `nortago_order_rpc_only_write_privileges_smoke.sql` verifies post-hardening table/column DML privileges are absent, scoped reads remain available, direct status UPDATE/order INSERT/item INSERT/UPDATE/DELETE are rejected, the approved lifecycle RPC advances status and appends one audit event, and payment status remains unchanged.
- Added `nortago_order_status_direct_write_baseline_smoke.sql` in commit `e4f77826f948e98ac054ce13c87cba39cceafdb5`. In a rollback-only CI fixture, before the hardening migration, it deliberately proves the broad grants + FOR ALL policy allow a direct status update and that this write produces no lifecycle audit row.
- The CI workflow applies the Order-only scope trigger, runs the baseline bypass proof, then applies/replays the RPC-only hardening migration.
- PR #32 adds effective privilege assertions for TRUNCATE, REFERENCES, and TRIGGER in addition to the prior DML checks; CI Run #266 PASS on exact head `de479e6b7c5bbb9cbf6b4097e0b067a49ad65cb4`.

### CI evidence
- PR #26 exact head `99ca6c1b461ef267789a6eecf9ed18807b75a9f5`: Run #216 PASS, production build and disposable PostgreSQL security/checkout/tenant/subscription/lifecycle/scope checks.
- PR #25 pagination release-base commit `b76d0ae85911b6963af96bb1fd92ba5d90816649`: Run #199 PASS, including inbox and summary cursor-pagination tests plus PostgreSQL smoke tests.
- PR #33 exact-head Run #268 and PR #32 Run #266 are additional evidence for the RPC-owner trigger and effective privilege completeness assertions.
- CI uses a disposable PostgreSQL database and simulated client grants. It does not prove actual Supabase staging privileges, real-user RLS, or deployed migration state.

## Preview deployment evidence and browser-UAT limitation

- Vercel status can be SUCCESS for a commit, but the status target may be a dashboard rather than a browser-ready preview alias. Record the exact preview URL only after independently opening it.
- Do not use a preview alias tied to an older SHA as evidence for a newer head. Browser checkout/auth/receipt interaction remains unverified unless performed against the exact current commit.
- PR #14/#15 previews have previously been blocked by Vercel build-rate-limit status; do not infer those failures for downstream previews.

## Required staging checks — exact preview SHA

Do not run until the owner approves the disposable staging migration and recovery plan.

- [ ] Record preview commit SHA; ensure the preview URL matches the PR head being tested.
- [ ] Confirm staging is disposable, identify the project ref, and use test-only businesses, outlets, products, accounts, and orders.
- [ ] Apply the reviewed migration to staging only after approval; record result and rollback/recovery plan.
- [ ] Query effective table and column privileges for `anon` and `authenticated`; confirm direct DML is denied on both order tables.
- [ ] As authenticated Business A owner, confirm scoped SELECT returns Business A orders/items.
- [ ] Attempt direct REST/API status update on a test order; expect denial, then confirm status and audit count remain unchanged.
- [ ] Attempt direct order INSERT and item INSERT/UPDATE/DELETE; expect denial and no mutation.
- [ ] Create an order using customer checkout; confirm order and item snapshot/price/quantity/total.
- [ ] Open the returned receipt capability; confirm header and items match checkout. Retry same idempotency key/payload and confirm same order; conflicting payload must reject.
- [ ] Use Owner Inbox lifecycle action; confirm status advances only through allowed transition, audit captures actor/from/to/note, and payment status is unchanged.
- [ ] Business A cannot read Business B's order/audit; outlet/business mismatch is rejected.
- [ ] Monthly/yearly outlet subscription checks create pending invoices only; no settlement or webhook delivery.
- [ ] Check desktop/mobile, console errors, pagination, delivery wording/fee, and customer/owner schedule display.

### Read-only staging catalog audit (capture output, do not mutate)

Run these queries only against the approved staging project, with a read-only SQL session where possible. They inspect effective privileges, inherited memberships, actual policies, trigger definitions/enablement, function ownership/security/ACLs, and migration tracking. Never include customer data or secrets in evidence.

#### Effective table and column privileges
```sql
select role_name, table_name,
  has_table_privilege(role_name, table_name, 'select') as can_select,
  has_table_privilege(role_name, table_name, 'insert') as can_insert,
  has_table_privilege(role_name, table_name, 'update') as can_update,
  has_table_privilege(role_name, table_name, 'delete') as can_delete,
  has_table_privilege(role_name, table_name, 'truncate') as can_truncate,
  has_table_privilege(role_name, table_name, 'references') as can_reference,
  has_table_privilege(role_name, table_name, 'trigger') as can_trigger,
  has_any_column_privilege(role_name, table_name, 'insert') as any_column_insert,
  has_any_column_privilege(role_name, table_name, 'update') as any_column_update,
  has_any_column_privilege(role_name, table_name, 'references') as any_column_references
from (values ('anon'), ('authenticated'), ('service_role')) as roles(role_name)
cross join (values ('public.otc_orders'::regclass), ('public.otc_order_items'::regclass)) as tables(table_name)
order by role_name, table_name;
```

Expected for `anon`: no direct order/item table access. Expected for `authenticated`: SELECT only; all DML, TRUNCATE, REFERENCES, TRIGGER and column INSERT/UPDATE/REFERENCES false. Interpret `service_role` separately as a privileged server role; never use it from client code.

#### Role inheritance and bypass attributes
```sql
select rolname, rolsuper, rolbypassrls, rolinherit,
  pg_has_role('anon', oid, 'member') as anon_member,
  pg_has_role('authenticated', oid, 'member') as authenticated_member,
  pg_has_role('service_role', oid, 'member') as service_role_member
from pg_roles
order by rolname;
```

Review any role inherited by `anon` or `authenticated` that has DML, BYPASSRLS, or elevated attributes. Membership/effective privilege results are the evidence; role and policy names alone are not.

#### Actual RLS policies
```sql
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('otc_orders', 'otc_order_items')
order by tablename, policyname;
```

Expected: RLS read policies only after the RPC-only migration. Stop if any client-role policy permits mutation or if Business A can read Business B's order/item rows.

#### Actual triggers and trigger-function security
```sql
select t.tgname, t.tgenabled, pg_get_triggerdef(t.oid) as trigger_sql,
  p.oid::regprocedure as trigger_function,
  pg_get_userbyid(p.proowner) as function_owner,
  p.prosecdef as security_definer,
  p.proconfig, p.proacl
from pg_trigger t
join pg_proc p on p.oid = t.tgfoid
where t.tgrelid in ('public.otc_orders'::regclass, 'public.otc_order_items'::regclass)
  and not t.tgisinternal
order by t.tgrelid::regclass::text, t.tgname;
```

Expected on a staging environment that includes the PR #33 guard: the status guard is enabled (`tgenabled` not disabled), and its trigger function is SECURITY INVOKER. Confirm the scope trigger and RPC-owner guard definitions; don't rely on trigger names.

#### Lifecycle RPC ownership, security mode and effective execute
```sql
select p.oid::regprocedure as function_signature,
  pg_get_userbyid(p.proowner) as function_owner,
  p.prosecdef as security_definer,
  p.proconfig, p.proacl,
  has_function_privilege('anon', p.oid, 'execute') as anon_execute,
  has_function_privilege('authenticated', p.oid, 'execute') as authenticated_execute,
  has_function_privilege('service_role', p.oid, 'execute') as service_role_execute
from pg_proc p
where p.oid = to_regprocedure('public.nortago_update_order_status(uuid,text,text)')
   or p.oid = to_regprocedure('public.nortago_order_status_rpc_owner_guard()');
```

Expected: lifecycle RPC is SECURITY DEFINER and authenticated can execute it while anon cannot. Trigger function is SECURITY INVOKER; client roles must not have direct EXECUTE grants. Confirm lifecycle RPC owner is a trusted database role, not a client role.

#### Migration tracking table existence
```sql
select to_regclass('supabase_migrations.schema_migrations') as migration_tracking_table;
```

If the table exists, query applied versions separately:
```sql
select version from supabase_migrations.schema_migrations order by version;
```
Compare the actual applied versions to the reviewed feature-branch migrations. If the tracking table is absent or the migration set differs, record that explicitly; do not assume migrations were applied.

## Evidence record

Record UTC timestamp, exact preview SHA, staging project ref (not credentials), test role/business/outlet, test ID, expected vs actual, sanitized screenshot/log, and whether mutation was absent after denial. Never capture receipt tokens, customer phone numbers, secrets, or payment credentials.

## Remaining release gates

- STAFF authorization: business-wide vs outlet-assigned policy and owner approval.
- Audit retention: cascade-delete behavior and approved retention policy.
- Delivery: fee configuration and courier responsibility wording.
- Browser UAT/staging evidence on exact preview SHA.
- Owner approval of the cash-at-pickup/COD versus payment-before-fulfillment policy; no active payment gateway is assumed.

No live migration, production deploy, payment activation, or webhook enablement is authorized by this document. LinkBayar remains disabled. NORTAGO ORDER only; Dine-In, Reservation, Walk-In/POS, queue, table/seating/capacity, sessions, Control Tower, and BOS are excluded.
