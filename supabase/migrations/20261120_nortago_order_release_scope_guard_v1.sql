-- NORTAGO Order-only release guard.
-- Prevent Dine-In and Walk-In order records from being created/modified in Order.
-- Reservation RPCs are separately revoked by the Order-only scope lock migration.

create or replace function public.nortago_order_only_scope_guard()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if new.fulfillment_type = 'DINE_IN' then
    raise exception 'ORDER_ONLY_DINE_IN_DISABLED';
  end if;
  if new.order_source = 'STAFF_WALK_IN' then
    raise exception 'ORDER_ONLY_WALK_IN_DISABLED';
  end if;
  return new;
end;
$$;

revoke all on function public.nortago_order_only_scope_guard() from public, anon, authenticated;

drop trigger if exists otc_orders_order_only_scope_guard on public.otc_orders;
create trigger otc_orders_order_only_scope_guard
before insert or update of order_source, fulfillment_type
on public.otc_orders
for each row execute function public.nortago_order_only_scope_guard();
