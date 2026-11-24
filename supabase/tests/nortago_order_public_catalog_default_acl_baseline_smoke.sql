-- Prove the CI fixture reproduces the observed postgres creator default ACL subset.
-- PostgreSQL 16 lacks MAINTAIN; the connected Supabase PostgreSQL 17 project also
-- grants MAINTAIN. The later REVOKE ALL migration must remove every client grant.
do $$
declare
  v_table regclass;
  v_role text;
begin
  foreach v_table in array array[
    'public.otc_outlets'::regclass,
    'public.otc_products'::regclass,
    'public.otc_outlet_products'::regclass
  ] loop
    foreach v_role in array array['anon','authenticated','service_role'] loop
      if not has_table_privilege(v_role,v_table,'truncate')
         or not has_table_privilege(v_role,v_table,'references')
         or not has_table_privilege(v_role,v_table,'trigger') then
        raise exception 'DEFAULT_ACL_FIXTURE_MISSING_EXPECTED_POSTGRES_GRANTS: %, %',v_role,v_table;
      end if;
    end loop;
    if has_table_privilege('anon',v_table,'select')
       or has_table_privilege('authenticated',v_table,'select')
       or has_table_privilege('anon',v_table,'insert')
       or has_table_privilege('authenticated',v_table,'insert')
       or has_table_privilege('anon',v_table,'update')
       or has_table_privilege('authenticated',v_table,'update')
       or has_table_privilege('anon',v_table,'delete')
       or has_table_privilege('authenticated',v_table,'delete') then
      raise exception 'DEFAULT_ACL_FIXTURE_DOES_NOT_MATCH_POSTGRES_CREATOR_BASELINE: %',v_table;
    end if;
  end loop;
end
$$;
