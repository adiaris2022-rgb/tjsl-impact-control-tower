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
