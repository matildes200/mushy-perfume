-- ============================================================
-- Mushy Parfum — Express payment method + clearer payment status
-- Adds a second payment method (Express, identified by a phone number)
-- alongside the existing bank transfer, both still managed from
-- admin/pagamentos.html. No existing columns are removed or renamed —
-- orders.payment_method / payment_status already existed as free text,
-- this just gives them a defined, admin-driven set of values.
-- ============================================================

alter table public.payment_settings add column if not exists express_phone text;

select pg_notify('pgrst', 'reload schema');
