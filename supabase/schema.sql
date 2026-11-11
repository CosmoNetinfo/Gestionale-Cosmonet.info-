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

-- Storico di Search Console: una riga per giorno e per pagina.
-- Il cron giornaliero (/api/cron/gsc-snapshot) la riempie, così i dati restano oltre i 16 mesi di Google.
create table if not exists public.gsc_page_daily (
  date        date    not null,
  page        text    not null,
  clicks      integer not null default 0,
  impressions integer not null default 0,
  position    real    not null default 0,
  primary key (date, page)
);
create index if not exists gsc_page_daily_page_idx on public.gsc_page_daily (page, date);
alter table public.gsc_page_daily enable row level security;

-- Da scrivere: coda delle notizie scelte dai feed RSS (pagina "Da scrivere").
create table if not exists public.news_queue (
  url        text primary key,
  title      text not null,
  source     text not null default '',
  cat        text not null default '',
  stato      text not null default 'da_scrivere', -- da_scrivere | scritto | scartato
  note       text,
  added_at   timestamptz not null default now()
);
alter table public.news_queue enable row level security;
-- Permessi per la chiave segreta (serve se compare l'errore 403 sulla coda).
grant all on table public.news_queue to service_role;

-- Fonti RSS importate da OPML (pagina "Da scrivere" → Fonti). Se vuota si usa il catalogo di default.
create table if not exists public.news_sources (
  url   text primary key,
  name  text not null,
  cat   text not null default 'altro',
  lang  text not null default 'it'
);
alter table public.news_sources enable row level security;
grant all on table public.news_sources to service_role;

-- Storico dei post social pubblicati da Cosmo Control (pagina "Pubblica").
create table if not exists public.social_posts (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  testo      text not null,
  link       text,
  canali     jsonb not null default '[]'::jsonb -- [{ "canale": "facebook", "ok": true, "errore": null }]
);
alter table public.social_posts enable row level security;
grant all on table public.social_posts to service_role;
grant usage, select on sequence public.social_posts_id_seq to service_role;

-- Stato dello spazio usato (per la pagina Archivio di Cosmo Control)
create or replace function public.cosmo_db_stato() returns json
language sql security definer set search_path = public, storage as $$
  select json_build_object(
    'db_bytes', pg_database_size(current_database()),
    'storage_bytes', coalesce((select sum((metadata->>'size')::bigint) from storage.objects), 0),
    'tabelle', coalesce((
      select json_agg(json_build_object('nome', c.relname, 'bytes', pg_total_relation_size(c.oid), 'righe', greatest(c.reltuples::bigint, 0)) order by pg_total_relation_size(c.oid) desc)
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'), '[]'::json)
  );
$$;
revoke all on function public.cosmo_db_stato() from public, anon, authenticated;
grant execute on function public.cosmo_db_stato() to service_role;
