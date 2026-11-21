# NORTAGO ORDER — Release Readiness & UAT

## Product scope (release 1)

NORTAGO ORDER is a shareable link for product catalog, checkout, and order intake. Customer order modes are **Pre-Order (scheduled pickup in current checkout model), Takeaway, and Delivery**.

Excluded from this release: Dine-In, Walk-In/POS, reservations, queues, tables/seating/capacity, sessions, Control Tower, and BOS (deferred until Order is live and stable).

## Current pull request chain and CI evidence (21 Nov 2026)

All PRs listed remain **open, draft, and unmerged**. Head/base references were refreshed during the release-first review.

| PR | Head branch | Head SHA / latest CI-tested code ref | Base branch | Latest verified CI |
|---|---|---|---|
| #1 | `feature/nortago-order-audit-fix` | `a75820a8ca6d14c3f92fd3dfcfb9821f28429843` | `main` | Run #69 PASS |
| #12 | `release/nortago-order-only-20261120` | `a323dcdedb5fd1048d9d2b2e3560c6ced889789c` | `feature/nortago-order-audit-fix` | Run #183 PASS |
| #13 | `fix/nortago-order-plan-snapshot-20261120` | `c0a5e75cf9a8964848ad00aa4b5d57d1753140a6` | `release/nortago-order-only-20261120` | Run #136 PASS |
| #14 | `fix/nortago-order-checkout-idempotency-20261120` | `f3a86754461b06b10250b073a38fae906bfd2777` | `fix/nortago-order-plan-snapshot-20261120` | Run #138 PASS |
| #15 | `fix/nortago-order-release-scope-20261120` | `e16260f8147e3b55255be6bf5163a32774abe280` | `fix/nortago-order-checkout-idempotency-20261120` | Run #140 PASS |
| #16 | `chore/nortago-order-scope-smoke-dedupe` | `db3e6a43edc4edc4d3338504d87da11163594e42` | `fix/nortago-order-release-scope-20261120` | Run #141 PASS |
| #17 | `feature/nortago-order-owner-inbox` | `7516e1b22d5cd340b872db4bc516471a81ef74d4` | `fix/nortago-order-release-scope-20261120` | Run #143 PASS |
| #18 | `feature/nortago-order-lifecycle-rpc` | `03ac27ceb0d268826c2b76e49808a923786d9e13` | `feature/nortago-order-owner-inbox` | Run #191 PASS |
| #26 | `fix/nortago-order-rpc-only-write-privileges-20261121` | `99ca6c1b461ef267789a6eecf9ed18807b75a9f5` | `fix/nortago-order-pagination-release-base-18-20261121` | Run #216 PASS |
| #28 | `docs/nortago-order-exact-release-evidence-20261121` | `d349e756d3dd6ca789e4bc1c7e4ba2ef74bc0fb9` | `fix/nortago-order-rpc-only-write-privileges-20261121` | Run #221 PASS on prior head `eb22b44e131d2dbe94ee276b6f4319945fc253da` (docs-only current head not CI-tested) |
| #29 | `feat/nortago-order-services-20261121` | `d63f3aa9ab0e20b972766b7215db245b8f54cccb` | `fix/nortago-order-rpc-only-write-privileges-20261121` | [Run #238 PASS](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44912723538) |

