-- ============================================================
-- Mushy Parfum — Expanded account page + referral program
-- Adds a delivery address, a referral code per customer, and an automatic
-- 10%-off coupon minted for the referrer once their invitee signs up.
-- ============================================================

alter table public.customers add column if not exists address text;
alter table public.customers add column if not exists referral_code text unique;
alter table public.customers add column if not exists referred_by uuid references public.customers(id);

alter table public.coupons add column if not exists owner_customer_id uuid references public.customers(id);

-- Coupons are otherwise admin-only (see migration_3_coupons.sql); this adds
-- just enough read access for a customer to see coupons they earned by referring a friend.
drop policy if exists "coupons_owner_select" on public.coupons;
create policy "coupons_owner_select" on public.coupons
  for select using (owner_customer_id = auth.uid());

-- Auto-generate a short, unique referral code for every new customer row.
create or replace function public.set_customer_referral_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.referral_code is null then
    new.referral_code := upper(substr(md5(new.id::text || clock_timestamp()::text), 1, 7));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_customer_referral_code on public.customers;
create trigger trg_set_customer_referral_code
  before insert on public.customers
  for each row execute function public.set_customer_referral_code();

-- Backfill existing customers that predate this column.
update public.customers
set referral_code = upper(substr(md5(id::text || clock_timestamp()::text), 1, 7))
where referral_code is null;

-- Called by the newly-signed-up customer right after their profile is
-- created; mints a one-time 10% coupon owned by the referrer. Runs as
-- SECURITY DEFINER since the referrer's row and the new coupon both sit
-- outside what the invitee's own RLS grants would otherwise allow.
create or replace function public.redeem_referral(p_ref_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referrer_id uuid;
  v_new_code text;
begin
  select id into v_referrer_id from public.customers
  where referral_code = upper(p_ref_code) and id <> auth.uid();

  if v_referrer_id is null then
    return false;
  end if;

  update public.customers
  set referred_by = v_referrer_id
  where id = auth.uid() and referred_by is null;

  if not found then
    return false;
  end if;

  v_new_code := 'REF' || upper(substr(md5(random()::text), 1, 6));

  insert into public.coupons (code, name, discount_type, discount_value, active, max_uses, min_order_value, owner_customer_id)
  values (v_new_code, 'Indicação de amigo', 'percentage', 10, true, 1, 0, v_referrer_id);

  return true;
end;
$$;

select pg_notify('pgrst', 'reload schema');
