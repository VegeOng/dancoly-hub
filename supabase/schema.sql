-- Dancoly CRM — 数据库重建脚本
-- 用法:Supabase Dashboard → 左侧 SQL Editor → New query → 粘贴全部 → Run
-- 说明:表结构由现有前端代码 (app/orders, app/dashboard, app/api/order-number) 反推得出。

-- ============================================================
-- 1. 客户表 customers
-- ============================================================
create table if not exists public.customers (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  phone         text,
  email         text,
  customer_type text default 'new',          -- 'new' 新客 / 'returning' 回购客
  hair_concern  text,                         -- 掉发困扰描述
  notes         text,
  created_at    timestamptz default now()
);

-- ============================================================
-- 2. 订单表 orders
-- ============================================================
create table if not exists public.orders (
  id                uuid primary key default gen_random_uuid(),
  order_number      text,                     -- 系统生成,格式 F0727-01
  order_code        text,                     -- 手填,如 DC-001
  customer_id       uuid references public.customers(id) on delete set null,
  quantity          integer default 0,
  unit_price        numeric default 0,
  total_amount      numeric default 0,
  discount          numeric default 0,
  gift              text,
  notes             text,                     -- "Products: ... | Notes: ..."
  payment_status    text default 'pending',   -- 'pending' / 'paid' / 'overdue'
  payment_proof_url text,
  delivery_address  text,
  created_at        timestamptz default now()
);

create index if not exists orders_customer_id_idx  on public.orders(customer_id);
create index if not exists orders_order_number_idx on public.orders(order_number);

-- ============================================================
-- 3. RLS 策略(前端用 anon key 直接读写,需放行)
--    注意:这是内部工具的宽松策略 —— 任何拿到 URL + anon key 的人都能读写。
--    若日后要收紧,应改成基于登录用户的策略。
-- ============================================================
alter table public.customers enable row level security;
alter table public.orders    enable row level security;

drop policy if exists "anon full access" on public.customers;
create policy "anon full access" on public.customers
  for all to anon using (true) with check (true);

drop policy if exists "anon full access" on public.orders;
create policy "anon full access" on public.orders
  for all to anon using (true) with check (true);

-- ============================================================
-- 4. 付款凭证 Storage bucket: payment-proofs(公开可读)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('payment-proofs', 'payment-proofs', true)
on conflict (id) do update set public = true;

drop policy if exists "payment-proofs anon upload" on storage.objects;
create policy "payment-proofs anon upload" on storage.objects
  for insert to anon with check (bucket_id = 'payment-proofs');

drop policy if exists "payment-proofs public read" on storage.objects;
create policy "payment-proofs public read" on storage.objects
  for select to public using (bucket_id = 'payment-proofs');

-- ============================================================
-- 5. TikTok Shop 连接表 tiktok_connections
--    ⚠️ access_token / refresh_token 属于敏感数据。
--       内部工具暂用 anon 宽松策略；日后可收紧为 service_role only。
-- ============================================================
create table if not exists public.tiktok_connections (
  id               uuid        primary key default gen_random_uuid(),
  shop_id          text        not null unique,
  shop_name        text,
  shop_code        text,
  seller_name      text,
  country_code     text        default 'MY',
  currency         text        default 'MYR',
  access_token     text,
  refresh_token    text,
  token_expires_at timestamptz,
  is_active        boolean     default true,
  last_synced_at   timestamptz,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

alter table public.tiktok_connections enable row level security;
drop policy if exists "anon full access" on public.tiktok_connections;
create policy "anon full access" on public.tiktok_connections
  for all to anon using (true) with check (true);

-- ============================================================
-- 6. TikTok Shop 订单表 tiktok_orders
-- ============================================================
create table if not exists public.tiktok_orders (
  id                  uuid        primary key default gen_random_uuid(),
  connection_id       uuid        references public.tiktok_connections(id) on delete cascade,
  tiktok_order_id     text        not null unique,
  order_sn            text,
  customer_id         uuid        references public.customers(id) on delete set null,
  total_amount        numeric     default 0,
  subtotal            numeric     default 0,
  shipping_fee        numeric     default 0,
  seller_discount     numeric     default 0,
  platform_discount   numeric     default 0,
  currency            text        default 'MYR',
  order_status        text        default 'UNPAID',
  payment_method      text,
  shipping_provider   text,
  tracking_number     text,
  recipient_name      text,
  recipient_phone     text,
  shipping_address    text,
  shipping_address_raw jsonb,
  buyer_uid           text,
  buyer_message       text,
  paid_at             timestamptz,
  shipped_at          timestamptz,
  completed_at        timestamptz,
  cancelled_at        timestamptz,
  tiktok_created_at   timestamptz,
  synced_at           timestamptz default now(),
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

create index if not exists tiktok_orders_connection_id_idx  on public.tiktok_orders(connection_id);
create index if not exists tiktok_orders_status_idx         on public.tiktok_orders(order_status);
create index if not exists tiktok_orders_created_idx        on public.tiktok_orders(tiktok_created_at desc);

alter table public.tiktok_orders enable row level security;
drop policy if exists "anon full access" on public.tiktok_orders;
create policy "anon full access" on public.tiktok_orders
  for all to anon using (true) with check (true);

-- ============================================================
-- 7. TikTok 订单商品行 tiktok_order_items
-- ============================================================
create table if not exists public.tiktok_order_items (
  id              uuid    primary key default gen_random_uuid(),
  tiktok_order_id text    not null references public.tiktok_orders(tiktok_order_id) on delete cascade,
  sku_id          text,
  product_id      text,
  product_name    text,
  sku_name        text,
  image_url       text,
  quantity        integer default 1,
  unit_price      numeric default 0,
  sale_price      numeric default 0,
  total_price     numeric default 0,
  seller_sku      text,
  created_at      timestamptz default now()
);

create index if not exists tiktok_order_items_order_id_idx on public.tiktok_order_items(tiktok_order_id);

alter table public.tiktok_order_items enable row level security;
drop policy if exists "anon full access" on public.tiktok_order_items;
create policy "anon full access" on public.tiktok_order_items
  for all to anon using (true) with check (true);

-- ============================================================
-- 8. TikTok Shop 商品表 tiktok_products
-- ============================================================
create table if not exists public.tiktok_products (
  id                uuid        primary key default gen_random_uuid(),
  connection_id     uuid        references public.tiktok_connections(id) on delete cascade,
  tiktok_product_id text        not null unique,
  title             text,
  status            text,
  image_url         text,
  price             numeric,
  stock             integer,
  synced_at         timestamptz default now(),
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

alter table public.tiktok_products enable row level security;
drop policy if exists "anon full access" on public.tiktok_products;
create policy "anon full access" on public.tiktok_products
  for all to anon using (true) with check (true);
