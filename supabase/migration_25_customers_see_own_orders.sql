-- Customers could not place an order at all. This is why.
--
-- public.orders had exactly one SELECT policy, is_admin(). No policy let a
-- customer read their own row. That looks like it would only empty out "Os
-- seus pedidos", but it also breaks checkout outright, because of how the
-- insert is written:
--
--     supabaseClient.from("orders").insert({ ... }).select().single()
--
-- PostgREST turns that into INSERT ... RETURNING, and PostgreSQL will not
-- return a row the reader has no SELECT policy for. The whole statement
-- aborts with "new row violates row-level security policy", the insert rolls
-- back with it, and js/checkout.js reports the generic failure. Reproduced
-- exactly: the same INSERT without RETURNING succeeds, with RETURNING fails.
--
-- It went unnoticed because every order that ever succeeded on a linked
-- account was placed from an admin account, where is_admin() is true and the
-- read-back is allowed. On 29 September a customer account uploaded nine
-- receipts in four minutes and created zero orders.
--
-- Scoped to the customer's own rows: customer_id = auth.uid() and nothing
-- else. A guest order carries no customer_id, so it stays invisible to
-- everyone but an admin, which is what the is_admin() policy beside this one
-- is for.

drop policy if exists orders_owner_select on public.orders;
create policy orders_owner_select on public.orders
  for select
  using (customer_id = auth.uid());
