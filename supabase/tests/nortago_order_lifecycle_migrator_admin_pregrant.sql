-- Disposable CI only: simulate the explicit database-owner pregrant.
-- The migration must revoke this temporary membership before it completes.
grant nortago_order_lifecycle_owner to nortago_order_migration_executor_ci
  with inherit false, set true, admin true;
