-- Execute and replay the candidate migration with a non-superuser CREATEROLE role.
-- SET SESSION AUTHORIZATION makes RESET ROLE inside the migration return to this executor.
\set ON_ERROR_STOP on
set session authorization nortago_order_migration_executor_ci;
\i supabase/migrations/20261124_nortago_order_dedicated_lifecycle_owner_v1.sql
reset session authorization;
