# NORTAGO ORDER — Release Readiness & UAT

## Product scope (release 1)

NORTAGO ORDER is a shareable link for product catalog, checkout, and order intake. Customer order modes are **Pre-Order (scheduled pickup in current checkout model), Takeaway, and Delivery**.

Excluded from this release: Dine-In, Walk-In/POS, reservations, queues, tables/seating/capacity, sessions, Control Tower, and BOS (deferred until Order is live and stable).

## Current pull request chain and CI evidence (20 Nov 2026)

All PRs listed remain **open, draft, and unmerged**. Head/base references were refreshed during the release-first review.

| PR | Head branch | Head SHA | Base branch | Latest verified CI |
|---|---|---|---|
| #1 | `feature/nortago-order-audit-fix` | `a75820a8ca6d14c3f92fd3dfcfb9821f28429843` | `main` | Run #69 PASS |
| #12 | `release/nortago-order-only-20261120` | `31e517eed0c280ed25e57c144405bbd2fcb0178b` | `feature/nortago-order-audit-fix` | Run #131 PASS |
| #13 | `fix/nortago-order-plan-snapshot-20261120` | `c0a5e75cf9a8964848ad00aa4b5d57d1753140a6` | `release/nortago-order-only-20261120` | Run #136 PASS |
| #14 | `fix/nortago-order-checkout-idempotency-20261120` | `f3a86754461b06b10250b073a38fae906bfd2777` | `fix/nortago-order-plan-snapshot-20261120` | Run #138 PASS |
| #15 | `fix/nortago-order-release-scope-20261120` | `e16260f8147e3b55255be6bf5163a32774abe280` | `fix/nortago-order-checkout-idempotency-20261120` | Run #140 PASS |
| #16 | `chore/nortago-order-scope-smoke-dedupe` | `db3e6a43edc4edc4d3338504d87da11163594e42` | `fix/nortago-order-release-scope-20261120` | Run #141 PASS |
| #17 | `feature/nortago-order-owner-inbox` | `7516e1b22d5cd340b872db4bc516471a81ef74d4` | `fix/nortago-order-release-scope-20261120` | Run #143 PASS |
| #18 | `feature/nortago-order-lifecycle-rpc` | `205315630ed66b0258e0537fcd6bf64333dbe269` | `feature/nortago-order-owner-inbox` | Run #168 PASS |

- [PR #18](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/pull/18) remains draft.
- [CI Run #168](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44760995191) passed on PR #18 head `205315630ed66b0258e0537fcd6bf64333dbe269`: production build and PostgreSQL migrations/smoke tests.
- PR #16 and #17 current heads were rechecked: CI runs #141 and #143 respectively, both PASS.
- Vercel preview for the latest PR #18 head reports **failure: build-rate-limit**. The preview page could not be independently inspected. CI PASS is not deployed-preview or staging UAT.

## Order lifecycle implementation and security test evidence

PR #18 adds a server-side `nortago_update_order_status` RPC, row locking, allowed transitions by fulfillment type, business-role authorization, outlet/business relationship validation, audit rows, and Owner Inbox actions/history. Payment status is deliberately not mutated by lifecycle actions.

The CI fixture was strengthened to model `business_users` membership rather than an unconditional role stub:
- no membership → lifecycle action denied;
- membership in Business A → allowed for Business A;
- Business A member → denied for Business B order;
- authorized Business A order referencing Business B outlet → rejected by outlet/business consistency guard;
- denied actions do not change status or create audit records.

**Limit:** CI uses a test `has_business_role` fixture, not the actual Supabase production function/identity. Repository migrations do not define the production `has_business_role` implementation. Real Supabase role/RLS verification remains mandatory. The current authorization model is business-level membership; it does not implement per-outlet staff membership/permission boundaries.

## Automated CI coverage (disposable PostgreSQL only)

- **Checkout → receipt:** server-priced checkout, outlet price override, input validation, receipt capability lookup, and receipt item data.
- **Checkout idempotency:** retry returns the same order/receipt, conflicting payload re-use rejected, no duplicate order/items.
- **Tenant isolation:** cross-business product rejected, cross-linked product/outlet rejected, failed checkout creates no order, invalid receipt token returns no data.
- **Lifecycle RPC:** fulfillment-specific transitions, forbidden transitions, role denial, business membership boundary, outlet/business mismatch, audit actor/note, payment-state separation.
- **Per-outlet subscriptions:** monthly/yearly plan snapshot, invoice/payment reuse on retry, plan change staged as pending, separate outlet subscriptions, no settlement or webhook.
- **Order scope:** Dine-In/Walk-In/reservation actions remain excluded/blocked in the Order release scope.

All automated assertions above ran against the disposable CI database and do **not** constitute live/staging verification.

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
- [ ] Open valid receipt token and confirm it resolves to the created order.
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

- **Preview:** latest PR #18 Vercel status is build-rate-limit failure; no independent browser verification.
- **Supabase staging:** no migration was applied. CI replay is disposable only.
- **Real auth/RLS:** production `has_business_role` and tenant policies are not verified against real users.
- **Checkout UAT:** automated functional tests pass; actual deployed checkout → private receipt needs staging/preview UAT.
- **Owner UAT:** lifecycle actions and audit history are automated; real tenant UI verification remains.
- **Delivery:** fee, courier handoff, and third-party responsibility need operational confirmation.
- **Payments:** payment provider collection and webhook settlement are not verified/activated. LinkBayar webhook remains disabled.

## Release checklist

- [x] Latest PR #18 head CI run #168 green (build + disposable database).
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
