-- The public settings view has to carry the amostra volume, or the storefront
-- cannot read it. Same security_invoker = false pattern as before: it publishes
-- only these columns to anon, and never the IBAN sitting beside them in
-- payment_settings.
create or replace view public.site_delivery_settings
with (security_invoker = false) as
  select
    free_delivery_threshold,
    free_delivery_active,
    amostra_volume_ml
  from public.payment_settings
  where id = 1;

grant select on public.site_delivery_settings to anon, authenticated;
