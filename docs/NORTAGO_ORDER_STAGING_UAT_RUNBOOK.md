# NORTAGO ORDER — Staging UAT Runbook

This runbook is for owner-approved testing in a disposable Supabase staging project and a preview deployment that matches the reviewed commit. It is not permission to migrate, deploy, enable payments, or change secrets.

## Preconditions (stop if any is missing)

- [ ] Preview URL is tied to the exact PR head SHA being tested.
- [ ] Staging Supabase project is disposable and identified (project ref recorded; do not paste credentials).
- [ ] Migration review is approved by the owner and a rollback/recovery plan exists.
- [ ] Two isolated businesses (A and B), outlets, products, and test accounts are provisioned.
- [ ] Owner/Manager/Partner/Staff role assignments are recorded; outlet-specific staff assignment is not assumed because the current model is business-level.
- [ ] LinkBayar feature flag and webhook remain disabled. Use non-payment/manual test paths only.
- [ ] No production data, customer phone numbers, payment credentials, or secrets are used.

## Evidence capture

Record a timestamp (UTC), tested preview commit SHA, staging project reference (not credentials), tester role, business/outlet, test case ID, result, and sanitized screenshot or logs. Redact customer PII and tokens. For failures, record the request/action, expected vs. actual result, error code, and whether any database mutation occurred. Do not include capability receipt tokens in evidence.

## 1. Login and business access

- [ ] Sign in as Business A owner; confirm dashboard loads and only authorized businesses are selectable.
- [ ] Sign in as Business B owner; confirm Business A order/customer/audit data is not exposed.
- [ ] Test each intended role (Owner, Program Manager, Partner, Staff) against the approved permission matrix. Do not infer outlet-specific permissions from business membership.
- [ ] Attempt an action with a revoked/no membership; it must fail and leave order/audit unchanged.

## 2. Customer checkout → receipt

- [ ] Choose an active outlet and an available product; submit Takeaway with valid customer details.
- [ ] Confirm order number, item snapshot, outlet price override, quantity, line total, subtotal and total.
- [ ] Open the receipt from the checkout-returned capability in the same test session. Confirm header, item snapshot, fulfillment, payment status and totals match the created order.
- [ ] Repeat the same checkout payload and idempotency key; confirm the same order/receipt is returned and no duplicate order/item rows appear.
- [ ] Reuse that key with a different payload; confirm rejection and no mutation.
- [ ] Try Business B's product at Business A's outlet, including a deliberately cross-linked outlet-product mapping; both must be rejected without creating an order.
- [ ] Open an invalid/unknown receipt token; it must return no customer/order data.
- [ ] Repeat with Delivery (valid address) and Pre-Order (future schedule); confirm required fields and receipt data.

## 3. Owner Order Inbox and lifecycle

For each order, use only the displayed action that is valid for its current status and fulfillment type. Server validation is authoritative.

**Takeaway happy path:** NEW → PROCESSING → READY → WAITING_PICKUP → PICKUP_VERIFIED → SUCCESS.

**Delivery happy path:** NEW → PROCESSING → READY → HANDED_OVER_TO_DELIVERY → SUCCESS.

**Pre-Order happy path:** NEW → PROCESSING → READY → WAITING_PICKUP → PICKUP_VERIFIED → SUCCESS → PO_SUCCESS. Verify schedule display.

- [ ] Add a short note; confirm trimming and audit persistence.
- [ ] Try an invalid transition and a transition for the wrong fulfillment type; both must be rejected without changing status or creating audit.
- [ ] Refresh; status and audit history must remain consistent.
- [ ] Confirm lifecycle actions never change payment status.
- [ ] Confirm an authorized Business A user cannot update Business B's order.
- [ ] Confirm an order whose outlet belongs to a different business is rejected.
- [ ] Confirm audit visibility follows actual staging RLS, not the CI fixture.

### Additional lifecycle edge-path coverage

Automated disposable-CI test: `supabase/tests/nortago_order_lifecycle_edge_transitions_smoke.sql`.

