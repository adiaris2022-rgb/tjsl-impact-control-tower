-- OTC commerce core + RLS
-- Applied to Supabase project tdpupelhvzxwhbqnnlxk.

create table if not exists public.otc_outlets (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  partner_id uuid references public.tjsl_partners(id) on delete set null,
  name text not null,
  address text, phone text, whatsapp text, operating_hours text,
  is_active boolean not null default true, created_at timestamptz not null default now()
);
create table if not exists public.otc_products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null, description text, category text, image_url text,
  base_price numeric(14,2) not null check (base_price >= 0),
  is_active boolean not null default true, created_at timestamptz not null default now()
);
create table if not exists public.otc_outlet_products (
  outlet_id uuid not null references public.otc_outlets(id) on delete cascade,
  product_id uuid not null references public.otc_products(id) on delete cascade,
  price numeric(14,2) check (price >= 0), is_available boolean not null default true,
  primary key (outlet_id, product_id)
);
create table if not exists public.otc_orders (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  outlet_id uuid not null references public.otc_outlets(id) on delete restrict,
  partner_id uuid references public.tjsl_partners(id) on delete set null,
  order_no text not null,
  order_source text not null default 'CUSTOMER_SELF_ORDER'
    check (order_source in ('CUSTOMER_SELF_ORDER','STAFF_WALK_IN','POS_INTEGRATED')),
  fulfillment_type text not null check (fulfillment_type in ('TAKE_AWAY','PRE_ORDER','DELIVERY','DINE_IN')),
  status text not null default 'NEW'
    check (status in ('NEW','PAID','SCHEDULED','PROCESSING','FULFILLMENT_CHECK','FULFILLMENT_ISSUE','READY','WAITING_PICKUP','PICKUP_VERIFIED','HANDED_OVER_TO_DELIVERY','SUCCESS','PO_SUCCESS')),
  customer_name text, customer_whatsapp text, delivery_address text, delivery_note text,
  scheduled_at timestamptz, subtotal numeric(14,2) not null default 0 check (subtotal >= 0),
  delivery_fee numeric(14,2) not null default 0 check (delivery_fee >= 0),
  discount numeric(14,2) not null default 0 check (discount >= 0),
  total numeric(14,2) not null default 0 check (total >= 0),
  payment_method text, payment_status text not null default 'PENDING'
    check (payment_status in ('PENDING','PAID','FAILED','REFUNDED')),
  pickup_code text unique, external_ref text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index if not exists otc_orders_business_order_no_uidx on public.otc_orders(business_id, order_no);
create unique index if not exists otc_orders_business_external_ref_uidx on public.otc_orders(business_id, external_ref) where external_ref is not null;
create table if not exists public.otc_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.otc_orders(id) on delete cascade,
  product_id uuid references public.otc_products(id) on delete set null,
  product_name_snapshot text not null, unit_price numeric(14,2) not null check (unit_price >= 0),
  quantity integer not null check (quantity > 0),
  variant_snapshot jsonb not null default '{}'::jsonb,
  modifier_snapshot jsonb not null default '{}'::jsonb,
  note text, line_total numeric(14,2) not null check (line_total >= 0)
);
alter table public.otc_outlets enable row level security;
alter table public.otc_products enable row level security;
alter table public.otc_outlet_products enable row level security;
alter table public.otc_orders enable row level security;
alter table public.otc_order_items enable row level security;
create index if not exists otc_outlets_business_idx on public.otc_outlets(business_id);
create index if not exists otc_products_business_idx on public.otc_products(business_id);
create index if not exists otc_orders_business_created_idx on public.otc_orders(business_id, created_at desc);
create index if not exists otc_orders_outlet_created_idx on public.otc_orders(outlet_id, created_at desc);
create index if not exists otc_order_items_order_idx on public.otc_order_items(order_id);

create policy otc_outlets_public_read on public.otc_outlets for select to anon, authenticated using (is_active = true);
create policy otc_products_public_read on public.otc_products for select to anon, authenticated using (is_active = true);
create policy otc_outlet_products_public_read on public.otc_outlet_products for select to anon, authenticated using (
  is_available = true
  and exists (select 1 from public.otc_outlets o where o.id = outlet_id and o.is_active = true)
  and exists (select 1 from public.otc_products p where p.id = product_id and p.is_active = true)
);
create policy otc_outlets_staff_manage on public.otc_outlets for all to authenticated
  using (public.has_business_role(business_id, array['OWNER','PROGRAM_MANAGER','PARTNER','STAFF']))
  with check (public.has_business_role(business_id, array['OWNER','PROGRAM_MANAGER','PARTNER','STAFF']));
create policy otc_products_staff_manage on public.otc_products for all to authenticated
  using (public.has_business_role(business_id, array['OWNER','PROGRAM_MANAGER','PARTNER','STAFF']))
  with check (public.has_business_role(business_id, array['OWNER','PROGRAM_MANAGER','PARTNER','STAFF']));
create policy otc_outlet_products_staff_manage on public.otc_outlet_products for all to authenticated
  using (exists (select 1 from public.otc_outlets o where o.id = outlet_id and public.has_business_role(o.business_id, array['OWNER','PROGRAM_MANAGER','PARTNER','STAFF'])))
  with check (exists (select 1 from public.otc_outlets o where o.id = outlet_id and public.has_business_role(o.business_id, array['OWNER','PROGRAM_MANAGER','PARTNER','STAFF'])));
create policy otc_orders_staff_manage on public.otc_orders for all to authenticated
  using (public.has_business_role(business_id, array['OWNER','PROGRAM_MANAGER','PARTNER','STAFF']))
  with check (public.has_business_role(business_id, array['OWNER','PROGRAM_MANAGER','PARTNER','STAFF']));
create policy otc_order_items_staff_manage on public.otc_order_items for all to authenticated
  using (exists (select 1 from public.otc_orders o where o.id = order_id and public.has_business_role(o.business_id, array['OWNER','PROGRAM_MANAGER','PARTNER','STAFF'])))
  with check (exists (select 1 from public.otc_orders o where o.id = order_id and public.has_business_role(o.business_id, array['OWNER','PROGRAM_MANAGER','PARTNER','STAFF'])));
