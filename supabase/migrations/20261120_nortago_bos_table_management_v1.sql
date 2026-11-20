-- NORTAGO BOS Table Management foundation v1
-- Creates outlet-scoped table registry and guarded RPCs. Not applied to any database.

create table if not exists public.nortago_bos_tables (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  outlet_id uuid not null references public.otc_outlets(id) on delete cascade,
  table_code text not null,
  table_name text not null,
  capacity integer not null default 4 check (capacity between 1 and 50),
  zone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (outlet_id, table_code)
);
create index if not exists nortago_bos_tables_outlet_idx
  on public.nortago_bos_tables(outlet_id, is_active, table_code);
create unique index if not exists nortago_bos_tables_id_outlet_unique
  on public.nortago_bos_tables(id, outlet_id);

alter table public.nortago_bos_tables enable row level security;
-- No direct client policies: read and writes are via authorization-checked RPCs.

create or replace function public.nortago_bos_table_list(p_outlet_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if not public.nortago_outlet_has_bos(p_outlet_id) then
    raise exception 'FEATURE_REQUIRES_NORTAGO_BOS';
  end if;
  if not exists (
    select 1 from public.otc_outlets o
    where o.id=p_outlet_id and public.has_business_role(o.business_id,array['OWNER','PROGRAM_MANAGER','PARTNER','STAFF'])
  ) then
    raise exception 'Not authorized to access this outlet';
  end if;
  return coalesce((select jsonb_agg(to_jsonb(t) order by t.table_code)
    from public.nortago_bos_tables t where t.outlet_id=p_outlet_id),'[]'::jsonb);
end;
$$;
revoke all on function public.nortago_bos_table_list(uuid) from public, anon;
grant execute on function public.nortago_bos_table_list(uuid) to authenticated;

create or replace function public.nortago_bos_table_save(
  p_outlet_id uuid,
  p_table_id uuid default null,
  p_table_code text default null,
  p_table_name text default null,
  p_capacity integer default 4,
  p_zone text default null,
  p_is_active boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_outlet public.otc_outlets%rowtype;
  v_saved public.nortago_bos_tables%rowtype;
begin
  if not public.nortago_outlet_has_bos(p_outlet_id) then
    raise exception 'FEATURE_REQUIRES_NORTAGO_BOS';
  end if;
  select * into v_outlet from public.otc_outlets o
  where o.id=p_outlet_id and o.is_active=true
    and public.has_business_role(o.business_id,array['OWNER','PROGRAM_MANAGER','PARTNER','STAFF']);
  if not found then raise exception 'Outlet not found or not authorized'; end if;
  if p_table_code is null or length(trim(p_table_code)) not between 1 and 16
    or p_table_code !~ '^[A-Za-z0-9_-]+$' then
    raise exception 'Kode meja harus 1-16 karakter: huruf, angka, - atau _';
  end if;
  if p_table_name is null or length(trim(p_table_name)) not between 1 and 60 then
    raise exception 'Nama meja harus 1-60 karakter';
  end if;
  if p_capacity is null or p_capacity not between 1 and 50 then
    raise exception 'Kapasitas harus antara 1-50 orang';
  end if;
  if p_table_id is null then
    insert into public.nortago_bos_tables(business_id,outlet_id,table_code,table_name,capacity,zone,is_active)
    values(v_outlet.business_id,p_outlet_id,upper(trim(p_table_code)),trim(p_table_name),p_capacity,nullif(trim(coalesce(p_zone,'')),''),p_is_active)
    returning * into v_saved;
  else
    -- Lock the table before checking occupancy so edits cannot race seating/session changes.
    perform 1 from public.nortago_bos_tables t
      where t.id=p_table_id and t.outlet_id=p_outlet_id for update;
    if not found then raise exception 'Table not found for this outlet'; end if;
    if to_regclass('public.nortago_bos_table_sessions') is not null then
      execute 'select exists (select 1 from public.nortago_bos_table_sessions s where s.table_id=$1 and s.status=''OPEN'' and ($2=false or s.party_size>$3))'
        into v_occupied using p_table_id,p_is_active,p_capacity;
      if v_occupied then raise exception 'Cannot deactivate table or reduce capacity below an active Dine-In party'; end if;
    end if;
    if to_regclass('public.nortago_bos_queue_entries') is not null then
      execute 'select exists (select 1 from public.nortago_bos_queue_entries q where q.table_id=$1 and q.status=''SEATED'' and ($2=false or q.party_size>$3))'
        into v_occupied using p_table_id,p_is_active,p_capacity;
      if v_occupied then raise exception 'Cannot deactivate table or reduce capacity below a seated Walk-In party'; end if;
    end if;
    update public.nortago_bos_tables t
    set table_code=upper(trim(p_table_code)),table_name=trim(p_table_name),capacity=p_capacity,
        zone=nullif(trim(coalesce(p_zone,'')),''),is_active=p_is_active,updated_at=now()
    where t.id=p_table_id and t.outlet_id=p_outlet_id
    returning * into v_saved;
    if not found then raise exception 'Table not found for this outlet'; end if;
  end if;
  return to_jsonb(v_saved);
end;
$$;
revoke all on function public.nortago_bos_table_save(uuid,uuid,text,text,integer,text,boolean) from public, anon;
grant execute on function public.nortago_bos_table_save(uuid,uuid,text,text,integer,text,boolean) to authenticated;
