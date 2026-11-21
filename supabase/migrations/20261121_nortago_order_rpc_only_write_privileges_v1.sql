-- NORTAGO Order: authenticated client roles are read-only for order headers/items.
-- Checkout and lifecycle mutations must go through the reviewed SECURITY DEFINER RPCs.
-- This closes the direct-table DML path that could bypass lifecycle validation/audit.
-- Idempotent; feature-branch only until review and disposable staging validation.

revoke all on table public.otc_orders from public, anon, authenticated;
revoke insert (id,business_id,outlet_id,partner_id,order_no,order_source,fulfillment_type,status,customer_name,customer_whatsapp,delivery_address,delivery_note,scheduled_at,subtotal,delivery_fee,discount,total,payment_method,payment_status,pickup_code,external_ref,created_at,updated_at,receipt_access_token,checkout_idempotency_key,checkout_request_hash)
  on table public.otc_orders from public, anon, authenticated;
revoke update (id,business_id,outlet_id,partner_id,order_no,order_source,fulfillment_type,status,customer_name,customer_whatsapp,delivery_address,delivery_note,scheduled_at,subtotal,delivery_fee,discount,total,payment_method,payment_status,pickup_code,external_ref,created_at,updated_at,receipt_access_token,checkout_idempotency_key,checkout_request_hash)
  on table public.otc_orders from public, anon, authenticated;
grant select on table public.otc_orders to authenticated;

drop policy if exists otc_orders_staff_manage on public.otc_orders;
drop policy if exists otc_orders_staff_read on public.otc_orders;
create policy otc_orders_staff_read on public.otc_orders
for select to authenticated
using (public.has_business_role(business_id, array['OWNER','PROGRAM_MANAGER','PARTNER','STAFF']::text[]));

revoke all on table public.otc_order_items from public, anon, authenticated;
revoke insert (id,order_id,product_id,product_name_snapshot,unit_price,quantity,variant_snapshot,modifier_snapshot,note,line_total)
  on table public.otc_order_items from public, anon, authenticated;
revoke update (id,order_id,product_id,product_name_snapshot,unit_price,quantity,variant_snapshot,modifier_snapshot,note,line_total)
  on table public.otc_order_items from public, anon, authenticated;
grant select on table public.otc_order_items to authenticated;

drop policy if exists otc_order_items_staff_manage on public.otc_order_items;
drop policy if exists otc_order_items_staff_read on public.otc_order_items;
create policy otc_order_items_staff_read on public.otc_order_items
for select to authenticated
using (
  exists (
    select 1 from public.otc_orders o
    where o.id = order_id
      and public.has_business_role(o.business_id, array['OWNER','PROGRAM_MANAGER','PARTNER','STAFF']::text[])
  )
);
