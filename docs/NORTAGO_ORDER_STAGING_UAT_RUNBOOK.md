# NORTAGO ORDER — Staging UAT Runbook

## Legacy nested app and sibling-PR integration gate

The nested `otc/` package is a separate legacy Next.js demo, not the active root NORTAGO ORDER app. PR #47 changes its root layout to render only a static disabled notice and not render any route children; the active root `app/otc/layout.tsx` remains unchanged. Do not use the nested package for checkout, receipt, Owner Dashboard, or payment UAT.

Before final candidate sign-off, verify that both sibling changes are represented: PR #40's `rls_auto_enable()` event-helper EXECUTE revocation (PR #41 does not inherit PR #40), and PR #44's same-business/two-outlet subscription regression (PR #45 does not inherit PR #44). Their individual CI passes are not evidence that their changes are present in the selected candidate SHA.


## Latest release-first preflight — 24 Nov 2026, 19:36 WIB

This is an evidence refresh, not permission to migrate or deploy. The latest selected code candidate is PR #45 head `e6cccf88c5544ea59eb601466b0e3c8d3a1dc6fb`; its parent PR #43 head is `64e3cd482c0afc1dba5bbe2a6305f8bee0861525`. PR #44 (`ea8f4c242371bed636075cf9445aa4b71d8a2ea0`) is a sibling of PR #45 and contains the two-outlets-within-one-business subscription test; PR #45 does not include it. Do not sign off the integrated candidate until both are represented and CI passes on the resulting exact SHA.

### Exact-head automated evidence

- PR #16 head `db3e6a43edc4edc4d3338504d87da11163594e42`: Run #141 PASS; both database and build jobs completed.
- PR #17 head `7516e1b22d5cd340b872db4bc516471a81ef74d4`: Run #143 PASS; both database and build jobs completed.
- PR #42 head `87f74e505af799d8b1c224e6d60238c5b928a1d5`: Run #407 PASS.
- PR #43 head `64e3cd482c0afc1dba5bbe2a6305f8bee0861525`: Run #408 PASS.
- PR #44 head `ea8f4c242371bed636075cf9445aa4b71d8a2ea0`: Run #409 PASS.
- PR #45 head `e6cccf88c5544ea59eb601466b0e3c8d3a1dc6fb`: Run #412 PASS.

All above are GitHub Actions runs against disposable PostgreSQL 17 and production-build/unit-test runners. They do not verify Supabase staging or a deployed browser preview. PR #43–#45 Vercel checks were blocked by the provider build-rate-limit; exact-head browser UAT remains BLOCKED.

### Staging identity and schema gate

The connected Supabase project `aakhinaryzidzpsjeewp` is active but contains zero OTC application tables and zero app migrations. The core OTC migration references `tdpupelhvzxwhbqnnlxk`, which is inaccessible to the current connection. Stop before any migration until the owner confirms the populated disposable staging project and read-only access is available. Do not infer `otc_orders` grants or policies from the empty project.

### Required security evidence once the correct target is available

- [ ] Record project ref and migration ledger; confirm this is the populated disposable staging target.
- [ ] Inspect actual table owner and effective table/column grants for `otc_orders` and `otc_order_items`.
- [ ] Inspect every RLS policy's command, roles, USING and WITH CHECK expressions; inspect all triggers and their function owner/security/search_path.
- [ ] Inspect `nortago_update_order_status`, `has_business_role`, `auth.uid()`, dedicated lifecycle owner memberships/attributes, and all SECURITY DEFINER writers.
- [ ] Under real authenticated sessions, prove direct status UPDATE is rejected without mutation/audit and approved RPC transitions succeed with exactly one audit event.
- [ ] Verify tenant A cannot read/mutate tenant B and confirm the actual business/outlet staff policy.
- [ ] Apply/replay migrations only after separate owner approval and a rollback/recovery plan.

### Current commercial limitations

- Delivery fee is not calculated (stored as zero); do not describe the order total as all-in.
- Payment/DP state is not a complete collection ledger; PENDING remains pending until a verified settlement workflow is approved and tested.
- LinkBayar remains disabled; do not enable provider/webhook or change secrets in this run.
- Staff access is business-level, not outlet-assignment scoped; confirm the owner policy before launch.
- Audit deletion currently follows the schema's cascade behavior; retention policy remains open.

No staging/live migration, merge, production deployment, payment/webhook activation, secrets/environment change, or destructive action is authorized by this runbook.


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


## 7. Lifecycle owner-boundary preflight (read-only)

Before accepting the lifecycle guard for staging:

