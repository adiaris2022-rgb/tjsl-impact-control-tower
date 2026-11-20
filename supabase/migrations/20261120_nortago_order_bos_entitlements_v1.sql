-- NORTAGO subscription tiers and BOS-only reservation entitlement.
-- Safe to review and run in staging first. No production migration is executed here.

update public.subscription_plans
set entitlements = jsonb_build_object('tier','ORDER','features',jsonb_build_array('DIGITAL_MENU','PRODUCTS','CUSTOMER_ORDER','TAKE_AWAY','DELIVERY','PRE_ORDER','CHECKOUT','RECEIPT','ORDER_MANAGEMENT','OWNER_SALES_DASHBOARD')),
    plan_code = case plan_code
      when 'NORTAGO_OUTLET_MONTHLY' then 'NORTAGO_ORDER_MONTHLY'
      when 'NORTAGO_OUTLET_YEARLY' then 'NORTAGO_ORDER_YEARLY'
      else plan_code end
where plan_code in ('NORTAGO_OUTLET_MONTHLY','NORTAGO_OUTLET_YEARLY');

insert into public.subscription_plans
  (plan_code,billing_interval,amount_idr,currency,entitlements,is_active)
values
  ('NORTAGO_ORDER_MONTHLY','MONTHLY',50000,'IDR',jsonb_build_object('tier','ORDER','features',jsonb_build_array('DIGITAL_MENU','PRODUCTS','CUSTOMER_ORDER','TAKE_AWAY','DELIVERY','PRE_ORDER','CHECKOUT','RECEIPT','ORDER_MANAGEMENT','OWNER_SALES_DASHBOARD')),true),
  ('NORTAGO_ORDER_YEARLY','YEARLY',500000,'IDR',jsonb_build_object('tier','ORDER','features',jsonb_build_array('DIGITAL_MENU','PRODUCTS','CUSTOMER_ORDER','TAKE_AWAY','DELIVERY','PRE_ORDER','CHECKOUT','RECEIPT','ORDER_MANAGEMENT','OWNER_SALES_DASHBOARD')),true),
  ('NORTAGO_BOS_MONTHLY','MONTHLY',100000,'IDR',jsonb_build_object('tier','BOS','features',jsonb_build_array('DIGITAL_MENU','PRODUCTS','CUSTOMER_ORDER','TAKE_AWAY','DELIVERY','PRE_ORDER','CHECKOUT','RECEIPT','ORDER_MANAGEMENT','OWNER_SALES_DASHBOARD','DINE_IN','RESERVATION','WALK_IN','WAITING_QUEUE','TABLE_MANAGEMENT','SEATING','CAPACITY_CONTROL','OPERATIONAL_CONTROL_TOWER')),true),
  ('NORTAGO_BOS_YEARLY','YEARLY',1000000,'IDR',jsonb_build_object('tier','BOS','features',jsonb_build_array('DIGITAL_MENU','PRODUCTS','CUSTOMER_ORDER','TAKE_AWAY','DELIVERY','PRE_ORDER','CHECKOUT','RECEIPT','ORDER_MANAGEMENT','OWNER_SALES_DASHBOARD','DINE_IN','RESERVATION','WALK_IN','WAITING_QUEUE','TABLE_MANAGEMENT','SEATING','CAPACITY_CONTROL','OPERATIONAL_CONTROL_TOWER')),true)
on conflict (plan_code) do update
set billing_interval=excluded.billing_interval, amount_idr=excluded.amount_idr,
    currency=excluded.currency, entitlements=excluded.entitlements, is_active=excluded.is_active;

