-- Dawakraft update: the promotional circular. Run once in Supabase
-- (SQL Editor -> New query -> paste -> Run), after 0003_uses.sql. Safe to run again.
-- Run this BEFORE deploying the app version that saves promo content or uses AI copy and photos,
-- or saving products (and the copy / photo rate limits) will fail.

-- Promo = the circular's own content (headline, sections, indications, price ticket, photo path),
-- shaped by parsePromo() in src/lib/promo.ts. Empty object means "not written yet".
alter table public.products add column if not exists promo jsonb not null default '{}'::jsonb;

alter table public.products drop constraint if exists products_promo_check;
alter table public.products add constraint products_promo_check
  check (jsonb_typeof(promo) = 'object' and pg_column_size(promo) < 16384);

-- Allow the new 'promo' (promotional circular) template.
alter table public.products drop constraint if exists products_template_check;
alter table public.products add constraint products_template_check
  check (template in ('catalog', 'clean', 'band', 'spotlight', 'promo'));

-- AI usage log: add 'copy' (AI copywriter) and 'photo' (AI lifestyle photo) next to 'read' and 'sort'.
-- The original inline check in 0001_init.sql is named ai_usage_kind_check by Postgres.
alter table public.ai_usage drop constraint if exists ai_usage_kind_check;
alter table public.ai_usage add constraint ai_usage_kind_check
  check (kind in ('read', 'sort', 'copy', 'photo'));
