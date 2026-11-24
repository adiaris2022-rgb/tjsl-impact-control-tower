-- Reproduce the connected Supabase PostgreSQL 17 postgres-creator table defaults
-- and seed legacy column-level grants to prove the release migration clears both ACL layers.
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
         or not has_table_privilege(v_role,v_table,'trigger')
         or not has_table_privilege(v_role,v_table,'maintain') then
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


-- Simulate pre-existing column-level grants that a table-level REVOKE alone would
-- leave behind. PUBLIC inheritance is deliberate so anon/authenticated both see it.
grant update (business_id) on table public.otc_products to public;
grant update (base_price) on table public.otc_products to authenticated;
grant update (business_id) on table public.otc_outlets to authenticated;
grant update (product_id) on table public.otc_outlet_products to public;
grant insert (name) on table public.otc_products to authenticated;
grant references (business_id) on table public.otc_outlets to public;

do $$
begin
  if not has_column_privilege('anon','public.otc_products','business_id','update')
     or not has_column_privilege('authenticated','public.otc_products','base_price','update')
     or not has_column_privilege('authenticated','public.otc_outlets','business_id','update')
     or not has_column_privilege('anon','public.otc_outlet_products','product_id','update')
     or not has_column_privilege('authenticated','public.otc_products','name','insert')
     or not has_column_privilege('anon','public.otc_outlets','business_id','references') then
    raise exception 'PUBLIC_CATALOG_LEGACY_COLUMN_ACL_FIXTURE_NOT_REPRODUCED';
  end if;
end
$$;
