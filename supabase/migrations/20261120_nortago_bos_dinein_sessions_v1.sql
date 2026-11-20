-- NORTAGO BOS Dine-In Table Sessions foundation v1
-- Queue-backed and manual sessions share table locks and occupancy checks.

create table if not exists public.nortago_bos_table_sessions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  outlet_id uuid not null references public.otc_outlets(id) on delete cascade,
  table_id uuid not null,
  queue_entry_id uuid,
  request_id uuid,
  guest_name text,
  party_size integer not null check (party_size between 1 and 50),
  status text not null default 'OPEN' check (status in ('OPEN','CLOSED')),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status='OPEN' and closed_at is null) or (status='CLOSED' and closed_at is not null))
);
alter table public.nortago_bos_table_sessions add column if not exists queue_entry_id uuid;
alter table public.nortago_bos_table_sessions add column if not exists request_id uuid;
create unique index if not exists nortago_bos_table_sessions_one_open_per_table
  on public.nortago_bos_table_sessions(table_id) where status='OPEN';
create unique index if not exists nortago_bos_table_sessions_one_queue_link
  on public.nortago_bos_table_sessions(queue_entry_id) where queue_entry_id is not null;
create unique index if not exists nortago_bos_table_sessions_request_unique
  on public.nortago_bos_table_sessions(outlet_id,request_id) where request_id is not null;
create index if not exists nortago_bos_table_sessions_outlet_status_idx
  on public.nortago_bos_table_sessions(outlet_id,status,opened_at desc);
-- Composite outlet keys prevent accidental cross-outlet table/queue references.
create unique index if not exists nortago_bos_queue_entries_id_outlet_unique
  on public.nortago_bos_queue_entries(id,outlet_id);
create unique index if not exists nortago_bos_tables_id_outlet_unique
  on public.nortago_bos_tables(id,outlet_id);
alter table public.nortago_bos_table_sessions drop constraint if exists nortago_bos_table_sessions_table_id_fkey;
alter table public.nortago_bos_table_sessions drop constraint if exists nortago_bos_table_sessions_table_outlet_fkey;
alter table public.nortago_bos_table_sessions drop constraint if exists nortago_bos_table_sessions_queue_entry_outlet_fkey;
alter table public.nortago_bos_table_sessions
  add constraint nortago_bos_table_sessions_table_outlet_fkey
  foreign key (table_id,outlet_id) references public.nortago_bos_tables(id,outlet_id) on delete restrict;
alter table public.nortago_bos_table_sessions
  add constraint nortago_bos_table_sessions_queue_entry_outlet_fkey
  foreign key (queue_entry_id,outlet_id) references public.nortago_bos_queue_entries(id,outlet_id)
  on delete set null (queue_entry_id);
alter table public.nortago_bos_table_sessions enable row level security;
-- No direct client policies. Operations are through the RPCs below.

create or replace function public.nortago_bos_session_list(p_outlet_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,pg_temp
as $$
begin
  if not public.nortago_outlet_has_bos(p_outlet_id) then raise exception 'FEATURE_REQUIRES_NORTAGO_BOS'; end if;
  if not exists(select 1 from public.otc_outlets o where o.id=p_outlet_id and public.has_business_role(o.business_id,array['OWNER','PROGRAM_MANAGER','PARTNER','STAFF'])) then
    raise exception 'Not authorized to access this outlet';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'id',s.id,'table_id',s.table_id,'queue_entry_id',s.queue_entry_id,'table_code',t.table_code,'table_name',t.table_name,
    'capacity',t.capacity,'guest_name',s.guest_name,'party_size',s.party_size,
    'status',s.status,'opened_at',s.opened_at,'closed_at',s.closed_at,'note',s.note
  ) order by s.opened_at desc) from public.nortago_bos_table_sessions s
  join public.nortago_bos_tables t on t.id=s.table_id where s.outlet_id=p_outlet_id),'[]'::jsonb);
end;
$$;
revoke all on function public.nortago_bos_session_list(uuid) from public,anon;
grant execute on function public.nortago_bos_session_list(uuid) to authenticated;

