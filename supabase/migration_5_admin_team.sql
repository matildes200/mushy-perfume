-- ============================================================
-- Mushy Parfum — Manage admins/staff from the dashboard
-- Run after migration_4_coupon_redemption.sql.
-- ============================================================

alter table public.admins
  add column if not exists full_name text,
  add column if not exists role text not null default 'Administrador',
  add column if not exists phone text;

-- SELECT-only policy already exists from migration.sql (admins_admin_select).
-- Add write access so the dashboard can add/edit/remove staff.
drop policy if exists "admins_admin_insert" on public.admins;
create policy "admins_admin_insert" on public.admins
  for insert with check (public.is_admin());

drop policy if exists "admins_admin_update" on public.admins;
create policy "admins_admin_update" on public.admins
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins_admin_delete" on public.admins;
create policy "admins_admin_delete" on public.admins
  for delete using (public.is_admin());

grant insert, update, delete on public.admins to anon, authenticated;

select pg_notify('pgrst', 'reload schema');
