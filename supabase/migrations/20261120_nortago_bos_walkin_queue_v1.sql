-- NORTAGO BOS Walk-In and Queue foundation v1
-- Outlet-scoped queue operations protected by BOS entitlement and staff roles.

create table if not exists public.nortago_bos_queue_counters (
  outlet_id uuid not null references public.otc_outlets(id) on delete cascade,
  queue_date date not null,
  last_number integer not null check (last_number > 0),
  primary key (outlet_id, queue_date)
);
create table if not exists public.nortago_bos_queue_entries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  outlet_id uuid not null references public.otc_outlets(id) on delete cascade,
  queue_no text not null,
  guest_name text not null,
  party_size integer not null check (party_size between 1 and 50),
  status text not null default 'WAITING' check (status in ('WAITING','CALLED','SEATED','CANCELLED','COMPLETED')),
  table_id uuid references public.nortago_bos_tables(id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(outlet_id, queue_no)
);
create index if not exists nortago_bos_queue_outlet_created_idx
  on public.nortago_bos_queue_entries(outlet_id, created_at desc);
alter table public.nortago_bos_queue_entries enable row level security;
alter table public.nortago_bos_queue_counters enable row level security;
-- No direct policies: queue reads/writes are RPC-only.

create or replace function public.nortago_bos_queue_list(p_outlet_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if not public.nortago_outlet_has_bos(p_outlet_id) then raise exception 'FEATURE_REQUIRES_NORTAGO_BOS'; end if;
  if not exists (select 1 from public.otc_outlets o where o.id=p_outlet_id and public.has_business_role(o.business_id,array['OWNER','PROGRAM_MANAGER','PARTNER','STAFF'])) then
    raise exception 'Not authorized to access this outlet';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'id',q.id,'queue_no',q.queue_no,'guest_name',q.guest_name,'party_size',q.party_size,
    'status',q.status,'table_id',q.table_id,'table_name',t.table_name,'note',q.note,
    'created_at',q.created_at,'updated_at',q.updated_at) order by q.created_at asc)
    from public.nortago_bos_queue_entries q left join public.nortago_bos_tables t on t.id=q.table_id
    where q.outlet_id=p_outlet_id and q.created_at >= date_trunc('day',now())), '[]'::jsonb);
end;
$$;
revoke all on function public.nortago_bos_queue_list(uuid) from public, anon;
grant execute on function public.nortago_bos_queue_list(uuid) to authenticated;

create or replace function public.nortago_bos_queue_add(
  p_outlet_id uuid,
  p_guest_name text,
  p_party_size integer,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_outlet public.otc_outlets%rowtype;
  v_day date := current_date;
  v_num integer;
  v_queue_no text;
  v_entry public.nortago_bos_queue_entries%rowtype;
begin
  if not public.nortago_outlet_has_bos(p_outlet_id) then raise exception 'FEATURE_REQUIRES_NORTAGO_BOS'; end if;
  select * into v_outlet from public.otc_outlets o where o.id=p_outlet_id and o.is_active=true
    and public.has_business_role(o.business_id,array['OWNER','PROGRAM_MANAGER','PARTNER','STAFF']);
  if not found then raise exception 'Outlet not found or not authorized'; end if;
  if p_guest_name is null or length(trim(p_guest_name)) not between 2 and 120 then raise exception 'Nama tamu harus 2-120 karakter'; end if;
  if p_party_size is null or p_party_size not between 1 and 50 then raise exception 'Jumlah tamu harus 1-50 orang'; end if;
  insert into public.nortago_bos_queue_counters(outlet_id,queue_date,last_number) values(p_outlet_id,v_day,1)
    on conflict(outlet_id,queue_date) do update set last_number=public.nortago_bos_queue_counters.last_number+1
    returning last_number into v_num;
  v_queue_no := 'W-' || to_char(v_day,'YYYYMMDD') || '-' || lpad(v_num::text,4,'0');
  insert into public.nortago_bos_queue_entries(business_id,outlet_id,queue_no,guest_name,party_size,note)
  values(v_outlet.business_id,p_outlet_id,v_queue_no,trim(p_guest_name),p_party_size,nullif(trim(coalesce(p_note,'')),''))
  returning * into v_entry;
  return to_jsonb(v_entry);
end;
$$;
revoke all on function public.nortago_bos_queue_add(uuid,text,integer,text) from public, anon;
grant execute on function public.nortago_bos_queue_add(uuid,text,integer,text) to authenticated;

create or replace function public.nortago_bos_queue_update(
  p_queue_id uuid,
  p_status text,
  p_table_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_entry public.nortago_bos_queue_entries%rowtype;
begin
  select * into v_entry from public.nortago_bos_queue_entries q where q.id=p_queue_id for update;
  if not found then raise exception 'Queue entry not found'; end if;
  if not public.nortago_outlet_has_bos(v_entry.outlet_id) then raise exception 'FEATURE_REQUIRES_NORTAGO_BOS'; end if;
  if not public.has_business_role(v_entry.business_id,array['OWNER','PROGRAM_MANAGER','PARTNER','STAFF']) then raise exception 'Not authorized'; end if;
  if p_status not in ('CALLED','SEATED','CANCELLED','COMPLETED') then raise exception 'Unsupported queue status'; end if;
  if (v_entry.status='WAITING' and p_status not in ('CALLED','CANCELLED'))
    or (v_entry.status='CALLED' and p_status not in ('SEATED','CANCELLED'))
    or (v_entry.status='SEATED' and p_status<>'COMPLETED') then raise exception 'Invalid queue status transition'; end if;
  if p_status='SEATED' then
    if p_table_id is null then raise exception 'Select a table before seating guest'; end if;
    if not exists (select 1 from public.nortago_bos_tables t where t.id=p_table_id and t.outlet_id=v_entry.outlet_id and t.is_active=true) then raise exception 'Table not found or inactive for this outlet'; end if;
    if exists (select 1 from public.nortago_bos_queue_entries q where q.table_id=p_table_id and q.status='SEATED' and q.id<>v_entry.id) then raise exception 'Table already assigned to another seated queue'; end if;
  end if;
  update public.nortago_bos_queue_entries set status=p_status,table_id=case when p_status='SEATED' then p_table_id else table_id end,updated_at=now()
    where id=p_queue_id returning * into v_entry;
  return to_jsonb(v_entry);
end;
$$;
revoke all on function public.nortago_bos_queue_update(uuid,text,uuid) from public, anon;
grant execute on function public.nortago_bos_queue_update(uuid,text,uuid) to authenticated;
