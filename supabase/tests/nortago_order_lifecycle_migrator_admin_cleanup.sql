-- Disposable CI only: the same database-owner grantor that issued ADMIN OPTION
-- revokes its own temporary membership after the migration executor transfers the RPC.
revoke nortago_order_lifecycle_owner from nortago_order_migration_executor_ci;
