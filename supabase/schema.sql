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
