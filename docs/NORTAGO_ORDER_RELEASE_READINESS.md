# NORTAGO ORDER — Release Readiness & UAT

## Product scope (release 1)

NORTAGO ORDER is a shareable link for product catalog, checkout, and order intake. Customer order modes are **Pre-Order (scheduled pickup in current checkout model), Takeaway, and Delivery**.

Excluded from this release: Dine-In, Walk-In/POS, reservations, queues, tables/seating/capacity, sessions, Control Tower, and BOS (deferred until Order is live and stable).

## Current pull request chain and CI evidence (20 Nov 2026)

All PRs listed remain **open, draft, and unmerged**. Head/base references were refreshed during the release-first review.

| PR | Head branch | Head SHA / latest CI-tested code ref | Base branch | Latest verified CI |
|---|---|---|---|
| #1 | `feature/nortago-order-audit-fix` | `a75820a8ca6d14c3f92fd3dfcfb9821f28429843` | `main` | Run #69 PASS |
| #12 | `release/nortago-order-only-20261120` | `31e517eed0c280ed25e57c144405bbd2fcb0178b` | `feature/nortago-order-audit-fix` | Run #131 PASS |
| #13 | `fix/nortago-order-plan-snapshot-20261120` | `c0a5e75cf9a8964848ad00aa4b5d57d1753140a6` | `release/nortago-order-only-20261120` | Run #136 PASS |
| #14 | `fix/nortago-order-checkout-idempotency-20261120` | `f3a86754461b06b10250b073a38fae906bfd2777` | `fix/nortago-order-plan-snapshot-20261120` | Run #138 PASS |
| #15 | `fix/nortago-order-release-scope-20261120` | `e16260f8147e3b55255be6bf5163a32774abe280` | `fix/nortago-order-checkout-idempotency-20261120` | Run #140 PASS |
| #16 | `chore/nortago-order-scope-smoke-dedupe` | `db3e6a43edc4edc4d3338504d87da11163594e42` | `fix/nortago-order-release-scope-20261120` | Run #141 PASS |
| #17 | `feature/nortago-order-owner-inbox` | `7516e1b22d5cd340b872db4bc516471a81ef74d4` | `fix/nortago-order-release-scope-20261120` | Run #143 PASS |
| #18 | `feature/nortago-order-lifecycle-rpc` | CI-tested code `8e084c579d40c023ea13aace0d028d55da628c89` (docs follow-up) | `feature/nortago-order-owner-inbox` | Run #174 PASS |