- [PR #18](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/pull/18) remains draft.
- [CI Run #174](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44770912476) passed on PR #18 head `8e084c579d40c023ea13aace0d028d55da628c89`: production build, migrations/replay, lifecycle security tests, checkout-to-receipt assertions, tenant isolation, and per-outlet subscription checks.
- PR #16 and #17 current heads were rechecked: CI runs #141 and #143 respectively, both PASS.
- Vercel check for code-tested commit `8e084c579d40c023ea13aace0d028d55da628c89` is **success**. A documentation-only follow-up advances the branch head; the bot's Preview alias has prefix `97f4da`, which matches neither the code-tested commit nor the current documentation head. The URL could not be independently inspected. CI PASS is not browser UAT or live Supabase staging verification.

### Preview status refreshed for PR #1/#12–#18

| PR | Vercel status | Evidence |
|---|---|---|
| #1 | Success | Preview status returned by GitHub |
| #12 | Success | Exact current head Vercel status |
| #13 | Success | Preview status returned by GitHub |
| #14 | Failure | Build-rate-limit |
| #15 | Failure | Build-rate-limit |
| #16 | Success | Preview status returned by GitHub |
| #17 | Success | Preview status returned by GitHub |
| #18 | Success | Exact current head Vercel status |
| #26 | Success | Exact current head Vercel status |
| #28 | Success | Exact current head Vercel status |
| #29 | Success | Exact current head Vercel status |

A successful Vercel check is deployment evidence only; preview pages were not independently browser-verified.

## Order lifecycle implementation and security test evidence

PR #18 adds a server-side `nortago_update_order_status` RPC, row locking, allowed transitions by fulfillment type, business-role authorization, outlet/business relationship validation, audit rows, and Owner Inbox actions/history. Payment status is deliberately not mutated by lifecycle actions.

The CI fixture was strengthened to model `business_users` membership rather than an unconditional role stub:
- no membership → lifecycle action denied;
- membership in Business A → allowed for Business A;
- Business A member → denied for Business B order;
- authorized Business A order referencing Business B outlet → rejected by outlet/business consistency guard;
- denied actions do not change status or create audit records;
- authenticated audit RLS test confirms Business A can read its event but cannot read Business B's event; direct audit INSERT is denied.

**Limit:** CI uses a test `has_business_role` fixture, not the actual Supabase production function/identity. Repository migrations do not define the production `has_business_role` implementation. Real Supabase role/RLS verification remains mandatory. The current authorization model is business-level membership; it does not implement per-outlet staff membership/permission boundaries. Lifecycle RPC validates that an order's outlet belongs to the same business, but cannot enforce staff assignment to a particular outlet because no outlet-specific membership/permission schema exists in this repository. Do not claim outlet-level staff isolation until that model is explicitly designed and UAT-tested.

## Automated CI coverage (disposable PostgreSQL only)

- **Checkout → receipt:** successful idempotent checkout returns a receipt capability; receipt RPC resolves the matching order header and item snapshot (customer, fulfillment/payment status, totals, item name, outlet price override, quantity, and line total). These assertions were added and passed in CI run #174.
- **Checkout idempotency:** retry returns the same order/receipt, conflicting payload re-use rejected, no duplicate order/items.
- **Tenant isolation:** cross-business product rejected, cross-linked product/outlet rejected, failed checkout creates no order, invalid receipt token returns no data.
- **Lifecycle RPC:** fulfillment-specific transitions, forbidden transitions, unauthenticated rejection, role denial, business membership boundary, outlet/business mismatch, invalid status, oversized note rejection, audit actor/note, payment-state separation.
- **Audit RLS:** authenticated Business A membership sees only Business A audit rows; Business B rows are filtered; direct authenticated INSERT privilege is absent.
- **Per-outlet subscriptions:** monthly/yearly plan snapshot, invoice/payment reuse on retry, plan change staged as pending, separate outlet subscriptions, no settlement or webhook.
- **Order scope:** Dine-In/Walk-In/reservation actions remain excluded/blocked in the Order release scope.

All automated assertions above ran against the disposable CI database. Successful checkout-to-receipt and lifecycle boundary assertions were verified on PR #18 head `8e084c579d40c023ea13aace0d028d55da628c89` in [CI Run #174](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44770912476). These tests do **not** constitute live/staging verification.

## Manual staging UAT — required before release

### A. Authentication and tenant/outlet ownership
- [ ] Owner/member from Business A can read and update only orders within authorized business.
- [ ] Business A user cannot update Business B order.
- [ ] Order with outlet belonging to another business is rejected and does not mutate order/audit.
- [ ] Real role variants (Owner, Program Manager, Partner, Staff) are checked against intended permissions.
- [ ] Audit history is visible only to authorized business members under real Supabase RLS.
- [ ] Confirm whether outlet-specific staff access is required; current implementation is business-level.

### B. Takeaway lifecycle
- [ ] NEW → PROCESSING → READY → WAITING_PICKUP → PICKUP_VERIFIED → SUCCESS.
- [ ] Wrong delivery handoff transition is rejected.
- [ ] Invalid/closed status transition is rejected.
- [ ] Optional note is trimmed, persisted, and limited to 500 characters.
- [ ] Refresh shows updated status and audit history.
- [ ] Payment status remains unchanged after lifecycle actions.

### C. Delivery lifecycle
- [ ] NEW → PROCESSING → READY → HANDED_OVER_TO_DELIVERY → SUCCESS.
- [ ] Pickup transition is rejected for Delivery.
- [ ] Verify courier handoff process and operational responsibility.
- [ ] Confirm delivery fee calculation/display; fee currently requires operational validation.

### D. Pre-Order lifecycle
- [ ] Future scheduled time is required at customer checkout.
- [ ] NEW/SCHEDULED → PROCESSING → READY → WAITING_PICKUP → PICKUP_VERIFIED → SUCCESS → PO_SUCCESS.
- [ ] Invalid pickup/delivery transitions are rejected.
- [ ] Scheduled time and pickup details display correctly in Owner Inbox and receipt.

### E. Customer checkout → receipt
- [ ] Submit an order with an available product and quantity; server uses outlet price, not client-supplied price.
- [ ] Verify order number, item snapshots, totals, fulfillment and payment status.
- [ ] Re-submit same idempotency key/payload; same order/receipt returns and no duplicate rows.
- [ ] Re-use key with a different payload; request is rejected.
- [ ] Open valid receipt token and confirm it resolves to the created order; automated CI now asserts successful receipt header/item data and outlet-price override.
- [ ] Invalid/unknown receipt token returns no order/customer data.
- [ ] Test a product from another business and confirm rejection without order creation.

### F. Per-outlet subscription
- [ ] Prepare monthly and yearly invoice for an outlet; confirm amount/plan snapshot.
- [ ] Retry invoice preparation; confirm same open invoice/payment is reused.
- [ ] Change plan; confirm active plan remains unchanged until settlement.
- [ ] Verify second outlet gets separate subscription/invoice.
- [ ] Confirm invoice preparation does not settle payment or create webhook delivery.
- [ ] Do not activate LinkBayar/webhook as part of UAT.

### G. Release scope and deployment
- [ ] Confirm Dine-In, Walk-In/POS, Reservation, Queue, Tables/Seating/Capacity, Session, and Control Tower are absent/blocked in Order.
- [ ] Verify preview is for the latest PR #18 head and all CTA/checkout routes work.
- [ ] Review migration and rollback plan; apply only to approved disposable staging.
- [ ] Complete UAT evidence (screenshots, test account roles, timestamps, test results) and owner sign-off.

## Current blockers / gates

- **Preview:** latest PR #18 Vercel status is success, but the bot's Preview alias commit prefix does not match the current head and the browser tool cannot inspect the deployment. Current-head preview/browser UAT remains unverified.
- **Supabase staging:** no migration was applied. CI replay is disposable only.
- **Real auth/RLS:** production `has_business_role` and tenant policies are not verified against real users.
- **Checkout UAT:** automated functional tests pass; actual deployed checkout → private receipt needs staging/preview UAT.
- **Owner UAT:** lifecycle actions and audit history are automated; real tenant UI verification remains.
- **Delivery:** fee, courier handoff, and third-party responsibility need operational confirmation.
- **Payments:** payment provider collection and webhook settlement are not verified/activated. LinkBayar webhook remains disabled.

## Release checklist

- [x] CI Run #174 green on the code-tested commit `8e084c579d40c023ea13aace0d028d55da628c89` (build + disposable database + checkout-to-receipt + lifecycle security + audit RLS).
- [ ] PR review and scope confirmation.
- [ ] Preview/staging access restored for current head.
- [ ] Approved migration applied to disposable staging.
- [ ] Real tenant/outlet and role isolation verified.
- [ ] Checkout → order → private receipt UAT passed.
- [ ] Owner lifecycle + audit history UAT passed.
- [ ] Monthly/yearly per-outlet subscription UAT passed without payment activation.
- [ ] Delivery pricing/handoff terms verified.
- [ ] Payment provider/webhook approved and tested if included in release.
- [ ] Production deployment explicitly approved.

## Release decision

**NOT READY for production** until preview/staging, real-tenant UAT, delivery, and payment gates are resolved. PR #18 remains draft. No merge, production deployment, Supabase staging/live migration, payment activation, secrets/environment change, or webhook enablement is performed without explicit approval.


## Latest automation refresh — 21 Nov 2026

- PR #18 current head: `1a70bbca1d929118fe4c023cc635ccdbfc14726c`; base remains `feature/nortago-order-owner-inbox` at `7516e1b22d5cd340b872db4bc516471a81ef74d4`. Draft, open, unmerged.
- [CI Run #178](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44790097632) **PASS** on that head: production build and disposable PostgreSQL migrations/replay plus lifecycle, audit RLS, checkout/receipt, tenant isolation, subscription, and scope smoke tests.
- New lifecycle edge-path smoke test covers scheduled → fulfillment check → issue → recovery, check → ready, terminal-state rejection, audit counts/note, and payment-state separation.
- PR #1 and #12–#17 head/base refs and their latest CI runs were refreshed on this review; PR #16 Run #141 and #17 Run #143 remain PASS.
- Vercel commit status for PR #18 head `1a70bbca1d929118fe4c023cc635ccdbfc14726c` is **success**, but the deployment/status target cannot be independently opened by the verification browser. Current-head browser UAT is still unverified.
- No staging/live migration, merge, production deployment, payment activation, webhook activation, or environment/secrets changes.


## Exact GitHub refresh — 21 Nov 2026 (automation run)

Metadata was refreshed from GitHub for PRs #1, #12–#18. All remain open, draft, and unmerged.

| PR | Head SHA | Base branch | Base SHA | CI on exact head | Vercel |
|---|---|---|---|---|
| #1 | `a75820a8ca6d14c3f92fd3dfcfb9821f28429843` | `main` | `545f4953368d0e85d7573c609bf4abf96b041c80` | Run #69 PASS | success |
| #12 | `31e517eed0c280ed25e57c144405bbd2fcb0178b` | `feature/nortago-order-audit-fix` | `a75820a8ca6d14c3f92fd3dfcfb9821f28429843` | **No PR workflow run returned for exact head; CI unverified** | failure (Vercel build-rate-limit) |
| #13 | `c0a5e75cf9a8964848ad00aa4b5d57d1753140a6` | `release/nortago-order-only-20261120` | `31e517eed0c280ed25e57c144405bbd2fcb0178b` | Run #136 PASS | success |
| #14 | `f3a86754461b06b10250b073a38fae906bfd2777` | `fix/nortago-order-plan-snapshot-20261120` | `c0a5e75cf9a8964848ad00aa4b5d57d1753140a6` | Run #138 PASS | failure (Vercel build-rate-limit) |
| #15 | `e16260f8147e3b55255be6bf5163a32774abe280` | `fix/nortago-order-checkout-idempotency-20261120` | `f3a86754461b06b10250b073a38fae906bfd2777` | Run #140 PASS | failure (Vercel build-rate-limit) |
| #16 | `db3e6a43edc4edc4d3338504d87da11163594e42` | `fix/nortago-order-release-scope-20261120` | `e16260f8147e3b55255be6bf5163a32774abe280` | Run #141 PASS | success |
| #17 | `7516e1b22d5cd340b872db4bc516471a81ef74d4` | `fix/nortago-order-release-scope-20261120` | `e16260f8147e3b55255be6bf5163a32774abe280` | Run #143 PASS | success |
| #18 | `21fbf56d7a8aba4f1b01beb93642ea945ea7cd75` (refresh baseline) | `feature/nortago-order-owner-inbox` | `7516e1b22d5cd340b872db4bc516471a81ef74d4` | Run #179 PASS | success |

Exact CI runs confirmed by commit lookup: #1 (ID 44665343539), #13 (44721352568), #14 (44725160805), #15 (44725624942), #16 (44740771154), #17 (44741038747), and #18 #179 (44790249044). PR #12's earlier run #131 was not returned for the exact head in this refresh and is therefore not treated as current verified CI.

PR #18 Run #179 jobs (production build and PostgreSQL migration/replay + lifecycle/audit, checkout, tenant-isolation, subscription, and scope smoke steps) completed successfully. Its Vercel check was success, but the deployment target is not independently accessible through the verification browser; browser UAT is still unverified.

### New safe CI coverage added after Run #179

- Added `supabase/tests/nortago_order_lifecycle_paid_order_smoke.sql`: starts from an order with `status=PAID` and `payment_status=PAID`, advances through Takeaway fulfillment, and asserts final `SUCCESS`, unchanged `PAID` payment status, ordered audit transitions, and actor attribution.
- Added a workflow step to run this test after the lifecycle edge-transition smoke.
- New commits: test `43aa931cc0ac40ea97f2a9f6903eedd9a75e70e4`; CI workflow `f859152210c6765b247693818098140b63b94326`.
- CI for these new commits was pending at the time this section was appended; Run #179 does not include the new test.



## Paid-order lifecycle CI result refresh — 21 Nov 2026

- Latest branch head before this documentation refresh: `96ef58f399c17d966cb86010d8147cab4150af8b` (base remains Owner Inbox head `7516e1b22d5cd340b872db4bc516471a81ef74d4`).
- [CI Run #181](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44801065841) **PASS** on the paid-order lifecycle test + workflow head. Both jobs completed successfully: production build and PostgreSQL migration/replay/smoke validation. The new `Run paid-order lifecycle smoke checks` step completed successfully.
- New test `supabase/tests/nortago_order_lifecycle_paid_order_smoke.sql` verifies a seeded paid Takeaway order can complete fulfillment without changing `payment_status=PAID`, and confirms the ordered five-event audit trail and actor attribution. This uses disposable CI fixtures only; no payment provider is called.
- Current Vercel status check for this branch head is **success**; the deployment page remains inaccessible to independent browser inspection. Current-head customer UAT remains unverified.
- PR #12 exact head `31e517eed0c280ed25e57c144405bbd2fcb0178b` still has no PR workflow run returned by exact-commit lookup; its CI remains unverified (not promoted from historical Run #131). Vercel check is failure due to build-rate-limit.
- Outlet-specific staff assignment remains a schema/authorization design blocker if the release requires per-outlet restriction. Current lifecycle authorization is business membership with a business/outlet consistency guard; do not claim outlet-level staff isolation.


## Exact-head release evidence refresh — 21 Nov 2026, 15:35 WIB

This refresh supersedes older exact-head and preview-status rows above. PRs remain open, draft, and unmerged. Workflow CI and commit statuses were queried against the exact current PR head SHA.

| PR | Head branch | Exact head SHA | Base branch | Exact base SHA | CI run | Vercel commit status |
|---|---|---|---|---|---|
| #1 | `feature/nortago-order-audit-fix` | `a75820a8ca6d14c3f92fd3dfcfb9821f28429843` | `main` | `545f4953368d0e85d7573c609bf4abf96b041c80` | [#69 PASS](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44665343539) | success |
| #12 | `release/nortago-order-only-20261120` | `a323dcdedb5fd1048d9d2b2e3560c6ced889789c` | `feature/nortago-order-audit-fix` | `a75820a8ca6d14c3f92fd3dfcfb9821f28429843` | [#183 PASS](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44810763148) | success |
| #13 | `fix/nortago-order-plan-snapshot-20261120` | `c0a5e75cf9a8964848ad00aa4b5d57d1753140a6` | `release/nortago-order-only-20261120` | `a323dcdedb5fd1048d9d2b2e3560c6ced889789c` | [#136 PASS](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44721352568) | success |
| #14 | `fix/nortago-order-checkout-idempotency-20261120` | `f3a86754461b06b10250b073a38fae906bfd2777` | `fix/nortago-order-plan-snapshot-20261120` | `c0a5e75cf9a8964848ad00aa4b5d57d1753140a6` | [#138 PASS](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44725160805) | failure — Vercel build-rate-limit |
| #15 | `fix/nortago-order-release-scope-20261120` | `e16260f8147e3b55255be6bf5163a32774abe280` | `fix/nortago-order-checkout-idempotency-20261120` | `f3a86754461b06b10250b073a38fae906bfd2777` | [#140 PASS](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44725624942) | failure — Vercel build-rate-limit |
| #16 | `chore/nortago-order-scope-smoke-dedupe` | `db3e6a43edc4edc4d3338504d87da11163594e42` | `fix/nortago-order-release-scope-20261120` | `e16260f8147e3b55255be6bf5163a32774abe280` | [#141 PASS](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44740771154) | success |
| #17 | `feature/nortago-order-owner-inbox` | `7516e1b22d5cd340b872db4bc516471a81ef74d4` | `fix/nortago-order-release-scope-20261120` | `e16260f8147e3b55255be6bf5163a32774abe280` | [#143 PASS](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44741038747) | success |
| #18 | `feature/nortago-order-lifecycle-rpc` | `03ac27ceb0d268826c2b76e49808a923786d9e13` | `feature/nortago-order-owner-inbox` | `7516e1b22d5cd340b872db4bc516471a81ef74d4` | [#191 PASS](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44832208699) | success |
| #26 | `fix/nortago-order-rpc-only-write-privileges-20261121` | `99ca6c1b461ef267789a6eecf9ed18807b75a9f5` | `fix/nortago-order-pagination-release-base-18-20261121` | `b76d0ae85911b6963af96bb1fd92ba5d90816649` | [#216 PASS](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44881451219) | success |

PR #12's earlier preview-rate-limit status was stale for the old commit; its current exact head is CI #183 PASS and Vercel success. PR #14 and #15 remain build-rate-limited for preview. Vercel success is commit-status evidence only; no browser inspection was performed.

### Lifecycle privilege evidence refresh

The baseline commerce migration creates `otc_orders_staff_manage` as `FOR ALL` for authenticated business roles. The lifecycle migration adds `nortago_update_order_status(uuid,text,text)` as SECURITY DEFINER, validates auth/business/outlet/status transition, updates `status`, and appends an audit row; it does not add a trigger that forces direct status writes to use the RPC. With client DML grants, direct status UPDATE therefore bypasses the RPC/audit path. The disposable CI baseline deliberately simulates Supabase-like DML grants and proves the bypass before hardening.

PR #26 migration `20261121_nortago_order_rpc_only_write_privileges_v1.sql` revokes table and column mutation privileges from `PUBLIC`, `anon`, and `authenticated` for order headers/items; restores authenticated SELECT only; and replaces mutation `FOR ALL` policies with business-scoped SELECT policies. CI Run #216 on the exact head proves direct UPDATE/INSERT/item mutation are rejected, authenticated scoped reads remain, and approved lifecycle RPC transitions still work and create audit while payment status stays unchanged. This is disposable CI effective-privilege evidence, not a live Supabase staging privilege check.

### Updated release gates

- [x] Exact current head CI for PR #1 and #12–#18, plus PR #26, queried by SHA.
- [x] PR #16 Run #141 and PR #17 Run #143 confirmed PASS.
- [x] PR #26 exact-head Run #216 PASS, including pre-hardening bypass proof and post-hardening RPC-only privilege regression test.
- [x] Exact commit status refreshed for Vercel across the listed PRs.
- [ ] Current-head preview independently opened in browser on desktop/mobile.
- [ ] Real Supabase staging effective grants, RLS, and role/outlet behavior verified.
- [ ] Owner/customer UAT, delivery operations, and release sign-off.
- [ ] Production deploy and payment/webhook approval remain explicit owner decisions.


## Service catalog branch CI refresh — 21 Nov 2026, 16:39 WIB

PR #29 remains draft and is not part of the release-critical PR #26 hardening path. Its current head is `d8a9655bb1495c3e3e9e3ec7fc0cc85065143f22`, base `99ca6c1b461ef267789a6eecf9ed18807b75a9f5`. Product/service catalog support is a separate enhancement.

- Run #44890309224 on `e5f251c73ffb635a25b7452e269086cf07d301f7` failed TypeScript build because the catalog mapping omitted `product_type` in the CI merge ref; the PostgreSQL migration/replay and database smoke job passed.
- Commit `49d1797450600467c36164be3124987a21a8282e` added the missing service-type mapping but still failed build: conditional string values widened to `string`, not the `PRODUCT|SERVICE` union.
- Follow-up `d8a9655bb1495c3e3e9e3ec7fc0cc85065143f22` narrows the mapping with `Product["product_type"]`. CI Run #44890601112 is pending at this evidence refresh; it must pass before this branch is considered build-clean.
- Owner/service CRUD (creating and assigning services to outlets), staging migration, and browser UAT remain unimplemented/unverified.

## Product/Service catalog CI evidence (21 Nov 2026)

PR #29 now validates the Product/Service schema in the disposable PostgreSQL CI environment. The workflow applies and replays `20261121_nortago_order_services_catalog_v1.sql`, then runs `nortago_order_services_catalog_smoke.sql` after the idempotent checkout RPC is installed.

- Both `PRODUCT` and `SERVICE` catalog types are stored and mapped to an active outlet.
- Invalid catalog type values are rejected by the CHECK constraint.
- A SERVICE item is submitted through the same customer checkout RPC and the receipt RPC returns the correct service snapshot, quantity, outlet price, and total.
- All fixture data is rollback-only in disposable CI.
- CI Run #230 PASS on exact PR #29 head `d8af9eb46dcc6a28d1d0e7d7f6388382a95b02c3`.

Manual staging UAT must still verify Owner catalog editing, global active/inactive, outlet availability, and outlet-specific price; the catalog CI smoke test does not substitute for UI testing.


## Atomic owner catalog creation — PR #29 current head

PR #29 adds a single authenticated SECURITY DEFINER RPC, `nortago_create_catalog_item_for_outlet`, for creating a business-scoped PRODUCT or SERVICE and its selected outlet mapping in one database transaction. The RPC derives the business from the outlet, requires an active outlet and business-role membership, validates name/type/price/description/category/image URL, and returns the created item. EXECUTE is granted only to `authenticated`; PUBLIC and `anon` are revoked.


- The owner catalog form now calls the RPC instead of performing separate product INSERT and outlet mapping UPSERT operations, preventing a partial create/orphan if the second write fails.
- Regression SQL `nortago_order_catalog_create_rpc_smoke.sql` checks execute privileges, authenticated success for PRODUCT and SERVICE, no-membership denial, inactive-outlet denial, invalid type/negative price/invalid image/blank name rejection, unauthenticated denial, and outlet mapping/price consistency.
- The workflow applies and replays the migration, then runs the regression test.
- Exact PR #29 head: `d63f3aa9ab0e20b972766b7215db245b8f54cccb`. CI Run #238 PASS on exact current PR #29 head; Vercel status is success. The earlier #230 PASS and database PASS on the previous commit do not validate this latest RPC migration. An intermediate build failure from an over-escaped URL regex was fixed using case-normalized `startsWith` checks; the final exact head passed both build and PostgreSQL jobs in CI #238.

