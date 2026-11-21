-- NORTAGO ORDER: support service items in the same catalog and checkout flow.
-- Safe additive schema change. Apply and validate on staging before production.

alter table public.otc_products
  add column if not exists product_type text not null default 'PRODUCT';

alter table public.otc_products
  drop constraint if exists otc_products_product_type_check;

alter table public.otc_products
  add constraint otc_products_product_type_check
  check (product_type in ('PRODUCT','SERVICE'));

comment on column public.otc_products.product_type is
  'Catalog type: PRODUCT (physical goods) or SERVICE (services). Both use the existing order/checkout lifecycle.';
