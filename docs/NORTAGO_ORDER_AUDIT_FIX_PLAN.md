# NORTAGO Order — Technical Audit & Fix Plan

**Product identity:** NORTAGO Order  
**Product descriptor:** Sistem Pemesanan Digital Terintegrasi  
**Baseline:** `main` at `545f4953368d0e85d7573c609bf4abf96b041c80`  
**Working branch:** `feature/nortago-order-audit-fix`  
**Production policy:** No merge to main, Railway deployment, production database mutation, or production configuration change without separate review and explicit approval.

## Executive assessment

The repository contains an OTC commerce prototype, now to be branded as NORTAGO Order. The active Next.js customer routes are under `app/otc/`; a second legacy-looking implementation exists under `otc/`. The current evidence does not establish that the second tree is deployed or used, so it must not be removed until deployment/build routing is verified.

The product is not yet ready for live commercial ordering. The main blockers are customer checkout permissions, server-side order validation, atomic order creation, private receipt access, real reservation persistence, payment confirmation, and owner reporting semantics.

## Verified findings from main

### P0 — Customer checkout and receipt access conflict with current RLS
Migration `supabase/migrations/20260928_otc_commerce_core_v1.sql` enables RLS on `otc_orders` and `otc_order_items`. The migration defines authenticated staff-management policies for those tables, but no customer/anon insert policy for order creation and no customer receipt-read policy. Meanwhile, `app/otc/checkout/page.tsx` and `app/otc/digital-receipt/page.tsx` create a Supabase client with the public anon key and perform direct table inserts/selects. Under the policies present in repository migrations, this customer flow is expected to be denied unless there are external policies not represented in the repository. Confirm the live policy state in staging before release.

**Fix:** Move customer order creation and receipt retrieval behind server-controlled endpoints or narrowly scoped database functions. Validate the public request, enforce product/outlet/business relationships, calculate all prices server-side, and expose only minimum receipt fields through an unguessable receipt capability token. Never expose the service-role key to the browser.

### P0 — Client-controlled prices and totals
`app/otc/customer-order/page.tsx` reads `base_price` into browser state and `app/otc/checkout/page.tsx` submits browser-calculated subtotal/total and item unit prices. A modified client can submit arbitrary prices or totals.

**Fix:** Accept product IDs and quantities only; re-fetch active products and outlet-specific prices server-side, calculate subtotal/fees/discount/total on the server, and persist authoritative snapshots.

### P1 — Order header and items are not atomic
Checkout inserts `otc_orders` first and `otc_order_items` in a separate request. If item insertion fails, an orphan order remains.

**Fix:** Use a single Postgres transaction via a carefully validated RPC or a server-side transactional operation. Add idempotency handling for retry-safe submissions.

### P1 — Dine-In reservation is a front-end simulation
`app/otc/reservation/page.tsx` only toggles local React state and displays a success message. It does not persist a reservation. In addition, customer-order mode only exposes TAKE_AWAY, PRE_ORDER, and DELIVERY; checkout treats every non-TAKE_AWAY/PRE_ORDER value as DELIVERY. The database order constraint already includes DINE_IN, but the end-to-end customer flow is not wired.

**Fix:** Define reservation data model, table/seat capacity rules, reservation status lifecycle, and persistence before connecting the Dine-In path. Keep reservations distinct from paid orders unless business rules explicitly require a linked order.

### P1 — Payment is not integrated
Checkout offers QRIS/Cash/Other but only writes the selected method and sets payment_status=PENDING. No gateway session, signed callback/webhook, reconciliation, or refund handling was found in the inspected route/migration set.

**Fix:** Keep payment status server-authoritative. Add provider adapter, signed webhook verification, idempotent payment events, reconciliation, and refund states. Do not mark paid based on browser return URLs.

### P1 — Digital receipt lookup is not capability-protected
Receipt lookup uses the sequentially structured order number query parameter and attempts to read order/customer details using the anon client. Current repository RLS does not provide the required public read policy, so this may fail; adding broad anon SELECT would expose personal data.

**Fix:** Generate a cryptographically random receipt token, store only its hash, and resolve receipt data through a narrowly scoped server endpoint. Avoid returning WhatsApp or other personal data unless necessary.

### P1 — Owner dashboard metrics mix order states
`app/otc/owner/page.tsx` and `app/otc/owner-report/page.tsx` sum all order totals without filtering by payment/fulfillment state. Pending, failed, or otherwise unconfirmed orders may therefore be presented as nominal sales. Owner selection also takes the first `business_users` row rather than offering an explicit business context when a user belongs to multiple businesses.

**Fix:** Separate order volume, gross order value, paid revenue, completed revenue, cancellations/refunds, and pending value. Resolve business scope explicitly and enforce role checks server-side.

