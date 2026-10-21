-- Dawakraft update: new launch vs existing. Run once in Supabase (SQL Editor -> New query -> paste -> Run),
-- after 0001_init.sql. Safe to run again.
-- launched_at = when the product launched. Empty means an existing product.
-- The app treats a product as a new launch for 60 days after this date, then as existing.
alter table public.products add column if not exists launched_at timestamptz;

create index if not exists products_owner_launched_idx on public.products (owner_id, launched_at desc);