- [PR #18](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/pull/18) remains draft.
- [CI Run #174](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44770912476) passed on PR #18 head `8e084c579d40c023ea13aace0d028d55da628c89`: production build, migrations/replay, lifecycle security tests, checkout-to-receipt assertions, tenant isolation, and per-outlet subscription checks.
- PR #16 and #17 current heads were rechecked: CI runs #141 and #143 respectively, both PASS.
- Vercel check for code-tested commit `8e084c579d40c023ea13aace0d028d55da628c89` is **success**. A documentation-only follow-up advances the branch head; the bot's Preview alias has prefix `97f4da`, which matches neither the code-tested commit nor the current documentation head. The URL could not be independently inspected. CI PASS is not browser UAT or live Supabase staging verification.

### Preview status refreshed for PR #1/#12–#18

| PR | Vercel status | Evidence |
|---|---|---|
| #1 | Success | Preview status returned by GitHub |
| #12 | Failure | Build-rate-limit |
| #13 | Success | Preview status returned by GitHub |
| #14 | Failure | Build-rate-limit |
| #15 | Failure | Build-rate-limit |
| #16 | Success | Preview status returned by GitHub |
| #17 | Success | Preview status returned by GitHub |
| #18 | Success | Current-head Vercel status check; preview URL not independently verified |

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


## Exact release-first refresh — 24 Nov 2026, 10:47 WIB

GitHub metadata was refreshed for PR #1 and #12–#17. All seven remain **Open / Draft / Unmerged / Mergeable**. Current exact head/base references and commit-associated workflow runs:

| PR | Exact head SHA | Exact base SHA | CI run on exact head | Build job | PostgreSQL job | Vercel exact-head status |
|---|---|---|---:|---|---|---|
| #1 | `a75820a8ca6d14c3f92fd3dfcfb9821f28429843` | `545f4953368d0e85d7573c609bf4abf96b041c80` | [#69](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44665343539) | PASS | PASS | success |
| #12 | `a323dcdedb5fd1048d9d2b2e3560c6ced889789c` | `a75820a8ca6d14c3f92fd3dfcfb9821f28429843` | [#183](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44810763148) | PASS | PASS | success |
| #13 | `c0a5e75cf9a8964848ad00aa4b5d57d1753140a6` | `a323dcdedb5fd1048d9d2b2e3560c6ced889789c` | [#136](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44721352568) | PASS | PASS | success |
| #14 | `f3a86754461b06b10250b073a38fae906bfd2777` | `c0a5e75cf9a8964848ad00aa4b5d57d1753140a6` | [#138](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44725160805) | PASS | PASS | failure: Vercel provider build-rate-limit |
| #15 | `e16260f8147e3b55255be6bf5163a32774abe280` | `f3a86754461b06b10250b073a38fae906bfd2777` | [#140](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44725624942) | PASS | PASS | failure: Vercel provider build-rate-limit |
| #16 | `db3e6a43edc4edc4d3338504d87da11163594e42` | `e16260f8147e3b55255be6bf5163a32774abe280` | [#141](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44740771154) | PASS | PASS | success |
| #17 | `7516e1b22d5cd340b872db4bc516471a81ef74d4` | `e16260f8147e3b55255be6bf5163a32774abe280` | [#143](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44741038747) | PASS | PASS | success |

Job-level status was fetched for all seven exact-head runs: **7/7 workflow runs and 14/14 jobs completed successfully**. PR #16 Run #141 and PR #17 Run #143 were explicitly rechecked on the current exact head SHAs. The Vercel failure for #14/#15 is a provider build-rate-limit status, not a GitHub Actions failure. A successful Vercel status is deployment-provider evidence, not browser UAT.

## Lifecycle owner-boundary decision

See [NORTAGO_ORDER_LIFECYCLE_OWNER_BOUNDARY_DECISION.md](./NORTAGO_ORDER_LIFECYCLE_OWNER_BOUNDARY_DECISION.md). The current owner guard is useful defense-in-depth but trusts a shared function-owner identity. A dedicated non-login lifecycle owner, with no memberships and minimal column/RLS grants, is the proposed production boundary. It is **not implemented or applied** until the actual Supabase `has_business_role`, `auth.uid()`, role attributes, RLS, and migration-executor permissions are inspected in an owner-approved staging session.



## Product & Service catalog — ported into release stack, 24 Nov 2026

The Product & Service work previously isolated on PR #29 was not an ancestor of the consolidated PR #34 release branch. It is now being ported as a follow-on to the lifecycle-hardened PR #37 stack (PR #38 candidate):

- Additive `otc_products.product_type` contract: `PRODUCT` or `SERVICE`, default `PRODUCT`.
- Owner catalog route creates items through the authenticated, business-membership-checked atomic `nortago_create_catalog_item_for_outlet` RPC; outlet price and availability remain outlet-specific.
- Customer menu filters inactive products and labels PRODUCT/SERVICE; checkout labels product/service lines and rejects Pre-Order times that are not in the future.
- Disposable SQL tests cover create RPC ACL/auth/business membership/active outlet/invalid type/price/image/name, outlet mapping, and SERVICE checkout-to-receipt using the outlet price. Checkout idempotency test also sends forged client price/unit_price fields and verifies server-side outlet pricing remains authoritative.
- No product/service changes are applied to Supabase staging or production.

## Concrete commercial gates from current source inspection

1. **Delivery fee is not calculated.** The checkout idempotency migration writes `delivery_fee = 0` and `total = subtotal` for all fulfillment types. The customer menu says delivery fee is not calculated; checkout/receipt still display the returned total. Delivery cannot be represented as a final all-in price until the owner chooses a pricing/collection policy or the customer-facing flow explicitly treats delivery fee as separately confirmed.
2. **Order payment remains pending.** Checkout offers QRIS/Cash/Other, states the payment gateway is not connected, and creates `payment_status = PENDING`. The Owner page's lifecycle action calls only `nortago_update_order_status` and explicitly says payment status is not changed; paid revenue metrics count only `payment_status = PAID`. No order-payment verification control was found in the reviewed Owner page. A manual verification workflow or a separately approved payment integration is required before paid-order reporting/fulfillment can be relied upon. LinkBayar remains disabled.
3. **Outlet-level staff isolation is not implemented in the reviewed UI.** Owner/catalog access is checked at business membership; outlet selection is within the business. Staging UAT must decide whether staff must be restricted to assigned outlets before commercial acceptance.
4. **SERVICE uses the shared order lifecycle.** The catalog distinguishes PRODUCT/SERVICE, but service-specific scheduling/fulfillment rules are not separate. Validate that the shared Take Away/Pre-Order/Delivery workflow matches the service offers being sold.

These are explicit acceptance decisions, not permission to invent fee, payment, or role policy. Keep the relevant flows disabled or clearly disclosed until the owner-approved policy is implemented and tested.


## Outlet/product tenant-isolation finding and guard — 24 Nov 2026

Source review of `20260928_otc_commerce_core_v1.sql` found that the original `otc_outlet_products_staff_manage` policy checked membership against the outlet business but did not require the mapped product to belong to that same business. The outlet/product tables have separate foreign keys, not a composite business-consistency constraint. A business member with direct table DML could therefore attempt a cross-business mapping if they knew another product UUID; the catalog RPC itself was safe because it derives the product business from the selected outlet, but the table policy did not enforce the invariant for all writes.

PR #38 adds a feature-branch migration that:
- Aborts if any existing cross-business outlet/product mapping is found; it does not repair or delete data.
- Replaces the staff mapping policy with an outlet/product business-equality check.
- Adds SECURITY INVOKER triggers for mapping INSERT/UPDATE and for outlet/product `business_id` reassignment, preventing existing mappings from becoming cross-business after a reassignment.
- Revokes direct EXECUTE on trigger functions; they are invoked only by their triggers.
- Adds disposable regression tests for valid mappings, cross-business insert/update rejection, and outlet/product business reassignment rejection.

This closes the source-level tenant mapping gap in the candidate release branch. Actual staging data must still pass the migration preflight and real authenticated-session UAT before approval.


5. **Service DP/full-payment terms are implemented in the PR #38 candidate; settlement is not.** Each SERVICE/outlet mapping can enable FULL only, DP only, or both. DP is configured as 1–99% or a fixed IDR amount per service unit; the checkout RPC recomputes the amount from the authoritative outlet price, stores the initial amount due and remaining balance, and the private digital receipt displays both. PRODUCT lines remain due in full in a mixed cart. The payment-settings RPC and a SECURITY INVOKER trigger restrict changes to OWNER/PROGRAM_MANAGER/PARTNER; direct STAFF writes are rejected. This is disposable-CI/source evidence only until exact-head CI and staging UAT pass. Actual money received, payment confirmation, balance collection, refunds, and partial settlement events are not recorded. All orders still start PENDING; do not mark a DP order PAID or count the full order total as paid revenue until an audited settlement workflow exists.

## Seller-configurable DP/full-payment implementation - 24 Nov 2026

- Owner catalog stores FULL/DP availability and DP type/value per outlet-service mapping. DP supports PERCENT (1-99%) or FIXED IDR per service unit.
- Checkout sends only the selected FULL/DP option. Database RPC recomputes the initial payment due from the authoritative outlet price and seller's saved terms; PRODUCT lines remain due in full, SERVICE lines can use DP.
- Idempotency hash includes payment option. The prior 10-argument RPC overload is removed; only the explicit 11-argument signature is granted to anon/authenticated.
- The receipt RPC and Digital Receipt display the full order total, initial amount due, and remaining balance.
- Disposable PostgreSQL smoke tests cover FULL, percentage DP, fixed DP, mixed PRODUCT/SERVICE carts, unauthorized options, receipt contents, and idempotent retry. CI must confirm migration apply/replay and the dedicated DP smoke test on the current exact PR head.

**Accounting gate:** order.payment_status remains a single PENDING/PAID/FAILED/REFUNDED value. No child payment/receipt ledger or separate partial-settlement flow currently records actual DP collected and later balance receipts. Accordingly Owner Dashboard excludes DP orders from fully-settled revenue and shows initial DP due and remaining balance separately. Do not set a DP order to PAID or count its full total as collected until a separate audited payment-receipt/settlement workflow is built and tested. LinkBayar remains disabled for customer order settlement.

## Staging target mismatch discovered by read-only audit - 24 Nov 2026

- Connected Supabase organization exposes an active project named NORTAGO-ORDER-STAGING (`aakhinaryzidzpsjeewp`), but read-only catalog inspection found no `public.otc_orders`, `otc_outlets`, `otc_products`, `otc_outlet_products`, `public.business_users`, or `public.has_business_role(uuid,text[])`; migration list was empty.
- The core OTC migration comment refers to a different Supabase project ref (`tdpupelhvzxwhbqnnlxk`). The connected `aakhinaryzidzpsjeewp` project is therefore not proven to be the populated database behind this release candidate. Do not apply NORTAGO migrations to it until the correct staging target is identified and owner-approved.
- Supabase security advisor flags `public.rls_auto_enable()` as a SECURITY DEFINER event-trigger function executable by PUBLIC/anon/authenticated; the event trigger `ensure_rls` is enabled. Revoke client/PUBLIC EXECUTE in a reviewed migration on the confirmed target, then re-run security advisors. No live/staging ACL change was made during this audit.
- This staging read-only inspection is distinct from disposable PostgreSQL CI and does not establish real application RLS/Auth/tenant behavior.

## Latest exact-head validation — 24 Nov 2026

- PR #38 head: `7dd1e366a6a67b92454c586ad12503ca8658fb05`; base PR #37 head: `be598ef1ea6437f4854785b07c65b95f57226df3`.
- [NORTAGO Order CI Run #367](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/45336888761): PASS, both production build and PostgreSQL validation jobs completed successfully on the exact PR head.
- [Vercel preview status](https://vercel.com/nortago/nortago-order-staging/CGfwdTWzxSAWFii5SLNwdm9pgvkk): Success; preview provider status is not browser UAT.
- The exact-head CI run covers Product/SERVICE catalog, cross-business outlet/product guard, seller-configurable service DP/full-payment migration and replay, Owner-only payment configuration RPC/trigger, DP percentage/fixed calculations, mixed cart, digital receipt amounts, changed-payment-option idempotency conflict, checkout-to-receipt, subscription, lifecycle security, pagination, and read-only staging audit SQL.
- Supabase staging remains unverified. No live/staging migration, production deployment, payment/webhook activation, or secrets/environment changes were performed. The candidate stores payment obligations but does not record actual money received, balance collection, refunds, or settlement events; checkout remains PENDING until a separately approved settlement workflow exists.


## Latest exact-head validation — 24 Nov 2026, 13:39 WIB

- PR #38 remains Open / Draft / Unmerged. Exact head `924af2923e154ceca023370c5bf18943bd6f4f9f`; exact base `be598ef1ea6437f4854785b07c65b95f57226df3` (PR #37 dedicated lifecycle-owner branch).
- [CI Run #369](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/45342651041) PASS on that exact head. PostgreSQL migration/security checks and production build/pagination tests both completed successfully.
- Vercel combined status is success for the exact head, but the bot's preview alias still contains commit prefix `90d2f9`, not `924af`. Preview and inspector URLs are inaccessible to the verification browser; exact-head browser UAT remains unverified.
- Checkout and private receipt now explicitly disclose that Delivery fees are not calculated or included in the displayed total and must be confirmed with the seller before payment/processing. This is disclosure only; fee calculation, collection, and courier dispatch remain unimplemented.
- Read-only Supabase inspection of connected project NORTAGO-ORDER-STAGING (`aakhinaryzidzpsjeewp`, ACTIVE_HEALTHY, PostgreSQL 17.12) found an empty `public` schema and no app migrations. `auth.uid()` exists, but OTC tables, `business_users`, `has_business_role`, lifecycle RPC, status audit, and app migration ledger are absent. Effective OTC grants/RLS/triggers therefore cannot be verified on this project.
- The OTC core migration comment references another project ref (`tdpupelhvzxwhbqnnlxk`), which the connected account could not inspect (permission denied). Do not apply migrations to the empty connected project; identify the populated staging target first.
- Supabase Security Advisor flags `public.rls_auto_enable()` as SECURITY DEFINER and executable by anon/authenticated; the `ensure_rls` event trigger is enabled. No ACL change was made; review this platform-level finding on the confirmed target.
- No staging/live migration, merge, production deployment, payment/webhook activation, secret/environment change, or destructive action was performed.

## Default ACL and RLS event-trigger finding — corrected read-only catalog evidence, 24 Nov 2026

Read-only catalog inspection of connected project NORTAGO-ORDER-STAGING (`aakhinaryzidzpsjeewp`, ACTIVE_HEALTHY, PostgreSQL 17.12) found zero public application tables and no application migration ledger. These results describe environment defaults and the platform event helper; they are **not effective grants on `otc_orders`**, because that table does not exist in this project.

### Default ACLs by object creator role

The expanded Query 19 output distinguishes global/built-in defaults from additive `public`-schema defaults:

- For objects created by `supabase_admin`, the **public-schema additive TABLE ACL** grants anon, authenticated, and service_role SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, and PostgreSQL 17 MAINTAIN. Its public-schema SEQUENCE ACL grants SELECT, UPDATE, USAGE; its public-schema FUNCTION ACL grants EXECUTE to those same roles. The global/built-in FUNCTION default also grants EXECUTE to PUBLIC. The broad table/sequence/function rows are schema-additive defaults, not a global table ACL.
- For objects created by `postgres`, the **public-schema additive TABLE ACL** grants only TRUNCATE, REFERENCES, TRIGGER, and MAINTAIN to anon/authenticated/service_role; it does not grant table SELECT, INSERT, UPDATE, or DELETE. No public-schema additive SEQUENCE/FUNCTION rows were returned for postgres; its built-in FUNCTION default grants EXECUTE to PUBLIC.
- The result is creator-role-specific. A `supabase_admin` default does not prove what a `postgres`-created object receives, and neither default ACL is an effective grant on an already-created table. Do not alter global or schema-level defaults without a separate owner-approved impact analysis.

The connected project's read-only session reported `current_user=postgres`; that is evidence only for this empty connected project, not proof of the migration executor or ACLs on the populated NORTAGO database.

### Actual event-helper catalog result on the connected project

- `public.rls_auto_enable()` exists, is owned by `postgres`, returns `event_trigger`, is SECURITY DEFINER, and has `search_path=pg_catalog`.
- `proacl=NULL`; effective EXECUTE is true for anon, authenticated, and service_role through the default PUBLIC EXECUTE privilege.
- Enabled event trigger `ensure_rls` invokes the function on `ddl_command_end`. Its body enables RLS on newly created public tables; this does not itself grant row access.
- `otc_orders`, `otc_order_items`, `otc_outlets`, `otc_products`, `business_users`, `has_business_role(uuid,text[])`, and `nortago_update_order_status(uuid,text,text)` are absent. No OTC RLS policies or OTC triggers can therefore be inspected on this project.

### PR #40 hardening candidate

[PR #40](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/pull/40) adds a conditional, function-specific migration. When the exact helper exists with the expected SECURITY DEFINER/event_trigger contract and is attached to an enabled event trigger, it revokes EXECUTE from PUBLIC, anon, authenticated, and service_role. It does not change global/default ACLs, the function body, or the event trigger definition.

The disposable CI fixture verifies:
- effective EXECUTE is false for anon, authenticated, and service_role after the revoke;
- SECURITY DEFINER and fixed `search_path=pg_catalog` remain unchanged;
- `ensure_rls` remains enabled; and
- creating a new public table still causes the event trigger to enable RLS.

### Latest exact-head CI — PR #40

- PR #40 remains Open / Draft / Unmerged. Current head: `22c6a2184ca5a735a221fe102875dd5a6b63cf8a`; base: `e783feefea1825d9a1697b8a0084d996f7b44dd2` (PR #38 candidate).
- [CI Run #398](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/45370196843) completed **PASS** on that exact head. Production build and all three pagination unit suites passed; PostgreSQL migration/security validation passed, including the lifecycle owner/direct-write regression and the new client/service EXECUTE plus security-path event-helper regression.
- Vercel status is failure due to provider build-rate-limit. No Preview/browser UAT is claimed for this head.
- This is disposable PostgreSQL CI only. The PR #40 migration has not been applied to any Supabase project.

### Staging target mismatch — still blocking real verification

The OTC core migration comment references project ref `tdpupelhvzxwhbqnnlxk`. The current Supabase connection cannot inspect that project (permission denied); the connected `aakhinaryzidzpsjeewp` project is empty and is not proven to be the populated NORTAGO database. Do not apply migrations to the empty connected project. Identify the correct populated staging target and obtain explicit approval before any staging migration or authenticated-session UAT.

No staging/live migration, merge, production deployment, payment/webhook activation, secrets/environment change, or destructive action was performed.
