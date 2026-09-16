-- Pass 2: what the shop needs to read, and what the campaign report needs to
-- count.

-- The banner can now be attached to a campaign, with a button through to the
-- products on promotion. Still only the banner columns: payment_settings holds
-- the IBAN and stays closed to anonymous visitors.
--
-- banner_campaign_id is exposed as banner_campaign_active rather than as an id
-- the page has to check itself: the view already knows whether that campaign is
-- running, so an attached banner appears and disappears with it.
create or replace view public.site_banner
with (security_invoker = false) as
  select
    s.banner_text,
    s.banner_active,
    s.banner_cta_label,
    s.banner_cta_url,
    s.banner_campaign_id,
    -- null when the banner is not attached to anything, which is what lets a
    -- plain announcement keep working on its own.
    case
      when s.banner_campaign_id is null then null
      else exists (
        select 1 from public.campaigns c
        where c.id = s.banner_campaign_id
          and c.archived = false
          and current_date between c.start_date and c.end_date
      )
    end as banner_campaign_active
  from public.payment_settings s
  where s.id = 1;

grant select on public.site_banner to anon, authenticated;

-- ---------------------------------------------------------------- report ---
-- Orders and revenue per campaign. The campaign is recorded on each order LINE,
-- not on the order, because one order can carry products from two campaigns and
-- products from none. Revenue counts only the lines the campaign actually
-- touched, so a campaign is never credited with the rest of the basket.
create or replace function public.campaign_stats()
returns table (
  campaign_id  bigint,
  order_count  bigint,
  units        bigint,
  revenue      numeric
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select
    (item->>'campaign_id')::bigint            as campaign_id,
    count(distinct o.id)                      as order_count,
    sum((item->>'qty')::int)                  as units,
    sum((item->>'price')::numeric * (item->>'qty')::int) as revenue
  from public.orders o
  cross join lateral jsonb_array_elements(coalesce(o.items, '[]'::jsonb)) as item
  where o.archived = false
    and o.status <> 'cancelado'
    and coalesce(item->>'campaign_id', '') <> ''
  group by 1;
$function$;

grant execute on function public.campaign_stats() to authenticated;
