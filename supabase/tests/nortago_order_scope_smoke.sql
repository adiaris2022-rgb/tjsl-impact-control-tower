-- Order-only release boundary smoke checks.
-- Reservation/Dine-In RPCs must remain non-executable by client roles.

do $$
begin
  if has_function_privilege('anon', 'public.nortago_create_customer_reservation(uuid,text,text,timestamp with time zone,integer,text)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.nortago_create_customer_reservation(uuid,text,text,timestamp with time zone,integer,text)', 'EXECUTE') then
    raise exception 'Order must not expose reservation creation RPC to client roles';
  end if;

  if has_function_privilege('anon', 'public.nortago_update_reservation_status(uuid,text)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.nortago_update_reservation_status(uuid,text)', 'EXECUTE') then
    raise exception 'Order must not expose reservation management RPC to client roles';
  end if;

  if not has_function_privilege('anon', 'public.nortago_create_customer_order(uuid,text,text,text,jsonb,text,timestamp with time zone,text,text)', 'EXECUTE') then
    raise exception 'Public customer order checkout RPC must remain executable';
  end if;

  if not has_function_privilege('anon', 'public.nortago_get_customer_receipt(uuid)', 'EXECUTE') then
    raise exception 'Public capability-token receipt RPC must remain executable';
  end if;

  if not has_function_privilege('authenticated', 'public.nortago_prepare_subscription_invoice(uuid,uuid,text)', 'EXECUTE')
    or has_function_privilege('anon', 'public.nortago_prepare_subscription_invoice(uuid,uuid,text)', 'EXECUTE') then
    raise exception 'Subscription invoice preparation must remain authenticated-only';
  end if;

  if has_function_privilege('anon', 'public.nortago_settle_subscription_payment(text,text,text,text,text,bigint,text,jsonb)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.nortago_settle_subscription_payment(text,text,text,text,text,bigint,text,jsonb)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.nortago_settle_subscription_payment(text,text,text,text,text,bigint,text,jsonb)', 'EXECUTE') then
    raise exception 'Webhook settlement must remain service-role-only';
  end if;

  raise notice 'NORTAGO Order-only scope and client RPC privileges verified';
end;
$$;