### P2 — Delivery is third-party handoff only
The checkout collects an address and note and states that courier fulfillment is third-party. No carrier booking, tracking, pricing quote, or delivery webhook integration was found in the inspected code.

**Fix:** Treat this as a deliberate V1 boundary. Model delivery assignment and handoff status; add a carrier connector only after provider selection and commercial approval.

### P2 — Duplicate/legacy implementation and branding drift
A second `otc/` app-like tree exists alongside `app/otc/`. The active UI still displays “NORTAGO OTC” and “OCT System of Record”; `app/otc/layout.tsx` metadata is also OTC-branded.

**Fix:** Verify route/build ownership first, then update customer-facing strings and metadata to “NORTAGO Order”. Do not delete the second tree until confirmed unused.

### P2 — Existing validation coverage is TJSL-centric
The repository includes a TJSL core SQL smoke test but no dedicated NORTAGO Order integration tests were identified in the inspected tree.

**Fix:** Add automated tests for customer authorization boundaries, catalog pricing, order idempotency, atomic persistence, all fulfillment modes, receipt token access, payment webhook replay, and owner metric calculations.


## Commercial model — owner decision (2026-11-17)

NORTAGO Order is intended as an affordable subscription platform for businesses of every size, from UMKM to large enterprises.

- Monthly subscription: **Rp50,000 per month**.
- Annual subscription: **Rp500,000 per year**.
- Annual saving versus twelve monthly payments: **Rp100,000 (16.7%)**.
- Annual effective monthly equivalent: approximately **Rp41,667**.

### Product and architecture implications

- Keep the core ordering workflow broadly usable across business categories; do not hard-code the product as restaurant-only.
- Use multi-tenant business isolation, with outlet/branch, user, and role scopes.
- Design for one-outlet micro businesses and multi-outlet organizations without splitting the product into separate codebases.
- Subscription entitlement and billing must be separate from order/payment transactions.
- Do not let subscription expiry erase business data or historical orders; define graceful read-only/suspension behavior and a recovery path.
- Meter and monitor infrastructure consumption so the low subscription price remains economically viable at scale.
- Enterprise-scale capability should be achieved through scalable architecture and controlled usage/operational policies, not by promising unlimited resources at the same price.

### Commercial decisions still required

The owner has set the monthly and annual price points. The billing unit has since been confirmed as **per outlet** and is documented below. Remaining commercial decisions include transaction/payment fees, user limits, storage/retention, support scope, and fair-use thresholds; these must be settled before public launch.


## Subscription Engine and access model — owner decision (2026-11-17)

### Billing unit and price

The official billing unit is **one outlet**. A business may own multiple outlets under one business account; each billable outlet has its own subscription.

- Monthly: **Rp50,000 per outlet per month**.
- Annual: **Rp500,000 per outlet per year**.
- Annual saving per outlet versus 12 monthly payments: **Rp100,000 (16.7%)**.
- Annual effective monthly equivalent: approximately **Rp41,667 per outlet**.

Examples:
- 1 outlet: Rp50,000/month or Rp500,000/year.
- 3 outlets: Rp150,000/month or Rp1,500,000/year.
- 5 outlets: Rp250,000/month or Rp2,500,000/year.
- 10 outlets: Rp500,000/month or Rp5,000,000/year.
- 20 outlets: Rp1,000,000/month or Rp10,000,000/year.

### Tenant and outlet hierarchy

Use the following hierarchy:

`Business (tenant) -> Business Users / Roles -> Outlets -> Outlet Subscription -> Outlet Orders / Catalog availability / Fulfillment`

- A business is the tenant and owns its shared identity, billing contact, users, and outlet portfolio.
- An outlet is the independently billable service unit.
- Product master data may be shared at business level; outlet-specific availability, price overrides, operating hours, and fulfillment configuration remain outlet-scoped.
- An owner can see and manage all outlets belonging to their business, subject to role and subscription entitlements.
- A manager may be scoped to selected outlets.
- Staff/cashier accounts should be scoped to assigned outlets and only the operational actions they need.
- Cross-business access must always be denied unless a future explicit platform-operator role is introduced with audited support procedures.

### Subscription Engine data model (proposed)

