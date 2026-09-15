-- Replaces the product_sizes / product_variants model with something much
-- simpler, as asked: each product has ONE bottle size that the shop sets per
-- product, and may additionally be offered as a 5 ml amostra with its own price
-- and its own stock.
--
-- products.volume_ml already existed and is exactly "the bottle size for this
-- product", so it is reused rather than a new column added beside it.

-- ------------------------------------------------------------- amostra ---
alter table public.products
  add column if not exists amostra_enabled boolean not null default false,
  add column if not exists amostra_price   integer,
  add column if not exists amostra_stock   integer not null default 0;

alter table public.products drop constraint if exists products_amostra_price_check;
alter table public.products add constraint products_amostra_price_check
  check (amostra_price is null or amostra_price >= 0);

alter table public.products drop constraint if exists products_amostra_stock_check;
alter table public.products add constraint products_amostra_stock_check
  check (amostra_stock >= 0);

-- An amostra that is on sale needs a price; without one the storefront would
-- offer it at zero.
alter table public.products drop constraint if exists products_amostra_needs_price;
alter table public.products add constraint products_amostra_needs_price
  check (amostra_enabled = false or amostra_price is not null);

-- The amostra volume and how long its credit lasts are settings, not constants
-- buried in the page.
alter table public.payment_settings
  add column if not exists amostra_volume_ml   integer not null default 5,
  add column if not exists amostra_credit_days integer not null default 30;

-- ------------------------------------------------- unwind the variants ---
-- The rollup trigger owned products.stock; with the variants gone, stock goes
-- back to meaning "full bottles on the shelf". The value is already correct:
-- the rollup equalled the 100 ml variant's stock, which was the product's own
-- stock before the variants were seeded.
drop trigger if exists product_variants_sync_stock on public.product_variants;
drop function if exists public.sync_product_stock();

drop table if exists public.product_variants;
drop table if exists public.product_sizes;

-- The base price was described as the 100 ml price, so any product still
-- carrying no bottle size is set to that rather than left reading "0 ml".
-- Products that already state a size (200 ml, say) are left alone.
update public.products set volume_ml = 100 where coalesce(volume_ml, 0) = 0;

-- ------------------------------------------------------ amostra credit ---
-- A coupon can now be tied to one product and to the full bottle only, which is
-- what the amostra credit is: "the value of the amostra, off this perfume".
alter table public.coupons
  add column if not exists product_id      bigint references public.products(id) on delete cascade,
  add column if not exists applies_to      text not null default 'any',
  add column if not exists source_order_id uuid references public.orders(id) on delete set null;

alter table public.coupons drop constraint if exists coupons_applies_to_check;
alter table public.coupons add constraint coupons_applies_to_check
  check (applies_to in ('any', 'full_bottle'));

-- Codes are matched case-insensitively, so uniqueness has to be too. There was
-- no unique index at all before: two coupons could share a code and
-- validate_coupon would silently pick whichever came first.
create unique index if not exists coupons_code_unique_idx on public.coupons (upper(code));
create index if not exists coupons_source_order_idx on public.coupons (source_order_id);

-- --------------------------------------------- validate_coupon, scoped ---
-- The third argument is the set of products in the cart AS FULL BOTTLES. It
-- defaults to null so every existing caller keeps working; a product-scoped
-- coupon is simply refused when it is not supplied.
create or replace function public.validate_coupon(
  p_code text,
  p_order_total numeric,
  p_full_bottle_product_ids bigint[] default null
)
returns table(valid boolean, reason_code text, discount_type text, discount_value numeric, min_order_value numeric)
language plpgsql
security definer
set search_path to 'public'
as $function$
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

  -- An amostra credit only pays for the full bottle of the same perfume.
  if c.product_id is not null then
    if p_full_bottle_product_ids is null
       or not (c.product_id = any(p_full_bottle_product_ids)) then
      return query select false, 'wrong_product', null::text, null::numeric, null::numeric;
      return;
    end if;
  end if;

  if p_order_total < c.min_order_value then
    return query select false, 'min_order', c.discount_type, c.discount_value, c.min_order_value;
    return;
  end if;

  return query select true, 'ok', c.discount_type, c.discount_value, c.min_order_value;
end;
$function$;

-- ------------------------------------- the credit, granted on delivery ---
-- A trigger rather than application code: the credit has to appear whichever
-- way the order reaches "entregue", including a status changed straight in the
-- database.
create or replace function public.grant_amostra_credits()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  item       jsonb;
  v_days     integer;
  v_code     text;
  v_product  bigint;
  v_value    numeric;
  v_name     text;
begin
  -- Only on the transition into entregue, so re-saving a delivered order does
  -- not mint a second code.
  if new.status is distinct from 'entregue' then return new; end if;
  if old.status is not distinct from 'entregue' then return new; end if;

  select coalesce(amostra_credit_days, 30) into v_days from public.payment_settings where id = 1;
  v_days := coalesce(v_days, 30);

  for item in select * from jsonb_array_elements(coalesce(new.items, '[]'::jsonb)) loop
    continue when coalesce(item->>'variant', '') <> 'amostra';

    v_product := nullif(item->>'id', '')::bigint;
    v_value   := coalesce(nullif(item->>'price', '')::numeric, 0);
    continue when v_product is null or v_value <= 0;

    -- One credit per perfume per order, however many amostras were bought.
    if exists (
      select 1 from public.coupons
      where source_order_id = new.id and product_id = v_product
    ) then
      continue;
    end if;

    select name into v_name from public.products where id = v_product;

    v_code := 'AMOSTRA-' || upper(substr(replace(new.id::text, '-', ''), 1, 6))
              || '-' || v_product::text;

    insert into public.coupons (
      name, code, discount_type, discount_value,
      end_date, max_uses, active,
      product_id, applies_to, source_order_id, owner_customer_id
    ) values (
      'Crédito de amostra · ' || coalesce(v_name, 'perfume'),
      v_code, 'fixed', v_value,
      current_date + v_days, 1, true,
      v_product, 'full_bottle', new.id, new.customer_id
    )
    on conflict do nothing;
  end loop;

  return new;
end;
$function$;

drop trigger if exists orders_grant_amostra_credits on public.orders;
create trigger orders_grant_amostra_credits
  after update of status on public.orders
  for each row execute function public.grant_amostra_credits();

-- `create or replace` above added an OVERLOAD rather than replacing the old
-- two-argument function, because the argument list changed. That left
-- validate_coupon('CODE', 1000) ambiguous — "function is not unique" — which
-- would break every caller that had not been updated. Only the three-argument
-- form should exist.
drop function if exists public.validate_coupon(text, numeric);
