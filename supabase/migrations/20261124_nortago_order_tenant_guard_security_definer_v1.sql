-- NORTAGO ORDER: keep tenant consistency row locks server-side.
-- The trigger functions need FOR SHARE row locks on parent rows. SECURITY DEFINER
-- executes them as the reviewed OTC table owner, so authenticated clients do not need
-- UPDATE privilege on otc_outlets just to create/update a mapping.
-- Functions are trigger-only: no client or service-role EXECUTE is granted.

do $$
declare
  v_executor oid := (select oid from pg_roles where rolname=current_user);
begin
  if to_regclass('public.otc_outlets') is null
     or to_regclass('public.otc_products') is null
     or to_regclass('public.otc_outlet_products') is null then
    raise exception 'NORTAGO_TENANT_GUARD_REQUIRED_TABLE_MISSING';
  end if;

  if exists (
    select 1 from pg_class
    where oid in (
      'public.otc_outlets'::regclass,
      'public.otc_products'::regclass,
      'public.otc_outlet_products'::regclass
    )
      and relowner <> v_executor
  ) then
    raise exception 'NORTAGO_TENANT_GUARD_EXECUTOR_MUST_OWN_PARENT_AND_MAPPING_TABLES';
  end if;

  if exists (
    select 1 from pg_class
    where oid in (
      'public.otc_outlets'::regclass,
      'public.otc_products'::regclass,
      'public.otc_outlet_products'::regclass
    )
      and (not relrowsecurity or relforcerowsecurity)
  ) then
    raise exception 'NORTAGO_TENANT_GUARD_REQUIRES_ENABLED_NON_FORCED_RLS';
  end if;

  if exists (
    select 1 from pg_proc
    where oid in (
      to_regprocedure('public.nortago_guard_outlet_product_business_match()'),
      to_regprocedure('public.nortago_guard_product_business_reassignment()'),
      to_regprocedure('public.nortago_guard_outlet_business_reassignment()')
    )
      and proowner <> v_executor
  ) then
    raise exception 'NORTAGO_TENANT_GUARD_EXECUTOR_MUST_OWN_TRIGGER_FUNCTIONS';
  end if;
end
$$;

create or replace function public.nortago_guard_outlet_product_business_match()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
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
security definer
set search_path = pg_catalog, pg_temp
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
security definer
set search_path = pg_catalog, pg_temp
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

revoke all on function public.nortago_guard_outlet_product_business_match() from public, anon, authenticated, service_role;
revoke all on function public.nortago_guard_product_business_reassignment() from public, anon, authenticated, service_role;
revoke all on function public.nortago_guard_outlet_business_reassignment() from public, anon, authenticated, service_role;

comment on function public.nortago_guard_outlet_product_business_match()
is 'SECURITY DEFINER trigger-only guard owned by the OTC table owner; locks parent rows and rejects cross-business mappings.';
comment on function public.nortago_guard_product_business_reassignment()
is 'SECURITY DEFINER trigger-only guard owned by the OTC table owner; prevents product business reassignment from invalidating outlet mappings.';
comment on function public.nortago_guard_outlet_business_reassignment()
is 'SECURITY DEFINER trigger-only guard owned by the OTC table owner; prevents outlet business reassignment from invalidating product mappings.';
