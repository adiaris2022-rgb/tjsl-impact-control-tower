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
