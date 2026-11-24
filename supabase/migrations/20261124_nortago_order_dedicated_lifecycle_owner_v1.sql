-- NORTAGO ORDER: isolate lifecycle status mutation behind a dedicated NOLOGIN owner.
-- Feature-branch candidate only. Do not apply to staging/live without explicit owner approval.
-- Preconditions are checked against the actual database catalog; unknown helper/RLS/role
-- conditions abort rather than broadening authenticated or PUBLIC privileges.

do $$
declare
  v_role_oid oid;
  v_rpc_oid oid;
  v_current_owner oid;
  v_helper pg_catalog.pg_proc%rowtype;
  v_role pg_catalog.pg_roles%rowtype;
  v_current_role pg_catalog.pg_roles%rowtype;
begin
  if to_regclass('public.otc_orders') is null
     or to_regclass('public.otc_outlets') is null
     or to_regclass('public.nortago_order_status_audit') is null then
    raise exception 'NORTAGO_LIFECYCLE_OWNER_REQUIRED_TABLE_MISSING';
  end if;

  if to_regprocedure('auth.uid()') is null then
    raise exception 'NORTAGO_LIFECYCLE_OWNER_AUTH_UID_MISSING';
  end if;

  select * into v_helper
  from pg_catalog.pg_proc
  where oid = to_regprocedure('public.has_business_role(uuid,text[])');

  if not found
     or not v_helper.prosecdef
     or coalesce(array_to_string(v_helper.proconfig, ','), '') not like '%search_path=pg_catalog%' then
    raise exception 'NORTAGO_LIFECYCLE_OWNER_UNVERIFIED_BUSINESS_ROLE_HELPER';
  end if;

  v_rpc_oid := to_regprocedure('public.nortago_update_order_status(uuid,text,text)');
  if v_rpc_oid is null then
    raise exception 'NORTAGO_LIFECYCLE_OWNER_RPC_MISSING';
  end if;

  if not exists (
    select 1 from pg_class
    where oid = 'public.otc_orders'::regclass and relrowsecurity
  ) or not exists (
    select 1 from pg_class
    where oid = 'public.otc_outlets'::regclass and relrowsecurity
  ) or not exists (
    select 1 from pg_class
    where oid = 'public.nortago_order_status_audit'::regclass and relrowsecurity
  ) then
    raise exception 'NORTAGO_LIFECYCLE_OWNER_RLS_NOT_ENABLED';
  end if;

  select * into v_current_role from pg_roles where rolname = current_user;
  if not found or (not v_current_role.rolsuper and not v_current_role.rolcreaterole) then
    raise exception 'NORTAGO_LIFECYCLE_OWNER_ROLE_CREATION_REQUIRES_PRIVILEGED_MIGRATOR';
  end if;

  select oid into v_role_oid
  from pg_roles
  where rolname = 'nortago_order_lifecycle_owner';

  if v_role_oid is null then
    execute 'create role nortago_order_lifecycle_owner nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls';
    select oid into v_role_oid from pg_roles where rolname = 'nortago_order_lifecycle_owner';
  else
    select * into v_role from pg_roles where oid = v_role_oid;
    if v_role.rolcanlogin or v_role.rolinherit or v_role.rolsuper
       or v_role.rolcreatedb or v_role.rolcreaterole
       or v_role.rolreplication or v_role.rolbypassrls then
      raise exception 'NORTAGO_LIFECYCLE_OWNER_EXISTING_ROLE_ATTRIBUTES_UNSAFE';
    end if;
  end if;

  if exists (
    select 1 from pg_auth_members
    where member = v_role_oid or roleid = v_role_oid
  ) then
    raise exception 'NORTAGO_LIFECYCLE_OWNER_ROLE_MEMBERSHIP_MUST_BE_EMPTY';
  end if;

  if exists (select 1 from pg_class where relowner = v_role_oid)
     or exists (select 1 from pg_namespace where nspowner = v_role_oid) then
    raise exception 'NORTAGO_LIFECYCLE_OWNER_MUST_NOT_OWN_TABLES_OR_SCHEMAS';
  end if;

  if exists (
    select 1 from pg_proc
    where proowner = v_role_oid and oid <> v_rpc_oid
  ) then
    raise exception 'NORTAGO_LIFECYCLE_OWNER_HAS_UNREVIEWED_FUNCTIONS';
  end if;

  select proowner into v_current_owner from pg_proc where oid = v_rpc_oid;
  if v_current_owner <> v_role_oid
     and not v_current_role.rolsuper
     and not pg_has_role(current_user, v_current_owner, 'MEMBER') then
    raise exception 'NORTAGO_LIFECYCLE_OWNER_MIGRATOR_CANNOT_TRANSFER_RPC';
  end if;
