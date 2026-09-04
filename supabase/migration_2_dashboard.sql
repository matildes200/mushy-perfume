-- ============================================================
-- Mushy Parfum — Admin dashboard v2 (Products/Orders/Customers/
-- Inventory/Analytics expansion)
-- Run after supabase/migration.sql, same place: SQL Editor > New query.
-- ============================================================

-- ---------- Products: richer catalog fields ----------
alter table public.products
  add column if not exists brand text,
  add column if not exists sku text,
  add column if not exists short_description text,
  add column if not exists fragrance_family text,
  add column if not exists concentration text,
  add column if not exists volume_ml integer,
  add column if not exists notes_top text,
  add column if not exists notes_heart text,
  add column if not exists notes_base text,
  add column if not exists low_stock_threshold integer not null default 5,
  add column if not exists images text[] not null default '{}',
  add column if not exists new_arrival boolean not null default false;

create unique index if not exists products_sku_key on public.products (sku) where sku is not null and sku <> '';

-- ---------- Orders: customer link, delivery + payment tracking, fuller status pipeline ----------
-- customer_name/customer_phone/notes were in the original migration.sql's CREATE TABLE,
-- but that statement silently no-ops if the orders table already exists (e.g. created
-- earlier by hand to match a simpler insert shape) — so they're repeated here as a
-- plain ALTER to guarantee they actually exist.
alter table public.orders
  add column if not exists customer_name text,
  add column if not exists customer_phone text,
  add column if not exists notes text,
  add column if not exists customer_id uuid references public.customers(id) on delete set null,
  add column if not exists customer_email text,
  add column if not exists shipping_address text,
  add column if not exists shipping_city text,
  add column if not exists shipping_postal_code text,
  add column if not exists delivery_method text,
  add column if not exists tracking_number text,
  add column if not exists courier text,
  add column if not exists delivery_status text not null default 'pending'
    check (delivery_status in ('pending', 'preparing', 'shipped', 'in_transit', 'delivered', 'failed')),
  add column if not exists payment_method text,
  add column if not exists payment_status text not null default 'pending'
    check (payment_status in ('pending', 'paid', 'failed', 'refunded')),
  add column if not exists delivery_fee numeric not null default 0,
  add column if not exists discount numeric not null default 0;

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'));

-- ---------- Stock history (so inventory changes are auditable) ----------
create table if not exists public.stock_history (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  product_id bigint not null references public.products(id) on delete cascade,
  change integer not null,
  reason text
);

alter table public.stock_history enable row level security;

drop policy if exists "stock_history_admin_all" on public.stock_history;
create policy "stock_history_admin_all" on public.stock_history
  for all using (public.is_admin()) with check (public.is_admin());

grant select, insert, update, delete on public.stock_history to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;

select pg_notify('pgrst', 'reload schema');
