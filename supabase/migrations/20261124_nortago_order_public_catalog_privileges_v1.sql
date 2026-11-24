-- NORTAGO ORDER: explicit least-privilege grants for the public customer catalog.
-- The UI uses NEXT_PUBLIC_SUPABASE_ANON_KEY. RLS policies alone do not grant SQL
-- privileges; default ACLs differ by object creator. This migration normalizes
-- only the three catalog tables and leaves service_role/global defaults untouched.

do $$
declare
  v_executor oid := (select oid from pg_roles where rolname=current_user);
begin
  if to_regclass('public.otc_outlets') is null
     or to_regclass('public.otc_products') is null
     or to_regclass('public.otc_outlet_products') is null then
    raise exception 'NORTAGO_PUBLIC_CATALOG_REQUIRED_TABLE_MISSING';
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
    raise exception 'NORTAGO_PUBLIC_CATALOG_MIGRATOR_MUST_OWN_TABLES';
  end if;

  if not exists (select 1 from pg_roles where rolname='anon')
     or not exists (select 1 from pg_roles where rolname='authenticated')
     or not exists (select 1 from pg_roles where rolname='service_role') then
    raise exception 'NORTAGO_PUBLIC_CATALOG_SUPABASE_ROLES_MISSING';
  end if;

  if not exists (select 1 from pg_attribute where attrelid='public.otc_products'::regclass and attname='name' and not attisdropped)
     or not exists (select 1 from pg_attribute where attrelid='public.otc_products'::regclass and attname='description' and not attisdropped)
     or not exists (select 1 from pg_attribute where attrelid='public.otc_products'::regclass and attname='category' and not attisdropped)
     or not exists (select 1 from pg_attribute where attrelid='public.otc_products'::regclass and attname='image_url' and not attisdropped)
     or not exists (select 1 from pg_attribute where attrelid='public.otc_products'::regclass and attname='is_active' and not attisdropped)
     or not exists (select 1 from pg_attribute where attrelid='public.otc_outlet_products'::regclass and attname='price' and not attisdropped)
     or not exists (select 1 from pg_attribute where attrelid='public.otc_outlet_products'::regclass and attname='is_available' and not attisdropped) then
    raise exception 'NORTAGO_PUBLIC_CATALOG_REVIEWED_COLUMNS_MISSING';
  end if;
end
$$;

-- Remove creator-specific default ACL grants (including TRUNCATE/REFERENCES/TRIGGER
-- and PG17 MAINTAIN) from PUBLIC and client roles before granting only app-required access.
revoke all on table public.otc_outlets, public.otc_products, public.otc_outlet_products
  from public, anon, authenticated;

-- Table-level REVOKE does not clear prior column-level grants. Normalize every
-- existing column privilege for PUBLIC and client roles before adding the reviewed
-- Owner Catalog update allowlist. Explicit service_role grants remain untouched.
do $
declare
  v_column record;
begin
  for v_column in
    select n.nspname, c.relname, a.attname
    from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    join pg_attribute a on a.attrelid=c.oid
    where n.nspname='public'
      and c.relname = any(array['otc_outlets','otc_products','otc_outlet_products'])
      and c.relkind in ('r','p')
      and a.attnum > 0
      and not a.attisdropped
  loop
    execute format(
      'revoke all privileges (%I) on table %I.%I from public, anon, authenticated',
      v_column.attname, v_column.nspname, v_column.relname
    );
  end loop;
end
$;

-- Public customer menu and authenticated Owner catalog reads.
grant select on table public.otc_outlets, public.otc_products, public.otc_outlet_products
  to anon, authenticated;

-- Owner Catalog UI performs only these direct edits. Catalog creation and service
-- payment-term changes remain behind SECURITY DEFINER RPCs.
grant update (name, description, category, image_url, is_active)
  on table public.otc_products to authenticated;
grant update (price, is_available)
  on table public.otc_outlet_products to authenticated;

do $$
begin
  if has_table_privilege('anon','public.otc_outlets','truncate')
     or has_table_privilege('authenticated','public.otc_outlets','truncate')
     or has_table_privilege('anon','public.otc_products','truncate')
     or has_table_privilege('authenticated','public.otc_products','truncate')
     or has_table_privilege('anon','public.otc_outlet_products','truncate')
     or has_table_privilege('authenticated','public.otc_outlet_products','truncate') then
    raise exception 'NORTAGO_PUBLIC_CATALOG_CLIENT_TRUNCATE_PRIVILEGE_REMAINS';
  end if;

  if not has_table_privilege('anon','public.otc_outlets','select')
     or not has_table_privilege('authenticated','public.otc_outlets','select')
     or not has_table_privilege('anon','public.otc_products','select')
     or not has_table_privilege('authenticated','public.otc_products','select')
     or not has_table_privilege('anon','public.otc_outlet_products','select')
     or not has_table_privilege('authenticated','public.otc_outlet_products','select') then
    raise exception 'NORTAGO_PUBLIC_CATALOG_SELECT_GRANT_MISSING';
  end if;
end
$$;
