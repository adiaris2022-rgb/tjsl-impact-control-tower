-- NORTAGO Order: seller-configurable service payment terms (FULL and/or DP).
-- DP is calculated server-side from outlet price; physical PRODUCT lines remain due in full.
-- Safe additive migration; existing orders are backfilled as FULL with full amount due.

alter table public.otc_outlet_products
  add column if not exists allow_full_payment boolean not null default true,
  add column if not exists allow_dp boolean not null default false,
  add column if not exists dp_type text not null default 'PERCENT',
  add column if not exists dp_value numeric(14,2) not null default 50;

alter table public.otc_outlet_products
  drop constraint if exists otc_outlet_products_payment_option_check,
  drop constraint if exists otc_outlet_products_dp_type_check,
  drop constraint if exists otc_outlet_products_dp_value_check;
alter table public.otc_outlet_products
  add constraint otc_outlet_products_payment_option_check check (allow_full_payment or allow_dp),
  add constraint otc_outlet_products_dp_type_check check (dp_type in ('PERCENT','FIXED')),
  add constraint otc_outlet_products_dp_value_check check (
    (dp_type = 'PERCENT' and dp_value >= 1 and dp_value <= 99)
    or (dp_type = 'FIXED' and dp_value > 0)
  );

alter table public.otc_orders
  add column if not exists payment_option text not null default 'FULL',
  add column if not exists payment_amount_due numeric(14,2) not null default 0,
  add column if not exists payment_balance_due numeric(14,2) not null default 0;
update public.otc_orders
set payment_amount_due = total,
    payment_balance_due = 0,
    payment_option = 'FULL'
where payment_amount_due = 0 and total > 0;
alter table public.otc_orders
  drop constraint if exists otc_orders_payment_option_check,
  drop constraint if exists otc_orders_payment_amounts_check;
alter table public.otc_orders
  add constraint otc_orders_payment_option_check check (payment_option in ('FULL','DP')),
  add constraint otc_orders_payment_amounts_check check (payment_amount_due >= 0 and payment_balance_due >= 0 and payment_amount_due + payment_balance_due = total);

create or replace function public.nortago_guard_service_payment_terms_owner()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public, pg_temp
as $
declare
  v_business_id uuid;
begin
  if old.allow_full_payment is distinct from new.allow_full_payment
     or old.allow_dp is distinct from new.allow_dp
     or old.dp_type is distinct from new.dp_type
     or old.dp_value is distinct from new.dp_value then
    select o.business_id into v_business_id
    from public.otc_outlets o
    join public.otc_products p on p.business_id=o.business_id
    where o.id=new.outlet_id and p.id=new.product_id and p.product_type='SERVICE';
    if not found then
      raise exception 'SERVICE_PAYMENT_TERMS_ITEM_NOT_FOUND';
    end if;
    if not public.has_business_role(v_business_id, array['OWNER','PROGRAM_MANAGER','PARTNER']::text[]) then
      raise exception 'SERVICE_PAYMENT_TERMS_FORBIDDEN';
    end if;
  end if;
  return new;
end;
$;

revoke all on function public.nortago_guard_service_payment_terms_owner() from public, anon, authenticated;
drop trigger if exists otc_outlet_products_service_payment_terms_owner_guard on public.otc_outlet_products;
create trigger otc_outlet_products_service_payment_terms_owner_guard
before update of allow_full_payment,allow_dp,dp_type,dp_value
on public.otc_outlet_products
for each row execute function public.nortago_guard_service_payment_terms_owner();

