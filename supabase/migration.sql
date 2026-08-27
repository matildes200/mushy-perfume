-- ============================================================
-- Mushy Perfume — Admin dashboard schema
--
-- Run this once in the Supabase dashboard: Project > SQL Editor > New query.
-- Before running:
--   1. Replace 'you@example.com' near the bottom with the email
--      you'll use to log into /admin.
--   2. After running, go to Authentication > Users > Add user and
--      create a user with that exact same email (and a password).
-- ============================================================

-- ---------- Products: fields the admin dashboard needs ----------
alter table public.products
  add column if not exists stock integer not null default 0,
  add column if not exists discount_percent numeric not null default 0
    check (discount_percent >= 0 and discount_percent <= 100),
  add column if not exists active boolean not null default true,
  add column if not exists description text;

-- ---------- Orders (created by checkout, managed by admins) ----------
create table if not exists public.orders (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  items jsonb not null,
  total numeric not null default 0,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'shipped', 'cancelled')),
  customer_name text,
  customer_phone text,
  notes text
);

-- ---------- Newsletter subscriptions ----------
create table if not exists public.subscriptions (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  email text not null unique,
  active boolean not null default true
);

-- ---------- Customer accounts ----------
-- One row per signed-up shopper, linked 1:1 to their auth.users row.
create table if not exists public.customers (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text,
  created_at timestamptz not null default now()
);

-- ---------- Admin allow-list ----------
create table if not exists public.admins (
  id bigint generated always as identity primary key,
  email text not null unique,
  created_at timestamptz not null default now()
);

-- ---------- is_admin(): true if the signed-in user's email is on the allow-list ----------
-- security definer + a locked search_path so it can read public.admins
-- regardless of the caller's own row-level permissions, without being
-- hijackable via a search_path substitution.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- ---------- Row Level Security ----------
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.subscriptions enable row level security;
alter table public.admins enable row level security;
alter table public.customers enable row level security;

-- Products: anyone can read (storefront), only admins can write.
drop policy if exists "products_public_read" on public.products;
create policy "products_public_read" on public.products
  for select using (true);

drop policy if exists "products_admin_write" on public.products;
create policy "products_admin_write" on public.products
  for all using (public.is_admin()) with check (public.is_admin());

-- Orders: anyone can create an order at checkout; only admins can read/manage them.
drop policy if exists "orders_public_insert" on public.orders;
create policy "orders_public_insert" on public.orders
  for insert with check (true);

drop policy if exists "orders_admin_select" on public.orders;
create policy "orders_admin_select" on public.orders
  for select using (public.is_admin());

drop policy if exists "orders_admin_update" on public.orders;
create policy "orders_admin_update" on public.orders
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "orders_admin_delete" on public.orders;
create policy "orders_admin_delete" on public.orders
  for delete using (public.is_admin());

-- Subscriptions: anyone can subscribe; only admins can read/manage the list.
drop policy if exists "subscriptions_public_insert" on public.subscriptions;
create policy "subscriptions_public_insert" on public.subscriptions
  for insert with check (true);

drop policy if exists "subscriptions_admin_select" on public.subscriptions;
create policy "subscriptions_admin_select" on public.subscriptions
  for select using (public.is_admin());

drop policy if exists "subscriptions_admin_update" on public.subscriptions;
create policy "subscriptions_admin_update" on public.subscriptions
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "subscriptions_admin_delete" on public.subscriptions;
create policy "subscriptions_admin_delete" on public.subscriptions
  for delete using (public.is_admin());

-- Customers: a shopper can create/read/update only their own row;
-- admins can read every row (e.g. to look someone up for an order).
drop policy if exists "customers_self_insert" on public.customers;
create policy "customers_self_insert" on public.customers
  for insert with check (auth.uid() = id);

drop policy if exists "customers_self_select" on public.customers;
create policy "customers_self_select" on public.customers
  for select using (auth.uid() = id or public.is_admin());

drop policy if exists "customers_self_update" on public.customers;
create policy "customers_self_update" on public.customers
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Admins table: only admins can see who else is an admin.
-- (There is deliberately no public/self-serve insert policy here —
-- adding an admin is done from the SQL editor, never from the app.)
drop policy if exists "admins_admin_select" on public.admins;
create policy "admins_admin_select" on public.admins
  for select using (public.is_admin());

-- ---------- Seed the first admin ----------
insert into public.admins (email)
values ('matilde.mussungo20@gmail.com')
on conflict (email) do nothing;
