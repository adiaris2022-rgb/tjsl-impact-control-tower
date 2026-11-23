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


## Exact release-candidate refresh — 23 Nov 2026

- PR #34 candidate head is now `cee234e27c3df791670be5216f21a3490d9260ad`, base PR #31 head `c58c841b11ef35a0a6c82ef2bc4d351681c82edb`.
- Exact head [Run #279 PASS](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/45147788112), 2/2 jobs. Vercel exact-head Success.
- Integrated PR #32's 12 effective-privilege assertions into the candidate's RPC-only write test: authenticated and anon must lack TRUNCATE, REFERENCES, and TRIGGER on both `otc_orders` and `otc_order_items`, in addition to DML and column INSERT/UPDATE checks. This avoids leaving the privilege-completeness test as a separate branch.
- Exact primary PR #1/#12–#17 refresh: 7/7 workflow runs, 14/14 jobs PASS; #16/#17 exact Run #141/#143 PASS. Vercel #14/#15 remains build-rate-limit failure; the other five are Success.
- PR #28 current doc head `67cce4dfe0128c33f93f7406adb1063678c0bd9d`, Run #277 PASS (2/2 jobs), Vercel Success.
- PR #18/#26/#32/#33 exact-head CI #191/#216/#266/#268 PASS; Vercel statuses Success.

These are repository-source and disposable CI results only. No effective Supabase staging privilege/RLS/auth inspection has been performed. Exact-preview browser UAT, delivery/payment policy, rollback, commercial acceptance, and explicit production approval remain release gates. No merge, migration, production deployment, payment/webhook activation, secrets/environment change, or destructive action. LinkBayar stays disabled.


## Fresh exact-head and security audit — 23 Nov 2026, 17:27 WIB

This section supersedes the stale exact-head references in the earlier refresh above.

### Exact PR metadata and CI

| PR | Head (full SHA) | Base (full SHA) | CI run | Vercel |
|---|---|---|---|---|
| #1 | `a75820a8ca6d14c3f92fd3dfcfb9821f28429843` | `545f4953368d0e85d7573c609bf4abf96b041c80` | #69 PASS | Success |
| #12 | `a323dcdedb5fd1048d9d2b2e3560c6ced889789c` | `a75820a8ca6d14c3f92fd3dfcfb9821f28429843` | #183 PASS | Success |
| #13 | `c0a5e75cf9a8964848ad00aa4b5d57d1753140a6` | `a323dcdedb5fd1048d9d2b2e3560c6ced889789c` | #136 PASS | Success |
| #14 | `f3a86754461b06b10250b073a38fae906bfd2777` | `c0a5e75cf9a8964848ad00aa4b5d57d1753140a6` | #138 PASS | Vercel build-rate-limit failure |
| #15 | `e16260f8147e3b55255be6bf5163a32774abe280` | `f3a86754461b06b10250b073a38fae906bfd2777` | #140 PASS | Vercel build-rate-limit failure |
| #16 | `db3e6a43edc4edc4d3338504d87da11163594e42` | `e16260f8147e3b55255be6bf5163a32774abe280` | #141 PASS | Success |
| #17 | `7516e1b22d5cd340b872db4bc516471a81ef74d4` | `e16260f8147e3b55255be6bf5163a32774abe280` | #143 PASS | Success |

The exact commit workflow-run and combined-status API results were refreshed. PR #16/#17 Runs #141/#143 are still PASS on current head commits. The #14/#15 failures are provider build-rate-limit status; their GitHub Actions workflow runs themselves passed.

### Migration and policy audit — source evidence, not names

Migration-tree inventory on the lifecycle branch (PR #18) contained 15 migration files; the RPC-only branch (PR #26) contained 16; the current consolidated PR #34 branch contained 18. Relevant actual source files were read from the branches:

- `20260928_otc_commerce_core_v1.sql`: RLS enabled on `otc_orders` and `otc_order_items`. The order and item mutation policies are `FOR ALL` for authenticated business roles using `has_business_role`; these policies do not validate lifecycle transitions.
- `20261120_nortago_order_lifecycle_rpc_v1.sql`: `nortago_update_order_status(uuid,text,text)` is SECURITY DEFINER; checks `auth.uid()`, business-role membership, outlet/business consistency and allowed status/fulfillment transitions; locks the order row; updates status and appends an audit record. This migration does **not** install a trigger forcing every status mutation through the RPC.
- `20261120_nortago_order_only_scope_lock_v1.sql`: revokes client execution of reservation RPCs; it is not an order-status guard.
- `20261120_nortago_order_release_scope_guard_v1.sql`: trigger rejects Dine-In and STAFF_WALK_IN order types. It does not validate the transition or create lifecycle audit. Later release hardening adds `status` to the trigger's watched columns so excluded legacy order types cannot advance through that scope guard.
- `20261121_nortago_order_rpc_only_write_privileges_v1.sql` (PR #26): revokes all table and explicit column INSERT/UPDATE/DELETE privileges on both order tables from PUBLIC, anon and authenticated; restores authenticated SELECT and business-scoped read policies.
- `20261123_nortago_order_status_rpc_owner_guard_v1.sql` (PR #33): SECURITY INVOKER trigger rejects changed status unless `current_user` matches the current lifecycle RPC owner, with SQLSTATE 42501 and `NORTAGO_ORDER_STATUS_RPC_ONLY`. It does not change checkout, payment_status, or business RLS.

### Bypass and prevention evidence

PR #26's CI workflow explicitly simulates client table and column DML grants after the core migration and before hardening. The rollback-only baseline test verifies that the broad business-role FOR ALL policy permits a direct `status='PROCESSING'` UPDATE and that it produces no lifecycle audit. This is the bypass reproduced in disposable PostgreSQL—not a claim about the live project's effective grants.

PR #34 Run #279 on exact head `cee234e27c3df791670be5216f21a3490d9260ad` passed both jobs. The database job applied/replayed RPC-only and status-owner migrations and completed:
- direct-status bypass baseline,
- RPC-only mutation privilege smoke,
- inherited `UPDATE(status)` plus narrow-RLS status-owner guard smoke,
- approved lifecycle RPC transition, exactly one audit row, unchanged `payment_status`,
- checkout idempotency/tenant isolation, per-outlet subscription, lifecycle edge/paid-order/scope checks.
The build job passed Owner Inbox/summary/hourly-report pagination tests and production build. Exact-head Vercel status was Success.

PR #26 Run #216, PR #32 Run #266, PR #33 Run #268 and PR #34 Run #279 were also rechecked on their exact current heads; each completed successfully. PR #28 before this update had head `459b0206b49d057e26be20386f097619d935e9eb`, Run #280 PASS (2/2), and Vercel Success. PR #18 current head `03ac27ceb0d268826c2b76e49808a923786d9e13`, Run #191 PASS, Vercel Success.

### Owner-guard limitation and precise decision

The PR #33 guard is defense-in-depth, not a PostgreSQL mechanism that identifies one specific calling function. It compares `current_user` with the owner of `nortago_update_order_status`; a future SECURITY DEFINER function owned by that same role that changes `otc_orders.status` could also pass. Source migration inventory currently found `nortago_update_order_status` as the only migration-defined status writer. The existing guard is retained as a safe feature-branch restriction and the test proves it rejects a direct inherited column grant while allowing the approved RPC.

**Decision required before staging:** if strict “only this RPC” enforcement is required beyond the current source inventory, use a dedicated non-client function-owner role (or equivalent owner-approved trust boundary) for the lifecycle writer, ensure no other status-writing SECURITY DEFINER function shares it, and validate migration-owner privileges/role setup in disposable staging first. Do not create/grant broad owner roles or assume the migration executor can change ownership. This run does not make that role change.

### Current release gates

Actual Supabase staging effective grants, inherited role memberships/BYPASSRLS, applied migrations, real auth identity/RLS, and tenant/outlet behavior remain unverified. Browser UAT, delivery fee/courier responsibility, payment-before-fulfillment decision, rollback/recovery, and commercial acceptance are still required. CI results above are disposable PostgreSQL only. No merge, staging/live migration, production deployment, payment/webhook activation, secret/environment change, or destructive action was performed. LinkBayar remains disabled; Order-only scope and BOS deferral remain unchanged.


## PR #34 test metadata follow-up — 23 Nov 2026

- PR #34 test head now includes assertions that the `otc_orders_status_rpc_owner_guard` trigger is installed and enabled, is `BEFORE UPDATE OF status`, uses a SECURITY INVOKER trigger function, and the guard function is not executable by anon/authenticated.
- Current PR #34 test head: `e2793462c6e297f36cf77ef83a4b6309dca923e`. The prior malformed-delimiter test-edit commit `1191dca0fb823f90d1264c0906d8e2523a56f3d0` was superseded; its Run #282 was cancelled. The delimiter was corrected and fetched back from GitHub with two dollar-quotes intact.
- At this evidence refresh, no Actions run was returned for the current PR #34 head, and its Vercel status was pending. Run #279 PASS and Vercel Success validate the previous head `cee234e27c3df791670be5216f21a3490d9260ad` only, not this additional trigger-metadata test.


## PR #34 exact test-head completion — 23 Nov 2026

- Current PR #34 test head `e2793462c6e297f36cf77ef83a4b6309dca923e` completed **CI Run #284 PASS (2/2 jobs)**: production build/pagination tests and PostgreSQL migrations/replay/security suite. The added status-owner trigger metadata and client-EXECUTE assertions passed in the inherited status privilege guard step. Exact-head Vercel status is Success.
- The superseded malformed-delimiter commit `1191dca0fb823f90d1264c0906d8e2523a56f3d0` was cancelled (Run #282) after correction; current head is the verified `e279...` commit.
- PR #28 documentation head at `4360dba98e7f4d100bae5943868d7a7ee4150f9e` had Run #285 in progress at this refresh (build job passed; PostgreSQL job still running). This newer documentation commit must be checked separately; Run #281 validates its prior head only.
