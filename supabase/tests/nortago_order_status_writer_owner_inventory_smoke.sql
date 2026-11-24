-- Release guardrail: status writers must stay within the approved lifecycle RPC.
-- This static catalog test scans same-owner SECURITY DEFINER function bodies for
-- direct UPDATE statements on otc_orders.status. It does not detect dynamic SQL
-- or indirect calls; the staging audit inventory remains required for review.
begin;

do $$
declare
  v_rpc_oid oid;
  v_rpc_owner oid;
  v_other_status_writers text;
begin
  select p.oid, p.proowner
    into v_rpc_oid, v_rpc_owner
  from pg_catalog.pg_proc p
  where p.oid = pg_catalog.to_regprocedure('public.nortago_update_order_status(uuid,text,text)');

  if v_rpc_oid is null then
    raise exception 'NORTAGO_ORDER_LIFECYCLE_RPC_MISSING';
  end if;

  if not (select p.prosecdef from pg_catalog.pg_proc p where p.oid = v_rpc_oid) then
    raise exception 'NORTAGO_ORDER_LIFECYCLE_RPC_MUST_BE_SECURITY_DEFINER';
  end if;

  if not has_function_privilege('authenticated', v_rpc_oid, 'execute')
     or has_function_privilege('anon', v_rpc_oid, 'execute') then
    raise exception 'NORTAGO_ORDER_LIFECYCLE_RPC_CLIENT_EXECUTE_GRANTS_INVALID';
  end if;

  -- The owner guard trusts the lifecycle RPC owner identity. Any other
  -- SECURITY DEFINER function with that owner and a direct status UPDATE is
  -- therefore a potential bypass and must be reviewed/blocked.
  select string_agg(p.oid::regprocedure::text, ', ' order by p.oid::regprocedure::text)
    into v_other_status_writers
  from pg_catalog.pg_proc p
  where p.proowner = v_rpc_owner
    and p.prokind in ('f','p')
    and p.prosecdef
    and p.oid <> v_rpc_oid
    and regexp_replace(
          lower(pg_catalog.pg_get_functiondef(p.oid)),
          '[[:space:]]+',
          ' ',
          'g'
        ) ~ 'update (public[.])?otc_orders( as)?( [a-z_][a-z0-9_]*)? set status[[:space:]]*=';

  if v_other_status_writers is not null then
    raise exception 'NORTAGO_ORDER_UNREVIEWED_SAME_OWNER_STATUS_WRITERS: %',
      v_other_status_writers;
  end if;
end $$;

rollback;
