-- Removes B2 (fixação e projecção) from the database. The feature was dropped;
-- nothing reads these columns any more, and no view, filter or index outside
-- this file referenced them.
--
-- The constraints and the index go with the columns automatically when the
-- columns are dropped, but they are named here so the intent is on the record.

drop index if exists public.products_fixacao_idx;

alter table public.products drop constraint if exists products_fixacao_check;
alter table public.products drop constraint if exists products_projecao_check;

alter table public.products
  drop column if exists fixacao,
  drop column if exists projecao;