create or replace function public.nortago_bos_session_open(
  p_outlet_id uuid,
  p_table_id uuid,
  p_guest_name text default null,
  p_party_size integer default 1,
  p_note text default null,
  p_queue_id uuid default null,
  p_request_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,pg_temp
as $$
declare
  v_outlet public.otc_outlets%rowtype;
  v_table public.nortago_bos_tables%rowtype;
  v_queue public.nortago_bos_queue_entries%rowtype;
  v_existing public.nortago_bos_table_sessions%rowtype;
  v_session public.nortago_bos_table_sessions%rowtype;
begin
  if not public.nortago_outlet_has_bos(p_outlet_id) then raise exception 'FEATURE_REQUIRES_NORTAGO_BOS'; end if;
  select * into v_outlet from public.otc_outlets o where o.id=p_outlet_id and o.is_active=true
    and public.has_business_role(o.business_id,array['OWNER','PROGRAM_MANAGER','PARTNER','STAFF']);
  if not found then raise exception 'Outlet not found or not authorized'; end if;
  if p_party_size is null or p_party_size not between 1 and 50 then raise exception 'Jumlah tamu harus 1-50'; end if;
  if p_guest_name is not null and length(trim(p_guest_name)) not between 2 and 120 then raise exception 'Nama tamu harus 2-120 karakter'; end if;
  if p_request_id is not null then
    select * into v_existing from public.nortago_bos_table_sessions s where s.outlet_id=p_outlet_id and s.request_id=p_request_id;
    if found then return to_jsonb(v_existing); end if;
  end if;
  -- Lock table first, matching queue seating RPC order, to serialize occupancy changes.
  select * into v_table from public.nortago_bos_tables t where t.id=p_table_id and t.outlet_id=p_outlet_id and t.is_active=true for update;
  if not found then raise exception 'Meja tidak ditemukan atau tidak aktif'; end if;
  if p_request_id is not null then
    select * into v_existing from public.nortago_bos_table_sessions s where s.outlet_id=p_outlet_id and s.request_id=p_request_id;
    if found then return to_jsonb(v_existing); end if;
  end if;
  if v_table.capacity < p_party_size then raise exception 'Kapasitas meja tidak cukup untuk jumlah tamu'; end if;
  if exists(select 1 from public.nortago_bos_table_sessions s where s.table_id=p_table_id and s.status='OPEN') then raise exception 'Meja masih memiliki sesi aktif'; end if;
  if p_queue_id is not null then
    select * into v_queue from public.nortago_bos_queue_entries q
      where q.id=p_queue_id and q.outlet_id=p_outlet_id and q.status='SEATED' and q.table_id=p_table_id for update;
    if not found then raise exception 'Antrean harus berstatus SEATED pada meja yang sama'; end if;
    if v_queue.party_size<>p_party_size then raise exception 'Jumlah tamu sesi tidak cocok dengan antrean'; end if;
    if v_queue.guest_name is not null then p_guest_name:=v_queue.guest_name; end if;
    if exists(select 1 from public.nortago_bos_table_sessions s where s.queue_entry_id=p_queue_id) then raise exception 'Antrean sudah ditautkan ke sesi Dine-In'; end if;
  else
    if exists(select 1 from public.nortago_bos_queue_entries q where q.table_id=p_table_id and q.status='SEATED') then
      raise exception 'Meja sedang digunakan oleh tamu antrean Walk-In';
    end if;
  end if;
  insert into public.nortago_bos_table_sessions(business_id,outlet_id,table_id,queue_entry_id,request_id,guest_name,party_size,note)
    values(v_outlet.business_id,p_outlet_id,p_table_id,p_queue_id,p_request_id,nullif(trim(coalesce(p_guest_name,'')),''),p_party_size,nullif(trim(coalesce(p_note,'')),''))
    on conflict (outlet_id,request_id) where request_id is not null do nothing returning * into v_session;
  if not found and p_request_id is not null then
    select * into v_session from public.nortago_bos_table_sessions where outlet_id=p_outlet_id and request_id=p_request_id;
  end if;
  if not found then raise exception 'Dine-In session creation failed'; end if;
  return to_jsonb(v_session);
end;
$$;
revoke all on function public.nortago_bos_session_open(uuid,uuid,text,integer,text,uuid,uuid) from public,anon;
grant execute on function public.nortago_bos_session_open(uuid,uuid,text,integer,text,uuid,uuid) to authenticated;

create or replace function public.nortago_bos_session_close(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,pg_temp
as $$
declare
  v_session public.nortago_bos_table_sessions%rowtype;
begin
  select * into v_session from public.nortago_bos_table_sessions s where s.id=p_session_id for update;
  if not found then raise exception 'Sesi meja tidak ditemukan'; end if;
  if not public.nortago_outlet_has_bos(v_session.outlet_id) then raise exception 'FEATURE_REQUIRES_NORTAGO_BOS'; end if;
  if not public.has_business_role(v_session.business_id,array['OWNER','PROGRAM_MANAGER','PARTNER','STAFF']) then raise exception 'Not authorized'; end if;
  if v_session.status<>'OPEN' then raise exception 'Session is already closed'; end if;
  -- Synchronize with queue seating/session opening on the same table.
  perform 1 from public.nortago_bos_tables t where t.id=v_session.table_id and t.outlet_id=v_session.outlet_id for update;
  update public.nortago_bos_table_sessions set status='CLOSED',closed_at=now(),updated_at=now() where id=p_session_id returning * into v_session;
  if v_session.queue_entry_id is not null then
    update public.nortago_bos_queue_entries set status='COMPLETED',updated_at=now()
      where id=v_session.queue_entry_id and status='SEATED';
  end if;
  return to_jsonb(v_session);
end;
$$;
revoke all on function public.nortago_bos_session_close(uuid) from public,anon;
grant execute on function public.nortago_bos_session_close(uuid) to authenticated;
