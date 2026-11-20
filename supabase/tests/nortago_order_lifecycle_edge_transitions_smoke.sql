-- Edge-path lifecycle smoke tests for status branches not covered by the main happy paths.
-- Uses the disposable CI auth.uid()/business_users fixture and always rolls back.
begin;
do $$
declare
  v_business uuid := gen_random_uuid();
  v_outlet uuid := gen_random_uuid();
  v_order_issue uuid := gen_random_uuid();
  v_order_check uuid := gen_random_uuid();
  v_actor uuid := '00000000-0000-0000-0000-000000000001'::uuid;
  v_error text;
  v_count integer;
begin
  insert into public.businesses(id) values (v_business);
  insert into public.otc_outlets(id,business_id,name) values (v_outlet,v_business,'Lifecycle Edge Outlet');
  insert into public.business_users(business_id,user_id,role) values (v_business,v_actor,'OWNER');
  insert into public.otc_orders(id,business_id,outlet_id,order_no,order_source,fulfillment_type,status,payment_status)
  values
    (v_order_issue,v_business,v_outlet,'SMOKE-LIFECYCLE-ISSUE','CUSTOMER_SELF_ORDER','TAKE_AWAY','NEW','PENDING'),
    (v_order_check,v_business,v_outlet,'SMOKE-LIFECYCLE-CHECK','CUSTOMER_SELF_ORDER','TAKE_AWAY','NEW','PENDING');

  -- Exercise the scheduled/check/issue recovery path and its audit trail.
  perform public.nortago_update_order_status(v_order_issue,'SCHEDULED','  schedule note  ');
  perform public.nortago_update_order_status(v_order_issue,'FULFILLMENT_CHECK',null);
  perform public.nortago_update_order_status(v_order_issue,'FULFILLMENT_ISSUE','quality issue');
  perform public.nortago_update_order_status(v_order_issue,'PROCESSING','restarted');
  perform public.nortago_update_order_status(v_order_issue,'READY',null);
  perform public.nortago_update_order_status(v_order_issue,'WAITING_PICKUP',null);
  perform public.nortago_update_order_status(v_order_issue,'PICKUP_VERIFIED',null);
  perform public.nortago_update_order_status(v_order_issue,'SUCCESS',null);

  if (select status from public.otc_orders where id=v_order_issue) <> 'SUCCESS' then
    raise exception 'Scheduled issue-recovery path did not finish at SUCCESS';
  end if;
  select count(*) into v_count from public.nortago_order_status_audit where order_id=v_order_issue;
  if v_count <> 8 then
    raise exception 'Expected eight edge-path audit records, got %',v_count;
  end if;
  if not exists (
    select 1 from public.nortago_order_status_audit
    where order_id=v_order_issue and from_status='NEW' and to_status='SCHEDULED'
      and actor_user_id=v_actor and note='schedule note'
  ) then
    raise exception 'Schedule audit should capture actor and trimmed note';
  end if;

  -- Terminal SUCCESS must not be reopened; rejected attempts cannot create audit events.
  begin
    perform public.nortago_update_order_status(v_order_issue,'PROCESSING',null);
    raise exception 'Expected terminal SUCCESS transition to be rejected';
  exception when others then
    v_error := sqlerrm;
    if v_error not like '%NORTAGO_ORDER_TRANSITION_INVALID%' then
      raise exception 'Expected terminal transition rejection, got: %',v_error;
    end if;
  end;
  select count(*) into v_count from public.nortago_order_status_audit where order_id=v_order_issue;
  if v_count <> 8 or (select status from public.otc_orders where id=v_order_issue) <> 'SUCCESS' then
    raise exception 'Rejected terminal transition changed order or audit';
  end if;

  -- Exercise the check-to-ready path that the Owner Inbox exposes.
  perform public.nortago_update_order_status(v_order_check,'PROCESSING',null);
  perform public.nortago_update_order_status(v_order_check,'FULFILLMENT_CHECK',null);
  perform public.nortago_update_order_status(v_order_check,'READY',null);
  perform public.nortago_update_order_status(v_order_check,'WAITING_PICKUP',null);
  perform public.nortago_update_order_status(v_order_check,'PICKUP_VERIFIED',null);
  perform public.nortago_update_order_status(v_order_check,'SUCCESS',null);
  if (select status from public.otc_orders where id=v_order_check) <> 'SUCCESS' then
    raise exception 'Check-to-ready path did not finish at SUCCESS';
  end if;
  select count(*) into v_count from public.nortago_order_status_audit where order_id=v_order_check;
  if v_count <> 6 then
    raise exception 'Expected six check-to-ready audit records, got %',v_count;
  end if;

  if exists (select 1 from public.otc_orders where id in (v_order_issue,v_order_check) and payment_status <> 'PENDING') then
    raise exception 'Lifecycle edge paths unexpectedly changed payment status';
  end if;
end $$;
rollback;
