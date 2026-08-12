-- Dancoly / THE CUT MARKETING — Invoice schema
-- Run in Supabase → SQL Editor → New query → paste all → Run.

-- Invoice number: plain running serial starting at 129723 -------------------
create sequence if not exists invoice_no_seq start with 129723;
grant usage on sequence invoice_no_seq to anon;

-- Invoices -------------------------------------------------------------------
create table if not exists public.invoices (
  id               uuid primary key default gen_random_uuid(),
  invoice_no       bigint unique not null default nextval('invoice_no_seq'),
  customer_id      uuid references public.customers(id) on delete set null,
  bill_to_name     text not null,
  bill_to_address  text,
  bill_to_tel      text,
  bill_to_fax      text,
  your_ref         text,
  branch_name      text,
  terms            text default 'Net 30 days',
  invoice_date     date default current_date,
  subtotal         numeric default 0,
  discount_total   numeric default 0,
  total            numeric default 0,
  amount_in_words  text,
  notes            text,
  created_at       timestamptz default now()
);

-- Invoice line items ---------------------------------------------------------
create table if not exists public.invoice_items (
  id            uuid primary key default gen_random_uuid(),
  invoice_id    uuid references public.invoices(id) on delete cascade,
  line_no       int,
  tax_code      text default 'SR',
  description   text,
  product_code  text,
  packing       text,
  qty           numeric default 0,
  uom           text,
  unit_price    numeric default 0,
  discount      numeric default 0,
  line_total    numeric default 0
);
create index if not exists invoice_items_invoice_idx on public.invoice_items(invoice_id);

-- RLS: front-end uses the anon key directly (internal tool) -------------------
alter table public.invoices      enable row level security;
alter table public.invoice_items enable row level security;

drop policy if exists "anon all invoices" on public.invoices;
create policy "anon all invoices" on public.invoices
  for all to anon using (true) with check (true);

drop policy if exists "anon all invoice_items" on public.invoice_items;
create policy "anon all invoice_items" on public.invoice_items
  for all to anon using (true) with check (true);
