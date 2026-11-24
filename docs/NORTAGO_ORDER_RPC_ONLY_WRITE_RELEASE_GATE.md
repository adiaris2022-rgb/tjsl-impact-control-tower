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

### Regression evidence
- `nortago_order_rpc_only_write_privileges_smoke.sql` verifies post-hardening table/column DML privileges are absent, scoped reads remain available, direct status UPDATE/order INSERT/item INSERT/UPDATE/DELETE are rejected, the approved lifecycle RPC advances status and appends one audit event, and payment status remains unchanged.
- Added `nortago_order_status_direct_write_baseline_smoke.sql` in commit `e4f77826f948e98ac054ce13c87cba39cceafdb5`. In a rollback-only CI fixture, before the hardening migration, it deliberately proves the broad grants + FOR ALL policy allow a direct status update and that this write produces no lifecycle audit row.
- The CI workflow now applies the Order-only trigger, runs the baseline bypass proof, then applies/replays the RPC-only hardening migration.

### CI evidence
- Prior exact PR #26 head `9dadb6b4ce296079c5e5673266a18e5b8f20a81f`: [Run #213 PASS](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44875004150), production build, both pagination unit-test suites, and PostgreSQL migration/replay/security/checkout/tenant/subscription/lifecycle/scope checks.
- PR #25 pagination release-base commit `b76d0ae85911b6963af96bb1fd92ba5d90816649`: [Run #199 PASS](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44857892093), including inbox and summary cursor-pagination tests plus PostgreSQL smoke tests.
- CI uses a disposable PostgreSQL database and simulated client grants. It does not prove actual Supabase staging privileges or real-user RLS.

## Preview deployment evidence and browser-UAT limitation

- Vercel check was **SUCCESS** for the prior exact PR #26 head `9dadb6b4ce296079c5e5673266a18e5b8f20a81f`. The status target is a Vercel project/deployment dashboard, not an independently verified current-head preview URL.
- The earlier preview alias in this document was tied to an older SHA and is not accepted as evidence for the newer head. A direct open attempt was inaccessible; no checkout/auth/receipt browser interaction is claimed.
- The new baseline-bypass test and CI workflow update advance PR #26; exact-head CI must be refreshed on the final commit before review. Preview/browser UAT remains a staging gate.
- PR #14/#15 previews have previously been blocked by Vercel build-rate-limit status; do not infer those failures for PR #26.

## Required staging checks — exact preview SHA

Do not run until the owner approves the disposable staging migration and recovery plan.

- [ ] Record preview commit SHA; ensure the preview URL matches the PR head being tested.
- [ ] Confirm staging is disposable, identify the project ref, and use test-only businesses, outlets, products, accounts, and orders.
- [ ] Apply the reviewed migration to staging only after approval; record result and rollback/recovery plan.
- [ ] Query effective table and column privileges for `anon` and `authenticated`; confirm direct DML is denied on both order tables.
- [ ] As authenticated Business A owner, confirm scoped SELECT still returns Business A orders/items.
- [ ] Attempt direct REST/API status update on a test order; expect denial, then confirm status and audit count remain unchanged.
- [ ] Attempt direct order INSERT and item INSERT/UPDATE/DELETE; expect denial and no mutation.
- [ ] Create an order using the customer checkout flow; confirm order and item snapshot/price/quantity/total.
- [ ] Open the returned receipt capability; confirm header and items match checkout. Retry same idempotency key/payload and confirm same order; conflicting payload must reject.
- [ ] Use Owner Inbox lifecycle action; confirm status advances only through allowed transition, audit captures actor/from/to/note, and payment status is unchanged.
- [ ] Business A cannot read/update Business B's order/audit; outlet/business mismatch is rejected.
- [ ] Monthly/yearly outlet subscription checks create pending invoices only; no settlement or webhook delivery.
- [ ] Check desktop/mobile, console errors, pagination, delivery wording/fee, and customer/owner schedule display.

### Privilege SQL to capture (no secrets)

```sql
select
  has_table_privilege('anon','public.otc_orders','select') as anon_order_select,
  has_table_privilege('authenticated','public.otc_orders','select') as auth_order_select,
  has_table_privilege('authenticated','public.otc_orders','update') as auth_order_update,
  has_any_column_privilege('authenticated','public.otc_orders','update') as auth_order_column_update,
  has_table_privilege('authenticated','public.otc_order_items','insert') as auth_item_insert,
  has_table_privilege('authenticated','public.otc_order_items','delete') as auth_item_delete,
  has_any_column_privilege('authenticated','public.otc_order_items','update') as auth_item_column_update;
```

Expected: authenticated SELECT is true; all direct DML checks are false; anon order/item SELECT is false. If any result differs, stop UAT and report a security blocker.

## Evidence record

Record UTC timestamp, exact preview SHA, staging project ref (not credentials), test role/business/outlet, test ID, expected vs actual, sanitized screenshot/log, and whether mutation was absent after denial. Never capture receipt tokens, customer phone numbers, secrets, or payment credentials.

## Remaining release gates

- STAFF authorization: business-wide vs outlet-assigned policy and owner approval.
- Audit retention: cascade-delete behavior and approved retention policy.
- Delivery: fee configuration and courier responsibility wording.
- Browser UAT/staging evidence on exact preview SHA.

No live migration, production deploy, payment activation, or webhook enablement is authorized by this document. LinkBayar remains disabled. NORTAGO ORDER only; Dine-In, Reservation, Walk-In/POS, queue, table/seating/capacity, sessions, Control Tower, and BOS are excluded.


## Owner policy decisions — explicit release sign-off required

- **STAFF scope:** current authorization is business-wide membership; the lifecycle RPC verifies business membership and that the order's outlet belongs to that same business. It does not enforce a staff-to-outlet assignment. The owner must choose one of two release policies: (a) explicitly accept business-wide STAFF access for Order v1, or (b) require outlet-specific staff membership, in which case STAFF access must remain blocked until the membership model and tests are implemented. Do not silently treat the current model as outlet-scoped.
- **Audit retention:** `nortago_order_status_audit.order_id` and `business_id` currently use parent foreign keys with `ON DELETE CASCADE`. Deleting an order/business therefore deletes its audit history; append-only privileges do not prevent parent-driven cascade deletion. The owner must either accept that retention behavior for v1 or require a retention-preserving design (for example, soft deletion or an archival model) before applying migrations. No schema change is made without that decision.
- **Delivery operations:** confirm the fee calculation/display and who owns courier handoff/customer communication. If not confirmed, exclude Delivery from the initial commercial offer or disclose the operational limitation.

These are policy/operations decisions, not reasons to weaken the RPC-only table privilege boundary.
