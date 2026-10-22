-- Dawakraft update: "Uses" (indications) and the Catalogue card layout. Run once in Supabase
-- (SQL Editor -> New query -> paste -> Run), after 0002_segments.sql. Safe to run again.
-- Run this BEFORE deploying the app version that saves "uses", or saving products will fail.

-- Uses = the indications line as in the approved leaflet, e.g. 'Hypertension, Angina'. Optional.
alter table public.products add column if not exists uses text not null default '';

alter table public.products drop constraint if exists products_uses_check;
alter table public.products add constraint products_uses_check check (char_length(uses) <= 140);

-- Allow the new 'catalog' (Catalogue card) template.
alter table public.products drop constraint if exists products_template_check;
alter table public.products add constraint products_template_check
  check (template in ('catalog', 'clean', 'band', 'spotlight'));
