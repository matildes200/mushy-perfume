-- Indexes for the columns the admin dashboard actually sorts and filters on.
--
-- At 8 orders none of this is measurable; at 500 it is the difference between
-- a paginated page and a sequential scan of the whole table on every keystroke
-- in the search box. Adding them now, while the tables are small, costs
-- nothing and means the dashboard does not degrade as volume arrives.

-- Orders: the list filters by status and archived, sorts by date, and the
-- clients page groups by customer.
create index if not exists orders_customer_id_idx on public.orders (customer_id);
create index if not exists orders_archived_created_idx on public.orders (archived, created_at desc);
create index if not exists orders_status_created_idx on public.orders (status, created_at desc);
-- Search by client name uses ILIKE, which a btree cannot serve. text_pattern_ops
-- handles the prefix case; a trigram index would be needed for infix matching,
-- and that is not worth an extension until the table is large.
create index if not exists orders_customer_name_idx on public.orders (lower(customer_name) text_pattern_ops);

-- Products: the catalogue filters by category and hides archived rows.
create index if not exists products_category_idx on public.products (category);
create index if not exists products_archived_idx on public.products (archived);
create index if not exists products_stock_idx on public.products (stock);

-- Customers: the list is ordered newest first.
create index if not exists customers_created_at_idx on public.customers (created_at desc);

-- Messages: the dashboard counts unanswered ones on every page load.
create index if not exists contact_messages_handled_idx on public.contact_messages (archived, handled);

-- Coupons: looked up by code on every checkout validation.
create index if not exists coupons_active_idx on public.coupons (active);

analyze public.orders;
analyze public.products;
analyze public.customers;
analyze public.contact_messages;
