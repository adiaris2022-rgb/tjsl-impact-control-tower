-- NORTAGO Order: persistent Dine-In reservation foundation.
-- Run in staging/disposable DB first; do not apply to production without approval.

create table if not exists public.otc_reservations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  outlet_id uuid not null references public.otc_outlets(id) on delete restrict,
  reservation_no text not null unique,
  customer_name text not null,
  customer_whatsapp text not null,
  reserved_for timestamptz not null,
  party_size integer not null check (party_size between 1 and 30),
  note text,
  status text not null default 'PENDING'
    check (status in ('PENDING','CONFIRMED','CANCELLED','CHECKED_IN','NO_SHOW','COMPLETED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists otc_reservations_outlet_time_idx
  on public.otc_reservations(outlet_id, reserved_for);
create index if not exists otc_reservations_business_created_idx
  on public.otc_reservations(business_id, created_at desc);

alter table public.otc_reservations enable row level security;

drop policy if exists otc_reservations_staff_read on public.otc_reservations;
create policy otc_reservations_staff_read on public.otc_reservations
  for select to authenticated
  using (public.has_business_role(business_id, array['OWNER','PROGRAM_MANAGER','PARTNER','STAFF']));

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
  if p_customer_name is null or length(trim(p_customer_name)) < 2 or length(trim(p_customer_name)) > 120 then
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
  if p_note is not null and length(p_note) > 1000 then
    raise exception 'Catatan reservasi terlalu panjang';
  end if;

  select * into v_outlet
  from public.otc_outlets
  where id = p_outlet_id and is_active = true;
  if not found then raise exception 'Outlet tidak ditemukan atau tidak aktif'; end if;

  v_reservation_no := 'NGR-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISS') || '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  insert into public.otc_reservations (
    business_id, outlet_id, reservation_no, customer_name, customer_whatsapp,
    reserved_for, party_size, note, status
  ) values (
    v_outlet.business_id, v_outlet.id, v_reservation_no, trim(p_customer_name),
    trim(p_customer_whatsapp), p_reserved_for, p_party_size,
    nullif(trim(coalesce(p_note, '')), ''), 'PENDING'
  );

  return jsonb_build_object('reservation_no', v_reservation_no, 'status', 'PENDING');
end;
$$;

revoke all on function public.nortago_create_customer_reservation(uuid,text,text,timestamptz,integer,text) from public;
grant execute on function public.nortago_create_customer_reservation(uuid,text,text,timestamptz,integer,text) to anon, authenticated;
