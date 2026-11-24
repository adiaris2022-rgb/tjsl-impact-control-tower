# NORTAGO ORDER — Deferred reservation hard-disable decision

## Release scope

Reservation/Dine-In is deferred. The repository keeps the historical reservation migration files and database objects for forward/migration-history compatibility; they are not an Order capability.

Both customer route implementations, `app/otc/reservation/page.tsx` and the legacy `otc/app/reservation/page.tsx`, are static unavailable pages. The legacy route previously displayed a client-side reservation form and a misleading `CONFIRMED` success state without creating a server order; that interactive form has now been removed. Both routes state that Reservation, Dine-In, Walk-In, queue, and table management are outside the Order release and direct customers back to the order menu.

## Security finding

The original reservation migration creates `public.otc_reservations`, enables RLS, and adds an authenticated business-membership SELECT policy. It also creates customer-create and staff-status SECURITY DEFINER RPCs. The Order-only scope-lock migration revokes client EXECUTE on those RPCs, but it did not normalize the table's effective SQL privileges.

The connected PostgreSQL 17 project is empty for OTC application tables, but its observed postgres-creator default table ACL grants anon/authenticated/service_role `TRUNCATE`, `REFERENCES`, `TRIGGER`, and `MAINTAIN`. RLS does not block TRUNCATE. Therefore, revoking only RPC EXECUTE and relying on the RLS policy is not a complete disabled-feature boundary for a postgres-created reservation table.

## Feature-branch hardening

The new migration:

- fails closed if the reservation table or either expected RPC is missing;
- requires the migration executor to own the reservation table;
- requires RLS to remain enabled;
- revokes all table-level and column-level privileges from PUBLIC, anon, authenticated, and service_role;
- revokes EXECUTE on both reservation RPCs from those roles;
- asserts that no effective table/column privilege or RPC EXECUTE remains for API roles.

It does not drop the table, delete migration history, disable RLS, or alter any production/staging data.

## Regression evidence

Disposable PostgreSQL 17 CI applies and replays the migration, then verifies:
- no anon/authenticated/service_role SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, or MAINTAIN;
- no residual column-level privilege;
- no EXECUTE on either reservation RPC;
- actual anon/authenticated/service_role SELECT and TRUNCATE attempts fail with insufficient privilege;
- RLS remains enabled.

The reservation routes in both the main app and legacy OTC sub-app remain static unavailable pages. A Node regression test checks both source files contain no form, client-side confirmation state, or reservation RPC call. The database schema is retained but inaccessible to API roles.

## Staging limitation

The connected `NORTAGO-ORDER-STAGING` project has no OTC application tables or migration ledger. The core OTC migration references a different, inaccessible project ref. No effective grants on a populated reservation table have been observed, and no staging migration is authorized or performed.
