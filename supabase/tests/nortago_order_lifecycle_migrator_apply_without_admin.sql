-- Expected-failure fixture: a trusted CREATEROLE executor without ADMIN OPTION
-- must not be able to self-grant membership in the pre-provisioned lifecycle owner.
\set ON_ERROR_STOP on
set session authorization nortago_order_migration_executor_ci;
\i supabase/migrations/20261124_nortago_order_dedicated_lifecycle_owner_v1.sql
reset session authorization;
