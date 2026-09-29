-- The amostra becomes an option on every perfume, priced from the bottle.
--
-- Until now amostra_enabled defaulted to false and the price was typed in per
-- product. Nobody had switched it on for any of the twelve, so the size picker
-- never appeared on a single card: the feature existed and was invisible.
--
-- Two changes make it real:
--
--   1. Offered by default. The column stays, so a particular perfume can still
--      be taken off sample, but it is now an opt-out rather than something to
--      remember for each new product.
--
--   2. The price is no longer stored. It is ten per cent of the bottle's price,
--      worked out at render time (see amostraPrice in js/main.js), so it can
--      never drift away from the price it is a fraction of and there is one
--      less number to enter. That means the constraint demanding a stored
--      price has to go, or enabling a sample would be rejected for having none.
--
-- amostra_price and amostra_stock are left in place rather than dropped:
-- active_campaign_products reads amostra_price, and a column nothing writes
-- costs nothing. Availability now follows the bottle's own stock, which is the
-- truth of it — a 5 ml sample is decanted from a bottle that is on the shelf.

alter table public.products drop constraint if exists products_amostra_needs_price;

alter table public.products alter column amostra_enabled set default true;

update public.products
   set amostra_enabled = true
 where coalesce(archived, false) = false
   and amostra_enabled is distinct from true;

comment on column public.products.amostra_price is
  'No longer read. The sample price is 10% of products.price, computed in js/main.js (amostraPrice).';
comment on column public.products.amostra_stock is
  'No longer read. A sample is decanted from the bottle, so availability follows products.stock.';
