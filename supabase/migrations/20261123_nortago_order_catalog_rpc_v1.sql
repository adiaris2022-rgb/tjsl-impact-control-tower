-- NORTAGO ORDER: tenant-scoped catalog creation RPC.
-- Keep branch-only until disposable staging validation and review.
create or replace function public.nortago_create_catalog_item_for_outlet(
  p_outlet_id uuid,
  p_name text,
  p_description text default null,
  p_category text default null,
  p_image_url text default null,
  p_price numeric default 0,
  p_product_type text default 'PRODUCT'
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_outlet public.otc_outlets%rowtype;
  v_product_id uuid;
  v_actor uuid;
begin
  v_actor := auth.uid();
  if v_actor is null then raise exception 'NORTAGO_CATALOG_AUTH_REQUIRED'; end if;
  if p_name is null or length(trim(p_name)) < 2 or length(trim(p_name)) > 120 then
    raise exception 'NORTAGO_CATALOG_NAME_INVALID';
  end if;
  if p_description is not null and length(p_description) > 500 then
    raise exception 'NORTAGO_CATALOG_DESCRIPTION_TOO_LONG';
  end if;
  if p_category is not null and length(p_category) > 80 then
    raise exception 'NORTAGO_CATALOG_CATEGORY_TOO_LONG';
  end if;
  if p_image_url is not null and length(p_image_url) > 2048 then
    raise exception 'NORTAGO_CATALOG_IMAGE_URL_TOO_LONG';
  end if;
  if p_image_url is not null and p_image_url !~* '^https?://' then
    raise exception 'NORTAGO_CATALOG_IMAGE_URL_INVALID';
  end if;
  if p_price is null or p_price < 0 then raise exception 'NORTAGO_CATALOG_PRICE_INVALID'; end if;
  if p_product_type is null or p_product_type not in ('PRODUCT','SERVICE') then
    raise exception 'NORTAGO_CATALOG_TYPE_INVALID';
  end if;

  select * into v_outlet from public.otc_outlets where id = p_outlet_id for share;
  if not found or not v_outlet.is_active then raise exception 'NORTAGO_CATALOG_OUTLET_INVALID'; end if;
  if not public.has_business_role(v_outlet.business_id, array['OWNER','PROGRAM_MANAGER','PARTNER']::text[]) then
    raise exception 'NORTAGO_CATALOG_FORBIDDEN';
  end if;

  insert into public.otc_products(business_id,name,description,category,image_url,base_price,product_type,is_active)
  values(v_outlet.business_id,trim(p_name),nullif(trim(p_description),''),nullif(trim(p_category),''),nullif(trim(p_image_url),''),p_price,p_product_type,true)
  returning id into v_product_id;

  insert into public.otc_outlet_products(outlet_id,product_id,price,is_available)
  values(v_outlet.id,v_product_id,p_price,true);

  return jsonb_build_object('product_id',v_product_id,'outlet_id',v_outlet.id,'business_id',v_outlet.business_id);
end;
$$;

revoke all on function public.nortago_create_catalog_item_for_outlet(uuid,text,text,text,text,numeric,text) from public, anon;
grant execute on function public.nortago_create_catalog_item_for_outlet(uuid,text,text,text,text,numeric,text) to authenticated;
