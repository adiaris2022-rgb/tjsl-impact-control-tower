-- NORTAGO Order: authenticated, tenant-scoped lifecycle updates with audit trail.
-- This migration is branch-only until reviewed and applied to disposable staging.

create table if not exists public.nortago_order_status_audit (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.otc_orders(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  outlet_id uuid not null references public.otc_outlets(id) on delete restrict,
  actor_user_id uuid not null,
  from_status text not null,
  to_status text not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists nortago_order_status_audit_order_created_idx
  on public.nortago_order_status_audit(order_id, created_at desc);
alter table public.nortago_order_status_audit enable row level security;

drop policy if exists nortago_order_status_audit_manager_read on public.nortago_order_status_audit;
create policy nortago_order_status_audit_manager_read on public.nortago_order_status_audit
for select to authenticated
using (public.has_business_role(business_id, array['OWNER','PROGRAM_MANAGER','PARTNER','STAFF']::text[]));

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
  v_order public.otc_orders%rowtype;
  v_actor uuid;
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

  select * into v_order
  from public.otc_orders
  where id = p_order_id
  for update;
  if not found then raise exception 'NORTAGO_ORDER_NOT_FOUND'; end if;

  if not public.has_business_role(v_order.business_id, array['OWNER','PROGRAM_MANAGER','PARTNER','STAFF']::text[]) then
    raise exception 'NORTAGO_ORDER_FORBIDDEN';
  end if;

  v_allowed := case v_order.status
    when 'NEW' then p_next_status in ('SCHEDULED','PROCESSING','FULFILLMENT_CHECK')
    when 'PAID' then p_next_status in ('SCHEDULED','PROCESSING','FULFILLMENT_CHECK')
    when 'SCHEDULED' then p_next_status in ('PROCESSING','FULFILLMENT_CHECK')
    when 'PROCESSING' then p_next_status in ('FULFILLMENT_CHECK','FULFILLMENT_ISSUE','READY')
    when 'FULFILLMENT_CHECK' then p_next_status in ('FULFILLMENT_ISSUE','READY')
    when 'FULFILLMENT_ISSUE' then p_next_status = 'PROCESSING'
    when 'READY' then p_next_status in ('WAITING_PICKUP','HANDED_OVER_TO_DELIVERY','SUCCESS')
    when 'WAITING_PICKUP' then p_next_status = 'PICKUP_VERIFIED'
    when 'PICKUP_VERIFIED' then p_next_status = 'SUCCESS'
    when 'HANDED_OVER_TO_DELIVERY' then p_next_status = 'SUCCESS'
    when 'SUCCESS' then p_next_status = 'PO_SUCCESS'
    else false
  end;
  if not v_allowed then raise exception 'NORTAGO_ORDER_TRANSITION_INVALID: % -> %', v_order.status, p_next_status; end if;

  update public.otc_orders
  set status = p_next_status, updated_at = now()
  where id = v_order.id;

  insert into public.nortago_order_status_audit(order_id,business_id,outlet_id,actor_user_id,from_status,to_status,note)
  values(v_order.id,v_order.business_id,v_order.outlet_id,v_actor,v_order.status,p_next_status,nullif(trim(p_note),''));

  return jsonb_build_object('order_id',v_order.id,'from_status',v_order.status,'to_status',p_next_status,'updated_at',now());
end;
$$;

revoke all on function public.nortago_update_order_status(uuid,text,text) from public, anon;
grant execute on function public.nortago_update_order_status(uuid,text,text) to authenticated;
