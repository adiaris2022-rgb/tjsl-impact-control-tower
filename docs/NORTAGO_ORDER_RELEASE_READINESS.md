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
| #28 | `docs/nortago-order-exact-release-evidence-20261121` | `ed22f0c45939bb67830bf0a1bbe8afa6fa4c9417` (pre-refresh exact head) | `fix/nortago-order-rpc-only-write-privileges-20261121` | Run #257 PASS (pre-refresh exact head) |
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
| #28 | Failure — Vercel build-rate-limit | Current docs-only head status; CI #221 passed on earlier code-tested ref, current docs-only head not CI-tested |
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


## Exact-head CI and commit-status refresh — 21 Nov 2026, 22:35 WIB

GitHub PR metadata and workflow runs were refreshed by exact commit SHA. PRs #1, #12–#17 remain open, draft, and unmerged.

| PR | Exact head SHA | Exact base SHA | CI | Exact Vercel commit status |
|---|---|---|---|---|
| #1 | a75820a8ca6d14c3f92fd3dfcfb9821f28429843 | 545f4953368d0e85d7573c609bf4abf96b041c80 | #69 PASS | success |
| #12 | a323dcdedb5fd1048d9d2b2e3560c6ced889789c | a75820a8ca6d14c3f92fd3dfcfb9821f28429843 | #183 PASS | success |
| #13 | c0a5e75cf9a8964848ad00aa4b5d57d1753140a6 | a323dcdedb5fd1048d9d2b2e3560c6ced889789c | #136 PASS | success |
| #14 | f3a86754461b06b10250b073a38fae906bfd2777 | c0a5e75cf9a8964848ad00aa4b5d57d1753140a6 | #138 PASS | failure — deployment rate limit |
| #15 | e16260f8147e3b55255be6bf5163a32774abe280 | f3a86754461b06b10250b073a38fae906bfd2777 | #140 PASS | failure — deployment rate limit |
| #16 | db3e6a43edc4edc4d3338504d87da11163594e42 | e16260f8147e3b55255be6bf5163a32774abe280 | #141 PASS | success |
| #17 | 7516e1b22d5cd340b872db4bc516471a81ef74d4 | e16260f8147e3b55255be6bf5163a32774abe280 | #143 PASS | success |

Exact commit workflow lookup confirmed run numbers and success conclusions for all seven. PR #16 Run #141 and PR #17 Run #143 are reconfirmed PASS.

### Additional exact-head evidence

| PR | Head SHA | Base SHA | CI | Preview/commit status |
|---|---|---|---|---|
| #18 | 03ac27ceb0d268826c2b76e49808a923786d9e13 | 7516e1b22d5cd340b872db4bc516471a81ef74d4 | #191 PASS | Vercel success |
| #26 | 99ca6c1b461ef267789a6eecf9ed18807b75a9f5 | b76d0ae85911b6963af96bb1fd92ba5d90816649 | #216 PASS | Vercel Preview Comments check run success; status endpoint transiently unavailable during refresh (prior exact status was success) |
| #28 | 88e8f6643061aa9004b95d57621bf4baad02e8c6 | 99ca6c1b461ef267789a6eecf9ed18807b75a9f5 | #243 PASS | failure — Vercel deployment rate limit |
| #29 | d63f3aa9ab0e20b972766b7215db245b8f54cccb | 99ca6c1b461ef267789a6eecf9ed18807b75a9f5 | #238 PASS | success |

- PR #28 Run #243 completed both production-build and PostgreSQL migration/smoke jobs successfully on its exact current head. Vercel failed solely with the account/project build-rate-limit status.
- PR #29 Run #238 completed production build, migration/replay, catalog-create security tests, catalog checkout-to-receipt smoke, pagination tests, and order lifecycle/security checks on exact head. Vercel commit status for this exact head is success.
- PR #26 Run #216 completed both CI jobs successfully. Its Vercel Preview Comments check run is success; the commit-status endpoint disconnected transiently during this refresh, so the endpoint result is not newly confirmed here.

### Migration/security scope cross-check

The complete migration directory listing was compared on PR #18 lifecycle branch and PR #26 hardening branch. In the OTC lifecycle path, the relevant files are the commerce-core migration (creates RLS and business-member FOR ALL policies), customer checkout and idempotency migrations (SECURITY DEFINER transactional RPCs), lifecycle RPC/audit migration, Order-only scope lock, Order-only scope guard trigger, and PR #26 RPC-only write-privilege migration. PR #26 additionally contains the direct-write baseline proof and post-hardening privilege regression test.

Baseline CI explicitly grants simulated client table/column DML before the lifecycle and RLS migrations; the baseline test proves direct status UPDATE can succeed without RPC audit. The hardening migration revokes table and column mutation rights from client roles, restores authenticated SELECT, and replaces mutation policies with read policies. The post-hardening test checks effective table/column privileges, RLS remains enabled, scoped reads, direct status/order/item writes rejected, approved lifecycle RPC works, one audit row is created, and payment state is unchanged. This evidence is from disposable PostgreSQL CI, not actual Supabase staging.

### Release gates remain

- [ ] Browser UAT for latest preview (desktop and mobile).
- [ ] Real Supabase staging effective grants/RLS/identity and business/outlet role checks.
- [ ] Checkout-to-receipt and Owner lifecycle UAT on deployed preview/staging.
- [ ] Delivery fee/courier operational decision.
- [ ] Commercial owner sign-off.
- [ ] Production release explicitly approved.

No PR was merged; no live/staging migration, production deployment, payment/webhook activation, secret/environment change, or destructive action was performed. LinkBayar webhook remains disabled.