create or replace function public.nortago_update_service_payment_terms(
  p_outlet_id uuid,
  p_product_id uuid,
  p_allow_full_payment boolean,
  p_allow_dp boolean,
  p_dp_type text,
  p_dp_value numeric
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $
declare
  v_actor uuid;
  v_business_id uuid;
  v_price numeric(14,2);
begin
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'SERVICE_PAYMENT_TERMS_AUTH_REQUIRED';
  end if;
  if p_allow_full_payment is null or p_allow_dp is null
     or not (p_allow_full_payment or p_allow_dp) then
    raise exception 'SERVICE_PAYMENT_TERMS_AT_LEAST_ONE_OPTION_REQUIRED';
  end if;
  if p_dp_type is null or p_dp_type not in ('PERCENT','FIXED') then
    raise exception 'SERVICE_PAYMENT_TERMS_DP_TYPE_INVALID';
  end if;
  if p_dp_value is null or p_dp_value::text in ('NaN','Infinity','-Infinity') then
    raise exception 'SERVICE_PAYMENT_TERMS_DP_VALUE_INVALID';
  end if;

  select o.business_id, coalesce(op.price,p.base_price)
    into v_business_id, v_price
  from public.otc_outlets o
  join public.otc_outlet_products op on op.outlet_id=o.id
  join public.otc_products p on p.id=op.product_id
  where o.id=p_outlet_id
    and p.id=p_product_id
    and p.product_type='SERVICE'
  for update of op;
  if not found then
    raise exception 'SERVICE_PAYMENT_TERMS_ITEM_NOT_FOUND';
  end if;

  if not public.has_business_role(v_business_id, array['OWNER','PROGRAM_MANAGER','PARTNER']::text[]) then
    raise exception 'SERVICE_PAYMENT_TERMS_FORBIDDEN';
  end if;

  if p_allow_dp then
    if p_dp_type='PERCENT' and (p_dp_value < 1 or p_dp_value > 99) then
      raise exception 'SERVICE_PAYMENT_TERMS_PERCENT_OUT_OF_RANGE';
    end if;
    if p_dp_type='FIXED' and (p_dp_value <= 0 or p_dp_value > v_price) then
      raise exception 'SERVICE_PAYMENT_TERMS_FIXED_AMOUNT_OUT_OF_RANGE';
    end if;
  end if;

  update public.otc_outlet_products
  set allow_full_payment=p_allow_full_payment,
      allow_dp=p_allow_dp,
      dp_type=p_dp_type,
      dp_value=p_dp_value
  where outlet_id=p_outlet_id and product_id=p_product_id;

  return jsonb_build_object(
    'outlet_id',p_outlet_id,
    'product_id',p_product_id,
    'allow_full_payment',p_allow_full_payment,
    'allow_dp',p_allow_dp,
    'dp_type',p_dp_type,
    'dp_value',p_dp_value
  );
end;
$;

revoke all on function public.nortago_update_service_payment_terms(uuid,uuid,boolean,boolean,text,numeric) from public, anon, authenticated;
grant execute on function public.nortago_update_service_payment_terms(uuid,uuid,boolean,boolean,text,numeric) to authenticated;
comment on function public.nortago_update_service_payment_terms(uuid,uuid,boolean,boolean,text,numeric)
is 'Owner/partner-only, outlet-scoped service payment configuration; validates terms and updates only the selected service mapping.';

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
  p_delivery_note text default null,
  p_payment_option text default 'FULL'
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
  v_payment_due numeric(14,2);
  v_payment_balance numeric(14,2);
  v_service_count integer;
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
  if p_payment_option is null or p_payment_option not in ('FULL','DP') then
    raise exception 'SERVICE_PAYMENT_OPTION_INVALID';
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
    'payment_option', p_payment_option,
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
      'payment_option', v_existing.payment_option,
      'payment_amount_due', v_existing.payment_amount_due,
      'payment_balance_due', v_existing.payment_balance_due,
      'reused', true
    );
  end if;

  if not v_outlet.is_active then raise exception 'Outlet tidak ditemukan atau tidak aktif'; end if;

  select count(*) into v_service_count
  from jsonb_to_recordset(p_items) as item(product_id uuid, quantity integer)
  join public.otc_products p on p.id = item.product_id
  join public.otc_outlet_products op on op.product_id = p.id and op.outlet_id = p_outlet_id
  where p.business_id = v_outlet.business_id
    and p.product_type = 'SERVICE'
    and p.is_active = true
    and op.is_available = true
    and item.quantity between 1 and 99;

  if p_payment_option = 'DP' and v_service_count = 0 then
    raise exception 'SERVICE_DP_REQUIRES_SERVICE_ITEM';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_items) as item(product_id uuid, quantity integer)
    join public.otc_products p on p.id = item.product_id
    join public.otc_outlet_products op on op.product_id = p.id and op.outlet_id = p_outlet_id
    where p.business_id = v_outlet.business_id
      and p.product_type = 'SERVICE'
      and p.is_active = true
      and op.is_available = true
      and item.quantity between 1 and 99
      and case when p_payment_option = 'DP' then not op.allow_dp else not op.allow_full_payment end
  ) then
    raise exception 'SERVICE_PAYMENT_OPTION_NOT_AVAILABLE';
  end if;

  select count(*),
         coalesce(sum(coalesce(op.price, p.base_price) * item.quantity), 0)::numeric(14,2),
         coalesce(sum(
           case
             when p.product_type = 'SERVICE' and p_payment_option = 'DP' then
               case op.dp_type
                 when 'PERCENT' then (coalesce(op.price, p.base_price) * item.quantity * op.dp_value / 100)
                 when 'FIXED' then (least(coalesce(op.price, p.base_price), op.dp_value) * item.quantity)
               end
             else coalesce(op.price, p.base_price) * item.quantity
           end
         ), 0)::numeric(14,2)
    into v_count, v_subtotal, v_payment_due
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
  v_payment_balance := (v_subtotal - v_payment_due)::numeric(14,2);

  v_order_no := 'NGO-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISS') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  v_receipt_token := gen_random_uuid();

  insert into public.otc_orders (
    business_id, outlet_id, order_no, order_source, fulfillment_type, status,
    customer_name, customer_whatsapp, delivery_address, delivery_note, scheduled_at,
    subtotal, delivery_fee, discount, total, payment_method, payment_status,
    payment_option, payment_amount_due, payment_balance_due,
    receipt_access_token, checkout_idempotency_key, checkout_request_hash
  ) values (
    v_outlet.business_id, v_outlet.id, v_order_no, 'CUSTOMER_SELF_ORDER', p_fulfillment_type, 'NEW',
    trim(p_customer_name), trim(p_customer_whatsapp),
    case when p_fulfillment_type = 'DELIVERY' then p_delivery_address else null end,
    case when p_fulfillment_type = 'DELIVERY' then p_delivery_note else null end,
    p_scheduled_at, v_subtotal, 0, 0, v_subtotal, p_payment_method, 'PENDING',
    p_payment_option, v_payment_due, v_payment_balance,
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
    'payment_option', p_payment_option,
    'payment_amount_due', v_payment_due,
    'payment_balance_due', v_payment_balance,
    'reused', false
  );