-- A central server-side entitlement gate. Only active BOS subscriptions unlock BOS.
create or replace function public.nortago_outlet_has_bos(p_outlet_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select exists (
    select 1
    from public.outlet_subscriptions s
    join public.subscription_plans p on p.id=s.plan_id
    where s.outlet_id=p_outlet_id
      and s.status='ACTIVE'
      and s.current_period_start is not null
      and s.current_period_start <= now()
      and s.current_period_end > now()
      and p.is_active=true
      and p.entitlements->>'tier'='BOS'
  );
$$;
revoke all on function public.nortago_outlet_has_bos(uuid) from public, anon, authenticated;

-- Public reservation creation is retained as a BOS feature, but is now blocked
-- for outlets without an active BOS subscription.
create or replace function public.nortago_create_customer_reservation(
  p_outlet_id uuid,
  p_customer_name text,
  p_customer_whatsapp text,
  p_reserved_for timestamptz,
  p_party_size integer,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_outlet public.otc_outlets%rowtype;
  v_reservation_no text;
begin
  if p_customer_name is null or length(trim(p_customer_name)) < 2 or length(p_customer_name) > 120 then
    raise exception 'Nama customer tidak valid';
  end if;
  if p_customer_whatsapp is null or p_customer_whatsapp !~ '^[0-9+(). -]{8,24}$' then
    raise exception 'Nomor WhatsApp tidak valid';
  end if;
  if p_reserved_for is null or p_reserved_for <= now() then
    raise exception 'Waktu reservasi harus di masa mendatang';
  end if;
  if p_party_size is null or p_party_size not between 1 and 30 then
    raise exception 'Jumlah tamu harus antara 1 sampai 30';
  end if;

  select * into v_outlet from public.otc_outlets
  where id=p_outlet_id and is_active=true;
  if not found then raise exception 'Outlet tidak ditemukan atau tidak aktif'; end if;
  if not public.nortago_outlet_has_bos(v_outlet.id) then
    raise exception 'RESERVATION_REQUIRES_NORTAGO_BOS';
  end if;

  v_reservation_no := 'NGR-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISS') || '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into public.otc_reservations (
    business_id,outlet_id,reservation_no,customer_name,customer_whatsapp,
    reserved_for,party_size,note,status
  ) values (
    v_outlet.business_id,v_outlet.id,v_reservation_no,trim(p_customer_name),
    trim(p_customer_whatsapp),p_reserved_for,p_party_size,
    nullif(trim(coalesce(p_note,'')),''),'PENDING'
  );
  return jsonb_build_object('reservation_no',v_reservation_no,'status','PENDING');
end;
$$;
revoke all on function public.nortago_create_customer_reservation(uuid,text,text,timestamptz,integer,text) from public;
grant execute on function public.nortago_create_customer_reservation(uuid,text,text,timestamptz,integer,text) to anon, authenticated;

-- Reservation lifecycle management is BOS-only even if an old deep link is used.
create or replace function public.nortago_update_reservation_status(
  p_reservation_id uuid,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $
declare
  v_reservation public.otc_reservations%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_status is null or p_status not in ('CONFIRMED','CANCELLED','CHECKED_IN','NO_SHOW','COMPLETED') then
    raise exception 'Unsupported reservation status';
  end if;
  select * into v_reservation from public.otc_reservations where id=p_reservation_id for update;
  if not found then raise exception 'Reservation not found'; end if;
  if not public.has_business_role(v_reservation.business_id,array['OWNER','PROGRAM_MANAGER','PARTNER','STAFF']) then
    raise exception 'Not authorized to manage this reservation';
  end if;
  if not public.nortago_outlet_has_bos(v_reservation.outlet_id) then
    raise exception 'RESERVATION_REQUIRES_NORTAGO_BOS';
  end if;
  if v_reservation.status in ('CANCELLED','COMPLETED','NO_SHOW') then raise exception 'Reservation is already closed'; end if;
  if v_reservation.status='PENDING' and p_status not in ('CONFIRMED','CANCELLED') then
    raise exception 'Pending reservation can only be confirmed or cancelled';
  end if;
  if v_reservation.status='CONFIRMED' and p_status not in ('CANCELLED','CHECKED_IN','NO_SHOW') then
    raise exception 'Confirmed reservation has an invalid next status';
  end if;
  if v_reservation.status='CHECKED_IN' and p_status<>'COMPLETED' then
    raise exception 'Checked-in reservation can only be completed';
  end if;
  update public.otc_reservations set status=p_status,updated_at=now() where id=p_reservation_id;
  return jsonb_build_object('reservation_id',p_reservation_id,'reservation_no',v_reservation.reservation_no,'status',p_status);
end;
$$;
revoke all on function public.nortago_update_reservation_status(uuid,text) from public, anon;
grant execute on function public.nortago_update_reservation_status(uuid,text) to authenticated;

-- Reservation records are BOS-only for authenticated outlet staff as well as writes.
-- Expose only the boolean entitlement check needed by the RLS policy to authenticated users.
grant execute on function public.nortago_outlet_has_bos(uuid) to authenticated;
drop policy if exists otc_reservations_staff_read on public.otc_reservations;
create policy otc_reservations_bos_staff_read on public.otc_reservations
  for select to authenticated
  using (
    public.has_business_role(business_id,array['OWNER','PROGRAM_MANAGER','PARTNER','STAFF'])
    and public.nortago_outlet_has_bos(outlet_id)
  );
