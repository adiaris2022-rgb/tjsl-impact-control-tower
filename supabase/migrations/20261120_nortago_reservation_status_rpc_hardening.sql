-- NORTAGO Order: harden reservation management RPC search_path and input.
create or replace function public.nortago_update_reservation_status(
  p_reservation_id uuid,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_reservation public.otc_reservations%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_status is null or p_status not in ('CONFIRMED','CANCELLED','CHECKED_IN','NO_SHOW','COMPLETED') then
    raise exception 'Unsupported reservation status';
  end if;

  select * into v_reservation
  from public.otc_reservations
  where id = p_reservation_id
  for update;

  if not found then
    raise exception 'Reservation not found';
  end if;

  if not public.has_business_role(
    v_reservation.business_id,
    array['OWNER','PROGRAM_MANAGER','PARTNER','STAFF']
  ) then
    raise exception 'Not authorized to manage this reservation';
  end if;

  if v_reservation.status in ('CANCELLED','COMPLETED','NO_SHOW') then
    raise exception 'Reservation is already closed';
  end if;

  if v_reservation.status = 'PENDING' and p_status not in ('CONFIRMED','CANCELLED') then
    raise exception 'Pending reservation can only be confirmed or cancelled';
  end if;

  if v_reservation.status = 'CONFIRMED' and p_status not in ('CANCELLED','CHECKED_IN','NO_SHOW') then
    raise exception 'Confirmed reservation has an invalid next status';
  end if;

  if v_reservation.status = 'CHECKED_IN' and p_status <> 'COMPLETED' then
    raise exception 'Checked-in reservation can only be completed';
  end if;

  update public.otc_reservations
  set status = p_status, updated_at = now()
  where id = p_reservation_id;

  return jsonb_build_object(
    'reservation_id', p_reservation_id,
    'reservation_no', v_reservation.reservation_no,
    'status', p_status
  );
end;
$$;
revoke all on function public.nortago_update_reservation_status(uuid,text) from public, anon;
grant execute on function public.nortago_update_reservation_status(uuid,text) to authenticated;
