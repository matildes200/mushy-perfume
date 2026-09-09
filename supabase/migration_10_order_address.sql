-- Delivery address captured at checkout.
--
-- Kept on the order rather than only on the customer profile: a shopper can
-- move house, or have an order sent somewhere other than their usual address,
-- and the address a parcel actually went to has to stay pinned to that order.
--
-- customers.address already exists (migration_8) and is used to prefill the
-- checkout fields; this is the snapshot of what was typed at the time.

alter table public.orders
  add column if not exists customer_address text,
  add column if not exists customer_city text;
