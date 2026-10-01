-- The amostra credit, applied without anybody having to remember a code.
--
-- Nothing was broken underneath. The trigger mints the credit on delivery, the
-- admin order page shows it, validate_coupon accepts it for the right bottle
-- and refuses it for any other, and the live one is unexpired and unused. What
-- was missing is the whole customer-facing half: the code existed only in the
-- database and in the admin, and the only way it ever reached a customer was
-- somebody reading it off the order and sending it by WhatsApp. The product
-- page meanwhile promised the discount would come off by itself.
--
-- Two things are added here.

-- 1. Whether the credit stacks with a campaign that otherwise forbids coupons.
--    A setting, not a rule in the code, because this is a commercial decision.
--    The default is true: the credit is money the customer has already handed
--    over for this perfume, not a second discount being granted, which is the
--    same reasoning validate_coupon already applies when it lets a
--    product-scoped code through a campaign block.
alter table public.payment_settings
  add column if not exists amostra_credit_stacks_with_campaign boolean not null default true;

comment on column public.payment_settings.amostra_credit_stacks_with_campaign is
  'When false, an amostra credit is not applied to a bottle in a campaign whose allow_coupons is false.';

-- 2. A customer has to be able to see their own credits to be told about them,
--    and the storefront has to be able to read them to apply one. There was a
--    SELECT policy for the owner already; this makes sure of it and names the
--    columns the account page needs.
drop policy if exists coupons_owner_select on public.coupons;
create policy coupons_owner_select on public.coupons
  for select
  using (owner_customer_id = auth.uid());

-- Looking up "my unused credits" runs on every cart change, so it gets an
-- index rather than a sequential scan over every coupon in the shop.
create index if not exists coupons_owner_active_idx
  on public.coupons (owner_customer_id, applies_to, active)
  where owner_customer_id is not null;

-- The storefront needs two more of these settings to tell a customer about a
-- credit: how long one lasts, and whether it survives a campaign. Both are
-- shop policy, not anybody's personal data, so they belong in the public-safe
-- view beside the delivery settings. security_invoker stays false: the view is
-- the thing that is public, the table behind it is not.
drop view if exists public.site_delivery_settings;
create view public.site_delivery_settings
with (security_invoker = false) as
  select free_delivery_threshold,
         free_delivery_active,
         amostra_volume_ml,
         amostra_credit_days,
         amostra_credit_stacks_with_campaign
    from public.payment_settings
   where id = 1;

grant select on public.site_delivery_settings to anon, authenticated;

-- What the order actually had taken off, and which credits did it. Recorded on
-- the order rather than worked out later: a credit's value or expiry can be
-- edited afterwards, and what the customer paid must not move with it.
alter table public.orders
  add column if not exists amostra_credit       integer not null default 0,
  add column if not exists amostra_credit_codes text[] not null default '{}';

comment on column public.orders.amostra_credit is
  'Kwanzas taken off this order by amostra credits, as applied at the time.';