- [ ] Run `docs/NORTAGO_ORDER_STAGING_SECURITY_AUDIT.sql` in an owner-approved staging SQL session.
- [ ] Inspect the actual `public.has_business_role(uuid,text[])` owner, SECURITY DEFINER/INVOKER mode, function configuration, ACL, effective EXECUTE, and full definition. The repository CI helper is only a test fixture.
- [ ] Inspect the actual `auth.uid()` function and verify request identity under the staging authenticated session.
- [ ] Inspect `business_users` only if the observed helper definition uses it; record actual RLS, policies, grants, and owner. Do not infer its production schema from CI fixtures.
- [ ] Inspect all same-owner SECURITY DEFINER functions and their EXECUTE reachability. The PR #35 static test detects common explicit direct UPDATE patterns, not dynamic SQL or indirect calls.
- [ ] Review the dedicated lifecycle owner decision in `docs/NORTAGO_ORDER_LIFECYCLE_OWNER_BOUNDARY_DECISION.md`.
- [ ] Confirm the proposed owner role is NOLOGIN/NOINHERIT/NOSUPERUSER/NOBYPASSRLS, has no memberships, owns only the lifecycle RPC, and has no schema CREATE privilege.
- [ ] Confirm only the lifecycle RPC has the minimum data privileges and role-specific RLS policies; authenticated/anon remain read-only for order headers/items.
- [ ] If any precondition is unknown or fails, stop. Do not grant broader client privileges or apply an owner migration to compensate.

No owner-boundary migration is applied by this runbook. Staging migration requires separate explicit owner approval.


## Dedicated lifecycle owner candidate (feature branch only)

- [ ] Review PR #37 migration and confirm the preflight matches the actual staging helper and role model before any migration approval.
- [ ] Verify the lifecycle owner has no login, inheritance, superuser, BYPASSRLS, role memberships, table ownership, schema CREATE, or unrelated function ownership.
- [ ] Verify exact column access: order identity/business/outlet/status/fulfillment SELECT; status/updated_at UPDATE; outlet id/business SELECT; audit INSERT columns only; no order-item access and no customer/payment/receipt-token/checkout-key column access.
- [ ] Run direct authenticated status-write rejection and approved RPC transition using real staging authenticated sessions only after separate migration approval.

PR #37 is not staging approval. No staging/live migration is authorized by this checklist.


## Product & Service catalog UAT (PR #38 candidate)

- [ ] Owner can create a PRODUCT and a SERVICE for an active outlet through the atomic catalog RPC.
- [ ] Non-member business and inactive outlet catalog creation are rejected; anon/PUBLIC cannot execute the create RPC.
- [ ] Outlet-specific price and availability are reflected in the customer menu; inactive business products are not shown.
- [ ] Customer menu and checkout clearly label PRODUCT vs SERVICE.
- [ ] SERVICE uses the standard checkout and receipt path with the outlet price snapshot; retry/idempotency remains intact.
- [ ] Pre-Order rejects past/current local pickup time.
- [ ] Verify Owner/catalog role access with actual Owner, Program Manager, Partner and Staff sessions; current checks are business-level, not outlet-assignment isolation.

## Delivery and payment acceptance gates — source-backed

- [ ] Confirm Delivery fee policy. Current checkout migration stores delivery_fee=0 and total=subtotal; no fee calculation exists. Do not present the total as all-in unless the owner explicitly chooses free delivery or a separately confirmed fee flow is implemented.
- [ ] Confirm order payment policy. Checkout currently records QRIS/Cash/Other, gateway-not-connected notice, and PENDING payment. Lifecycle status updates do not change payment_status. Verify the manual payment verification path or keep paid-only reporting/fulfillment gated; do not activate LinkBayar in this run.
- [ ] Confirm whether staff require outlet-specific access restrictions. Current source checks business membership only.

No staging/live migration or payment activation is authorized by this runbook.


## Outlet/product tenant consistency UAT (PR #38 candidate)

- [ ] Confirm the migration preflight reports no existing outlet/product mappings where `otc_outlets.business_id <> otc_products.business_id`; do not auto-delete or auto-repair any rows.
- [ ] With an authenticated member of a business, valid same-business outlet/product mappings remain writable.
- [ ] Cross-business mapping INSERT and UPDATE are rejected by the server-side trigger and policy.
- [ ] Reassigning a mapped product or outlet to another business is rejected until its mappings are removed through an owner-approved workflow.
- [ ] Confirm anon/authenticated cannot directly EXECUTE trigger functions.

CI regression uses disposable PostgreSQL only. Staging catalog/data inspection remains read-only until separately approved.