1. `subscription_plans`: plan code, billing interval (MONTHLY/YEARLY), price in IDR minor units or integer rupiah, currency, entitlement definition, active dates.
2. `outlet_subscriptions`: outlet_id, plan_id, status (TRIALING/ACTIVE/PAST_DUE/SUSPENDED/CANCELED/EXPIRED), current_period_start/end, next_due_at, grace_period_end, auto_renew, created_at.
3. `subscription_invoices`: business_id, outlet_id, subscription_id, invoice_no, amount, currency, period, status (DRAFT/OPEN/PAID/FAILED/VOID/REFUNDED), due_at, paid_at.
4. `subscription_payments`: invoice_id, provider, provider_reference, amount, status, verified_at, idempotency_key; payment status is updated only by trusted server-side provider verification.
5. `subscription_events`: append-only audit trail for activation, renewal, failed payment, grace-period transition, suspension, cancellation, refund, and manual adjustment.
6. `outlet_entitlements` (or derived entitlement service): effective feature and quota state for a given outlet and period. Avoid trusting entitlement values sent by the browser.

All subscription tables must be tenant-scoped and protected by RLS. Subscription writes, invoice issuance, payment verification, and entitlement transitions must be server-controlled. Never accept a client assertion that an invoice is paid.

### Access and authorization model

- **Platform Super Admin:** cross-tenant support/operations only through explicit audited privileged access; not a default business role.
- **Business Owner:** manage business profile, all owned outlets, outlet subscriptions, billing overview, user invitations, and business-wide reporting.
- **Business Admin:** manage assigned business operations and users, but billing/payment administration may be withheld unless explicitly granted.
- **Outlet Manager:** manage assigned outlet catalog availability, orders, fulfillment, schedules, and outlet-level reports.
- **Cashier/Staff:** handle assigned outlet orders and fulfillment steps; no subscription, user-role, or business-wide financial administration by default.
- **Read-only/Analyst:** view only explicitly assigned outlet or business reports.

Authorization must check both tenant membership and outlet assignment. A role name alone is insufficient. Enforce server-side and in database policies; hide UI controls only as a secondary convenience. Use least privilege and record privileged changes in an audit log.

### Subscription lifecycle and service behavior

- A newly created outlet is not commercially active until its subscription is active or an explicitly configured trial is granted.
- Each outlet subscription has independent renewal and payment status.
- Failed renewal enters PAST_DUE and a clearly defined grace period; during grace, notify the owner and allow payment recovery.
- After grace expires, suspend new customer checkout for that outlet. Preserve owner access to billing, data export, and historical records.
- Do not delete outlet, catalog, order, or receipt history when a subscription expires or is canceled.
- Reactivation restores eligible service after verified payment; it must not duplicate invoices or payment events.
- Adding an outlet triggers a separate subscription selection and invoice for that outlet.
- Removing an outlet stops future renewal according to cancellation policy; it does not erase historical transactions or bypass any outstanding invoice.

### Pricing and commercial guardrails still to decide

The owner has confirmed the billing unit and base prices. Before public launch, define whether the price includes all listed features, user counts, order volumes, storage, support, and payment-provider fees. Establish fair-use and infrastructure safeguards that do not unexpectedly change the advertised base price. Large enterprises can subscribe for many outlets, while any bespoke SLA, integrations, or high-volume infrastructure commitments should be separately specified and approved rather than silently assumed unlimited.

### Required tests

- Business with 1, 3, 10, and 20 outlets produces the correct invoice totals.
- One outlet's expired/failed subscription does not suspend sibling outlets.
- Owner sees all business outlets; outlet manager sees only assigned outlets.
- Cashier cannot alter subscriptions, billing, roles, or cross-outlet data.
- Cross-business read/write attempts are denied.
- Duplicate payment webhooks do not double-activate or double-charge.
- Past-due, grace-period, suspension, cancellation, and reactivation preserve historical data.
- Outlet transfer, closure, and ownership changes follow audited workflows.


## Subscription Engine schema foundation — implemented in branch (2026-11-17)

A reviewable SQL migration has been added at:

`supabase/migrations/20261117_nortago_order_subscription_engine_v1.sql`

It creates:
- `subscription_plans` with monthly/yearly billing interval, IDR amount, effective dates, and JSONB entitlement metadata.
- `outlet_subscriptions` with one current subscription per outlet, independent lifecycle status, period dates, due date, grace period, and renewal flag.
- `subscription_invoices` scoped to business, outlet, and subscription.
- `subscription_payments` with provider reference, unique idempotency key, server verification timestamp, and provider payload.
- `subscription_events` as an append-oriented lifecycle audit trail.
- Tenant/outlet consistency triggers for subscription, invoice, and event records.
- RLS: active plan catalog can be read publicly; billing records can be read by OWNER/PROGRAM_MANAGER of their business; payment records and all writes have no client policies and remain server-side.

Important boundaries:
- This is a schema foundation only. It does not yet issue invoices, accept payments, renew subscriptions, calculate entitlements, suspend checkout, or expose billing APIs.
- No seed plan rows are inserted yet; commercial plan activation needs a controlled server-side provisioning flow.
- No migration has been applied to staging or production.
- The migration assumes existing `public.businesses`, `public.otc_outlets`, and `public.has_business_role(uuid,text[])` definitions from the repository.
- The current role helper is only used for OWNER/PROGRAM_MANAGER billing reads; validate actual role assignments and helper behavior in staging before enabling the UI.
- The SQL must be tested on a disposable/staging Supabase database, including trigger/RLS behavior and a cross-tenant denial matrix, before any environment is changed.