end
$$;

grant usage on schema public, auth to nortago_order_lifecycle_owner;
grant execute on function auth.uid() to nortago_order_lifecycle_owner;
grant execute on function public.has_business_role(uuid,text[]) to nortago_order_lifecycle_owner;

-- Clear any previous grants only from this dedicated role. Do not alter PUBLIC,
-- anon, authenticated, service_role, or unrelated application roles.
revoke all privileges on table public.otc_orders from nortago_order_lifecycle_owner;
revoke all privileges on table public.otc_outlets from nortago_order_lifecycle_owner;
revoke all privileges on table public.otc_order_items from nortago_order_lifecycle_owner;
revoke all privileges on table public.nortago_order_status_audit from nortago_order_lifecycle_owner;

do $$
declare
  v_col record;
begin
  for v_col in
    select attname from pg_attribute
    where attrelid = 'public.otc_orders'::regclass and attnum > 0 and not attisdropped
  loop
    execute format(
      'revoke select (%1$I), insert (%1$I), update (%1$I), references (%1$I) on table public.otc_orders from nortago_order_lifecycle_owner',
      v_col.attname
    );
  end loop;

  for v_col in
    select attname from pg_attribute
    where attrelid = 'public.otc_outlets'::regclass and attnum > 0 and not attisdropped
  loop
    execute format(
      'revoke select (%1$I), insert (%1$I), update (%1$I), references (%1$I) on table public.otc_outlets from nortago_order_lifecycle_owner',
      v_col.attname
    );
  end loop;

  for v_col in
    select attname from pg_attribute
    where attrelid = 'public.otc_order_items'::regclass and attnum > 0 and not attisdropped
  loop
    execute format(
      'revoke select (%1$I), insert (%1$I), update (%1$I), references (%1$I) on table public.otc_order_items from nortago_order_lifecycle_owner',
      v_col.attname
    );
  end loop;

  for v_col in
    select attname from pg_attribute
    where attrelid = 'public.nortago_order_status_audit'::regclass and attnum > 0 and not attisdropped
  loop
    execute format(
      'revoke select (%1$I), insert (%1$I), update (%1$I), references (%1$I) on table public.nortago_order_status_audit from nortago_order_lifecycle_owner',
      v_col.attname
    );
  end loop;
end
$$;

grant select (id, business_id, outlet_id, status, fulfillment_type)
  on table public.otc_orders to nortago_order_lifecycle_owner;
grant update (status, updated_at)
  on table public.otc_orders to nortago_order_lifecycle_owner;
grant select (id, business_id)
  on table public.otc_outlets to nortago_order_lifecycle_owner;
grant insert (order_id, business_id, outlet_id, actor_user_id, from_status, to_status, note)
  on table public.nortago_order_status_audit to nortago_order_lifecycle_owner;

drop policy if exists nortago_lifecycle_owner_orders_select on public.otc_orders;
create policy nortago_lifecycle_owner_orders_select
on public.otc_orders for select to nortago_order_lifecycle_owner
using (public.has_business_role(business_id, array['OWNER','PROGRAM_MANAGER','PARTNER','STAFF']::text[]));

