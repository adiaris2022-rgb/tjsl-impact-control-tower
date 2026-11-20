-- NORTAGO Order: customer checkout idempotency.
-- Repeated submissions with the same key and identical request return the same order.
-- Reusing a key for different payloads is rejected. Safe to replay.

alter table public.otc_orders
  add column if not exists checkout_idempotency_key uuid,
  add column if not exists checkout_request_hash text;

create unique index if not exists otc_orders_checkout_idempotency_key_uidx
  on public.otc_orders(checkout_idempotency_key)
  where checkout_idempotency_key is not null;

create or replace function public.nortago_create_customer_order_idempotent(
  p_outlet_id uuid,
  p_idempotency_key uuid,
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
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_outlet public.otc_outlets%rowtype;
  v_existing public.otc_orders%rowtype;
  v_order_id uuid;
  v_order_no text;
  v_receipt_token uuid;
  v_request_hash text;
  v_subtotal numeric(14,2);
  v_count integer;
begin
  if p_idempotency_key is null then
    raise exception 'CHECKOUT_IDEMPOTENCY_KEY_REQUIRED';
  end if;
  if p_customer_name is null or length(trim(p_customer_name)) < 2 or length(trim(p_customer_name)) > 120 then
    raise exception 'Nama customer tidak valid';
  end if;
  if p_customer_whatsapp is null or p_customer_whatsapp !~ '^[0-9+(). -]{8,24}$' then
    raise exception 'Nomor WhatsApp tidak valid';
  end if;
  if p_fulfillment_type is null or p_fulfillment_type not in ('TAKE_AWAY','PRE_ORDER','DELIVERY') then
    raise exception 'Jenis fulfillment tidak didukung';
  end if;
  if p_payment_method is null or p_payment_method not in ('QRIS','Cash','Other') then
    raise exception 'Metode pembayaran tidak valid';
  end if;
  if p_fulfillment_type = 'PRE_ORDER' and (p_scheduled_at is null or p_scheduled_at <= now()) then
    raise exception 'Jadwal pre-order harus di masa mendatang';
  end if;
  if p_fulfillment_type = 'DELIVERY' and (p_delivery_address is null or length(trim(p_delivery_address)) < 5 or length(trim(p_delivery_address)) > 500) then
    raise exception 'Alamat delivery tidak valid';
  end if;
  if p_delivery_note is not null and length(p_delivery_note) > 500 then
    raise exception 'Catatan delivery terlalu panjang';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 50 then
    raise exception 'Daftar item tidak valid';
  end if;

  v_request_hash := encode(digest(jsonb_build_object(
    'outlet_id', p_outlet_id,
    'customer_name', trim(p_customer_name),
    'customer_whatsapp', trim(p_customer_whatsapp),
    'fulfillment_type', p_fulfillment_type,
    'items', p_items,
    'payment_method', p_payment_method,
    'scheduled_at', p_scheduled_at,
    'delivery_address', p_delivery_address,
    'delivery_note', p_delivery_note
  )::text, 'sha256'), 'hex');

  select * into v_outlet
  from public.otc_outlets
  where id = p_outlet_id;
  if not found then raise exception 'Outlet tidak ditemukan'; end if;

  -- Serialize requests using the same key before looking for a prior order.
  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text, 0));
  select * into v_existing
  from public.otc_orders
  where checkout_idempotency_key = p_idempotency_key;
  if found then
    if v_existing.outlet_id <> p_outlet_id
      or v_existing.checkout_request_hash is distinct from v_request_hash then
      raise exception 'CHECKOUT_IDEMPOTENCY_CONFLICT';
    end if;
    return jsonb_build_object(
      'order_no', v_existing.order_no,
      'receipt_token', v_existing.receipt_access_token,
      'subtotal', v_existing.subtotal,
      'total', v_existing.total,
      'reused', true
    );
  end if;

  if not v_outlet.is_active then raise exception 'Outlet tidak ditemukan atau tidak aktif'; end if;

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
    subtotal, delivery_fee, discount, total, payment_method, payment_status,
    receipt_access_token, checkout_idempotency_key, checkout_request_hash
  ) values (
    v_outlet.business_id, v_outlet.id, v_order_no, 'CUSTOMER_SELF_ORDER', p_fulfillment_type, 'NEW',
    trim(p_customer_name), trim(p_customer_whatsapp),
    case when p_fulfillment_type = 'DELIVERY' then p_delivery_address else null end,
    case when p_fulfillment_type = 'DELIVERY' then p_delivery_note else null end,
    p_scheduled_at, v_subtotal, 0, 0, v_subtotal, p_payment_method, 'PENDING',
    v_receipt_token, p_idempotency_key, v_request_hash
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
    'total', v_subtotal,
    'reused', false
  );
end;
$$;

revoke all on function public.nortago_create_customer_order_idempotent(uuid,uuid,text,text,text,jsonb,text,timestamptz,text,text) from public, anon, authenticated;
grant execute on function public.nortago_create_customer_order_idempotent(uuid,uuid,text,text,text,jsonb,text,timestamptz,text,text) to anon, authenticated;

-- Disable the legacy client RPC so clients cannot bypass the idempotency key.
revoke all on function public.nortago_create_customer_order(uuid,text,text,text,jsonb,text,timestamptz,text,text) from public, anon, authenticated;
