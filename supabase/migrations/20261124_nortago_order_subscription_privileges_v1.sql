-- NORTAGO ORDER: explicit least-privilege grants for per-outlet subscription UI/API access.
-- Source-backed callers:
--   * Owner subscriptions page reads subscription_plans and outlet_subscriptions as authenticated.
--   * Server checkout/webhook routes read selected subscription_payments/subscription_invoices
--     columns with service_role and update only payment retry/reference metadata.
-- All billing state transitions remain in SECURITY DEFINER RPCs.
--
-- Fail closed if the reviewed tables are missing, RLS is disabled, or this executor
-- does not own them. Do not broaden global/default privileges.

do $nortago_subscription_acl_preflight$
declare
  v_executor oid := (select oid from pg_roles where rolname = current_user);
  v_table text;
  v_oid oid;
begin
  foreach v_table in array array[
    'subscription_plans',
    'outlet_subscriptions',
    'subscription_invoices',
    'subscription_payments',
    'subscription_events',
    'subscription_webhook_deliveries'
  ] loop
    v_oid := to_regclass(format('public.%I', v_table));
    if v_oid is null then
      raise exception 'NORTAGO_SUBSCRIPTION_ACL_REQUIRED_TABLE_MISSING: %', v_table;
    end if;
    if (select relowner from pg_class where oid = v_oid) <> v_executor then
      raise exception 'NORTAGO_SUBSCRIPTION_ACL_EXECUTOR_MUST_OWN_TABLE: %', v_table;
    end if;
    if not (select relrowsecurity from pg_class where oid = v_oid) then
      raise exception 'NORTAGO_SUBSCRIPTION_ACL_RLS_MUST_REMAIN_ENABLED: %', v_table;
    end if;
  end loop;

  if to_regprocedure('public.nortago_prepare_subscription_invoice(uuid,uuid,text)') is null
     or to_regprocedure('public.nortago_settle_subscription_payment(text,text,text,text,text,bigint,text,jsonb)') is null then
    raise exception 'NORTAGO_SUBSCRIPTION_ACL_REQUIRED_BILLING_RPCS_MISSING';
  end if;
end
$nortago_subscription_acl_preflight$;

-- Remove inherited/default table grants from client and server roles first.
-- RPC owners perform billing mutations; service_role receives only the columns
-- actually read/updated by the trusted checkout and webhook API routes.
revoke all on table
  public.subscription_plans,
  public.outlet_subscriptions,
  public.subscription_invoices,
  public.subscription_payments,
  public.subscription_events,
  public.subscription_webhook_deliveries
from public, anon, authenticated, service_role;

-- Table-level REVOKE does not remove existing per-column ACLs. Clear every
-- column grant from all API roles before restoring the narrow allowlists.
do $nortago_subscription_column_acl$
declare
  v_column record;
begin
  for v_column in
    select n.nspname, c.relname, a.attname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid
    where n.nspname = 'public'
      and c.relname = any(array[
        'subscription_plans',
        'outlet_subscriptions',
        'subscription_invoices',
        'subscription_payments',
        'subscription_events',
        'subscription_webhook_deliveries'
      ])
      and c.relkind in ('r','p')
      and a.attnum > 0
      and not a.attisdropped
  loop
    execute format(
      'revoke all privileges (%I) on table %I.%I from public, anon, authenticated, service_role',
      v_column.attname, v_column.nspname, v_column.relname
    );
  end loop;
end
$nortago_subscription_column_acl$;

-- Owner subscription UI: public plan metadata and business-scoped outlet status.
grant select on table public.subscription_plans to anon, authenticated;
grant select on table public.outlet_subscriptions to authenticated;

-- Trusted API routes:
-- checkout reads idempotency_key and updates retry/reference metadata;
-- webhook reads payment lookup fields and joins the invoice's public identifiers.
grant select (id, invoice_no, amount_idr, currency)
  on table public.subscription_invoices to service_role;
grant select (id, invoice_id, provider, provider_reference, amount_idr, currency, idempotency_key)
  on table public.subscription_payments to service_role;
grant update (idempotency_key, provider_reference, provider_payload)
  on table public.subscription_payments to service_role;

-- No direct client/server-table access to invoice history, payment payloads,
-- internal events, or webhook-delivery deduplication rows. The reviewed RPC
-- owners perform those writes; the settlement RPC remains service_role-only.

