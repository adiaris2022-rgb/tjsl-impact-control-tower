# NORTAGO ORDER — Lifecycle RPC owner-boundary decision

**Decision status: design approved for feature-branch review; staging application remains unapproved.**  
**Scope: NORTAGO ORDER only.** This decision does not add Dine-In, Reservation, Walk-In/POS, queue, tables/seating/capacity, sessions, Control Tower, or BOS.

## Evidence reviewed

1. The original OTC core migration defines `otc_orders.status` as text with the allowed values `NEW`, `PAID`, `SCHEDULED`, `PROCESSING`, `FULFILLMENT_CHECK`, `FULFILLMENT_ISSUE`, `READY`, `WAITING_PICKUP`, `PICKUP_VERIFIED`, `HANDED_OVER_TO_DELIVERY`, `SUCCESS`, and `PO_SUCCESS`. Payment is a separate `payment_status` column with `PENDING`, `PAID`, `FAILED`, and `REFUNDED`.
2. The core migration creates `otc_orders_staff_manage FOR ALL` for authenticated business members. Its `USING`/`WITH CHECK` predicates enforce business membership, not lifecycle transitions.
3. PR #18 migration `20261120_nortago_order_lifecycle_rpc_v1.sql` adds `nortago_update_order_status(uuid,text,text)` as `SECURITY DEFINER`. It requires `auth.uid()`, calls `has_business_role`, locks the order row, validates the outlet/business relationship and fulfillment-specific transition, updates status, and inserts one audit row. It does not change `payment_status`.
4. The PR #26 baseline regression deliberately restores Supabase-like client DML grants in disposable CI and proves that the old `FOR ALL` membership policy permits direct `status` mutation without a lifecycle audit event.
5. PR #26 migration `20261121_nortago_order_rpc_only_write_privileges_v1.sql` revokes client table- and column-level DML on `otc_orders` and `otc_order_items`, removes the broad order/item manage policies, and leaves authenticated scoped SELECT policies.
6. PR #33 migration `20261123_nortago_order_status_rpc_owner_guard_v1.sql` adds a `BEFORE UPDATE OF status` `SECURITY INVOKER` trigger. It compares `current_user` with the owner of the lifecycle RPC. Its rollback-only regression simulates an inherited `UPDATE(status)` grant and narrow UPDATE policy: direct mutation is rejected, the status remains unchanged, no audit row is written, and the approved RPC succeeds with exactly one audit row.
7. PR #35 adds a same-owner `SECURITY DEFINER` function inventory test for explicit direct UPDATE patterns. That test is intentionally static and does not prove the absence of dynamic SQL or indirect calls.
8. The repository's CI stub defines `has_business_role(uuid,text[])` as `SECURITY DEFINER`; the production/Supabase implementation is not defined by the reviewed repository migrations. Its actual owner, ACL, security mode, body, and underlying membership-table RLS must be inspected in staging before changing function ownership.

## Security conclusion

- **PR #18 alone is not a safe release candidate.** The baseline direct-write bypass is reproduced by source-backed disposable PostgreSQL regression evidence.
- **PR #26 + PR #33/#34 materially restrict the bypass in the reviewed migration stack.** Authenticated clients are intended to be read-only for order headers/items; the owner guard also rejects a direct status update when inherited column privilege and a matching RLS policy are deliberately simulated.
- **The owner guard is not yet an isolated trust boundary.** It trusts the lifecycle RPC's function-owner identity. Any other `SECURITY DEFINER` function running under the same owner can satisfy that identity. PR #35 catches a narrow class of explicit direct SQL writers, but cannot establish safety against dynamic SQL, indirect helper calls, or unreviewed functions.
- No claim is made about effective grants, role inheritance, actual trigger state, actual production `has_business_role`, or applied migrations in Supabase staging. Those require an owner-approved read-only staging SQL session.

## Precise owner-policy decision for production hardening

Do not use a shared, broadly privileged migration/table owner (for example, a generic `postgres` owner) as the long-term lifecycle authorization principal.

The production design to review is a dedicated role named `nortago_order_lifecycle_owner` with these properties:

- `NOLOGIN`, `NOINHERIT`, `NOSUPERUSER`, `NOCREATEDB`, `NOCREATEROLE`, `NOREPLICATION`, and `NOBYPASSRLS`.
- No role memberships in either direction: no users/roles may inherit or `SET ROLE` to it, and it must not inherit another role.
- No `CREATE` privilege on `public`; it must not own application tables or schemas.
- It owns exactly one `SECURITY DEFINER` function: `public.nortago_update_order_status(uuid,text,text)`. CI and the staging audit must fail closed if any other `SECURITY DEFINER` function shares this owner.
- Keep the existing `SECURITY INVOKER` status guard and require `current_user` to equal this dedicated owner. Keep the guard trigger enabled and non-executable by client roles.
- Grant only the function's required data access: SELECT on order identity/business/outlet/status/fulfillment columns; UPDATE on `status` and `updated_at` only; SELECT on the outlet's `business_id` only; INSERT on the lifecycle audit table only; and EXECUTE on the verified `auth.uid()` and `has_business_role(uuid,text[])` helpers.
- Add RLS policies addressed only to this non-login role for the required order SELECT/UPDATE, outlet SELECT, and audit INSERT operations. Do not add client DML grants or broad policies for `authenticated`, `anon`, or `PUBLIC`. Do not grant `BYPASSRLS`.
- Preserve the RPC's explicit actor, business membership, outlet/business consistency, allowed-transition, row-locking, and audit checks. Keep payment state separate.
- Do not grant this owner role to `authenticated`, `service_role`, or any application login. Review any helper called by the RPC as a separate trust boundary.

### Mandatory preconditions before writing/applying that migration

1. Run the read-only staging catalog audit and record the actual `has_business_role` function owner, `prosecdef`, `proconfig`, ACL/effective EXECUTE, and complete definition.
2. Inspect the actual `business_users` relation (if that is the helper's backing relation): owner, RLS enabled/forced state, policies, and effective privileges. If the helper is not SECURITY DEFINER or uses a different membership relation, stop and redesign the minimum access path from observed schema; do not assume this repository's CI stub is production truth.
3. Verify `auth.uid()` exists and resolves the authenticated request identity under the intended Supabase/PostgREST session.
4. Verify current table owners, RLS state, policies, trigger definitions/enabled state, RPC signature/status constraints, role memberships, and migration ledger.
5. Confirm the migration executor can create the dedicated role and transfer function ownership without leaving schema CREATE or role-membership privileges behind. If that requires a database-owner/superuser session, obtain that owner's explicit approval.
6. Apply only to an explicitly approved disposable staging project, then rerun direct-write rejection and approved-RPC transition tests under real authenticated sessions. No production application is implied by this decision.

If any precondition fails, retain the client DML revokes, do not broaden grants to make tests pass, and leave the lifecycle owner migration blocked for a database-owner decision.

## Independent release-readiness work continues

While the owner-policy decision is pending, continue independent Order-only gates: exact-SHA CI, checkout-to-receipt, idempotency, tenant/business isolation, per-outlet monthly/yearly subscription, owner pagination, customer/owner preview UAT, delivery fee/courier responsibility, payment-before-fulfillment policy, rollback/recovery, and commercial sign-off.

LinkBayar remains disabled. No staging/live migration, production deploy, payment/webhook activation, secrets/environment changes, merge, or destructive action is authorized by this document.
