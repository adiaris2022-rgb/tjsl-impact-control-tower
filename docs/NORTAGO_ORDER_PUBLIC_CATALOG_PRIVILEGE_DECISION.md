# NORTAGO ORDER — Public catalog privilege decision

## Evidence observed in connected Supabase project

Read-only catalog inspection of connected project `NORTAGO-ORDER-STAGING` (`aakhinaryzidzpsjeewp`, PostgreSQL 17.12) returned:

- `current_user=postgres`, `session_user=postgres`.
- No OTC application tables or app migration ledger exist in this project, so these are default-ACL findings, not effective grants on `otc_outlets`, `otc_products`, or `otc_outlet_products`.
- For objects created by role `postgres` in schema public, default table ACL grants `TRUNCATE`, `REFERENCES`, and `TRIGGER` to `anon`, `authenticated`, and `service_role` (PostgreSQL 17 additionally reports `MAINTAIN`). It does not grant SELECT/INSERT/UPDATE/DELETE.
- For objects created by `supabase_admin`, the public-schema default ACL is broader: table DML/DDL privileges and function EXECUTE are granted to client roles. The effect depends on the actual object creator; do not assume the migration runner role.
- No role membership was found for anon, authenticated, or service_role in the connected project.

## Source-level application evidence

- `app/api/supabase-config/route.ts` returns `NEXT_PUBLIC_SUPABASE_ANON_KEY` to the browser.
- `app/otc/customer-order/page.tsx` uses that client to read `otc_outlets`, `otc_outlet_products`, and joined `otc_products`.
- `app/otc/checkout/page.tsx` reads `otc_outlets` with the anon client.
- `app/otc/owner/catalog/page.tsx` uses the authenticated client to update `otc_products.name/description/category/image_url/is_active` and `otc_outlet_products.price/is_available`. Catalog creation and service DP/full-payment changes use RPCs.
- The original `20260928_otc_commerce_core_v1.sql` creates public-read and staff-manage RLS policies for these tables but contains no explicit table grants. The tenant-guard CI smoke previously granted SELECT/UPDATE directly in the test fixture, which masked the migration's missing grant contract.

## Feature-branch correction

This PR adds two migrations:

1. `20261124_nortago_order_tenant_guard_security_definer_v1.sql` makes the three tenant-consistency trigger functions SECURITY DEFINER under the reviewed OTC table owner, with fixed search_path (pg_catalog, pg_temp) and no client/service EXECUTE. The functions retain `FOR SHARE` row locks without requiring clients to receive UPDATE on `otc_outlets` merely to create/update a mapping. They are trigger-only and do not return cross-tenant data.
2. `20261124_nortago_order_public_catalog_privileges_v1.sql` revokes all PUBLIC/anon/authenticated privileges from the three catalog tables, then grants only:
   - SELECT to anon and authenticated on outlets, products, and outlet-product mappings.
   - UPDATE on product name, description, category, image_url, is_active to authenticated.
   - UPDATE on outlet-product price and is_available to authenticated.
   - No client INSERT/DELETE/TRUNCATE/REFERENCES/TRIGGER/MAINTAIN; no authenticated outlet UPDATE; no product business_id/base_price or mapping-key/payment-term UPDATE.

The migration leaves explicit service_role grants and all global default ACLs untouched. Any column privilege inherited only through PUBLIC is intentionally removed with the PUBLIC grant. It checks table ownership and required columns before changing grants. The existing RLS policies remain in force, so the grants do not bypass business-membership predicates.

CI now simulates the observed postgres creator default ACL before creating OTC tables, proves those grants reached the new tables, applies the migrations, and verifies the final effective table/column privileges. The tenant-guard smoke now uses actual anon/authenticated roles for public reads and allowed Owner Catalog updates, while privileged server-side writes still exercise cross-business trigger rejection.

## Release gate / limitation

This is disposable PostgreSQL CI evidence only. The connected Supabase project still has no OTC tables or migration history, and the OTC core migration comment references inaccessible project ref `tdpupelhvzxwhbqnnlxk`. No staging/live migration or ACL change was performed. Identify the populated staging target and verify its real migration executor/default ACL/effective grants before applying anything.


The two migrations require the applying principal to own the three OTC catalog tables; the tenant-guard migration also requires RLS enabled but not FORCE RLS so the table-owner SECURITY DEFINER guard can take the reviewed row locks and inspect all linked rows. A superuser who is not the table owner is not silently accepted. If the actual staging owner differs, stop and obtain an owner-approved migration principal rather than changing ownership or broadening grants.


## Additional ACL regression hardening

The PostgreSQL CI service now uses major version 17 to match the connected Supabase project. The baseline fixture models the observed MAINTAIN default privilege and deliberately seeds stale column-level UPDATE/INSERT/REFERENCES grants before the catalog migration. The migration explicitly revokes all column-level privileges from PUBLIC, anon, and authenticated on the three catalog tables before restoring only the approved Owner Catalog update columns. Regression checks verify no stale client column grants survive and that direct service_role default grants remain intact.
