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
