-- Public read access for the promotional banner — and for nothing else.
--
-- The banner lives in payment_settings, whose RLS deliberately requires an
-- authenticated session: that table also holds the IBAN and the Express
-- number, which must never be readable by an anonymous visitor. But the banner
-- has to be visible to someone who is not logged in, which is most of the
-- traffic. Opening the table would leak the bank details with it.
--
-- A view solves it by exposing two columns and no others. Postgres runs a view
-- with security_invoker off as its owner, so it reads past the underlying
-- table's RLS — which is exactly the controlled hole we want, and why the
-- column list here matters so much. Do not add columns to this view.

create or replace view public.site_banner
with (security_invoker = false) as
  select
    banner_text,
    banner_active
  from public.payment_settings
  where id = 1;

grant select on public.site_banner to anon, authenticated;

comment on view public.site_banner is
  'Public-safe slice of payment_settings: the promotional banner only. Never add payment columns here — anonymous visitors can read this view.';
