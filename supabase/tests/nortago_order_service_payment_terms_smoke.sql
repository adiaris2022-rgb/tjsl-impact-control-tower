-- NORTAGO Order: seller-configurable service DP/full payment rules.
-- Disposable PostgreSQL fixtures; all writes are rolled back.
begin;
create or replace function auth.uid() returns uuid
language sql stable
as $ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $;
do $
declare
  v_actor uuid := '00000000-0000-0000-0000-000000000001';
  v_staff uuid := '00000000-0000-0000-0000-000000000002';
  v_business uuid := gen_random_uuid();
  v_other_business uuid := gen_random_uuid();
  v_other_outlet uuid := gen_random_uuid();
  v_other_service uuid := gen_random_uuid();
  v_outlet uuid := gen_random_uuid();
  v_product uuid := gen_random_uuid();
  v_service_percent uuid := gen_random_uuid();
  v_service_fixed uuid := gen_random_uuid();
  v_service_full_only uuid := gen_random_uuid();
  v_result jsonb;
  v_retry jsonb;
  v_receipt jsonb;
  v_error text;
  v_key uuid := gen_random_uuid();
  v_token uuid;
  v_items jsonb;
begin
  perform set_config('request.jwt.claim.sub',v_actor::text,true);
  if has_function_privilege('anon','public.nortago_guard_service_payment_terms_owner()','execute')
     or has_function_privilege('authenticated','public.nortago_guard_service_payment_terms_owner()','execute')
     or exists (select 1 from pg_proc where oid='public.nortago_guard_service_payment_terms_owner()'::regprocedure and prosecdef) then
    raise exception 'SERVICE_PAYMENT_TERMS_TRIGGER_FUNCTION_ACL_OR_MODE_INVALID';
  end if;
  if not exists (
    select 1 from pg_trigger where tgrelid='public.otc_outlet_products'::regclass
      and tgname='otc_outlet_products_service_payment_terms_owner_guard'
      and not tgisinternal and tgenabled in ('O','A')
  ) then
    raise exception 'SERVICE_PAYMENT_TERMS_OWNER_TRIGGER_MISSING';
  end if;
  if has_function_privilege('anon','public.nortago_update_service_payment_terms(uuid,uuid,boolean,boolean,text,numeric)','execute')
     or not has_function_privilege('authenticated','public.nortago_update_service_payment_terms(uuid,uuid,boolean,boolean,text,numeric)','execute') then
    raise exception 'SERVICE_PAYMENT_TERMS_RPC_ACL_INVALID';
  end if;
  if not has_function_privilege('anon','public.nortago_create_customer_order_idempotent(uuid,uuid,text,text,text,jsonb,text,timestamptz,text,text,text)','execute')
     or not has_function_privilege('authenticated','public.nortago_create_customer_order_idempotent(uuid,uuid,text,text,text,jsonb,text,timestamptz,text,text,text)','execute') then
    raise exception 'CHECKOUT_PAYMENT_TERMS_RPC_CLIENT_GRANT_MISSING';
  end if;
  if to_regprocedure('public.nortago_create_customer_order_idempotent(uuid,uuid,text,text,text,jsonb,text,timestamptz,text,text)') is not null then
    raise exception 'LEGACY_CHECKOUT_RPC_OVERLOAD_MUST_BE_REMOVED';
  end if;

  insert into public.businesses(id) values(v_business),(v_other_business);
  insert into public.otc_outlets(id,business_id,name,is_active) values
    (v_outlet,v_business,'Payment Terms Outlet',true),
    (v_other_outlet,v_other_business,'Other Payment Terms Outlet',true);
  insert into public.business_users(business_id,user_id,role) values
    (v_business,v_actor,'OWNER'),
    (v_business,v_staff,'STAFF');
  insert into public.otc_products(id,business_id,name,base_price,is_active,product_type) values
    (v_product,v_business,'Payment Product',20000,true,'PRODUCT'),
    (v_service_percent,v_business,'Percent DP Service',100000,true,'SERVICE'),
    (v_service_fixed,v_business,'Fixed DP Service',80000,true,'SERVICE'),
    (v_service_full_only,v_business,'Full Only Service',50000,true,'SERVICE'),
    (v_other_service,v_other_business,'Unauthorized Service',40000,true,'SERVICE');
  insert into public.otc_outlet_products(outlet_id,product_id,price,is_available,allow_full_payment,allow_dp,dp_type,dp_value) values
    (v_outlet,v_product,20000,true,true,false,'PERCENT',50),
    (v_outlet,v_service_percent,100000,true,true,true,'PERCENT',30),
    (v_outlet,v_service_fixed,80000,true,true,true,'FIXED',25000),
    (v_outlet,v_service_full_only,50000,true,true,false,'PERCENT',50),
    (v_other_outlet,v_other_service,40000,true,true,false,'PERCENT',50);

  -- Only an OWNER/PARTNER-level business member may change per-outlet service terms.
  perform public.nortago_update_service_payment_terms(
    v_outlet,v_service_full_only,true,true,'PERCENT',40
  );
  if not exists (
    select 1 from public.otc_outlet_products
    where outlet_id=v_outlet and product_id=v_service_full_only
      and allow_full_payment and allow_dp and dp_type='PERCENT' and dp_value=40
  ) then
    raise exception 'OWNER_PAYMENT_TERMS_RPC_DID_NOT_UPDATE_OUTLET_MAPPING';
  end if;
  update public.otc_outlet_products set allow_full_payment=true,allow_dp=false,dp_value=50
  where outlet_id=v_outlet and product_id=v_service_full_only;

  -- Direct table writes must not let STAFF bypass the owner-only RPC.
  perform set_config('request.jwt.claim.sub',v_staff::text,true);
  begin
    update public.otc_outlet_products set allow_dp=true
    where outlet_id=v_outlet and product_id=v_service_full_only;
    raise exception 'STAFF_DIRECT_PAYMENT_TERMS_WRITE_WAS_ACCEPTED';
  exception when others then
    if sqlerrm <> 'SERVICE_PAYMENT_TERMS_FORBIDDEN' then raise; end if;
  end;
  perform set_config('request.jwt.claim.sub',v_actor::text,true);

  begin
    perform public.nortago_update_service_payment_terms(
      v_other_outlet,v_other_service,true,true,'PERCENT',40
    );
    raise exception 'NON_MEMBER_PAYMENT_TERMS_UPDATE_WAS_ACCEPTED';
  exception when others then
    if sqlerrm <> 'SERVICE_PAYMENT_TERMS_FORBIDDEN' then raise; end if;
  end;

  begin
    perform public.nortago_update_service_payment_terms(
      v_outlet,v_service_full_only,false,false,'PERCENT',40
    );
    raise exception 'DISABLING_BOTH_PAYMENT_OPTIONS_WAS_ACCEPTED';
  exception when others then
    if sqlerrm <> 'SERVICE_PAYMENT_TERMS_AT_LEAST_ONE_OPTION_REQUIRED' then raise; end if;
  end;

  -- FULL remains the default and is authoritative on the server.
  v_items := jsonb_build_array(jsonb_build_object('product_id',v_service_percent,'quantity',2));
  v_result := public.nortago_create_customer_order_idempotent(
    v_outlet,v_key,'Payment Smoke','081234567890','TAKE_AWAY',v_items,'Cash',null,null,null,'FULL'
  );
  if v_result->>'payment_option' <> 'FULL'
     or (v_result->>'payment_amount_due')::numeric <> 200000
     or (v_result->>'payment_balance_due')::numeric <> 0 then
    raise exception 'FULL payment terms were not stored as the full amount';
  end if;

  -- Percent DP applies per line total and is computed from the server-side outlet price.
  v_key := gen_random_uuid();
  v_items := jsonb_build_array(jsonb_build_object('product_id',v_service_percent,'quantity',2,'price',1));
  v_result := public.nortago_create_customer_order_idempotent(
    v_outlet,v_key,'Payment Smoke','081234567890','TAKE_AWAY',v_items,'Cash',null,null,null,'DP'
  );
  if v_result->>'payment_option' <> 'DP'
     or (v_result->>'total')::numeric <> 200000
     or (v_result->>'payment_amount_due')::numeric <> 60000
     or (v_result->>'payment_balance_due')::numeric <> 140000 then
    raise exception 'Percent DP must be 30 percent of authoritative outlet total';
  end if;
  v_token := (v_result->>'receipt_token')::uuid;
  v_receipt := public.nortago_get_customer_receipt(v_token);
  if v_receipt->'order'->>'payment_option' <> 'DP'
     or (v_receipt->'order'->>'payment_amount_due')::numeric <> 60000
     or (v_receipt->'order'->>'payment_balance_due')::numeric <> 140000 then
    raise exception 'Private receipt must expose the stored DP amount and remaining balance';
  end if;
  v_retry := public.nortago_create_customer_order_idempotent(
    v_outlet,v_key,'Payment Smoke','081234567890','TAKE_AWAY',v_items,'Cash',null,null,null,'DP'
  );
  if v_retry->>'reused' <> 'true'
     or v_retry->>'payment_amount_due' <> v_result->>'payment_amount_due'
     or v_retry->>'payment_balance_due' <> v_result->>'payment_balance_due' then
    raise exception 'Idempotent retry must preserve DP and balance amounts';
  end if;

  -- Fixed DP is per service unit and cannot exceed the unit price.
  v_key := gen_random_uuid();
  v_items := jsonb_build_array(jsonb_build_object('product_id',v_service_fixed,'quantity',2));
  v_result := public.nortago_create_customer_order_idempotent(
    v_outlet,v_key,'Payment Smoke','081234567890','TAKE_AWAY',v_items,'Cash',null,null,null,'DP'
  );
  if (v_result->>'payment_amount_due')::numeric <> 50000
     or (v_result->>'payment_balance_due')::numeric <> 110000 then
    raise exception 'Fixed DP must be applied per service unit';
  end if;

  -- Mixed cart: PRODUCT is fully due; SERVICE uses the configured DP.
  v_key := gen_random_uuid();
  v_items := jsonb_build_array(
    jsonb_build_object('product_id',v_product,'quantity',1),
    jsonb_build_object('product_id',v_service_percent,'quantity',1)
  );
  v_result := public.nortago_create_customer_order_idempotent(
    v_outlet,v_key,'Payment Smoke','081234567890','TAKE_AWAY',v_items,'Cash',null,null,null,'DP'
  );
  if (v_result->>'total')::numeric <> 120000
     or (v_result->>'payment_amount_due')::numeric <> 50000
     or (v_result->>'payment_balance_due')::numeric <> 70000 then
    raise exception 'Mixed cart must collect PRODUCT in full plus SERVICE DP';
  end if;

  -- Reject DP when any service in the cart has DP disabled.
  v_key := gen_random_uuid();
  v_items := jsonb_build_array(jsonb_build_object('product_id',v_service_full_only,'quantity',1));
  begin
    perform public.nortago_create_customer_order_idempotent(
      v_outlet,v_key,'Payment Smoke','081234567890','TAKE_AWAY',v_items,'Cash',null,null,null,'DP'
    );
    raise exception 'SERVICE_DP_DISABLED_WAS_ACCEPTED';
  exception when others then
    if sqlerrm <> 'SERVICE_PAYMENT_OPTION_NOT_AVAILABLE' then raise; end if;
  end;

  -- Reject FULL when seller enabled DP only.
  update public.otc_outlet_products set allow_full_payment=false,allow_dp=true
  where outlet_id=v_outlet and product_id=v_service_full_only;
  v_key := gen_random_uuid();
  begin
    perform public.nortago_create_customer_order_idempotent(
      v_outlet,v_key,'Payment Smoke','081234567890','TAKE_AWAY',v_items,'Cash',null,null,null,'FULL'
    );
    raise exception 'SERVICE_FULL_PAYMENT_DISABLED_WAS_ACCEPTED';
  exception when others then
    if sqlerrm <> 'SERVICE_PAYMENT_OPTION_NOT_AVAILABLE' then raise; end if;
  end;

  -- Reject DP for a cart containing only physical goods.
  v_key := gen_random_uuid();
  v_items := jsonb_build_array(jsonb_build_object('product_id',v_product,'quantity',1));
  begin
    perform public.nortago_create_customer_order_idempotent(
      v_outlet,v_key,'Payment Smoke','081234567890','TAKE_AWAY',v_items,'Cash',null,null,null,'DP'
    );
    raise exception 'PRODUCT_ONLY_DP_WAS_ACCEPTED';
  exception when others then
    if sqlerrm <> 'SERVICE_DP_REQUIRES_SERVICE_ITEM' then raise; end if;
  end;
end $$;
rollback;