## Exact-head refresh — 22 Nov 2026

- Re-read PR metadata for #1 and #12–#17 from GitHub. All remain open, draft, unmerged, and mergeable; head/base SHAs are unchanged from the table above.
- Re-fetched workflow runs by the exact current head SHA for each PR: #1 Run #69 PASS, #12 Run #183 PASS, #13 Run #136 PASS, #14 Run #138 PASS, #15 Run #140 PASS, #16 Run #141 PASS, and #17 Run #143 PASS.
- Exact-head Vercel statuses refreshed: #1 success, #12 success, #13 success, #14 build-rate-limit failure, #15 build-rate-limit failure, #16 success, #17 success.
- PR #28 current head `f34455841e66f1801da46309c87cff1205499c6e`: CI Run #244 PASS and Vercel status success. The docs-only branch has no app/migration changes in this refresh.
- PR #18 exact head `03ac27ceb0d268826c2b76e49808a923786d9e13`: CI Run #191 PASS. PR #26 exact head `99ca6c1b461ef267789a6eecf9ed18807b75a9f5`: CI Run #216 PASS. PR #29 exact head `d63f3aa9ab0e20b972766b7215db245b8f54cccb`: CI Run #238 PASS.
- The baseline lifecycle bypass was reproduced only in disposable CI by simulating authenticated table and column DML grants against the core `FOR ALL` membership policy. The RPC-only hardening migration removes client order/item mutation privileges while retaining authenticated business-scoped SELECT; the regression test rejects direct UPDATE/INSERT/DELETE and accepts the lifecycle RPC with audit/payment-state assertions. Effective Supabase staging/live grants remain unverified.
- Browser UAT, real tenant/role verification, approved staging migration, delivery/courier decision, and commercial sign-off remain open. No production deployment, payment, or webhook activation.

## Superseding exact-head refresh — 22 Nov 2026, 03:14 WIB

This section supersedes prior snapshots for current GitHub refs/checks. Metadata and workflow runs were queried again by exact PR head SHA. All PRs #1, #12–#17 remain open, draft, unmerged, and mergeable.


| PR | Exact head SHA | Exact base SHA | CI run | Exact Vercel commit status |
|---|---|---|---|---|
| #1 | `a75820a8ca6d14c3f92fd3dfcfb9821f28429843` | `545f4953368d0e85d7573c609bf4abf96b041c80` | #69 PASS | success |
| #12 | `a323dcdedb5fd1048d9d2b2e3560c6ced889789c` | `a75820a8ca6d14c3f92fd3dfcfb9821f28429843` | #183 PASS | success |
| #13 | `c0a5e75cf9a8964848ad00aa4b5d57d1753140a6` | `a323dcdedb5fd1048d9d2b2e3560c6ced889789c` | #136 PASS | success |
| #14 | `f3a86754461b06b10250b073a38fae906bfd2777` | `c0a5e75cf9a8964848ad00aa4b5d57d1753140a6` | #138 PASS | failure — Vercel build-rate-limit |
| #15 | `e16260f8147e3b55255be6bf5163a32774abe280` | `f3a86754461b06b10250b073a38fae906bfd2777` | #140 PASS | failure — Vercel build-rate-limit |
| #16 | `db3e6a43edc4edc4d3338504d87da11163594e42` | `e16260f8147e3b55255be6bf5163a32774abe280` | #141 PASS | success |
| #17 | `7516e1b22d5cd340b872db4bc516471a81ef74d4` | `e16260f8147e3b55255be6bf5163a32774abe280` | #143 PASS | success |
| #18 | `03ac27ceb0d268826c2b76e49808a923786d9e13` | `7516e1b22d5cd340b872db4bc516471a81ef74d4` | #191 PASS | success |
| #26 | `99ca6c1b461ef267789a6eecf9ed18807b75a9f5` | `b76d0ae85911b6963af96bb1fd92ba5d90816649` | #216 PASS | success |
| #28 | `52cb20fe18aae46ade87c05847a4bc7d2bc5d904` | `99ca6c1b461ef267789a6eecf9ed18807b75a9f5` | #245 PASS | success |
| #29 | `d63f3aa9ab0e20b972766b7215db245b8f54cccb` | `99ca6c1b461ef267789a6eecf9ed18807b75a9f5` | #238 PASS | success |

- Exact SHA workflow lookup confirms all seven requested PR CI runs completed successfully; PR #16/#17 remain Run #141/#143 PASS.
- Job-level verification was performed for Runs #141, #143, #216, #238, and #245; both build and PostgreSQL validation jobs completed successfully on the inspected runs.
- The prior PR #28 snapshot listed head `f3445584...` and Run #244. That is superseded: the current head is `52cb20fe...`, Run #245 PASS, and Vercel commit status is success.
- PR #14/#15 Vercel remain build-rate-limited despite their CI success. Vercel success does not replace browser UAT; preview pages have not been independently tested on desktop/mobile in this refresh.
- The lifecycle baseline direct-status bypass is proven in simulated client-grant disposable CI; PR #26 hardening denies direct order/item mutations and permits the approved RPC. Effective Supabase staging/live grants, identity, and RLS remain unverified.
- Automated checkout-to-receipt, tenant isolation, per-outlet subscription, pagination, and lifecycle assertions are evidence from disposable CI only. Browser/customer/owner UAT, staging verification, delivery/courier decision, and commercial sign-off remain open.
- No merge, production deploy, staging/live database migration, payment/webhook activation, secret/environment change, or destructive action occurred. LinkBayar webhook remains disabled.


## Superseding exact-head evidence — 22 Nov 2026 04:22 WIB