### Follow-up implementation — price catalog and schema smoke test

- The migration now seeds the two approved catalog prices: `NORTAGO_OUTLET_MONTHLY` = Rp50,000 and `NORTAGO_OUTLET_YEARLY` = Rp500,000. This is catalog metadata only; it does not issue invoices or collect payments.
- Added `supabase/tests/nortago_subscription_schema_smoke.sql`, a read-only post-migration smoke test for the approved prices, RLS on payment records, the one-current-subscription-per-outlet index, and the tenant/outlet consistency trigger.
- The smoke test has not been executed because no staging database was accessed.


### Owner subscription dashboard — read-only UI added

- Added `app/otc/owner/subscriptions/page.tsx` to show the signed-in business context, active price catalog, and per-outlet subscription status/period dates.
- Added a navigation link from the existing Owner Control Tower.
- The page performs read-only Supabase queries; it does not create or update subscriptions, invoices, or payments.
- Reads depend on the migration's RLS policies and existing `business_users` membership model. Validate with actual OWNER, PROGRAM_MANAGER, outlet-manager, and cross-business accounts in staging.
- The dashboard now loads all `business_users` memberships for the signed-in user and provides a business selector when more than one business is available. The selector scopes the read-only outlet/subscription queries to the selected business. It displays a shortened business ID because a verified business display-name field was not established. Verified owner-only billing authorization is still required before mutation actions.

### API implementation gate

The repository currently exposes only a public Supabase URL/anon-key endpoint and the inspected owner page performs client-side Supabase authentication. Before implementing subscription mutation APIs, inspect the complete auth/session model, the exact `business_users` role schema, and the deployed definition/signature of `has_business_role`. The API must validate a bearer/session token server-side and verify OWNER billing authority for the outlet's business; do not infer authorization from a client-supplied business ID or a role label. No payment gateway or invoice mutation endpoint has been added until that contract can be verified safely.

## Delivery plan

1. **Security and data integrity:** RLS review in staging, server-side pricing, atomic order RPC/API, idempotency, receipt capability token.
2. **Customer ordering:** wire catalog/outlet availability, cart validation, checkout, Take Away and Pre-Order; define Dine-In reservation model and connect it end-to-end.
3. **Payments:** provider-neutral payment interface, webhook verification, reconciliation, refunds.
4. **Fulfillment:** status machine for pickup, pre-order, third-party delivery handoff, and dine-in check-in.
5. **Owner dashboard:** scoped business/outlet access, real-time/refresh strategy, paid-vs-pending reporting, order operations.
6. **Branding and cleanup:** NORTAGO Order naming, verify/remove legacy duplicate only after build/deploy path audit.

## Validation and release gates

- Static checks: TypeScript, lint, Next.js production build.
- Database: apply migrations only to disposable/staging Supabase; verify RLS with anon, authenticated staff, owner, and cross-business users.
- Integration: successful and rejected checkout cases; concurrent/idempotent retries; item-insert failure rollback; receipt token expiry/revocation; webhook signature/replay tests.
- UAT: all fulfillment modes, mobile customer journey, outlet staff workflow, owner reports, refunds/cancellations.
- Operations: backup/restore, monitoring/alerts, secrets review, and rollback rehearsal.
- Release: review pull request and staging evidence; obtain explicit approval before merge or any production change.

## Current validation status

- Repository metadata confirms default branch `main`.
- Latest main commit inspected: `545f4953368d0e85d7573c609bf4abf96b041c80`.
- Existing Railway commit status was reported as success for that commit; this is not proof that every NORTAGO Order customer journey or database policy works.
- No live production database, payment provider, customer order, or production runtime mutation was performed during this audit.
- Build/test commands have not been executed in this GitHub-only review; they remain required validation gates.


- Subscription Engine schema foundation committed to `feature/nortago-order-audit-fix`; migration is not applied to any database.


### Follow-up implementation — business context selector

- The read-only subscription dashboard now loads the signed-in user's business memberships and offers a selector for multi-business accounts.
- Changing the selected business reloads the outlet and subscription rows under that business ID; existing RLS remains the security boundary.
- The selector uses a shortened business ID as its label. No business-name join was added because the available schema/display-name contract has not yet been verified.
- This is a UI improvement only; it does not add subscription mutation, invoice, payment, or entitlement APIs. Multi-business and cross-tenant behavior still requires staging validation.