- [ ] For SERVICE items, verify whether the seller requires DP or full payment. Current schema/UI supports a single price and PENDING payment only; no DP/full-payment selection or balance tracking exists. Do not launch deposit-based services until the seller's DP amount/rule and balance collection flow are implemented and tested.


## Read-only catalog tenant-guard audit evidence

- [ ] Run security audit Query 15 and record authenticated SELECT/INSERT/UPDATE grants on `otc_outlet_products`, SELECT and UPDATE (required for `FOR SHARE`) on `otc_outlets`/`otc_products`, and the specific business-key column SELECT grants.
- [ ] Run Query 16 and verify the exact `otc_outlet_products_staff_manage` policy `USING`/`WITH CHECK`, enabled tenant-guard triggers, SECURITY INVOKER mode, function owners/configuration, and no direct anon/authenticated EXECUTE.
- [ ] Run Query 17 and require `cross_business_mapping_count = 0` before applying the tenant-guard migration. Any existing mismatch requires owner review; never delete or auto-repair rows.

## Seller-configurable service DP/full-payment UAT

- [ ] For each SERVICE at each outlet, verify the seller can enable FULL only, DP only, or both; the UI must not allow both options to be disabled.
- [ ] Verify DP can be configured as PERCENT (1-99%) or FIXED IDR amount. The fixed amount is per service unit and must be positive; the seller UI prevents setting it above the current outlet price.
- [ ] Verify FULL checkout charges all PRODUCT and SERVICE lines at authoritative outlet prices.
- [ ] Verify DP checkout charges PRODUCT lines in full and SERVICE lines at the seller-configured DP amount. Mixed-cart total, initial amount due, and remaining balance must reconcile exactly.
- [ ] Verify checkout RPC recalculates DP from database outlet settings; forged client price or DP amount fields must not affect the result.
- [ ] Verify DP option is rejected for product-only carts and whenever any SERVICE in the cart has DP disabled. Verify FULL is rejected when a SERVICE in the cart has full payment disabled.
- [ ] Verify the Owner-only payment-terms RPC denies non-members and the SECURITY INVOKER trigger rejects direct STAFF table writes; anon/PUBLIC cannot execute the RPC or trigger function.
- [ ] Retry with the same idempotency key and identical payment option; the same order, receipt token, initial due, and remaining balance must be returned. Reusing the key with a changed payment option must be rejected.
- [ ] Digital Receipt must clearly show total order, initial amount due, remaining balance, payment option, and PENDING status.

**Important accounting limitation:** the DP implementation stores the payment option, initial amount due, remaining balance, and a single payment status. It does not record actual amounts received, balance collection, payment receipts, refunds, or partial settlement events. All newly created orders remain PENDING. The Owner Dashboard's paid-only metrics exclude PENDING orders and its per-outlet summary displays DP pending amount and remaining DP balance. Those figures are order obligations, not proof of money received; this implementation does not yet provide a verified DP settlement/collection ledger. Do not mark a DP order fully PAID or include its full order total in paid revenue until a separate, audited payment-receipt/settlement workflow is implemented.


## Default ACL and DDL event-trigger preflight (read-only)

- [ ] Run security audit Query 19. Record effective global/built-in and public-schema default privileges by object creator role for TABLE, SEQUENCE, and FUNCTION objects. A default ACL for one creator role does not prove the ACL used by another migration executor.
- [ ] Review default TABLE privileges granting anon/authenticated INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, or TRIGGER; review FUNCTION EXECUTE separately. Do not change global default privileges without an owner-approved impact analysis.
- [ ] Run Query 20. Inspect enabled DDL event triggers, SECURITY DEFINER owner, fixed search_path, ACL, and effective anon/authenticated EXECUTE.
- [ ] If `public.rls_auto_enable()` exists as an enabled SECURITY DEFINER event-trigger function, the candidate migration conditionally revokes EXECUTE from PUBLIC, anon, authenticated, and service_role while preserving the enabled event trigger. The helper is not an application RPC; PostgreSQL invokes it through the event trigger. Verify effective EXECUTE is false for all four grantees and that a newly created public table still receives RLS in disposable CI.
- [ ] Do not create, drop, disable, or replace a platform event trigger during staging UAT. The CI fixture is disposable-only.

## Integrated subscription isolation regression

The selected candidate must include the PR #44 test that creates two outlets in the same business plus a second business, proves separate subscription IDs, stages a yearly change for only one outlet, and leaves all four invoice payment records PENDING. This is automated disposable PostgreSQL evidence only; no payment settlement or webhook delivery occurs.
