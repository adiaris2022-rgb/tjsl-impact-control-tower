# NORTAGO ORDER — Exact-head CI & Lifecycle Security Refresh
**Refresh:** 24 Nov 2026, 06:00 WIB  
**Scope:** NORTAGO ORDER only. Dine-In, Reservation, Walk-In, POS, queues, tables/seating/capacity, sessions, Control Tower, and BOS are excluded.

## 1. Primary PRs — refreshed exact refs and CI
All PRs #1, #12–#17 were refreshed from GitHub metadata. Each is Open, Draft, Unmerged, and Mergeable. Commit-associated workflow runs match the current head SHA; both jobs completed success: **7/7 runs, 14/14 jobs PASS**.

| PR | Head | Base SHA | Actions run | CI jobs | Vercel |
|---|---|---|---|---|
| [#1](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/pull/1) | `a75820a8ca6d14c3f92fd3dfcfb9821f28429843` | `545f4953368d0e85d7573c609bf4abf96b041c80` | [#69](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44665343539) | 2/2 PASS | Success |
| [#12](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/pull/12) | `a323dcdedb5fd1048d9d2b2e3560c6ced889789c` | `a75820a8ca6d14c3f92fd3dfcfb9821f28429843` | [#183](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44810763148) | 2/2 PASS | Success |
| [#13](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/pull/13) | `c0a5e75cf9a8964848ad00aa4b5d57d1753140a6` | `a323dcdedb5fd1048d9d2b2e3560c6ced889789c` | [#136](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44721352568) | 2/2 PASS | Success |
| [#14](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/pull/14) | `f3a86754461b06b10250b073a38fae906bfd2777` | `c0a5e75cf9a8964848ad00aa4b5d57d1753140a6` | [#138](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44725160805) | 2/2 PASS | Provider build-rate-limit |
| [#15](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/pull/15) | `e16260f8147e3b55255be6bf5163a32774abe280` | `f3a86754461b06b10250b073a38fae906bfd2777` | [#140](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44725624942) | 2/2 PASS | Provider build-rate-limit |
| [#16](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/pull/16) | `db3e6a43edc4edc4d3338504d87da11163594e42` | `e16260f8147e3b55255be6bf5163a32774abe280` | [#141](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44740771154) | 2/2 PASS | Success |
| [#17](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/pull/17) | `7516e1b22d5cd340b872db4bc516471a81ef74d4` | `e16260f8147e3b55255be6bf5163a32774abe280` | [#143](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44741038747) | 2/2 PASS | Success |

PR #16/#17 explicitly rechecked: Run #141/#143, exact current SHA, 2/2 jobs PASS. GitHub Actions for #14/#15 is green; Vercel failure is the provider build-rate-limit check, not GitHub CI.

## 2. PR #28 documentation branch
Current head at refresh: `642353a8bc023e20c7c5e4fac009cc6ee0976e67`.  
Exact commit-associated CI: [Run #294](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/45273901084), **2/2 PASS**.  
- Build job: Owner Inbox cursor-pagination unit tests, Owner summary cursor-pagination unit tests, production build — success.
- PostgreSQL job: baseline simulated Supabase client grants, all migrations apply/replay, billing/security, checkout, lifecycle, tenant isolation, per-outlet subscription, and scope smoke checks — success.
- Vercel exact SHA status: Success.
- PR #28 remains Draft/Open/Unmerged.

## 3. Consolidated candidate PR #34
PR #34 remains Draft/Open/Unmerged. Exact refs:
- Base `c58c841b11ef35a0a6c82ef2bc4d351681c82edb`
- Head `e2793462c6e297f36cf77ef83a4b6309dca923e`
- [Run #284](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/45156977713) — 2/2 jobs PASS; merge-checkout evidence previously inspected confirms tested head/base.
- Vercel current exact-head status: Success.
- Coverage includes inherited status privilege guard, RPC-only DML, migration replay, checkout idempotency, tenant isolation, per-outlet subscription, lifecycle edge paths/audit, paid-order payment-state separation, scope lock, and owner pagination tests.

## 4. Lifecycle security: migration-source inventory
Migration directories were enumerated for:
- PR #18 lifecycle branch: 15 migrations.
- PR #26 RPC-only DML branch: 16 migrations.
- PR #33 owner-guard branch: 18 migrations.
- PR #34 consolidated release branch: 18 migrations.

All 18 migration files on PR #34 release branch were fetched and text-scanned for `otc_orders`, status, grants, policies, triggers, and lifecycle RPC references. The inventory includes core OTC, secure checkout, idempotency, lifecycle, Order-only scope, RPC-only DML, POS-integrated source guard, and status-owner guard migrations.

### Findings
- Core migration `20260928_otc_commerce_core_v1.sql` creates RLS-enabled `otc_orders` and business-membership `FOR ALL` policy `otc_orders_staff_manage`. That policy alone is not lifecycle enforcement; baseline test with simulated client DML proved direct status update could bypass RPC/audit.
- Checkout migration `20261117_nortago_customer_checkout_secure_v1.sql` and idempotency migration `20261120_nortago_customer_checkout_idempotency_v1.sql` create orders by INSERT; receipt code is read-only.
- `20261120_nortago_order_lifecycle_rpc_v1.sql` defines `nortago_update_order_status(uuid,text,text)` SECURITY DEFINER. It validates `auth.uid()`, business role, outlet/business relation, row-locks, checks fulfillment-specific transition, updates status, and writes audit transactionally; payment_status remains untouched. Authenticated EXECUTE is granted; public/anon are revoked.
- `20261121_nortago_order_rpc_only_write_privileges_v1.sql` revokes direct table and explicit column INSERT/UPDATE/DELETE privileges on order headers/items from PUBLIC, anon, authenticated; re-grants authenticated SELECT and replaces broad manage policies with scoped read policies.
- `20261120_nortago_order_release_scope_guard_v1.sql` rejects Dine-In and STAFF_WALK_IN on INSERT/status/source/fulfillment updates. `20261122_nortago_order_pos_integrated_scope_guard_v1.sql` adds POS_INTEGRATED rejection.
- `20261123_nortago_order_status_rpc_owner_guard_v1.sql` installs enabled BEFORE UPDATE OF status SECURITY INVOKER trigger. It compares `current_user` to lifecycle RPC owner and rejects with `NORTAGO_ORDER_STATUS_RPC_ONLY` when unmatched. Client EXECUTE on trigger function is revoked.
- Text scan of the release migration set found the only direct `UPDATE public.otc_orders SET status` writer in the lifecycle RPC. No other status writer was found in this migration inventory.

### Regression proof (disposable CI only)
The owner-guard smoke test grants inherited `UPDATE(status)`, creates a narrow UPDATE policy for a fixture, proves effective column privilege exists and table-level UPDATE is absent, then attempts direct status update. It asserts the expected RPC-only trigger denial, unchanged status, no audit event, approved lifecycle RPC succeeds with exactly one audit row, and payment_status remains unchanged. The RPC-only smoke separately asserts client direct table/column mutation privileges are revoked while authenticated scoped reads and supported RPCs remain.

### Security limitation
The trigger compares trusted RPC owner identity, not caller-function identity. A same-owner SECURITY DEFINER writer could pass. Static inventory currently finds only the lifecycle writer, but strict single-function enforcement would require a dedicated trusted owner boundary or another owner-approved design. Actual staging effective privileges, inherited role membership, BYPASSRLS, auth, RLS, trigger enabled state, function ownership, and applied migrations remain **unverified** because no staging database session is available.

## 5. Release gates
CI evidence covers checkout-to-receipt, idempotency, tenant/outlet isolation, per-outlet subscription, owner pagination, lifecycle transitions/audit, direct mutation denial, and Order-only scope. CI is disposable PostgreSQL/build evidence, not browser/customer UAT.

Open gates:
1. Actual Supabase staging read-only catalog audit (grants, role closure/BYPASSRLS, RLS, trigger state, function owner/ACL, migration ledger).
2. Customer browser UAT for menu/cart/checkout/receipt.
3. Owner browser UAT for inbox/lifecycle/audit.
4. Confirm staff outlet isolation requirements.
5. Delivery/courier responsibility and fees.
6. Payment-before-fulfillment decision (current lifecycle can advance NEW to PROCESSING while payment_status=PENDING; policy must decide when this is acceptable).
7. Rollback/recovery and commercial acceptance.

## 6. Safety
No merge, production deployment, Supabase staging/live migration, payment/webhook activation, secrets/environment changes, or destructive actions. LinkBayar webhook remains disabled. Order-only scope stays locked; BOS deferred until Order is live/stable.