- [ ] Scheduled recovery path: NEW → SCHEDULED → FULFILLMENT_CHECK → FULFILLMENT_ISSUE → PROCESSING → READY → WAITING_PICKUP → PICKUP_VERIFIED → SUCCESS.
- [ ] Audit count, actor, and trimmed schedule note are preserved on the recovery path.
- [ ] Terminal SUCCESS cannot be reopened to PROCESSING; rejected transition must leave order and audit unchanged.
- [ ] Owner Inbox check path: PROCESSING → FULFILLMENT_CHECK → READY → WAITING_PICKUP → PICKUP_VERIFIED → SUCCESS.
- [ ] Payment status remains unchanged on both paths.

## 4. Outlet subscription (manual, no settlement)

- [ ] Prepare monthly plan (Rp50,000) for outlet A and confirm invoice/plan snapshot.
- [ ] Prepare yearly plan (Rp500,000) for outlet B and confirm a separate subscription/invoice.
- [ ] Retry preparation; confirm the existing open invoice/payment record is reused.
- [ ] Change outlet A's plan; confirm it remains pending and current plan is unchanged until settlement.
- [ ] Confirm no payment becomes VERIFIED/PAID and no webhook delivery is created.
- [ ] Do not call payment provider or enable settlement/webhook during this UAT.

## 5. Fulfillment and scope

- [ ] Verify delivery fee and customer-facing fee wording; if not operationally configured, treat Delivery as blocked for commercial use or disclose the limitation.
- [ ] Confirm courier handoff responsibility and customer communication.
- [ ] Confirm Pre-Order schedule is visible to customer and owner.
- [ ] Confirm Dine-In, Reservation, Walk-In/POS, queue, table/seating/capacity, session, and Control Tower are absent or blocked.

## 6. Deployment verification

- [ ] Preview loads on desktop and mobile widths without console errors or horizontal overflow.
- [ ] Checkout, receipt, owner dashboard, subscription links, and lifecycle actions work in the preview.
- [ ] The preview commit SHA matches the PR head being reviewed. A Ready deployment for a different SHA is not evidence for current head.
- [ ] Preview and staging verification are recorded separately; CI disposable PostgreSQL does not substitute for either.
- [ ] No production deploy or live migration is performed without explicit owner approval.

## Evidence template

| Field | Value |
|---|---|
| UTC timestamp | |
| Preview URL | |
| Preview commit SHA | |
| Staging project reference | |
| Tester / role | |
| Business / outlet | |
| Test case ID | |
| Result (PASS/FAIL/BLOCKED) | |
| Expected / actual | |
| Sanitized evidence link | |
| Mutation confirmed absent on failure? | |

## Exit criteria

Commercial release review may proceed only after all critical checkout/receipt, tenant authorization, lifecycle, subscription, fulfillment, and current-head preview tests pass; delivery/payment limitations are explicitly resolved or excluded from the offered release; and the owner approves the release checklist. CI green alone is not staging UAT.


## Paid-order fulfillment regression (CI fixture)

The release-first CI now includes `supabase/tests/nortago_order_lifecycle_paid_order_smoke.sql`. It seeds a disposable order with `status=PAID` and `payment_status=PAID` (no provider call or real payment), then advances Takeaway fulfillment through PROCESSING → READY → WAITING_PICKUP → PICKUP_VERIFIED → SUCCESS. It asserts the payment state remains PAID, the five audit transitions are ordered and actor-attributed. This is automated CI coverage only; do not use a live payment to reproduce it in staging.


## Hourly owner report pagination regression

- The Owner hourly report must fetch all today's order rows using keyset pagination (created_at DESC, id DESC), not a single PostgREST response that may be capped at 1,000 rows.
- CI runs `app/otc/owner-report/hourly-summary.test.mjs` to verify multi-page aggregation, duplicate-row handling at a cursor boundary, local-time hour buckets, and that only `payment_status=PAID` contributes to the paid total.
- For staging UAT, if the fixture has more than one page of orders, confirm the report count and paid total reconcile across all pages. This is a preview/staging test, not a live customer-data test.
