-- NORTAGO ORDER: atomic, membership-checked catalog creation for one outlet.
-- Prevent orphaned catalog rows if outlet mapping creation fails.
-- Additive, feature branch only until staging review.
create or replace function public.nortago_create_catalog_item_for_outlet(
  p_outlet_id uuid,
  p_name text,
  p_description text default null,
  p_category text default null,
  p_image_url text default null,
  p_price numeric default null,
  p_product_type text default 'PRODUCT'
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_actor uuid;
  v_business_id uuid;
  v_product_id uuid;
  v_name text;
  v_description text;
  v_category text;
  v_image_url text;
begin
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'NORTAGO_CATALOG_AUTH_REQUIRED';
  end if;

  v_name := nullif(trim(p_name), '');
  if v_name is null or length(v_name) > 120 then
    raise exception 'NORTAGO_CATALOG_NAME_INVALID';
  end if;
  v_description := nullif(trim(p_description), '');
  if v_description is not null and length(v_description) > 500 then
    raise exception 'NORTAGO_CATALOG_DESCRIPTION_TOO_LONG';
  end if;
  v_category := nullif(trim(p_category), '');
  if v_category is not null and length(v_category) > 80 then
    raise exception 'NORTAGO_CATALOG_CATEGORY_TOO_LONG';
  end if;
  v_image_url := nullif(trim(p_image_url), '');
  if v_image_url is not null and (
    length(v_image_url) > 2048 or v_image_url !~* '^https?://[^[:space:]]+$'
  ) then
    raise exception 'NORTAGO_CATALOG_IMAGE_URL_INVALID';
  end if;
  if p_price is null or p_price < 0 or p_price::text in ('NaN','Infinity','-Infinity') then
    raise exception 'NORTAGO_CATALOG_PRICE_INVALID';
  end if;
  if p_product_type is null or p_product_type not in ('PRODUCT','SERVICE') then
    raise exception 'NORTAGO_CATALOG_PRODUCT_TYPE_INVALID';
  end if;

  select o.business_id into v_business_id
  from public.otc_outlets o
  where o.id = p_outlet_id and o.is_active = true
  for share;
  if not found then
    raise exception 'NORTAGO_CATALOG_OUTLET_NOT_AVAILABLE';
  end if;

  if not public.has_business_role(v_business_id, array['OWNER','PROGRAM_MANAGER','PARTNER','STAFF']::text[]) then
    raise exception 'NORTAGO_CATALOG_FORBIDDEN';
  end if;

  insert into public.otc_products(
    business_id,name,description,category,image_url,base_price,product_type,is_active
  ) values (
    v_business_id,v_name,v_description,v_category,v_image_url,p_price,p_product_type,true
  ) returning id into v_product_id;

  insert into public.otc_outlet_products(outlet_id,product_id,price,is_available)
  values(p_outlet_id,v_product_id,p_price,true);

  return jsonb_build_object(
    'product_id',v_product_id,
    'business_id',v_business_id,
    'outlet_id',p_outlet_id,
    'name',v_name,
    'product_type',p_product_type,
    'price',p_price,
    'is_available',true
  );
end;
$$;

revoke all on function public.nortago_create_catalog_item_for_outlet(uuid,text,text,text,text,numeric,text) from public, anon, authenticated;
grant execute on function public.nortago_create_catalog_item_for_outlet(uuid,text,text,text,text,numeric,text) to authenticated;

comment on function public.nortago_create_catalog_item_for_outlet(uuid,text,text,text,text,numeric,text)
is 'Creates a business-scoped PRODUCT or SERVICE and its outlet price/availability in one transaction after authentication and membership validation.';
