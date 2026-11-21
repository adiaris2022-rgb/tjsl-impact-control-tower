# NORTAGO ORDER — RPC-only write gate and staging UAT

## Why this gate exists

Owner Order lifecycle changes must go through `nortago_update_order_status`, which validates authentication, business membership, outlet/business consistency, fulfillment-specific status transitions, and records an audit event. Client table DML could bypass that workflow if the effective Supabase grants permit it.

PR #26 makes client table access read-only for order headers and order items:

- `PUBLIC`, `anon`, and `authenticated`: no direct INSERT, UPDATE, or DELETE on `otc_orders` or `otc_order_items`, including column-level INSERT/UPDATE privileges.
- `authenticated`: SELECT only, subject to business-scoped RLS.
- Checkout/idempotency, customer receipt, and lifecycle remain SECURITY DEFINER RPC paths; no client table mutation is required by the reviewed `app/otc` checkout, Owner Inbox, or Owner Report pages.

## Verified CI evidence for the security implementation

- Security implementation commit tested: `837d1fe8692cad816f47bffa96268a6ffdaeee62`
- CI run #208 for the security implementation commit: [SUCCESS](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44865351744)
- Exact current PR #26 head at this document update: `176814a87c38b909aa15c59c05be141e1b69c731`
- Exact-head CI run #209: [SUCCESS](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44871268859)
- Jobs: PostgreSQL migrations/security/functional smoke checks SUCCESS; install, pagination unit tests, and production build SUCCESS.
- Coverage includes PostgreSQL migration/replay, simulated broad client DML grants, RPC-only privilege checks, lifecycle and audit tests, checkout-to-receipt idempotency, tenant isolation, per-outlet subscription, pagination, and Order-only scope guards.

CI is disposable PostgreSQL evidence only. It does not verify effective privileges or RLS in the Supabase staging project.

## Preview deployment evidence and browser-UAT limitation

- PR #26 Vercel status was SUCCESS/Ready for head `176814a87c38b909aa15c59c05be141e1b69c731`; the deployment preview URL returned by Vercel is: [Preview](https://nortago-order-staging-git-fix-nortago-order-rpc-652c1f-nortago.vercel.app).
- The current web inspection tool could not open that preview URL. This is a deployment-status signal only, not browser UAT; no checkout, authentication, or receipt interaction is claimed.
- PR #14 and PR #15 preview status checks are failing with Vercel `api-deployments-free-per-day` build-rate limit. Do not infer the same failure for PR #26, whose status is Ready.

## Required staging checks — exact preview SHA

Do not run until the owner approves the disposable staging migration and recovery plan.

- [ ] Record preview commit SHA; ensure the preview URL matches the PR head being tested.
- [ ] Confirm staging is disposable, identify the project ref, and use test-only businesses, outlets, products, accounts, and orders.
- [ ] Apply the reviewed migration to staging only after approval; record result and rollback/recovery plan.
- [ ] Query effective table and column privileges for `anon` and `authenticated`; confirm direct DML is denied on both order tables.
- [ ] As authenticated Business A owner, confirm scoped SELECT still returns Business A orders/items.
- [ ] Attempt direct REST/API status update on a test order; expect denial, then confirm status and audit count remain unchanged.
- [ ] Attempt direct order INSERT and item INSERT/UPDATE/DELETE; expect denial and no mutation.
- [ ] Create an order using the customer checkout flow; confirm order and item snapshot/price/quantity/total.
- [ ] Open the returned receipt capability; confirm header and items match checkout. Retry same idempotency key/payload and confirm same order; conflicting payload must reject.
- [ ] Use Owner Inbox lifecycle action; confirm status advances only through allowed transition, audit captures actor/from/to/note, and payment status is unchanged.
- [ ] Business A cannot read/update Business B's order/audit; outlet/business mismatch is rejected.
- [ ] Monthly/yearly outlet subscription checks create pending invoices only; no settlement or webhook delivery.
- [ ] Check desktop/mobile, console errors, pagination, delivery wording/fee, and customer/owner schedule display.

### Privilege SQL to capture (no secrets)

```sql
select
  has_table_privilege('anon','public.otc_orders','select') as anon_order_select,
  has_table_privilege('authenticated','public.otc_orders','select') as auth_order_select,
  has_table_privilege('authenticated','public.otc_orders','update') as auth_order_update,
  has_any_column_privilege('authenticated','public.otc_orders','update') as auth_order_column_update,
  has_table_privilege('authenticated','public.otc_order_items','insert') as auth_item_insert,
  has_table_privilege('authenticated','public.otc_order_items','delete') as auth_item_delete,
  has_any_column_privilege('authenticated','public.otc_order_items','update') as auth_item_column_update;
```

Expected: authenticated SELECT is true; all direct DML checks are false; anon order/item SELECT is false. If any result differs, stop UAT and report a security blocker.

## Evidence record

Record UTC timestamp, exact preview SHA, staging project ref (not credentials), test role/business/outlet, test ID, expected vs actual, sanitized screenshot/log, and whether mutation was absent after denial. Never capture receipt tokens, customer phone numbers, secrets, or payment credentials.

## Remaining release gates

- STAFF authorization: business-wide vs outlet-assigned policy and owner approval.
- Audit retention: cascade-delete behavior and approved retention policy.
- Delivery: fee configuration and courier responsibility wording.
- Browser UAT/staging evidence on exact preview SHA.

No live migration, production deploy, payment activation, or webhook enablement is authorized by this document. LinkBayar remains disabled. NORTAGO ORDER only; Dine-In, Reservation, Walk-In/POS, queue, table/seating/capacity, sessions, Control Tower, and BOS are excluded.
