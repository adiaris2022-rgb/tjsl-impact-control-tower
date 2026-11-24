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


## Feature-branch implementation candidate — PR #37

A dedicated-owner migration candidate is now proposed on feature branch `fix/nortago-order-dedicated-lifecycle-owner-20261124` (PR #37). It adds a database preflight that aborts unless the actual `auth.uid()`, SECURITY DEFINER `has_business_role(uuid,text[])` with a `pg_catalog`-first search path, required tables, and RLS are present. It creates a NOLOGIN/NOINHERIT/NOSUPERUSER/NOBYPASSRLS role with no memberships, transfers only the lifecycle RPC, and grants only the required order/outlet/audit columns plus helper EXECUTE.

The RPC body is narrowed from `SELECT *` to the five columns it actually consumes (`id`, `business_id`, `outlet_id`, `status`, `fulfillment_type`), so the proposed owner does not need access to customer PII, payment fields, checkout keys, or order items. The CI candidate also checks exact column privileges, role attributes/memberships, RLS policy presence, and the existing direct-write rejection/approved-RPC regression. This is still feature-branch/disposable-CI evidence only. It has not been applied to Supabase staging or production. If the actual staging helper is not SECURITY DEFINER with a safe search path, the migration deliberately aborts; redesign must follow the observed helper and membership relation rather than weakening grants.


## Managed Supabase migration-executor compatibility — 24 Nov 2026

A read-only catalog audit was run against the connected Supabase project `NORTAGO-ORDER-STAGING` (`aakhinaryzidzpsjeewp`). This project is ACTIVE_HEALTHY on PostgreSQL 17.12, but it is empty for the application: no public OTC tables, no `business_users`, no `has_business_role`, no lifecycle RPC, no status audit table, and no application migration ledger. It is not proven to be the populated staging target; the OTC core migration comment references `tdpupelhvzxwhbqnnlxk`, which this connection cannot inspect.

The actual managed-role catalog on the connected project shows:

- Current role `postgres`: `rolsuper=false`, `rolcreaterole=true`, `rolbypassrls=true`, `rolcanlogin=true`. It is not a database superuser.
- `public` schema owner is `pg_database_owner`; `postgres` has USAGE and CREATE with grant option.
- `auth` schema owner is `supabase_admin`; `postgres` has USAGE but no CREATE or grant option.
- `auth.uid()` owner is `supabase_auth_admin`; EXECUTE is available to `postgres` through PUBLIC, but is not grantable by `postgres`.
- `postgres` is not a member of `supabase_admin`; its catalog memberships do not confer ownership of the auth schema/function.

This makes the previous superuser-only lifecycle-owner migration path incompatible with the connected managed-role shape. Directly granting auth schema USAGE or auth.uid EXECUTE to the dedicated lifecycle owner is also not available to this executor. No attempt was made to change these platform ACLs.

### PR #39 feature-branch adjustment

PR #39 updates the candidate migration without broadening client or platform grants:

1. Require a trusted migration executor with `CREATEROLE` (or superuser), public-schema CREATE grant option, access to `auth.uid()`, and ownership/membership sufficient to transfer the existing lifecycle RPC. Fail closed if any observed prerequisite is missing.
2. Keep auth schema access with the trusted migration executor. Add `public.nortago_order_auth_actor()`, a SECURITY DEFINER bridge owned by that executor, with `search_path=pg_catalog`; it returns only `auth.uid()`. Revoke EXECUTE from PUBLIC/anon/authenticated and grant it only to `nortago_order_lifecycle_owner`. The dedicated owner receives neither USAGE on `auth` nor a direct auth.uid grant.
3. The database owner must pre-provision `nortago_order_lifecycle_owner` as NOLOGIN/NOINHERIT/NOSUPERUSER/NOCREATEDB/NOCREATEROLE/NOREPLICATION/NOBYPASSRLS, then grant the trusted migration executor a temporary membership with `ADMIN TRUE`, `SET TRUE`, and `INHERIT FALSE`. A managed `CREATEROLE` executor cannot grant itself membership in a pre-existing role without ADMIN OPTION; the migration must fail closed if the owner has not provided this grant. The executor uses the membership only to transfer/replace the lifecycle RPC and revokes only the temporary `public CREATE` privilege it granted itself. Because PostgreSQL records the membership grant under the database-owner grantor, the executor cannot revoke that owner-issued membership; the **same database-owner principal that pregranted ADMIN OPTION must revoke it after the migration** (or a database superuser must do so). Verify zero memberships before authenticated UAT. The dedicated role must finish with no memberships and no schema CREATE.
4. Keep the dedicated lifecycle owner NOLOGIN/NOINHERIT/NOSUPERUSER/NOBYPASSRLS, with only its reviewed column-level order/outlet/audit grants and RLS policies. The bridge is a separate, narrowly scoped trust boundary and is not a status writer.

CI now prepares a NOLOGIN, non-superuser CREATEROLE executor and a database-owner-preprovisioned lifecycle role. It first runs the migration without ADMIN OPTION and asserts the exact fail-closed error, then simulates the owner pregrant, applies the migration as the executor, simulates owner-side revocation of the owner-issued membership, re-pregrants for replay, replays, revokes again as the owner, and checks zero memberships, helper ACL/owner, minimal grants/RLS, direct status-write rejection, and approved RPC transition/audit. This remains disposable PostgreSQL evidence only.

### Owner decision and remaining preconditions

The preferred path is a managed-role-compatible migration using the restricted auth-actor bridge, **not** granting the dedicated lifecycle owner access to the auth schema and **not** broadening authenticated/service_role privileges. The migration executor must own the OTC tables and lifecycle RPC, have CREATEROLE (or be superuser), public-schema USAGE/CREATE grant option, access to `auth.uid()`, and EXECUTE/GRANT OPTION on the actual SECURITY DEFINER `has_business_role(uuid,text[])` helper (or the dedicated role must already have the required EXECUTE). Separately, the database owner must pre-provision the dedicated NOLOGIN role and grant the executor temporary `ADMIN TRUE, SET TRUE, INHERIT FALSE` membership. CREATEROLE alone is not sufficient to grant membership in an existing role. PostgreSQL records that membership under the owner grantor, so the same owner must revoke it after migration; the executor can revoke only grants it recorded itself. CI proves the migration rejects the missing-ADMIN case and verifies that owner-side cleanup is required and effective. Inspect the real helper body/owner/ACL and its membership-table RLS first. If any prerequisite is unavailable, stop and require an explicitly approved migration principal or redesign the bridge from the observed schema.

The connected project remains empty, so actual effective grants on `otc_orders.status`, actual OTC RLS policies/triggers, and authenticated-session behavior remain **unverified**. Do not apply migrations to `aakhinaryzidzpsjeewp` merely because it is named staging. The separate `ensure_rls` event trigger invokes `public.rls_auto_enable()`; the function is SECURITY DEFINER with default PUBLIC EXECUTE on this project. This platform-level finding is documented for review on the confirmed target; no ACL change was made.



### PR #39 CI failure and owner-membership correction — 24 Nov 2026

The first PR #39 exact-head run (#382) exposed a real PostgreSQL privilege rule: a non-superuser CREATEROLE executor cannot grant itself membership in a pre-existing `nortago_order_lifecycle_owner` role without ADMIN OPTION. The initial fixture incorrectly attempted that self-grant and failed at setup with `permission denied to grant role`. The migration candidate has been corrected to require a database-owner-preprovisioned ADMIN/SET membership, verify `ADMIN TRUE`, `SET TRUE`, and `INHERIT FALSE` from `pg_auth_members`, use it only for the function ownership transfer, and revoke it at the end. CI now tests both the expected fail-closed case without the owner pregrant and the successful apply/replay case after the pregrant. This is a precise owner policy, not a broad client or platform grant.


The second PR #39 exact-head CI run (#386) reached the post-migration security verification and exposed that the migration executor cannot remove the membership row granted by `postgres`: PostgreSQL tracks role-membership grantors, and a role can revoke only the membership grant it made. The migration now leaves the owner-issued temporary ADMIN OPTION intact and the CI fixture has an explicit owner-side cleanup step (run by the same grantor) before the final no-membership assertion. This is required operationally in the real managed project; do not begin authenticated UAT until the database owner has revoked the temporary membership and the catalog audit confirms zero members.
