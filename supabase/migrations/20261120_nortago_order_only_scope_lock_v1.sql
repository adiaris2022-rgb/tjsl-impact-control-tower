-- NORTAGO Order-only release boundary.
-- Reservation is a deferred BOS feature. Keep legacy schema/function definitions
-- for forward compatibility, but remove client execution privileges in Order.
-- This migration is additive and safe to replay.

revoke all on function public.nortago_create_customer_reservation(uuid,text,text,timestamptz,integer,text)
  from public, anon, authenticated;

revoke all on function public.nortago_update_reservation_status(uuid,text)
  from public, anon, authenticated;
