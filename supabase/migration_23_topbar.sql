-- One bar at the top of the site, never two. The banner and the campaign used
-- to be able to show at the same time, which stacked two strips above the
-- header. There is now a single slot in one of three states.

alter table public.payment_settings
  add column if not exists banner_mode text not null default 'off';

alter table public.payment_settings drop constraint if exists payment_settings_banner_mode_check;
alter table public.payment_settings add constraint payment_settings_banner_mode_check
  check (banner_mode in ('off', 'manual', 'campaign'));

-- Carry the existing setting over rather than silently switching the bar off:
-- active with a campaign attached becomes 'campaign', active alone becomes
-- 'manual', anything else is 'off'.
update public.payment_settings
   set banner_mode = case
     when banner_active is not true then 'off'
     when banner_campaign_id is not null then 'campaign'
     else 'manual'
   end
 where banner_mode = 'off';

-- The view resolves the whole thing, so the storefront reads one row and
-- renders it without deciding anything. A campaign bar whose campaign is not
-- running today comes back as 'off'.
--
-- Dropped first rather than replaced: the column list changes, and
-- create-or-replace cannot rename or reorder a view's columns.
drop view if exists public.site_banner;

create view public.site_banner
with (security_invoker = false) as
  select
    case
      when s.banner_mode = 'campaign' and not exists (
        select 1 from public.campaigns c
        where c.id = s.banner_campaign_id
          and c.archived = false
          and current_date between c.start_date and c.end_date
      ) then 'off'
      else s.banner_mode
    end as mode,
    -- A campaign bar says the campaign's name; a manual one says whatever was
    -- typed. Never both.
    case
      when s.banner_mode = 'campaign' then coalesce(nullif(s.banner_text, ''), c.name)
      else s.banner_text
    end as banner_text,
    case when s.banner_mode = 'campaign' then c.name else null end as campaign_name,
    s.banner_cta_label,
    s.banner_cta_url,
    s.banner_campaign_id,
    -- Lets the bar be given a stable id, so dismissing one message does not
    -- also dismiss the next one the shop puts up.
    md5(coalesce(s.banner_mode, '') || coalesce(s.banner_text, '') ||
        coalesce(s.banner_campaign_id::text, '')) as banner_key
  from public.payment_settings s
  left join public.campaigns c on c.id = s.banner_campaign_id
  where s.id = 1;

grant select on public.site_banner to anon, authenticated;
