-- ============================================================
-- Mushy Parfum — Checkout overhaul (bank transfer + receipt upload)
-- Replaces the WhatsApp handoff with: login-gated checkout, admin-managed
-- bank transfer details, and a receipt ("comprovativo") upload per order.
-- ============================================================

-- Singleton table holding the bank details shown to customers at checkout.
create table if not exists public.payment_settings (
  id int primary key default 1,
  bank_name text,
  account_holder text,
  account_number text,
  updated_at timestamptz default now(),
  constraint payment_settings_singleton check (id = 1)
);

insert into public.payment_settings (id) values (1) on conflict (id) do nothing;

alter table public.payment_settings enable row level security;

drop policy if exists "payment_settings_read_authenticated" on public.payment_settings;
create policy "payment_settings_read_authenticated" on public.payment_settings
  for select using (auth.role() = 'authenticated');

drop policy if exists "payment_settings_admin_write" on public.payment_settings;
create policy "payment_settings_admin_write" on public.payment_settings
  for all using (public.is_admin()) with check (public.is_admin());

-- Orders now carry the uploaded receipt's storage path (not a public URL —
-- the bucket below is private, so admins view it via a signed URL).
alter table public.orders add column if not exists receipt_url text;

-- Private bucket: each customer's receipts live under "<user_id>/...", which
-- both policies below check via storage.foldername(name).
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

drop policy if exists "receipts_owner_insert" on storage.objects;
create policy "receipts_owner_insert" on storage.objects
  for insert with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "receipts_owner_read" on storage.objects;
create policy "receipts_owner_read" on storage.objects
  for select using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "receipts_admin_read" on storage.objects;
create policy "receipts_admin_read" on storage.objects
  for select using (bucket_id = 'receipts' and public.is_admin());

select pg_notify('pgrst', 'reload schema');
