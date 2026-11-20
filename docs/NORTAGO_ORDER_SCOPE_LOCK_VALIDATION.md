# NORTAGO ORDER — Scope Lock & Release Gate

## Release 1 scope

NORTAGO ORDER provides a customer-facing product/menu, checkout, receipt, and order fulfillment flow. Supported order fulfillment modes for this release are:

- Takeaway
- Pre-Order (scheduled pickup in the current checkout model)
- Delivery

This release does **not** include Dine-In, Reservation, Walk-In/POS, queue management, tables/seating/capacity, operational sessions, Control Tower, or BOS. BOS is deferred until NORTAGO ORDER is live and stable.

## Server-side boundary

The scope-lock migration removes client execution privileges from reservation RPCs. Keep these assertions covered by the scope smoke test:

- Anonymous customer checkout RPC remains executable.
- Capability-token receipt RPC remains executable.
- Subscription invoice preparation remains authenticated-only.
- Reservation creation and reservation-status RPCs are not executable by anon/authenticated.
- Subscription settlement is service-role-only; no client role can execute it.
- LinkBayar webhook and payment settlement remain disabled/unactivated for release UAT.

Legacy reservation definitions may remain in the repository for compatibility; their presence is not a customer-facing feature grant. A route/UI entry must explicitly state that Reservation is unavailable in Order.

## CI scope validation

The PostgreSQL scope smoke test must run against the existing OTC schema plus the Order-only scope-lock migration and assert function privileges. CI is disposable; it is not staging evidence.

Run the repository workflow on a pull-request commit and retain exact commit SHA and workflow run URL. A historical green run must not be used to represent a different commit.

## Manual release validation (owner-approved staging only)

- [ ] Preview deployment matches the exact reviewed commit.
- [ ] Two test businesses/outlets are isolated; no production data or PII is used.
- [ ] Takeaway checkout creates an order and resolves its receipt.
- [ ] Pre-Order requires a future pickup schedule and schedule is displayed.
- [ ] Delivery address and fee wording are shown; do not offer Delivery commercially until fee and courier handoff are operationally verified.
- [ ] Owner lifecycle actions are server-validated and audit history persists.
- [ ] Tenant/outlet consistency and real RLS are tested with real staging identities.
- [ ] Subscription invoices remain pending; no payment/webhook settlement is activated.
- [ ] Excluded release surfaces are absent or blocked.

## Stop conditions

Stop and record a blocker if the current-head preview cannot be accessed, the real staging project is not owner-approved/disposable, real auth/RLS cannot be validated, a scope-excluded feature is exposed, or delivery/payment operations are not ready. CI green alone is not commercial-release approval.

No merge, production deployment, staging/live migration, secrets/environment changes, destructive operation, payment activation, or webhook enablement is authorized by this document.
