-- Cosmo Control: tabella delle revisioni.
-- Incolla tutto nello SQL Editor di Supabase e premi Run.

create table if not exists public.article_reviews (
  article_id  bigint primary key,
  reviewed_at timestamptz not null default now(),
  note        text
);

-- Sicurezza: RLS attiva e nessuna policy = nessun accesso dalla chiave pubblica.
-- Il gestionale usa la chiave segreta lato server, che passa comunque.
alter table public.article_reviews enable row level security;
