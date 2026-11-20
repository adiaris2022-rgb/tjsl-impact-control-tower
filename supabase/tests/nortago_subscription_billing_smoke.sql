-- Additional billing engine assertions; run after 20261117_nortago_order_subscription_billing_v1.sql.
do $$
begin
  if to_regprocedure('public.nortago_prepare_subscription_invoice(uuid,uuid,text)') is null then
    raise exception 'Missing authenticated invoice preparation RPC';
  end if;
  if to_regprocedure('public.nortago_settle_subscription_payment(text,text,text,text,text,bigint,text,jsonb)') is null then
    raise exception 'Missing verified webhook settlement RPC';
  end if;
  if has_function_privilege('anon','public.nortago_prepare_subscription_invoice(uuid,uuid,text)','EXECUTE') then
    raise exception 'Anonymous users must not create subscription invoices';
  end if;
  if has_function_privilege('authenticated','public.nortago_settle_subscription_payment(text,text,text,text,text,bigint,text,jsonb)','EXECUTE') then
    raise exception 'Authenticated users must not settle subscription payments';
  end if;
  if not exists(select 1 from pg_class where oid='public.subscription_webhook_deliveries'::regclass and relrowsecurity) then
    raise exception 'Webhook delivery ledger must have RLS enabled';
  end if;
end;
$$;
