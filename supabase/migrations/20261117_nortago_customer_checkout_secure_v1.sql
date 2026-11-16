-- NORTAGO Order: secure public checkout and capability-based receipt access.
-- Customer clients submit product IDs and quantities only. Prices and totals are
-- calculated in PostgreSQL; order header/items are committed in one transaction.
-- Review and validate on disposable/staging Supabase before applying anywhere.

alter table public.otc_orders
  add column if not exists receipt_access_token uuid not null default gen_random_uuid();
create unique index if not exists otc_orders_receipt_access_token_uidx
  on public.otc_orders(receipt_access_token);

create or replace function public.nortago_create_customer_order(
  p_outlet_id uuid,
  p_customer_name text,
  p_customer_whatsapp text,
  p_fulfillment_type text,
  p_items jsonb,
  p_payment_method text default 'QRIS',
  p_scheduled_at timestamptz default null,
  p_delivery_address text default null,
  p_delivery_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_outlet public.otc_outlets%rowtype;
  v_order_id uuid;
  v_order_no text;
  v_receipt_token uuid;
  v_subtotal numeric(14,2);
  v_count integer;
begin
  if p_customer_name is null or length(trim(p_customer_name)) < 2 or length(p_customer_name) > 120 then
    raise exception 'Nama customer tidak valid';
  end if;
  if p_customer_whatsapp is null or p_customer_whatsapp !~ '^[0-9+(). -]{8,24}$' then
    raise exception 'Nomor WhatsApp tidak valid';
  end if;
  if p_fulfillment_type not in ('TAKE_AWAY','PRE_ORDER','DELIVERY') then
    raise exception 'Jenis fulfillment tidak didukung';
  end if;
  if p_payment_method not in ('QRIS','Cash','Other') then
    raise exception 'Metode pembayaran tidak valid';
  end if;
  if p_fulfillment_type = 'PRE_ORDER' and p_scheduled_at is null then
    raise exception 'Jadwal pre-order wajib diisi';
  end if;
  if p_fulfillment_type = 'DELIVERY' and (p_delivery_address is null or length(trim(p_delivery_address)) < 5) then
    raise exception 'Alamat delivery wajib diisi';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 50 then
    raise exception 'Daftar item tidak valid';
  end if;

  select * into v_outlet
  from public.otc_outlets
  where id = p_outlet_id and is_active = true;
  if not found then raise exception 'Outlet tidak ditemukan atau tidak aktif'; end if;

    select count(*), coalesce(sum(coalesce(op.price, p.base_price) * item.quantity), 0)::numeric(14,2)
    into v_count, v_subtotal
  from jsonb_to_recordset(p_items) as item(product_id uuid, quantity integer)
  join public.otc_products p on p.id = item.product_id
  join public.otc_outlet_products op on op.product_id = p.id and op.outlet_id = p_outlet_id
  where p.business_id = v_outlet.business_id
    and p.is_active = true
    and op.is_available = true
    and item.quantity between 1 and 99;

  if v_count = 0 or v_count <> jsonb_array_length(p_items) then
    raise exception 'Ada produk tidak tersedia atau jumlah item tidak valid';
  end if;

  v_order_no := 'NGO-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISS') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  v_receipt_token := gen_random_uuid();

  insert into public.otc_orders (
    business_id, outlet_id, order_no, order_source, fulfillment_type, status,
    customer_name, customer_whatsapp, delivery_address, delivery_note, scheduled_at,
    subtotal, delivery_fee, discount, total, payment_method, payment_status, receipt_access_token
  ) values (
    v_outlet.business_id, v_outlet.id, v_order_no, 'CUSTOMER_SELF_ORDER', p_fulfillment_type, 'NEW',
    trim(p_customer_name), trim(p_customer_whatsapp),
    case when p_fulfillment_type = 'DELIVERY' then p_delivery_address else null end,
    case when p_fulfillment_type = 'DELIVERY' then p_delivery_note else null end,
    p_scheduled_at, v_subtotal, 0, 0, v_subtotal, p_payment_method, 'PENDING', v_receipt_token
  ) returning id into v_order_id;

  insert into public.otc_order_items (
    order_id, product_id, product_name_snapshot, unit_price, quantity, line_total
  )
  select v_order_id, p.id, p.name, coalesce(op.price, p.base_price)::numeric(14,2),
         item.quantity, (coalesce(op.price, p.base_price) * item.quantity)::numeric(14,2)
  from jsonb_to_recordset(p_items) as item(product_id uuid, quantity integer)
  join public.otc_products p on p.id = item.product_id
  join public.otc_outlet_products op on op.product_id = p.id and op.outlet_id = p_outlet_id
  where p.business_id = v_outlet.business_id
    and p.is_active = true
    and op.is_available = true
    and item.quantity between 1 and 99;

  return jsonb_build_object(
    'order_no', v_order_no,
    'receipt_token', v_receipt_token,
    'subtotal', v_subtotal,
    'total', v_subtotal
  );
end;
$$;

create or replace function public.nortago_get_customer_receipt(p_receipt_token uuid)
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'order', jsonb_build_object(
      'order_no', o.order_no,
      'customer_name', o.customer_name,
      'fulfillment_type', o.fulfillment_type,
      'status', o.status,
      'payment_status', o.payment_status,
      'payment_method', o.payment_method,
      'scheduled_at', o.scheduled_at,
      'subtotal', o.subtotal,
      'delivery_fee', o.delivery_fee,
      'discount', o.discount,
      'total', o.total,
      'pickup_code', o.pickup_code,
      'created_at', o.created_at,
      'outlet_name', outlet.name
    ),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'product_name_snapshot', i.product_name_snapshot,
        'unit_price', i.unit_price,
        'quantity', i.quantity,
        'line_total', i.line_total
      ) order by i.id)
      from public.otc_order_items i where i.order_id = o.id
    ), '[]'::jsonb)
  )
  from public.otc_orders o
  join public.otc_outlets outlet on outlet.id = o.outlet_id
  where o.receipt_access_token = p_receipt_token
  limit 1;
$$;

revoke all on function public.nortago_create_customer_order(uuid,text,text,text,jsonb,text,timestamptz,text,text) from public;
revoke all on function public.nortago_get_customer_receipt(uuid) from public;
grant execute on function public.nortago_create_customer_order(uuid,text,text,text,jsonb,text,timestamptz,text,text) to anon, authenticated;
grant execute on function public.nortago_get_customer_receipt(uuid) to anon, authenticated;

-- The capability token is intentionally not exposed through table SELECT policies.
