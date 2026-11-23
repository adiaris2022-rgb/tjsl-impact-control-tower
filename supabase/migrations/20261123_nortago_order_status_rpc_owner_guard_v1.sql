-- NORTAGO Order: defense-in-depth guard for order status mutations.
-- Only the SECURITY DEFINER lifecycle RPC owner may change otc_orders.status.
-- Client DML privileges are still revoked separately; this guard protects against
-- accidentally inherited status-column privileges and overly broad client RLS policies.
create or replace function public.nortago_order_status_rpc_owner_guard()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_rpc_owner name;
begin
  if new.status is distinct from old.status then
    select pg_catalog.pg_get_userbyid(p.proowner)
      into v_rpc_owner
    from pg_catalog.pg_proc p
    where p.oid = pg_catalog.to_regprocedure('public.nortago_update_order_status(uuid,text,text)');

    if v_rpc_owner is null or current_user is distinct from v_rpc_owner then
      raise exception 'NORTAGO_ORDER_STATUS_RPC_ONLY'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.nortago_order_status_rpc_owner_guard() from public, anon, authenticated;

drop trigger if exists otc_orders_status_rpc_owner_guard on public.otc_orders;
create trigger otc_orders_status_rpc_owner_guard
before update of status on public.otc_orders
for each row
when (old.status is distinct from new.status)
execute function public.nortago_order_status_rpc_owner_guard();
