-- BOS reservation RLS and helper privilege assertions.
do $$
declare v_qual text;
begin
 if not exists(select 1 from pg_class where oid='public.otc_reservations'::regclass and relrowsecurity=true) then raise exception 'Reservation RLS must be enabled'; end if;
 select qual into v_qual from pg_policies where schemaname='public' and tablename='otc_reservations' and policyname='otc_reservations_bos_staff_read';
 if v_qual is null then raise exception 'BOS reservation read policy missing'; end if;
 if position('nortago_outlet_has_bos' in v_qual)=0 then raise exception 'Reservation read policy must enforce BOS entitlement'; end if;
 if not has_function_privilege('authenticated','public.nortago_outlet_has_bos(uuid)','EXECUTE') then raise exception 'Authenticated role needs execute on BOS entitlement helper for RLS'; end if;
 if not has_function_privilege('authenticated','public.nortago_update_reservation_status(uuid,text)','EXECUTE') then raise exception 'Authenticated reservation status RPC grant missing'; end if;
 raise notice 'BOS reservation read policy and RPC smoke checks passed';
end;
$$;