This section supersedes earlier PR #28 head/check rows above. PR metadata, exact-commit workflow runs, and commit statuses were freshly fetched from GitHub.

| PR | Head SHA | Base SHA | CI | Vercel |
|---|---|---|---|---|
| #1 | `a75820a8ca6d14c3f92fd3dfcfb9821f28429843` | `545f4953368d0e85d7573c609bf4abf96b041c80` | #69 PASS | success |
| #12 | `a323dcdedb5fd1048d9d2b2e3560c6ced889789c` | `a75820a8ca6d14c3f92fd3dfcfb9821f28429843` | #183 PASS | success |
| #13 | `c0a5e75cf9a8964848ad00aa4b5d57d1753140a6` | `a323dcdedb5fd1048d9d2b2e3560c6ced889789c` | #136 PASS | success |
| #14 | `f3a86754461b06b10250b073a38fae906bfd2777` | `c0a5e75cf9a8964848ad00aa4b5d57d1753140a6` | #138 PASS | failure — Vercel build rate limit |
| #15 | `e16260f8147e3b55255be6bf5163a32774abe280` | `f3a86754461b06b10250b073a38fae906bfd2777` | #140 PASS | failure — Vercel build rate limit |
| #16 | `db3e6a43edc4edc4d3338504d87da11163594e42` | `e16260f8147e3b55255be6bf5163a32774abe280` | #141 PASS | success |
| #17 | `7516e1b22d5cd340b872db4bc516471a81ef74d4` | `e16260f8147e3b55255be6bf5163a32774abe280` | #143 PASS | success |

PR #16 Run #141 and PR #17 Run #143 were rechecked at exact heads. For both, production build and PostgreSQL migration/smoke jobs completed successfully. All requested PRs #1 and #12–#17 remain open, draft, unmerged, and mergeable.

PR #18 head `03ac27ceb0d268826c2b76e49808a923786d9e13` Run #191 PASS; Vercel success. PR #26 head `99ca6c1b461ef267789a6eecf9ed18807b75a9f5` Run #216 PASS; Vercel success. PR #29 head `d63f3aa9ab0e20b972766b7215db245b8f54cccb` Run #238 PASS; Vercel success.

**Stack ancestry confirmed:** PR #26 base `b76d0ae85911b6963af96bb1fd92ba5d90816649` compares to PR #18 head as ahead by 8 commits, behind 0, with the merge-base equal to PR #18 head. PR #26 head compares to PR #18 head as ahead by 26, behind 0. Therefore the RPC-only privilege hardening is stacked on the lifecycle branch.

**PR #28 current head at this refresh:** `d41d9a9eea5d6fb601b87c88d0e3c921da5565b0`; base `99ca6c1b461ef267789a6eecf9ed18807b75a9f5`. Exact-SHA workflow lookup returned no CI run for this head; Run #245 PASS is on the previous docs head `52cb20fe18aae46ade87c05847a4bc7d2bc5d904`. Vercel status on current head is success. Browser UAT is not implied by Vercel status.

Security tests are disposable PostgreSQL evidence. No effective grants/RLS on real Supabase staging/live have been verified. Browser UAT, real tenant/role checks, delivery/courier decision, and commercial sign-off remain open. No merge, live/staging migration, production deployment, payment/webhook activation, secret/environment change, or destructive action. LinkBayar remains disabled.


## Superseding exact-head snapshot — 22 Nov 2026 05:19 WIB

This snapshot supersedes the prior PR #28 exact-head notes above. Fresh GitHub pull-request metadata and commit statuses were read for PRs #1/#12/#13/#14/#15/#16/#17. Workflow evidence was checked against the exact listed commit; PR #12 run #183 was verified directly via its run/check-runs endpoint because the commit-run wrapper returned no run.

| PR | Head SHA | Base SHA | CI exact head | Vercel exact head |
|---|---|---|---|
| #1 | `a75820a8ca6d14c3f92fd3dfcfb9821f28429843` | `545f4953368d0e85d7573c609bf4abf96b041c80` | #69 PASS | success |
| #12 | `a323dcdedb5fd1048d9d2b2e3560c6ced889789` | `a75820a8ca6d14c3f92fd3dfcfb9821f28429843` | #183 PASS | success |
| #13 | `c0a5e75cf9a8964848ad00aa4b5d57d1753140a6` | `a323dcdedb5fd1048d9d2b2e3560c6ced889789` | #136 PASS | success |
| #14 | `f3a86754461b06b10250b073a38fae906bfd2777` | `c0a5e75cf9a8964848ad00aa4b5d57d1753140a6` | #138 PASS | failure — Vercel build-rate limit |
| #15 | `e16260f8147e3b55255be6bf5163a32774abe280` | `f3a86754461b06b10250b073a38fae906bfd2777` | #140 PASS | failure — Vercel build-rate limit |
| #16 | `db3e6a43edc4edc4d3338504d87da11163594e42` | `e16260f8147e3b55255be6bf5163a32774abe280` | #141 PASS | success |
| #17 | `7516e1b22d5cd340b872db4bc516471a81ef74d4` | `e16260f8147e3b55255be6bf5163a32774abe280` | #143 PASS | success |

For PR #16 run #141 and PR #17 run #143, both jobs (production build and PostgreSQL migration/smoke) were fetched and completed successfully. All seven PRs remain open, draft, unmerged, and mergeable.


### PR #28 documentation CI refresh

