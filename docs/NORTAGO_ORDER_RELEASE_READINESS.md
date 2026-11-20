# NORTAGO ORDER — Release Readiness & UAT

## Product scope (release 1)

NORTAGO ORDER is a shareable link for product/service catalog, checkout, and order intake. Customer order modes are **Pre-Order (scheduled pickup in current checkout model), Takeaway, and Delivery**.

Excluded from this release: Dine-In, Walk-In/POS, reservations, queues, tables/seating/capacity, sessions, Control Tower, and BOS (deferred until Order is live and stable).

## CI evidence

All assertions below are from disposable PostgreSQL/Next.js CI, not a live Supabase or production system.

- PR #1, #12–#17: latest heads were refreshed; their Order CI runs were completed successfully at the time of this audit.
- PR #18 lifecycle foundation: a prior CI run (run 44754809702, commit 43eff1891943e6b8c50b33793e4de53dca59bd35) passed migration replay, lifecycle security smoke, and production build.
- Lifecycle smoke now covers allowed Takeaway, Pre-Order, and Delivery transitions; wrong fulfillment transitions; role denial; outlet/business mismatch; audit actor/note; and payment state separation.
- Checkout-to-receipt functional smoke in `nortago_subscription_schema_smoke.sql` covers server-priced checkout, malformed input rejection, receipt capability lookup, and item data in the receipt.
- Per-outlet subscription functional smoke covers monthly/yearly invoice snapshots, same-invoice reuse, per-outlet isolation, staged plan switching, pending status, and no settlement/webhook.
- Checkout tenant-isolation smoke was added to verify business A products cannot be ordered through business B's outlet (including a deliberately cross-linked outlet-product row), and rejected attempts create no orders. This new test is pending the latest CI run.

## Current blockers / gates

- **Latest CI:** must pass on the current PR #18 head before this draft is considered review-ready.
- **Preview/staging:** Vercel preview build quota has returned `build-rate-limit` on the lifecycle branch. A prior PR #20 preview status was Ready, but the preview page could not be independently opened during this audit. This is not staging UAT evidence.
- **Supabase staging:** no migration was applied during this run. The approved disposable CI database validates migration replay only.
- **Real auth/tenant UAT:** verify owner/program-manager/partner/staff role boundaries with real Supabase identities and multiple businesses/outlets.
- **Checkout UAT:** complete a real preview checkout, confirm order creation, and open the private receipt link. Test retries and wrong/expired receipt tokens.
- **Owner UAT:** verify status buttons, fulfillment-specific transitions, audit history, and refresh behavior in a deployed preview with real tenant users.
- **Subscription/payment:** invoice preparation remains pending-only in CI. LinkBayar payment collection and webhook settlement remain disabled; do not activate until provider credentials, callback validation, reconciliation, and approval are completed.
- **Delivery:** confirm operational delivery fee calculation, courier handoff, and responsibility for third-party courier costs before commercial promises.

## Release checklist

- [ ] Latest CI is green for PR #18 head.
- [ ] PR review and scope confirmation.
- [ ] Approved migration applied to disposable staging.
- [ ] Real tenant/outlet and role isolation verified.
- [ ] Checkout → order → private receipt UAT passed.
- [ ] Owner status lifecycle + audit history UAT passed.
- [ ] Monthly/yearly per-outlet subscription UAT passed without activating payment.
- [ ] Delivery pricing/handoff terms verified.
- [ ] Payment provider/webhook approved and tested, if included in release.
- [ ] Production deployment explicitly approved.

## Release decision

**NOT READY for production** until the CI, staging, real-tenant UAT, delivery, and payment gates above are resolved. This branch remains draft-only; no merge, production deployment, live migration, payment activation, or webhook enablement is performed by this checklist.
