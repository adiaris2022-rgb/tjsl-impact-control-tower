-- NORTAGO ORDER: enforce business consistency across outlet/product mappings.
-- Additive feature-branch hardening. Never repair/delete existing rows automatically.
-- The migration aborts if existing cross-business mappings require owner review.

do $$
begin
  if to_regclass('public.otc_outlets') is null
     or to_regclass('public.otc_products') is null
     or to_regclass('public.otc_outlet_products') is null then
    raise exception 'NORTAGO_OUTLET_PRODUCT_TENANT_GUARD_TABLE_MISSING';
  end if;

  if exists (
    select 1
    from public.otc_outlet_products op
    join public.otc_outlets o on o.id=op.outlet_id
    join public.otc_products p on p.id=op.product_id
    where o.business_id is distinct from p.business_id
  ) then
    raise exception 'NORTAGO_OUTLET_PRODUCT_EXISTING_CROSS_BUSINESS_MAPPING_REQUIRES_OWNER_REVIEW';
  end if;
end
$$;

create or replace function public.nortago_guard_outlet_product_business_match()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_outlet_business_id uuid;
  v_product_business_id uuid;
begin
  select o.business_id into v_outlet_business_id
  from public.otc_outlets o
  where o.id=new.outlet_id
  for share;
  if not found then
    raise exception 'NORTAGO_OUTLET_PRODUCT_OUTLET_NOT_FOUND';
  end if;

  select p.business_id into v_product_business_id
  from public.otc_products p
  where p.id=new.product_id
  for share;
  if not found then
    raise exception 'NORTAGO_OUTLET_PRODUCT_PRODUCT_NOT_FOUND';
  end if;

  if v_outlet_business_id is distinct from v_product_business_id then
    raise exception 'NORTAGO_OUTLET_PRODUCT_BUSINESS_MISMATCH';
  end if;
  return new;
end;
$$;

create or replace function public.nortago_guard_product_business_reassignment()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if new.business_id is distinct from old.business_id
     and exists (
       select 1
       from public.otc_outlet_products op
       join public.otc_outlets o on o.id=op.outlet_id
       where op.product_id=old.id
         and o.business_id is distinct from new.business_id
     ) then
    raise exception 'NORTAGO_PRODUCT_BUSINESS_CHANGE_BREAKS_OUTLET_MAPPING';
  end if;
  return new;
end;
$$;

create or replace function public.nortago_guard_outlet_business_reassignment()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if new.business_id is distinct from old.business_id
     and exists (
       select 1
       from public.otc_outlet_products op
       join public.otc_products p on p.id=op.product_id
       where op.outlet_id=old.id
         and p.business_id is distinct from new.business_id
     ) then
    raise exception 'NORTAGO_OUTLET_BUSINESS_CHANGE_BREAKS_PRODUCT_MAPPING';
  end if;
  return new;
end;
$$;

revoke all on function public.nortago_guard_outlet_product_business_match() from public, anon, authenticated;
revoke all on function public.nortago_guard_product_business_reassignment() from public, anon, authenticated;
revoke all on function public.nortago_guard_outlet_business_reassignment() from public, anon, authenticated;

drop trigger if exists otc_outlet_products_business_match_guard on public.otc_outlet_products;
create trigger otc_outlet_products_business_match_guard
before insert or update of outlet_id, product_id on public.otc_outlet_products
for each row execute function public.nortago_guard_outlet_product_business_match();

drop trigger if exists otc_products_business_reassignment_guard on public.otc_products;
create trigger otc_products_business_reassignment_guard
before update of business_id on public.otc_products
for each row execute function public.nortago_guard_product_business_reassignment();

drop trigger if exists otc_outlets_business_reassignment_guard on public.otc_outlets;
create trigger otc_outlets_business_reassignment_guard
before update of business_id on public.otc_outlets
for each row execute function public.nortago_guard_outlet_business_reassignment();

-- Defense in depth for authenticated DML. The triggers also protect service-role
-- writes and prevent future policy changes from silently creating cross-tenant links.
drop policy if exists otc_outlet_products_staff_manage on public.otc_outlet_products;
create policy otc_outlet_products_staff_manage
on public.otc_outlet_products for all to authenticated
using (
  exists (
    select 1
    from public.otc_outlets o
    join public.otc_products p on p.id=product_id and p.business_id=o.business_id
    where o.id=outlet_id
      and public.has_business_role(o.business_id, array['OWNER','PROGRAM_MANAGER','PARTNER','STAFF']::text[])
  )
)
with check (
  exists (
    select 1
    from public.otc_outlets o
    join public.otc_products p on p.id=product_id and p.business_id=o.business_id
    where o.id=outlet_id
      and public.has_business_role(o.business_id, array['OWNER','PROGRAM_MANAGER','PARTNER','STAFF']::text[])
  )
);

-- Recheck after installing guards to catch any writer that raced the initial
-- preflight. No rows are deleted or repaired automatically.
do $
begin
  if exists (
    select 1
    from public.otc_outlet_products op
    join public.otc_outlets o on o.id=op.outlet_id
    join public.otc_products p on p.id=op.product_id
    where o.business_id is distinct from p.business_id
  ) then
    raise exception 'NORTAGO_OUTLET_PRODUCT_CROSS_BUSINESS_MAPPING_FOUND_AFTER_GUARD_INSTALL';
  end if;
end
$;

comment on function public.nortago_guard_outlet_product_business_match()
is 'Rejects outlet/product mappings unless both records belong to the same business.';
comment on function public.nortago_guard_product_business_reassignment()
is 'Prevents product business reassignment from invalidating existing outlet mappings.';
comment on function public.nortago_guard_outlet_business_reassignment()
is 'Prevents outlet business reassignment from invalidating existing product mappings.';