Before this documentation-only refresh, PR #28 head was `3a0933690a8653b424f888c50298465a5ceb6224`, base `99ca6c1b461ef267789a6eecf9ed18807b75a9f5`. Run #247 completed successfully on that exact head: **Install and production build — success; Validate PostgreSQL migrations and smoke tests — success**. Exact-head Vercel status was success. Links: [Run #247](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44951420111), [preview](https://vercel.com/nortago/nortago-order-staging/Xi8o41WTSTqXeEBDC4Jaqh2BjJPy).

This evidence update itself advances PR #28's documentation branch. Its new commit SHA and CI/Vercel statuses must be refreshed separately; #247 does not apply to that new commit. No browser UAT or live/staging database verification is implied.


## Payment/lifecycle policy gate — 22 Nov 2026

Fresh review of `nortago_order_lifecycle_rpc_smoke.sql`, `nortago_order_lifecycle_paid_order_smoke.sql`, and the lifecycle RPC migration found a release policy question: the RPC permits a `NEW` order to advance to `PROCESSING` while `payment_status='PENDING'` (the disposable test explicitly exercises this path). This preserves separate payment and fulfillment status, but with payment/webhook integrations disabled, an owner can start fulfillment before payment verification. This may be intended for Cash/Other orders; it should not be silently assumed for QRIS.

**Release decision required:** confirm whether owner-initiated fulfillment while payment is PENDING is permitted for all methods, or restrict unpaid progression (e.g., only permitted manual-payment methods). No schema/RPC behavior was changed because this is a commercial policy decision and payment activation is not approved. Add this decision to UAT before launch.

The latest prior documentation commit `07515c1d9cc579aeebf75523e0696ca4ccaf305e` completed Run #248 PASS (both production build and PostgreSQL migration/smoke jobs). This policy note advances the docs branch; its new exact-head CI is pending and will be reported separately.


### Latest release-first execution — 22 Nov 2026, 06:15 WIB

- Refreshed PR #1/#12/#13/#14/#15/#16/#17 metadata and exact commit workflow runs. All remain Open/Draft/Unmerged/mergeable; exact-head CI runs #69/#183/#136/#138/#140/#141/#143 all PASS. Vercel status on #14/#15 is build-rate-limit failure; the other five exact heads are success.
- PR #28 exact head `8f7771af27c5a46abcd526e1db28dcd8e7866661`: CI Run #249 PASS (PostgreSQL migration/security/smoke job and production build job). Exact-head Vercel status success. This corrects the prior stale #247/#248 references.
- Scope guard audit found the OTC core check permits `POS_INTEGRATED`, while the existing Order guard rejected only Dine-In and `STAFF_WALK_IN`. Since POS-integrated/Walk-In is deferred from NORTAGO ORDER, created draft PR #30 to close this source gap.
- PR #30 branch `fix/nortago-order-pos-integrated-scope-guard-20261122`, exact head `751a307185dd99cd8842bc5cd54a4a3ad8352f8e`, base PR #26 head `99ca6c1b461ef267789a6eecf9ed18807b75a9f5`, 3 commits ahead/0 behind. Adds an idempotent forward migration rejecting `POS_INTEGRATED` with `ORDER_ONLY_POS_DISABLED`, insert and legacy-lifecycle regression tests, and CI migration/replay steps. CI Run #250 is in progress; no PASS claim until it completes.
- PR #30 remains Draft/Open/unmerged. No staging/live migration or production action. LinkBayar webhook stays disabled. Browser UAT and live staging grants/RLS verification remain open.


### POS-integrated scope gap closed in feature branch — 22 Nov 2026

- Exact PR #30 head `751a307185dd99cd8842bc5cd54a4a3ad8352f8e`, base `99ca6c1b461ef267789a6eecf9ed18807b75a9f5`: [CI Run #250 PASS](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44960942102). Both production-build and PostgreSQL migration/smoke jobs passed.
- New forward migration applies and replays idempotently. Scope tests reject POS-integrated INSERT with `ORDER_ONLY_POS_DISABLED`, seed a legacy POS-integrated row only in a rollback fixture, and prove lifecycle RPC cannot advance it or emit audit; valid online Take Away remains accepted.
- PR #30 remains Draft/Open/unmerged. Exact-head Vercel status had no result returned; preview/browser UAT is not claimed. No staging/live migration or production deployment.


## Exact release-first refresh — 22 Nov 2026, 07:33 WIB

This snapshot supersedes the earlier exact-head evidence where values conflict. Fresh GitHub PR metadata and commit-associated Actions runs were fetched during this refresh.

### Requested release PRs (#1, #12–#17)

| PR | Head SHA | Base SHA | Exact-head CI | State |
|---|---|---|---|
| #1 | `a75820a8ca6d14c3f92fd3dfcfb9821f28429843` | `545f4953368d0e85d7573c609bf4abf96b041c80` | #69 PASS | Open/Draft/Unmerged |
| #12 | `a323dcdedb5fd1048d9d2b2e3560c6ced889789c` | `a75820a8ca6d14c3f92fd3dfcfb9821f28429843` | #183 PASS | Open/Draft/Unmerged |
| #13 | `c0a5e75cf9a8964848ad00aa4b5d57d1753140a6` | `a323dcdedb5fd1048d9d2b2e3560c6ced889789c` | #136 PASS | Open/Draft/Unmerged |
| #14 | `f3a86754461b06b10250b073a38fae906bfd2777` | `c0a5e75cf9a8964848ad00aa4b5d57d1753140a6` | #138 PASS | Open/Draft/Unmerged |
| #15 | `e16260f8147e3b55255be6bf5163a32774abe280` | `f3a86754461b06b10250b073a38fae906bfd2777` | #140 PASS | Open/Draft/Unmerged |
| #16 | `db3e6a43edc4edc4d3338504d87da11163594e42` | `e16260f8147e3b55255be6bf5163a32774abe280` | #141 PASS | Open/Draft/Unmerged |
| #17 | `7516e1b22d5cd340b872db4bc516471a81ef74d4` | `e16260f8147e3b55255be6bf5163a32774abe280` | #143 PASS | Open/Draft/Unmerged |

