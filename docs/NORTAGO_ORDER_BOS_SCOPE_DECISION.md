# NORTAGO Order & NORTAGO BOS — Scope and Entitlement Decision

Status: Product decision locked for the next implementation stage.

## NORTAGO Order
**Price:** Rp50,000/outlet/month or Rp500,000/outlet/year.

Order is the digital ordering and sales product. The customer and owner surfaces must not present or enable Dine-In, Table reservation/booking, Walk-In staff order entry, waiting list/queue management, or table/seating/capacity management.

Order supports the existing customer self-order flows:
- Take Away
- Delivery
- Pre-Order scheduling

Owner dashboard in Order is limited to order/sales metrics, outlets, and Order subscription management. Reservation data, reservation actions, and reservation entry points are excluded from Order surfaces.

## NORTAGO BOS
**Price:** Rp100,000/outlet/month or Rp1,000,000/outlet/year.

BOS includes all Order features plus:
- Dine-In
- Reservation
- Walk-In
- Waiting list and queue
- Table availability and management
- Seating and capacity control
- Reservation schedule and guest visit status
- Expanded operational control tower

## Architecture rules
1. One shared platform/data core; separate products by plan entitlement, not deployments.
2. Protected features must be checked server-side for protected actions/RPCs. UI hiding alone is not security.
3. Subscription plan is assigned per outlet. A business may have outlets on different plans.
4. Annual plans are prepaid at Rp500,000 for Order and Rp1,000,000 for BOS; equivalent to 10 monthly payments for 12 months.
5. Upgrade Order → BOS is an entitlement change, not data migration. Proposed difference is +Rp50,000/month or +Rp500,000/year per outlet; proration/billing-cycle policy remains to be defined.
6. Pre-Order is a scheduling attribute/flow, not a fulfillment capability like Dine-In. Current UI may keep it as an explicit schedule option while the data model is reviewed.
7. Legacy reservation routes/database objects may remain during transition but must not be advertised, linked, or exposed as usable NORTAGO Order features. Server-side BOS entitlement enforcement is a release gate before commercially enabling BOS modules.

## Release checklist
- [x] Order customer flow offers only Take Away, Pre-Order, Delivery.
- [x] Order owner dashboard is limited to Order/sales summary; reservation panel and entry link removed.
- [ ] Server-side entitlement policy and RPC enforcement for BOS modules.
- [ ] Subscription UI explicitly displays Order vs BOS and per-outlet plan.
- [ ] BOS Dine-In/Reservation/Walk-In end-to-end validation, capacity, collision prevention, and permissions.
- [ ] Staging UAT before merge/deployment.
