-- Defense-in-depth: even inherited column UPDATE privileges plus an UPDATE
-- policy must not allow a client to bypass the lifecycle RPC. Fixtures roll back.
begin;

grant update (status) on table public.otc_orders to nortago_order_status_writer_ci;
grant nortago_order_status_writer_ci to authenticated;

insert into public.businesses(id)
values ('10000000-0000-4000-8000-000000000033');
insert into public.otc_outlets(id,business_id,name)
values ('20000000-0000-4000-8000-000000000033',
        '10000000-0000-4000-8000-000000000033',
        'Inherited status guard fixture');
insert into public.business_users(business_id,user_id,role)
values ('10000000-0000-4000-8000-000000000033',
        '00000000-0000-0000-0000-000000000001',
        'OWNER');
insert into public.otc_orders(id,business_id,outlet_id,order_no,order_source,fulfillment_type,status,payment_status)
values ('30000000-0000-4000-8000-000000000033',
        '10000000-0000-4000-8000-000000000033',
        '20000000-0000-4000-8000-000000000033',
        'STATUS-OWNER-GUARD-CI',
        'CUSTOMER_SELF_ORDER','TAKE_AWAY','NEW','PENDING');

-- Temporarily model a narrow UPDATE policy so the trigger is tested independently
-- of the RPC-only RLS/privilege restriction. This policy is rollback-only.
drop policy if exists nortago_ci_status_update on public.otc_orders;
create policy nortago_ci_status_update on public.otc_orders
for update to authenticated
using (id = '30000000-0000-4000-8000-000000000033')
with check (id = '30000000-0000-4000-8000-000000000033');

do $$
declare
  v_rpc_owner name;
begin
  if not has_any_column_privilege('authenticated','public.otc_orders','update') then
    raise exception 'CI fixture must prove inherited status-column UPDATE privilege';
  end if;
  if has_table_privilege('authenticated','public.otc_orders','update') then
    raise exception 'CI fixture should not grant table-level UPDATE';
  end if;
  select pg_catalog.pg_get_userbyid(proowner) into v_rpc_owner
    from pg_catalog.pg_proc
    where oid = pg_catalog.to_regprocedure('public.nortago_update_order_status(uuid,text,text)');
  if v_rpc_owner is null or v_rpc_owner in ('anon','authenticated') then
    raise exception 'Lifecycle RPC must have a trusted non-client owner';
  end if;
end $$;

set local role authenticated;
do $$
declare
  v_error text;
  v_count integer;
begin
  begin
    update public.otc_orders
      set status='PROCESSING', updated_at=now()
    where id='30000000-0000-4000-8000-000000000033';
    raise exception 'Direct status write unexpectedly succeeded';
  exception when insufficient_privilege then
    v_error := sqlerrm;
    if v_error not like '%NORTAGO_ORDER_STATUS_RPC_ONLY%' then
      raise exception 'Expected RPC-only trigger denial, got: %',v_error;
    end if;
  end;

  if (select status from public.otc_orders where id='30000000-0000-4000-8000-000000000033') <> 'NEW' then
    raise exception 'Rejected direct status update changed the order';
  end if;
  select count(*) into v_count from public.nortago_order_status_audit
    where order_id='30000000-0000-4000-8000-000000000033';
  if v_count <> 0 then
    raise exception 'Rejected direct status update must not create audit';
  end if;

  perform public.nortago_update_order_status(
    '30000000-0000-4000-8000-000000000033',
    'PROCESSING',
    'owner-guard CI');
  if (select status from public.otc_orders where id='30000000-0000-4000-8000-000000000033') <> 'PROCESSING' then
    raise exception 'Approved lifecycle RPC should update status under owner guard';
  end if;
  select count(*) into v_count from public.nortago_order_status_audit
    where order_id='30000000-0000-4000-8000-000000000033';
  if v_count <> 1 then
    raise exception 'Approved lifecycle RPC must append exactly one audit row';
  end if;
  if (select payment_status from public.otc_orders where id='30000000-0000-4000-8000-000000000033') <> 'PENDING' then
    raise exception 'Lifecycle RPC must not change payment status';
  end if;
end $$;
reset role;

rollback;