drop policy if exists nortago_lifecycle_owner_orders_update on public.otc_orders;
create policy nortago_lifecycle_owner_orders_update
on public.otc_orders for update to nortago_order_lifecycle_owner
using (public.has_business_role(business_id, array['OWNER','PROGRAM_MANAGER','PARTNER','STAFF']::text[]))
with check (public.has_business_role(business_id, array['OWNER','PROGRAM_MANAGER','PARTNER','STAFF']::text[]));

drop policy if exists nortago_lifecycle_owner_outlets_select on public.otc_outlets;
create policy nortago_lifecycle_owner_outlets_select
on public.otc_outlets for select to nortago_order_lifecycle_owner
using (public.has_business_role(business_id, array['OWNER','PROGRAM_MANAGER','PARTNER','STAFF']::text[]));

drop policy if exists nortago_lifecycle_owner_audit_insert on public.nortago_order_status_audit;
create policy nortago_lifecycle_owner_audit_insert
on public.nortago_order_status_audit for insert to nortago_order_lifecycle_owner
with check (public.has_business_role(business_id, array['OWNER','PROGRAM_MANAGER','PARTNER','STAFF']::text[]));

-- The RPC only reads these five order columns. Avoid SELECT * so the function can
-- run with the exact column-level privileges granted above.
create or replace function public.nortago_update_order_status(
  p_order_id uuid,
  p_next_status text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_order_id uuid;
  v_business_id uuid;
  v_outlet_id uuid;
  v_current_status text;
  v_fulfillment_type text;
  v_actor uuid;
  v_outlet_business_id uuid;
  v_allowed boolean := false;
begin
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'NORTAGO_ORDER_AUTH_REQUIRED';
  end if;
  if p_next_status is null or p_next_status not in (
    'SCHEDULED','PROCESSING','FULFILLMENT_CHECK','FULFILLMENT_ISSUE',
    'READY','WAITING_PICKUP','PICKUP_VERIFIED','HANDED_OVER_TO_DELIVERY',
    'SUCCESS','PO_SUCCESS'
  ) then
    raise exception 'NORTAGO_ORDER_STATUS_INVALID';
  end if;
  if p_note is not null and length(p_note) > 500 then
    raise exception 'NORTAGO_ORDER_NOTE_TOO_LONG';
  end if;

  select o.id, o.business_id, o.outlet_id, o.status, o.fulfillment_type
    into v_order_id, v_business_id, v_outlet_id, v_current_status, v_fulfillment_type
  from public.otc_orders o
  where o.id = p_order_id
  for update;
  if not found then raise exception 'NORTAGO_ORDER_NOT_FOUND'; end if;

  if not public.has_business_role(v_business_id, array['OWNER','PROGRAM_MANAGER','PARTNER','STAFF']::text[]) then
    raise exception 'NORTAGO_ORDER_FORBIDDEN';
  end if;

  select o.business_id into v_outlet_business_id
  from public.otc_outlets o
  where o.id = v_outlet_id;
  if not found then raise exception 'NORTAGO_ORDER_OUTLET_NOT_FOUND'; end if;
  if v_outlet_business_id is distinct from v_business_id then
    raise exception 'NORTAGO_ORDER_OUTLET_BUSINESS_MISMATCH';
  end if;

  v_allowed := case v_current_status
    when 'NEW' then p_next_status in ('SCHEDULED','PROCESSING','FULFILLMENT_CHECK')
    when 'PAID' then p_next_status in ('SCHEDULED','PROCESSING','FULFILLMENT_CHECK')
    when 'SCHEDULED' then p_next_status in ('PROCESSING','FULFILLMENT_CHECK')
    when 'PROCESSING' then p_next_status in ('FULFILLMENT_CHECK','FULFILLMENT_ISSUE','READY')
    when 'FULFILLMENT_CHECK' then p_next_status in ('FULFILLMENT_ISSUE','READY')
    when 'FULFILLMENT_ISSUE' then p_next_status = 'PROCESSING'
    when 'READY' then case v_fulfillment_type
      when 'TAKE_AWAY' then p_next_status = 'WAITING_PICKUP'
      when 'PRE_ORDER' then p_next_status = 'WAITING_PICKUP'
      when 'DELIVERY' then p_next_status = 'HANDED_OVER_TO_DELIVERY'
      else false
    end
    when 'WAITING_PICKUP' then
      v_fulfillment_type in ('TAKE_AWAY','PRE_ORDER') and p_next_status = 'PICKUP_VERIFIED'
    when 'PICKUP_VERIFIED' then
      v_fulfillment_type in ('TAKE_AWAY','PRE_ORDER') and p_next_status = 'SUCCESS'
    when 'HANDED_OVER_TO_DELIVERY' then
      v_fulfillment_type = 'DELIVERY' and p_next_status = 'SUCCESS'
    when 'SUCCESS' then
      v_fulfillment_type = 'PRE_ORDER' and p_next_status = 'PO_SUCCESS'
    else false
  end;
  if not v_allowed then
    raise exception 'NORTAGO_ORDER_TRANSITION_INVALID: % -> % for %',
      v_current_status, p_next_status, v_fulfillment_type;
  end if;

  update public.otc_orders
  set status = p_next_status, updated_at = now()
  where id = v_order_id;

  insert into public.nortago_order_status_audit
    (order_id,business_id,outlet_id,actor_user_id,from_status,to_status,note)
  values
    (v_order_id,v_business_id,v_outlet_id,v_actor,v_current_status,p_next_status,nullif(trim(p_note),''));

  return jsonb_build_object(
    'order_id',v_order_id,
    'from_status',v_current_status,
    'to_status',p_next_status,
    'updated_at',now()
  );
end;
$$;

-- Temporarily grant CREATE only to satisfy ALTER FUNCTION ownership requirements,
-- then remove it immediately. The dedicated role never retains schema CREATE.
grant create on schema public to nortago_order_lifecycle_owner;
alter function public.nortago_update_order_status(uuid,text,text)
  owner to nortago_order_lifecycle_owner;
revoke create on schema public from nortago_order_lifecycle_owner;

revoke all on function public.nortago_update_order_status(uuid,text,text) from public, anon;
grant execute on function public.nortago_update_order_status(uuid,text,text) to authenticated;

do $$
begin
  if has_schema_privilege('nortago_order_lifecycle_owner','public','create') then
    raise exception 'NORTAGO_LIFECYCLE_OWNER_SCHEMA_CREATE_MUST_BE_REVOKED';
  end if;
  if has_table_privilege('nortago_order_lifecycle_owner','public.otc_orders','select')
     or has_table_privilege('nortago_order_lifecycle_owner','public.otc_orders','update') then
    raise exception 'NORTAGO_LIFECYCLE_OWNER_ORDER_TABLE_LEVEL_GRANTS_TOO_BROAD';
  end if;
  if has_table_privilege('nortago_order_lifecycle_owner','public.otc_order_items','select')
     or has_table_privilege('nortago_order_lifecycle_owner','public.otc_order_items','insert')
     or has_table_privilege('nortago_order_lifecycle_owner','public.otc_order_items','update')
     or has_table_privilege('nortago_order_lifecycle_owner','public.otc_order_items','delete') then
    raise exception 'NORTAGO_LIFECYCLE_OWNER_ORDER_ITEMS_PRIVILEGES_UNEXPECTED';
  end if;
  if has_column_privilege('nortago_order_lifecycle_owner','public.otc_orders','customer_name','select')
     or has_column_privilege('nortago_order_lifecycle_owner','public.otc_orders','customer_name','update')
     or has_column_privilege('nortago_order_lifecycle_owner','public.otc_orders','payment_status','update') then
    raise exception 'NORTAGO_LIFECYCLE_OWNER_UNRELATED_ORDER_COLUMN_PRIVILEGE';
  end if;
end
$$;
