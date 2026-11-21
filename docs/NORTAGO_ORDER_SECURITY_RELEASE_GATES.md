# NORTAGO ORDER — Security & Commercial Release Gates

This is a documentation-only release-readiness review based on the lifecycle migration and disposable CI contracts. It does **not** authorize a live migration, production deployment, payment activation, secrets change, or destructive operation.

## Verified code-level facts

- `nortago_update_order_status(uuid,text,text)` is a `SECURITY DEFINER` RPC with an explicit search path.
- The RPC rejects a missing `auth.uid()`, locks the selected order, checks business membership through `has_business_role`, verifies that the outlet belongs to the order's business, validates the fulfillment-specific transition, updates the order status, and writes an audit row in the same transaction.
- The lifecycle allow-list includes `OWNER`, `PROGRAM_MANAGER`, `PARTNER`, and `STAFF`. Authorization is business-membership based; this function does not check staff-to-outlet assignments. Do not interpret the current `STAFF` role as outlet-restricted.
- The audit table denies direct authenticated insert/update/delete and uses RLS for reads. The migration's audit foreign keys use `ON DELETE CASCADE` for order and business parents. Therefore, direct audit mutation restrictions do **not** guarantee audit retention when a parent order or business is deleted.

## Commercial release decisions required

### Staff/outlet boundary

Choose and record one policy before real staff accounts are enabled:

- **Business-wide staff access accepted:** confirm staff are trusted for all outlets in the business, provide a documented owner sign-off, and test that business B remains isolated from business A.
- **Outlet-specific staff access required:** keep staff lifecycle actions out of commercial use until an outlet-assignment schema/authorization check is implemented and tested. Do not rely on UI outlet selection as a security boundary.

### Audit retention

- Confirm the business/order deletion policy and whether lifecycle history must survive deletion of its parent.
- If audit retention is required, change the cascade behavior to a reviewed retention/soft-delete policy in a separate migration, add disposable PostgreSQL tests, and obtain owner approval before staging migration.
- Until the retention policy is decided, do not claim the audit log is permanently immutable or retained.

## Staging UAT evidence required

Use a disposable staging project and a preview built from the exact head SHA being tested. Record UTC time, preview SHA, project reference (never credentials), role, business/outlet, case ID, result, and sanitized evidence.

- [ ] Owner A can advance only orders belonging to Business A.
- [ ] Owner A cannot mutate Business B's order; status and audit remain unchanged.
- [ ] Order with an outlet belonging to another business is rejected.
- [ ] Invalid and fulfillment-incompatible transitions are rejected without mutation.
- [ ] Authorized transition writes exactly one audit event with actor, from/to status, and note.
- [ ] Payment state is unchanged by fulfillment lifecycle actions.
- [ ] Audit visibility follows staging RLS for both businesses.
- [ ] Checkout → receipt, idempotent retry, changed-payload/key rejection, and cross-business product/outlet validation pass.
- [ ] Per-outlet subscription preparation/retry remains pending and does not mark payment verified/paid or activate webhooks.
- [ ] Staff access is tested according to the explicitly approved business-wide or outlet-specific policy.
- [ ] Delivery fees, courier handoff responsibility, and customer disclosure are confirmed or Delivery is excluded from commercial availability.

CI on a disposable database is not live staging UAT. A preview for a different SHA is not evidence for the current branch.

## Automated CI evidence snapshot (2026-11-21)

The following exact-head workflow runs were rechecked:

- Lifecycle and audit PR #18 head `03ac27ceb0d268826c2b76e49808a923786d9e13`: run `44832208699`, both build and PostgreSQL jobs passed.
- Inbox pagination PR #21 head `7439811f8abf9692a369c2c48a278afcef3b77fe`: run `44832523269`, both jobs passed.
- Cursor pagination PR #22 head `1ab07fc4d16be27420e01a8c84e35ba8e2ec77c9`: run `44838570910`, both jobs passed.
- Summary pagination PR #23 head `7ae228012ad064a49fdeb436073e5002536fede4`: run `44843787049`, both build and PostgreSQL jobs passed.

These are disposable CI results only. They do not establish preview-browser behavior, real-account permissions, or Supabase staging readiness.

## Release scope and prohibited actions

NORTAGO ORDER only. Exclude Dine-In, Reservation, Walk-In/POS, queue, tables/seating/capacity, sessions, and Control Tower from this release. BOS remains deferred until ORDER is live and stable.

No merge, production deploy, live/staging migration, destructive action, secrets/environment change, payment activation, or webhook activation without explicit owner approval. LinkBayar remains disabled.
