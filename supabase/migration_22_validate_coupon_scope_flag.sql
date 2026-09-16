-- The storefront has to tell an amostra credit apart from an ordinary cupão, so
-- that a campaign which refuses to be combined with a discount code still
-- honours money the customer already paid.
--
-- Only the server knows a coupon is product-scoped, so it says so. Adding a
-- column to the result changes the return type, which create-or-replace cannot
-- do; the function has to be dropped first.

drop function if exists public.validate_coupon(text, numeric, bigint[]);

create function public.validate_coupon(
  p_code text,
  p_order_total numeric,
  p_full_bottle_product_ids bigint[] default null
)
returns table(
  valid boolean,
  reason_code text,
  discount_type text,
  discount_value numeric,
  min_order_value numeric,
  -- True for an amostra credit: tied to one perfume's full bottle.
  product_scoped boolean
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  c record;
begin
  select * into c from public.coupons where upper(code) = upper(p_code);

  if c is null then
    return query select false, 'not_found', null::text, null::numeric, null::numeric, false;
    return;
  end if;

  if c.active = false then
    return query select false, 'inactive', null::text, null::numeric, null::numeric, false;
    return;
  end if;

  if c.start_date is not null and c.start_date > current_date then
    return query select false, 'not_started', null::text, null::numeric, null::numeric, false;
    return;
  end if;

  if c.end_date is not null and c.end_date < current_date then
    return query select false, 'expired', null::text, null::numeric, null::numeric, false;
    return;
  end if;

  if c.max_uses is not null and c.times_used >= c.max_uses then
    return query select false, 'max_uses', null::text, null::numeric, null::numeric, false;
    return;
  end if;

  -- An amostra credit only pays for the full bottle of the same perfume.
  if c.product_id is not null then
    if p_full_bottle_product_ids is null
       or not (c.product_id = any(p_full_bottle_product_ids)) then
      return query select false, 'wrong_product', null::text, null::numeric, null::numeric, true;
      return;
    end if;
  end if;

  if p_order_total < c.min_order_value then
    return query select false, 'min_order', c.discount_type, c.discount_value, c.min_order_value,
                        (c.product_id is not null);
    return;
  end if;

  return query select true, 'ok', c.discount_type, c.discount_value, c.min_order_value,
                      (c.product_id is not null);
end;
$function$;
