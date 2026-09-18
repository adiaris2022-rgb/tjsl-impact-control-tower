-- Deterministic E2E schema smoke test.
-- Run in a disposable/staging database. This test rolls back all inserted rows.
begin;
do $$
declare
  b uuid; p uuid; partner uuid; tx uuid; outc uuid; ev uuid; proxy uuid; calc uuid; rpt uuid;
  dup_ok boolean := false; bad_amount_ok boolean := false; bad_status_ok boolean := false;
  gross numeric; impact numeric; ratio numeric;
begin
  insert into public.businesses(name) values ('E2E TEST - ROLLBACK') returning id into b;
  insert into public.tjsl_programs(business_id,name,status) values (b,'E2E Program','ACTIVE') returning id into p;
  insert into public.tjsl_partners(program_id,business_name,status) values (p,'E2E Partner','ACTIVE') returning id into partner;
  insert into public.tjsl_transactions(partner_id,transaction_at,amount,source,status,external_ref)
  values (partner,now(),1000000,'OCT','SUCCESS','E2E-REF-001') returning id into tx;

  begin
    insert into public.tjsl_transactions(partner_id,transaction_at,amount,source,status,external_ref)
    values (partner,now(),500000,'OCT','SUCCESS','E2E-REF-001');
  exception when unique_violation then dup_ok := true;
  end;

  begin
    insert into public.tjsl_transactions(partner_id,transaction_at,amount,source,status,external_ref)
    values (partner,now(),-1,'OCT','SUCCESS','E2E-BAD-AMOUNT');
  exception when check_violation then bad_amount_ok := true;
  end;

  insert into public.tjsl_outcomes(partner_id,name,indicator,baseline,current_value,unit,status)
  values (partner,'E2E Outcome','Transactions enabled',0,1,'count','VERIFIED') returning id into outc;

  insert into public.tjsl_evidence(outcome_id,storage_path,source_type,status,verified_at,verification_note)
  values (outc,'00000000-0000-0000-0000-000000000001/p/00000000-0000-0000-0000-000000000002/e2e.txt',
          'DOCUMENT','VERIFIED',now(),'E2E rollback verification') returning id into ev;

  insert into public.tjsl_financial_proxies(outcome_id,proxy_name,proxy_value,unit,methodology_source,approval_status)
  values (outc,'E2E proxy',0.18,'ratio','E2E test assumption','APPROVED') returning id into proxy;

  gross := 1000000 * 0.18;
  impact := gross * (1 - 0.20) * (1 - 0.20) * (1 - 0.00) * (1 - 0.00);
  ratio := impact / 100000;

  insert into public.tjsl_sroi_calculations(
    program_id,investment,gross_value,deadweight,attribution,displacement,drop_off,
    impact_value,sroi,status,calculation_trace
  ) values (
    p,100000,gross,0.20,0.20,0.00,0.00,impact,ratio,'ESTIMATED',
    jsonb_build_object('source','E2E_TEST','transaction_value',1000000,'proxy',0.18)
  ) returning id into calc;

  insert into public.tjsl_reports(program_id,period,status,sroi_calculation_id,methodology_note)
  values (p,current_date,'DRAFT',calc,'E2E rollback test') returning id into rpt;

  insert into public.tjsl_audit_events(business_id,entity_type,entity_id,action,after_data)
  values (b,'tjsl_programs',p,'E2E_TEST',
          jsonb_build_object('transaction_id',tx,'evidence_id',ev));

  begin
    insert into public.tjsl_transactions(partner_id,transaction_at,amount,source,status,external_ref)
    values (partner,now(),500000,'OCT','INVALID','E2E-BAD-STATUS');
  exception when check_violation then bad_status_ok := true;
  end;

  if not dup_ok then raise exception 'E2E_FAIL duplicate external_ref was accepted'; end if;
  if not bad_amount_ok then raise exception 'E2E_FAIL negative amount was accepted'; end if;
  if not bad_status_ok then raise exception 'E2E_FAIL invalid status was accepted'; end if;
  if abs(ratio - 1.152) > 0.000001 then raise exception 'E2E_FAIL SROI formula mismatch: %', ratio; end if;
end $$;
rollback;
