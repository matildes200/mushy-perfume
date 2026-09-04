-- ============================================================
-- Mushy Parfum — Coupons / Promotions
-- Run in the Supabase SQL Editor after migration.sql and migration_2_dashboard.sql.
-- ============================================================

create table if not exists public.coupons (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  name text not null,
  code text not null,
  discount_type text not null check (discount_type in ('percentage', 'fixed')),
  discount_value numeric not null check (discount_value >= 0),
  start_date date,
  end_date date,
  min_order_value numeric not null default 0,
  max_uses integer,
  times_used integer not null default 0,
  active boolean not null default true
);

create unique index if not exists coupons_code_key on public.coupons (upper(code));

alter table public.coupons enable row level security;

-- Admin-only: coupons aren't consumed by the storefront yet, so there's
-- no public read policy — nothing outside /admin touches this table.
drop policy if exists "coupons_admin_all" on public.coupons;
create policy "coupons_admin_all" on public.coupons
  for all using (public.is_admin()) with check (public.is_admin());

grant select, insert, update, delete on public.coupons to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;

select pg_notify('pgrst', 'reload schema');