do $nortago_subscription_acl_assert$
declare
  v_table text;
  v_role text;
begin
  foreach v_table in array array[
    'subscription_plans',
    'outlet_subscriptions',
    'subscription_invoices',
    'subscription_payments',
    'subscription_events',
    'subscription_webhook_deliveries'
  ] loop
    foreach v_role in array array['anon','authenticated','service_role'] loop
      if has_table_privilege(v_role, format('public.%I', v_table), 'truncate')
         or has_table_privilege(v_role, format('public.%I', v_table), 'references')
         or has_table_privilege(v_role, format('public.%I', v_table), 'trigger')
         or has_table_privilege(v_role, format('public.%I', v_table), 'maintain') then
        raise exception 'NORTAGO_SUBSCRIPTION_UNEXPECTED_DDL_OR_MAINTENANCE_PRIVILEGE: %, %', v_role, v_table;
      end if;
    end loop;
  end loop;

  if not has_table_privilege('anon','public.subscription_plans','select')
     or not has_table_privilege('authenticated','public.subscription_plans','select')
     or not has_table_privilege('authenticated','public.outlet_subscriptions','select')
     or has_table_privilege('anon','public.outlet_subscriptions','select') then
    raise exception 'NORTAGO_SUBSCRIPTION_UI_READ_ALLOWLIST_INVALID';
  end if;

  if has_table_privilege('anon','public.subscription_invoices','select')
     or has_table_privilege('authenticated','public.subscription_invoices','select')
     or has_table_privilege('anon','public.subscription_payments','select')
     or has_table_privilege('authenticated','public.subscription_payments','select')
     or has_table_privilege('anon','public.subscription_events','select')
     or has_table_privilege('authenticated','public.subscription_events','select')
     or has_table_privilege('anon','public.subscription_webhook_deliveries','select')
     or has_table_privilege('authenticated','public.subscription_webhook_deliveries','select') then
    raise exception 'NORTAGO_SUBSCRIPTION_PRIVATE_TABLE_CLIENT_SELECT_REMAINS';
  end if;

  if not has_column_privilege('service_role','public.subscription_invoices','id','select')
     or not has_column_privilege('service_role','public.subscription_invoices','invoice_no','select')
     or not has_column_privilege('service_role','public.subscription_invoices','amount_idr','select')
     or not has_column_privilege('service_role','public.subscription_invoices','currency','select')
     or not has_column_privilege('service_role','public.subscription_payments','id','select')
     or not has_column_privilege('service_role','public.subscription_payments','invoice_id','select')
     or not has_column_privilege('service_role','public.subscription_payments','provider','select')
     or not has_column_privilege('service_role','public.subscription_payments','provider_reference','select')
     or not has_column_privilege('service_role','public.subscription_payments','amount_idr','select')
     or not has_column_privilege('service_role','public.subscription_payments','currency','select')
     or not has_column_privilege('service_role','public.subscription_payments','idempotency_key','select') then
    raise exception 'NORTAGO_SUBSCRIPTION_SERVICE_READ_COLUMNS_MISSING';
  end if;

  if not has_column_privilege('service_role','public.subscription_payments','idempotency_key','update')
     or not has_column_privilege('service_role','public.subscription_payments','provider_reference','update')
     or not has_column_privilege('service_role','public.subscription_payments','provider_payload','update')
     or has_column_privilege('service_role','public.subscription_payments','status','update')
     or has_column_privilege('service_role','public.subscription_payments','verified_at','update')
     or has_column_privilege('service_role','public.subscription_invoices','status','update') then
    raise exception 'NORTAGO_SUBSCRIPTION_SERVICE_UPDATE_ALLOWLIST_INVALID';
  end if;

  if has_any_column_privilege('anon','public.subscription_payments','select')
     or has_any_column_privilege('authenticated','public.subscription_payments','select')
     or has_any_column_privilege('anon','public.subscription_payments','update')
     or has_any_column_privilege('authenticated','public.subscription_payments','update')
     or has_any_column_privilege('anon','public.subscription_payments','insert')
     or has_any_column_privilege('authenticated','public.subscription_payments','insert') then
    raise exception 'NORTAGO_SUBSCRIPTION_PAYMENT_CLIENT_COLUMN_PRIVILEGE_REMAINS';
  end if;
end
$nortago_subscription_acl_assert$;