Exact-SHA workflow lookup returned the listed successful runs. Jobs were fetched for all seven runs: production-build and PostgreSQL migration/replay/smoke jobs both completed successfully. PR #16/#17 recheck confirms #141/#143 remain PASS. Vercel commit status: #1/#12/#13/#16/#17 success; #14/#15 build-rate-limit failure.

### Security source review — direct status UPDATE vs lifecycle RPC

Reviewed source SQL at the relevant feature-branch heads: 
- `20260928_otc_commerce_core_v1.sql`: RLS enabled; `otc_orders_staff_manage` and `otc_order_items_staff_manage` are business-role `FOR ALL` policies. Policies do not restrict individual status transitions. Core SQL itself does not specify client DML grants.
- `20261120_nortago_order_lifecycle_rpc_v1.sql`: `nortago_update_order_status(uuid,text,text)` is SECURITY DEFINER with fixed search_path; requires `auth.uid()`, membership, outlet/business consistency, allowed transition, row locking, and writes audit. It does not install a status-write trigger.
- `20261120_nortago_order_release_scope_guard_v1.sql`: scope trigger originally covers INSERT/UPDATE of `order_source` and `fulfillment_type`; it does not enforce lifecycle transition/audit by itself.
- `20261121_nortago_order_rpc_only_write_privileges_v1.sql` (PR #26): revokes table and column DML from PUBLIC/anon/authenticated on order headers/items; authenticated SELECT remains business-scoped through explicit SELECT policies. Approved SECURITY DEFINER checkout/receipt/lifecycle RPCs remain the write paths.
- Baseline test `nortago_order_status_direct_write_baseline_smoke.sql` proves direct status update succeeds under simulated Supabase client DML grants plus the broad FOR ALL policy and produces no audit before hardening. Post-hardening test `nortago_order_rpc_only_write_privileges_smoke.sql` asserts table/column privileges, scoped SELECT, direct status update/order insert/item insert-update-delete denial, approved RPC status advance and one audit row, and payment state remains unchanged.
- PR #30 adds the `POS_INTEGRATED` exclusion to the scope guard and includes `status` in the trigger's UPDATE column list, so RPC status transitions on out-of-scope legacy records are rejected before the lifecycle RPC can complete. CI fixtures prove Dine-In, STAFF_WALK_IN, and POS_INTEGRATED are rejected while online Take Away works.

**Security evidence boundary:** all effective-grant assertions and direct mutation behavior above are disposable PostgreSQL CI fixtures. Real Supabase staging/live effective grants, RLS, auth identity, and tenant roles are not verified. The preview URL cannot be independently opened in the available web verifier; no browser UAT is claimed.

### Related exact-head CI
- PR #18 head `03ac27ceb0d268826c2b76e49808a923786d9e13`: Run #191 PASS (build + PostgreSQL).
- PR #26 head `99ca6c1b461ef267789a6eecf9ed18807b75a9f5`: Run #216 PASS (build + PostgreSQL security smoke).
- PR #30 head `751a307185dd99cd8842bc5cd54a4a3ad8352f8e`: Run #250 PASS (build + migration/replay/scope smoke).
- PR #28 head `3a0738f8733421c8f3d09d763cafff1a83d3dfd5`: Run #252 PASS (build + PostgreSQL migration/security/smoke). This corrects older sections that refer to a previous docs commit or run.

### Release gates remain open
Customer/owner browser UAT, staging effective grants/RLS/auth and real tenant validation, delivery fee/courier decision, payment-before-fulfillment policy, and commercial sign-off remain open. LinkBayar stays disabled. No merge, production deploy, live/staging migration, payment/webhook activation, secrets/environment change, or destructive action was performed.


## Superseding exact-head release snapshot — 22 Nov 2026, 08:48 WIB

Fresh GitHub pull-request metadata, commit-associated workflow runs, and commit statuses were retrieved in this run. This section supersedes previous exact-head tables where they conflict. PRs #1/#12–#17 remain open, draft, unmerged, and mergeable.

| PR | Head SHA | Base SHA | Exact-head CI | Vercel |
|---|---|---|---|
| #1 | a75820a8ca6d14c3f92fd3dfcfb9821f28429843 | 545f4953368d0e85d7573c609bf4abf96b041c80 | #69 PASS | success |
| #12 | a323dcdedb5fd1048d9d2b2e3560c6ced889789c | a75820a8ca6d14c3f92fd3dfcfb9821f28429843 | #183 PASS | success |
| #13 | c0a5e75cf9a8964848ad00aa4b5d57d1753140a6 | a323dcdedb5fd1048d9d2b2e3560c6ced889789c | #136 PASS | success |
| #14 | f3a86754461b06b10250b073a38fae906bfd2777 | c0a5e75cf9a8964848ad00aa4b5d57d1753140a6 | #138 PASS | failure — Vercel build-rate limit |
| #15 | e16260f8147e3b55255be6bf5163a32774abe280 | f3a86754461b06b10250b073a38fae906bfd2777 | #140 PASS | failure — Vercel build-rate limit |
| #16 | db3e6a43edc4edc4d3338504d87da11163594e42 | e16260f8147e3b55255be6bf5163a32774abe280 | #141 PASS | success |
| #17 | 7516e1b22d5cd340b872db4bc516471a81ef74d4 | e16260f8147e3b55255be6bf5163a32774abe280 | #143 PASS | success |

Exact commit workflow lookup confirmed the run associations; job endpoints were fetched for all seven runs. Both jobs—production build and PostgreSQL migrations/smoke—completed successfully for every requested PR. PR #16/#17 recheck confirms Run #141/#143 remain PASS.

### Security/lifecycle branch review

The migration tree was enumerated at PR #18 head 03ac27ceb0d268826c2b76e49808a923786d9e13, PR #26 head 99ca6c1b461ef267789a6eecf9ed18807b75a9f5, PR #12 head a323dcdedb5fd1048d9d2b2e3560c6ced889789c, and PR #30 head 751a307185dd99cd8842bc5cd54a4a3ad8352f8e. The relevant core, lifecycle RPC, Order-only scope lock, release scope guard, RPC-only write-privilege migration, and POS-integrated guard migrations were fetched and inspected.

- Core OTC migration enables RLS on otc_orders and creates otc_orders_staff_manage FOR ALL using business membership. This policy is not a lifecycle transition restriction.
- Lifecycle RPC nortago_update_order_status(uuid,text,text) is SECURITY DEFINER, uses a fixed search_path, requires auth.uid(), checks business role and outlet/business consistency, row-locks the order, validates the transition, updates status, and inserts audit. Core lifecycle migration does not install a status enforcement trigger.
- Scope lock revokes authenticated/anon execution of reservation creation and management RPCs.
- RPC-only hardening migration revokes table DML and all listed column INSERT/UPDATE rights on otc_orders and otc_order_items from PUBLIC/anon/authenticated, restores authenticated SELECT, and replaces broad mutation policies with business-scoped SELECT policies. Checkout, receipt, and lifecycle SECURITY DEFINER RPC write paths remain available with explicit execution grants.
- CI explicitly simulates Supabase-style table and column DML before hardening. Baseline test proves direct status UPDATE succeeds under those grants and the broad membership policy without audit. Post-hardening regression asserts table and any-column INSERT/UPDATE rights absent, direct status UPDATE/order INSERT/item INSERT/UPDATE/DELETE denied, authenticated scoped SELECT retained, approved lifecycle RPC works, exactly one audit row is appended, and payment state remains unchanged.
- Release scope migration trigger covers INSERT and UPDATE of order_source, fulfillment_type, and status. PR #30 adds rejection of POS_INTEGRATED in addition to Dine-In and STAFF_WALK_IN; test proves supported online Take Away still works and legacy POS lifecycle advancement is rejected without status/audit change.

Effective grants, RLS, auth identity, and tenant role behavior on real Supabase staging/live remain unverified. Evidence here is SQL source and disposable PostgreSQL CI only.

### Related exact-head CI and preview

| PR | Exact head SHA | Exact CI | Vercel exact commit status |
|---|---|---|---|
| #18 | 03ac27ceb0d268826c2b76e49808a923786d9e13 | #191 PASS | success |
| #26 | 99ca6c1b461ef267789a6eecf9ed18807b75a9f5 | #216 PASS | success |
| #28 | cc9b25fca48e18dba944d03b5f9e22be073daacb | #253 PASS | success |
| #30 | 751a307185dd99cd8842bc5cd54a4a3ad8352f8e | #250 PASS | success |

Jobs were fetched from GitHub for Runs #191, #216, #253, and #250; production build and PostgreSQL migration/smoke jobs both completed successfully. PR #30 preview has Vercel Ready status, but independent browser UAT is not claimed.

### Release gates still open

- Browser UAT (customer checkout-to-receipt and Owner Inbox lifecycle/audit, desktop/mobile).
- Actual Supabase staging effective grants/RLS/auth and real tenant/role checks.
- Delivery fee and courier operational terms.
- Payment-before-fulfillment policy decision (RPC permits NEW → PROCESSING while payment is PENDING; decide whether this is allowed for every payment method or only manual payment).
- Commercial sign-off and explicit production-release approval.

PR #30 remains draft/open/unmerged. No merge, production deploy, staging/live migration, payment/webhook activation, secrets/environment change, or destructive action. LinkBayar webhook remains disabled.

## Fresh exact-ref verification — 22 Nov 2026

This snapshot supersedes older PR head/run entries above where they differ. Pull requests were refreshed from GitHub, each workflow run was queried by ID, the run's `head_sha` was matched to the current PR `head_sha`, and both CI jobs were inspected.

| PR | Head SHA | Base branch / SHA | Exact CI run | CI jobs | Vercel status |
|---|---|---|---|---|
| #1 | `a75820a8ca6d14c3f92fd3dfcfb9821f28429843` | `main` / `545f4953368d0e85d7573c609bf4abf96b041c80` | [#69](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44665343539) | build PASS; PostgreSQL PASS | success |
| #12 | `a323dcdedb5fd1048d9d2b2e3560c6ced889789c` | `feature/nortago-order-audit-fix` / `a75820a8ca6d14c3f92fd3dfcfb9821f28429843` | [#183](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44810763148) | build PASS; PostgreSQL PASS | success |
| #13 | `c0a5e75cf9a8964848ad00aa4b5d57d1753140a6` | `release/nortago-order-only-20261120` / `a323dcdedb5fd1048d9d2b2e3560c6ced889789c` | [#136](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44721352568) | build PASS; PostgreSQL PASS | success |
| #14 | `f3a86754461b06b10250b073a38fae906bfd2777` | `fix/nortago-order-plan-snapshot-20261120` / `c0a5e75cf9a8964848ad00aa4b5d57d1753140a6` | [#138](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44725160805) | build PASS; PostgreSQL PASS | build rate limited |
| #15 | `e16260f8147e3b55255be6bf5163a32774abe280` | `fix/nortago-order-checkout-idempotency-20261120` / `f3a86754461b06b10250b073a38fae906bfd2777` | [#140](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44725624942) | build PASS; PostgreSQL PASS | build rate limited |
| #16 | `db3e6a43edc4edc4d3338504d87da11163594e42` | `fix/nortago-order-release-scope-20261120` / `e16260f8147e3b55255be6bf5163a32774abe280` | [#141](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44740771154) | build PASS; PostgreSQL PASS | success |
| #17 | `7516e1b22d5cd340b872db4bc516471a81ef74d4` | `fix/nortago-order-release-scope-20261120` / `e16260f8147e3b55255be6bf5163a32774abe280` | [#143](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44741038747) | build PASS; PostgreSQL PASS | success |

All seven are open, draft, unmerged, and reported mergeable at refresh time. CI exact-head totals: **7/7 workflow runs, 14/14 jobs PASS**. The Vercel rate limit on #14/#15 is a deployment-provider check, not a failed GitHub Actions CI job.

### Security and release branches refreshed

| PR | Exact head SHA | Exact CI run |
|---|---|---|
| #18 lifecycle RPC | `03ac27ceb0d268826c2b76e49808a923786d9e13` | [#191](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44832208699) PASS |
| #26 RPC-only write privileges | `99ca6c1b461ef267789a6eecf9ed18807b75a9f5` | [#216](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44881451219) PASS |
| #28 release-readiness docs | `abeb66e63d75dbd9eee539c4c9c8fff715b01698` | [#256](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44981210633) PASS |
| #30 POS-integrated scope guard | `751a307185dd99cd8842bc5cd54a4a3ad8352f8e` | [#250](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44960942102) PASS |

Both jobs (production build and PostgreSQL migration/smoke) passed for these exact run heads.

### Effective privilege hardening evidence

Migration `20261121_nortago_order_rpc_only_write_privileges_v1.sql` explicitly revokes table and column DML on `otc_orders` and `otc_order_items` from `PUBLIC`, `anon`, and `authenticated`; authenticated scoped SELECT is re-granted. Its regression test checks table/column privileges with `has_table_privilege` and `has_any_column_privilege`, asserts RLS remains enabled and read policies exist, then attempts direct status/order/item mutations under `authenticated` and expects `insufficient_privilege`. It invokes the approved lifecycle RPC and asserts status advancement, exactly one audit event, and unchanged payment status. This is disposable PostgreSQL CI evidence; it does not establish the actual grants/function owner/auth configuration on a Supabase staging/live project.

### Current release blockers

- Owner/customer browser UAT is not recorded as complete.
- Supabase staging effective grants, RLS, auth, and real membership checks remain unverified.
- Delivery fee/courier responsibility and payment-before-fulfillment policy need an explicit operational decision.
- LinkBayar webhook and payment activation remain disabled.
- No merge, production deployment, live migration, environment/secrets change, or destructive operation is authorized by this evidence refresh.

### Fresh security and exact-head verification — 22 Nov 2026 11:33 WIB

This refresh supersedes the #28 row above and confirms the following exact refs without applying changes to live/staging systems:
- PR #1 and #12–#17 head/base metadata is unchanged. All seven exact-head CI runs are completed PASS, with both jobs (production build and PostgreSQL migrations/smoke) successful: 14/14 jobs. PR #16/#17 are specifically Run #141/#143 PASS.
- Current Vercel commit status: #1/#12/#13/#16/#17 success; #14/#15 fail only due to build-rate limit.
- PR #18 head `03ac27ceb0d268826c2b76e49808a923786d9e13`: Run #191 PASS, both jobs; Vercel success.
- PR #26 head `99ca6c1b461ef267789a6eecf9ed18807b75a9f5`: Run #216 PASS, both jobs; Vercel success.
- PR #28 head `abeb66e63d75dbd9eee539c4c9c8fff715b01698`: Run #256 PASS, both jobs; Vercel success.
- PR #30 head `751a307185dd99cd8842bc5cd54a4a3ad8352f8e`: Run #250 PASS, both jobs; Vercel success.
- Actual migration source review: core migration has business-membership `FOR ALL` order policies; lifecycle RPC is SECURITY DEFINER, validates auth/membership/outlet/status transition and appends audit, but there is no status-transition/audit trigger forcing direct updates through that RPC. Scope guard trigger validates excluded source/fulfillment types; it does not itself enforce lifecycle transitions.
- PR #26 hardening explicitly revokes table and column INSERT/UPDATE/DELETE from PUBLIC, anon, authenticated on `otc_orders` and `otc_order_items`, then restores authenticated SELECT. Disposable CI first reproduces the bypass under broad simulated client DML grants, then verifies direct mutation denial and successful approved RPC transition with one audit row and unchanged payment status.
- Effective privileges, function ownership, auth identity, and RLS behavior in real Supabase staging/live are still not verified. Browser UAT and commercial decisions remain open.

All seven primary PRs and PR #18/#26/#28/#30 remain open/draft/unmerged at refresh. No merge, production deploy, live/staging migration, payment/webhook activation, secret/environment changes, or destructive actions were performed. LinkBayar remains disabled.


## Release-first automation snapshot — 22 Nov 2026, 13:25 WIB

This snapshot supersedes prior exact-ref/status entries above for PRs #1/#12–#17 and related release/security PRs where values differ. It is based on freshly fetched GitHub PR metadata, commit-associated workflow runs, combined commit statuses, and job results.


### Primary release PRs

| PR | Head SHA | Base branch / SHA | Exact CI | Build job | PostgreSQL job | Vercel |
|---|---|---|---|---|---|
| #1 | `a75820a8ca6d14c3f92fd3dfcfb9821f28429843` | `main` / `545f4953368d0e85d7573c609bf4abf96b041c80` | [#69](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44665343539) | PASS | PASS | success |
| #12 | `a323dcdedb5fd1048d9d2b2e3560c6ced889789c` | `feature/nortago-order-audit-fix` / `a75820a8ca6d14c3f92fd3dfcfb9821f28429843` | [#183](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44810763148) | PASS | PASS | success |
| #13 | `c0a5e75cf9a8964848ad00aa4b5d57d1753140a6` | `release/nortago-order-only-20261120` / `a323dcdedb5fd1048d9d2b2e3560c6ced889789c` | [#136](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44721352568) | PASS | PASS | success |
| #14 | `f3a86754461b06b10250b073a38fae906bfd2777` | `fix/nortago-order-plan-snapshot-20261120` / `c0a5e75cf9a8964848ad00aa4b5d57d1753140a6` | [#138](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44725160805) | PASS | PASS | failure — Vercel build-rate limit |
| #15 | `e16260f8147e3b55255be6bf5163a32774abe280` | `fix/nortago-order-checkout-idempotency-20261120` / `f3a86754461b06b10250b073a38fae906bfd2777` | [#140](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44725624942) | PASS | PASS | failure — Vercel build-rate limit |
| #16 | `db3e6a43edc4edc4d3338504d87da11163594e42` | `fix/nortago-order-release-scope-20261120` / `e16260f8147e3b55255be6bf5163a32774abe280` | [#141](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44740771154) | PASS | PASS | success |
| #17 | `7516e1b22d5cd340b872db4bc516471a81ef74d4` | `fix/nortago-order-release-scope-20261120` / `e16260f8147e3b55255be6bf5163a32774abe280` | [#143](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44741038747) | PASS | PASS | success |

All seven primary PRs are open, draft, unmerged, and mergeable at this refresh. The exact-head run lookup returned the matching SHA for each workflow; both jobs passed, totaling 7/7 workflows and 14/14 jobs. PR #16/#17 were specifically rechecked: #141/#143 PASS.

### Related security/release PRs

| PR | Head SHA | Exact CI | Vercel |
|---|---|---|---|
| #18 lifecycle RPC | `03ac27ceb0d268826c2b76e49808a923786d9e13` | [#191](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44832208699) PASS | success |
| #26 RPC-only write hardening | `99ca6c1b461ef267789a6eecf9ed18807b75a9f5` | [#216](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44881451219) PASS | success |
| #28 release-readiness docs, pre-refresh | `ed22f0c45939bb67830bf0a1bbe8afa6fa4c9417` | [#257](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44985666458) PASS | success |
| #30 POS-integrated scope guard | `751a307185dd99cd8842bc5cd54a4a3ad8352f8e` | [#250](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44960942102) PASS | success |

Both CI jobs (production build and PostgreSQL migration/replay/smoke) passed on these refs. This documentation update creates a new PR #28 head; its exact SHA and CI will be recorded in the PR comment after the run is checked. Older #28 rows and references are historical, not evidence for the new commit.

### Lifecycle security evidence (source + disposable CI)

- The core migration's business-membership `FOR ALL` policies do not enforce lifecycle transitions. Under the simulated client DML grants in CI, a direct `UPDATE otc_orders.status` succeeds without a lifecycle audit row; the baseline fixture reproduces that bypass.
- The lifecycle RPC `nortago_update_order_status` is SECURITY DEFINER, authenticates `auth.uid()`, checks business role and outlet/business consistency, row-locks, validates allowed transitions, and writes the status/audit transactionally. The lifecycle migration does not install a trigger that forces all direct status writes through this RPC.
- PR #26's migration revokes table-level and explicit column-level INSERT/UPDATE/DELETE on order headers/items from PUBLIC, anon, authenticated, and restores authenticated SELECT with scoped read policies. Regression smoke verifies direct status/order/item mutations are denied while approved RPC advances status, appends one audit record, and leaves payment state unchanged.
- PR #30 adds `POS_INTEGRATED` rejection in the scope guard. The trigger includes `status` updates so legacy POS rows cannot advance through lifecycle; disposable tests assert no status/audit change and preserve online Take Away.
- These grants, RLS and auth checks are PostgreSQL CI simulations only. Real Supabase staging effective grants, function owner, auth identity, tenant membership, and RLS evaluation remain unverified.

### Readiness evidence and remaining decisions

- CI coverage for checkout-to-receipt, idempotency, tenant isolation, monthly/yearly per-outlet subscriptions, plan-change staging, cursor pagination, lifecycle edge paths, audit, and scope restrictions is green on the referenced test commits.
- Browser UAT for customer checkout/receipt and owner inbox/lifecycle/audit has not been completed or evidenced.
- The lifecycle RPC currently permits `NEW → PROCESSING` while `payment_status=PENDING`. Owner must decide which payment methods allow fulfillment before settlement. Until decided, do not offer a prepayment-required flow or treat PENDING as paid; payment-provider settlement/webhook remains disabled. This is a release-policy gate, not a CI assertion.
- Delivery fee/courier responsibility, real staging role/tenant checks, rollback plan, and commercial sign-off remain open.
- PR #28 new documentation head: CI exact-SHA verification pending. No merge, production deploy, staging/live migration, payment/webhook activation, secrets/environment changes, or destructive actions. LinkBayar stays disabled.
