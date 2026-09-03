-- ============================================================
-- Mushy Perfume — Coupon redemption at checkout
-- Run after migration_3_coupons.sql.
-- ============================================================

-- Track which coupon (if any) was used on an order.
alter table public.orders
  add column if not exists coupon_code text;

-- Validate a coupon code for the current cart total WITHOUT exposing the
-- coupons table to the public (RLS on coupons stays admin-only). Returns
-- a reason_code instead of a message so the client can show it in
-- whatever language/wording the UI uses.
create or replace function public.validate_coupon(p_code text, p_order_total numeric)
returns table (
  valid boolean,
  reason_code text,
  discount_type text,
  discount_value numeric,
  min_order_value numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
begin
  select * into c from public.coupons where upper(code) = upper(p_code);

  if c is null then
    return query select false, 'not_found', null::text, null::numeric, null::numeric;
    return;
  end if;

  if c.active = false then
    return query select false, 'inactive', null::text, null::numeric, null::numeric;
    return;
  end if;

  if c.start_date is not null and c.start_date > current_date then
    return query select false, 'not_started', null::text, null::numeric, null::numeric;
    return;
  end if;

  if c.end_date is not null and c.end_date < current_date then
    return query select false, 'expired', null::text, null::numeric, null::numeric;
    return;
  end if;

  if c.max_uses is not null and c.times_used >= c.max_uses then
    return query select false, 'max_uses', null::text, null::numeric, null::numeric;
    return;
  end if;

  if p_order_total < c.min_order_value then
    return query select false, 'min_order', c.discount_type, c.discount_value, c.min_order_value;
    return;
  end if;

  return query select true, 'ok', c.discount_type, c.discount_value, c.min_order_value;
end;
$$;

grant execute on function public.validate_coupon(text, numeric) to anon, authenticated;

-- Atomically bump the usage counter when a coupon is actually used at checkout.
create or replace function public.redeem_coupon(p_code text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.coupons set times_used = times_used + 1 where upper(code) = upper(p_code);
$$;

grant execute on function public.redeem_coupon(text) to anon, authenticated;

select pg_notify('pgrst', 'reload schema');