end;
$$;

revoke all on function public.nortago_create_customer_order_idempotent(uuid,uuid,text,text,text,jsonb,text,timestamptz,text,text) from public, anon, authenticated;
grant execute on function public.nortago_create_customer_order_idempotent(uuid,uuid,text,text,text,jsonb,text,timestamptz,text,text) to anon, authenticated;

-- Disable the legacy client RPC so clients cannot bypass the idempotency key.
revoke all on function public.nortago_create_customer_order(uuid,text,text,text,jsonb,text,timestamptz,text,text) from public, anon, authenticated;


-- Remove the previous overload so callers cannot bypass the explicit payment option.
drop function if exists public.nortago_create_customer_order_idempotent(uuid,uuid,text,text,text,jsonb,text,timestamptz,text,text);
revoke all on function public.nortago_create_customer_order_idempotent(uuid,uuid,text,text,text,jsonb,text,timestamptz,text,text,text) from public, anon, authenticated;
grant execute on function public.nortago_create_customer_order_idempotent(uuid,uuid,text,text,text,jsonb,text,timestamptz,text,text,text) to anon, authenticated;


-- Keep customer receipt totals and remaining balance explicit for DP orders.
create or replace function public.nortago_get_customer_receipt(p_receipt_token uuid)
returns jsonb
language sql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select jsonb_build_object(
    'order', jsonb_build_object(
      'order_no', o.order_no,
      'customer_name', o.customer_name,
      'fulfillment_type', o.fulfillment_type,
      'status', o.status,
      'payment_status', o.payment_status,
      'payment_method', o.payment_method,
      'payment_option', o.payment_option,
      'payment_amount_due', o.payment_amount_due,
      'payment_balance_due', o.payment_balance_due,
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
