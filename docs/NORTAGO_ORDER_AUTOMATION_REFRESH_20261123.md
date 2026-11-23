# NORTAGO ORDER — Release-first automation refresh

**Refresh:** 23 Nov 2026, 02:19 WIB  
**Scope:** Order-only release. No merge, deploy, live/staging migration, payment/webhook activation, secrets/config change, or destructive operation.

## Primary PR exact refs and CI

All PR #1 and #12–#17 were refreshed from GitHub metadata and remain Open, Draft, Unmerged, and mergeable. The exact commit-associated workflows and both job endpoints were inspected: 7/7 workflow runs and 14/14 jobs passed (production build and PostgreSQL migration/replay/smoke).

| PR | Head branch | Head SHA | Base branch | Base SHA | CI |
|---|---|---|---|---|
| [#1](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/pull/1) | feature/nortago-order-audit-fix | a75820a8ca6d14c3f92fd3dfcfb9821f28429843 | main | 545f4953368d0e85d7573c609bf4abf96b041c80 | [#69 PASS](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44665343539) |
| [#12](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/pull/12) | release/nortago-order-only-20261120 | a323dcdedb5fd1048d9d2b2e3560c6ced889789c | feature/nortago-order-audit-fix | a75820a8ca6d14c3f92fd3dfcfb9821f28429843 | [#183 PASS](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44810763148) |
| [#13](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/pull/13) | fix/nortago-order-plan-snapshot-20261120 | c0a5e75cf9a8964848ad00aa4b5d57d1753140a6 | release/nortago-order-only-20261120 | a323dcdedb5fd1048d9d2b2e3560c6ced889789c | [#136 PASS](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44721352568) |
| [#14](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/pull/14) | fix/nortago-order-checkout-idempotency-20261120 | f3a86754461b06b10250b073a38fae906bfd2777 | fix/nortago-order-plan-snapshot-20261120 | c0a5e75cf9a8964848ad00aa4b5d57d1753140a6 | [#138 PASS](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44725160805) |
| [#15](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/pull/15) | fix/nortago-order-release-scope-20261120 | e16260f8147e3b55255be6bf5163a32774abe280 | fix/nortago-order-checkout-idempotency-20261120 | f3a86754461b06b10250b073a38fae906bfd2777 | [#140 PASS](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44725624942) |
| [#16](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/pull/16) | chore/nortago-order-scope-smoke-dedupe | db3e6a43edc4edc4d3338504d87da11163594e42 | fix/nortago-order-release-scope-20261120 | e16260f8147e3b55255be6bf5163a32774abe280 | [#141 PASS](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44740771154) |
| [#17](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/pull/17) | feature/nortago-order-owner-inbox | 7516e1b22d5cd340b872db4bc516471a81ef74d4 | fix/nortago-order-release-scope-20261120 | e16260f8147e3b55255be6bf5163a32774abe280 | [#143 PASS](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44741038747) |

Vercel exact-head statuses: #1/#12/#13/#16/#17 success; #14/#15 failure from provider build-rate limit. CI itself passed on #14/#15.

## Lifecycle security audit (migration source + disposable PostgreSQL)

Reviewed the relevant migration files across PR #1/#12/#13/#14/#15/#18/#26 branches:

- **Core OTC** `20260928_otc_commerce_core_v1.sql`: `otc_orders.status` CHECK values are NEW, PAID, SCHEDULED, PROCESSING, FULFILLMENT_CHECK, FULFILLMENT_ISSUE, READY, WAITING_PICKUP, PICKUP_VERIFIED, HANDED_OVER_TO_DELIVERY, SUCCESS, PO_SUCCESS. RLS is enabled. `otc_orders_staff_manage` is authenticated FOR ALL with business-membership USING/WITH CHECK; it is not lifecycle enforcement. The core migration itself does not grant client table DML.
- **Lifecycle RPC** `20261120_nortago_order_lifecycle_rpc_v1.sql`: SECURITY DEFINER `nortago_update_order_status` authenticates via `auth.uid()`, checks business role and outlet/business relationship, locks the row, validates the transition, updates status and appends audit in one transaction. It does not create a trigger forcing status changes through the RPC.
- **Scope lock** `20261120_nortago_order_only_scope_lock_v1.sql`: revokes reservation RPC execution; does not protect order status.
- **Checkout/idempotency** migrations create NEW orders through SECURITY DEFINER RPCs and disable the legacy checkout RPC; no status-transition trigger is introduced.
- **Release scope guard** `20261120_nortago_order_release_scope_guard_v1.sql`: trigger checks DINE_IN and STAFF_WALK_IN, but the trigger only covers order_source/fulfillment_type at that branch; it is not a status-transition validator.
- **POS guard forward migration** `20261122_nortago_order_pos_integrated_scope_guard_v1.sql` (PR #30): trigger fires before INSERT or UPDATE of order_source, fulfillment_type, status, but its function only rejects DINE_IN, STAFF_WALK_IN, and POS_INTEGRATED. Firing on status does not enforce the lifecycle transition or audit.
- **RPC-only write hardening** `20261121_nortago_order_rpc_only_write_privileges_v1.sql` (PR #26): revokes table and explicit column INSERT/UPDATE privileges on otc_orders and otc_order_items from PUBLIC/anon/authenticated; restores authenticated SELECT and replaces broad mutation policies with business-scoped SELECT policies. Checkout, receipt, and lifecycle SECURITY DEFINER RPCs remain supported.

CI baseline test `nortago_order_status_direct_write_baseline_smoke.sql` simulates Supabase-like client DML grants and proves direct authenticated status UPDATE succeeds under broad membership RLS with no audit. Post-hardening regression test checks effective table/column privileges, RLS/read grants, rejects direct status/order/item mutations, then calls approved lifecycle RPC and verifies status advance, exactly one audit event, and unchanged payment_status.

**Evidence boundary:** tests run on disposable PostgreSQL. Effective grants/role inheritance, function ownership, auth identity and actual RLS/tenant roles on Supabase staging/live are not verified.

## Related release-readiness exact CI

| PR | Head SHA | Run | CI / Vercel |
|---|---|---|---|
| [#18 lifecycle RPC](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/pull/18) | 03ac27ceb0d268826c2b76e49808a923786d9e13 | [#191](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44832208699) | both jobs PASS; Vercel success |
| [#26 RPC-only writes](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/pull/26) | 99ca6c1b461ef267789a6eecf9ed18807b75a9f5 | [#216](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44881451219) | both jobs PASS; Vercel success |
| [#28 evidence](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/pull/28) (before this snapshot) | 6fb343e5465ef611e0f0472329b765fe8abf80e9 | [#263](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/45048474168) | both jobs PASS; Vercel success |
| [#29 Product/Service catalog](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/pull/29) | d63f3aa9ab0e20b972766b7215db245b8f54cccb | [#238](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44912723538) | both jobs PASS; Vercel success |
| [#30 POS guard](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/pull/30) | 751a307185dd99cd8842bc5cd54a4a3ad8352f8e | [#250](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44960942102) | both jobs PASS; Vercel success |
| [#31 hourly pagination](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/pull/31) | c58c841b11ef35a0a6c82ef2bc4d351681c82edb | [#254](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44967453458) | both jobs PASS; Vercel success |

CI step evidence for #29/#30/#31 was inspected. #29 runs catalog RPC security and Product/Service checkout-to-receipt smoke; #30 applies/replays POS guard and runs scope smoke; #31 runs Inbox, summary, and hourly pagination tests.

## Commercial release gates

- Customer browser UAT: menu → checkout → receipt (desktop/mobile).
- Owner browser UAT: inbox → lifecycle transition → audit.
- Read-only staging verification of effective grants, RLS, auth, function ownership and real tenant/outlet roles.
- Owner-approved payment-before-fulfillment policy (checkout is order submission; QRIS is not verified payment).
- Delivery fee/courier operating responsibility, commercial sign-off, release and rollback approval.

No merge, deployment, Supabase staging/live migration, payment/webhook activation, secrets/environment changes, or destructive actions. LinkBayar stays disabled. Release scope excludes Dine-In, Reservation, Walk-In/POS, queue, tables/seating/capacity, sessions, Control Tower, and BOS (deferred).


## Snapshot CI verification

- Initial snapshot commit: `8538fdd4640a94c1e6ae6ede0015c44fc9103cb1`.
- [Run #264 PASS](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/45060353097) was confirmed on that exact SHA. Both jobs completed: production build + pagination unit tests; PostgreSQL migration/replay/security/checkout/tenant/subscription/lifecycle/scope smoke.
- Vercel exact commit status on the snapshot was success.
- This evidence update is documentation-only and requires its own exact-head CI check.


## Fresh exact-head refresh — 23 Nov 2026, 18:11 WIB

This refresh supersedes earlier snapshots above. GitHub PR metadata and commit workflow/status endpoints were queried for PR #1 and #12–#17. All seven PRs remain open, draft, and unmerged.

| PR | Head SHA | Base SHA | Exact-head CI | Vercel |
|---|---|---|---|
| #1 | `a75820a8ca6d14c3f92fd3dfcfb9821f28429843` | `545f4953368d0e85d7573c609bf4abf96b041c80` | #69 PASS | success |
| #12 | `a323dcdedb5fd1048d9d2b2e3560c6ced889789c` | `a75820a8ca6d14c3f92fd3dfcfb9821f28429843` | #183 PASS | success |
| #13 | `c0a5e75cf9a8964848ad00aa4b5d57d1753140a6` | `a323dcdedb5fd1048d9d2b2e3560c6ced889789c` | #136 PASS | success |
| #14 | `f3a86754461b06b10250b073a38fae906bfd2777` | `c0a5e75cf9a8964848ad00aa4b5d57d1753140a6` | #138 PASS | provider build-rate-limit |
| #15 | `e16260f8147e3b55255be6bf5163a32774abe280` | `f3a86754461b06b10250b073a38fae906bfd2777` | #140 PASS | provider build-rate-limit |
| #16 | `db3e6a43edc4edc4d3338504d87da11163594e42` | `e16260f8147e3b55255be6bf5163a32774abe280` | #141 PASS | success |
| #17 | `7516e1b22d5cd340b872db4bc516471a81ef74d4` | `e16260f8147e3b55255be6bf5163a32774abe280` | #143 PASS | success |

Each commit-associated workflow run and combined status was queried again. Seven runs and fourteen jobs passed. PR #16/#17 runs #141/#143 remain green on their exact current commits. The #14/#15 provider failures are Vercel build-rate limits; GitHub Actions CI passed.


## Consolidated release candidate refresh

- PR #34 metadata: head `e2793462c6e297f36cf77ef83a4b6309dca923e`, base `c58c841b11ef35a0a6c82ef2bc4d351681c82edb`; Open/Draft/Unmerged/Mergeable.
- [Run #284](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/45156977713) jobs endpoint returned both jobs completed successfully: PostgreSQL migrations/replay/security/checkout/tenant/subscription/lifecycle/scope suite and production build/pagination tests.
- Exact head combined status: Vercel success. The commit-associated workflow-runs lookup returned no run entry, so exact SHA association for #284 is supported by the PR's recorded run/head but could not be independently re-confirmed through that endpoint in this refresh. Browser opening the GitHub run was unavailable.
- PR #28 pre-update head `37e3f9fecbd76266370358c4116054ad2f512fcc`: Run #286 PASS (2/2 jobs), Vercel success. This documentation update creates a new head and requires its own CI verification.

## Release gates remain unchanged

Actual Supabase staging effective grants/role inheritance/BYPASSRLS, real auth/RLS and applied migrations remain unverified. Customer/Owner browser UAT, delivery fee/courier responsibility, payment-before-fulfillment decision, rollback/recovery and commercial acceptance remain pending. No merge, staging/live migration, production deployment, payment/webhook activation, secrets/environment changes, or destructive action. LinkBayar remains disabled; NORTAGO ORDER-only scope and BOS deferral remain in force.
