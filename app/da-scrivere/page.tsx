import Link from "next/link";
import { getNews, codaMarkdown } from "@/lib/news";
import { Badge, Card, Kpi, PageHeader } from "@/components/ui";
import { CopyButton } from "@/components/CopyButton";
import { agendaAttiva } from "@/lib/agenda";
import { aggiungiInCoda, cambiaStato, mettiInAgenda } from "./actions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ORE = [
  { v: 24, l: "24 ore" },
  { v: 72, l: "3 giorni" },
  { v: 168, l: "7 giorni" },
];

const quando = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("it-IT", { timeZone: "Europe/Rome", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";

export default async function DaScrivere({ searchParams }: { searchParams: { ore?: string; cat?: string; scritti?: string; agenda?: string } }) {
  const ore = [24, 72, 168].includes(Number(searchParams.ore)) ? Number(searchParams.ore) : 24;
  const mostraScritti = searchParams.scritti === "1";
  const { items, fonti, fontiVuote, coda, codaMancante, categorie, sorgente } = await getNews({ ore, cat: searchParams.cat || undefined });
  const cat = categorie.some((c) => c.id === searchParams.cat) ? searchParams.cat : undefined;
  const visibili = items.filter((n) => mostraScritti || !n.simile);
  const daScrivere = coda.filter((q) => q.stato === "da_scrivere");
  const href = (o: Partial<{ ore: number; cat: string; scritti: string }>) => {
    const p = new URLSearchParams();
    const m = { ore, cat, scritti: mostraScritti ? "1" : undefined, ...o };
    for (const [k, v] of Object.entries(m)) if (v) p.set(k, String(v));
    return `/da-scrivere?${p}`;
  };
  const chip = (attivo: boolean) =>
    "rounded-full border px-3 py-1 text-xs " + (attivo ? "border-primary bg-primary-soft text-primary-dark" : "border-line text-muted hover:border-primary");

  return (
    <>
      <PageHeader
        title="Da scrivere"
        subtitle="Notizie dai tuoi feed, senza quelle su cui hai già un articolo"
        right={
          <Link href="/da-scrivere/fonti" className="rounded-md border border-line px-3 py-1.5 text-sm text-muted hover:border-primary hover:text-primary">
            Fonti ({fonti}) · {sorgente === "database" ? "importate" : "catalogo"}
          </Link>
        }
      />

      {searchParams.agenda === "ok" && (
        <div className="mb-5 rounded-card border border-ok/30 bg-ok-soft px-4 py-3 text-sm text-ok">Messa su Cosmo Agenda per oggi (e in coda).</div>
      )}
      {searchParams.agenda === "errore" && (
        <div className="mb-5 rounded-card border border-warn/30 bg-warn-soft px-4 py-3 text-sm text-warn">
          Cosmo Agenda non ha risposto: controlla che AGENDA_URL sia impostata su Vercel.
        </div>
      )}

      {codaMancante && (
        <div className="mb-5 rounded-card border border-warn/30 bg-warn-soft px-4 py-3 text-sm text-warn">
          <strong>La coda non è ancora attiva:</strong> {codaMancante}. Puoi comunque leggere le notizie.
        </div>
      )}

      <div className="grid grid-cols-4 gap-5">
        <Kpi label="Notizie trovate" value={items.length} hint={`ultime ${ORE.find((o) => o.v === ore)?.l}`} />
        <Kpi label="Già scritte da te" value={items.filter((n) => n.simile).length} hint="nascoste di default" />
        <Kpi label="In coda da scrivere" value={daScrivere.length} tone={daScrivere.length ? "ok" : "default"} />
        <Kpi label="Fonti che rispondono" value={`${fonti - fontiVuote.length}/${fonti}`} tone={fontiVuote.length > 5 ? "warn" : "default"} />
      </div>

      {daScrivere.length > 0 && (
        <Card className="mt-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold">In coda ({daScrivere.length})</h2>
            <CopyButton text={codaMarkdown(coda)} label="Copia come Markdown" />
          </div>
          <ul className="divide-y divide-line text-sm">
            {daScrivere.map((q) => (
              <li key={q.url} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <a href={q.url} target="_blank" rel="noreferrer" className="block truncate font-medium hover:text-primary">
                    {q.title}
                  </a>
                  <span className="text-xs text-muted">{q.source}</span>
                </div>
                {(["scritto", "scartato", "rimuovi"] as const).map((s) => (
                  <form action={cambiaStato} key={s}>
                    <input type="hidden" name="url" value={q.url} />
                    <input type="hidden" name="title" value={q.title} />
                    <input type="hidden" name="stato" value={s} />
                    <button className="rounded-md border border-line px-2 py-1 text-xs text-muted hover:border-primary hover:text-primary">
                      {s === "scritto" ? "Scritto" : s === "scartato" ? "Scarta" : "Togli"}
                    </button>
                  </form>
                ))}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">Claude legge questa coda da solo (strumento «news_queue»): puoi dirgli «scrivi il primo della coda».</p>
        </Card>
      )}

      <Card className="mt-5">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {ORE.map((o) => (
            <Link key={o.v} href={href({ ore: o.v })} className={chip(o.v === ore)}>
              {o.l}
            </Link>
          ))}
          <span className="mx-2 text-line">|</span>
          <Link href={href({ cat: "" })} className={chip(!cat)}>
            Tutte
          </Link>
          {categorie.map((c) => (
            <Link key={c.id} href={href({ cat: c.id })} className={chip(cat === c.id)}>
              {c.label}
            </Link>
          ))}
          <span className="mx-2 text-line">|</span>
          <Link href={href({ scritti: mostraScritti ? "" : "1" })} className={chip(mostraScritti)}>
            {mostraScritti ? "Mostro anche i già scritti" : "Mostra anche i già scritti"}
          </Link>
        </div>

        {visibili.length === 0 ? (
          <p className="py-6 text-sm text-muted">Nessuna notizia in questo periodo. Prova con 3 o 7 giorni.</p>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {visibili.map((n) => (
              <li key={n.url} className="flex items-start gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <a href={n.url} target="_blank" rel="noreferrer" className="font-medium hover:text-primary">
                    {n.title}
                  </a>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                    <span>{n.source}</span>
                    <span>·</span>
                    <span>{quando(n.date)}</span>
                    <Badge tone="neutral">{n.lang === "it" ? "italiano" : "inglese"}</Badge>
                    {n.simile && (
                      <a href={n.simile.url} target="_blank" rel="noreferrer">
                        <Badge tone="warn">forse già scritto: {n.simile.title.slice(0, 50)}</Badge>
                      </a>
                    )}
                  </div>
                  {n.snippet && <p className="mt-1 line-clamp-2 text-xs text-muted">{n.snippet}</p>}
                </div>
                {n.inCoda ? (
                  <Badge tone={n.inCoda === "da_scrivere" ? "ok" : "neutral"}>{n.inCoda === "da_scrivere" ? "in coda" : n.inCoda}</Badge>
                ) : (
                  <form action={aggiungiInCoda}>
                    <input type="hidden" name="url" value={n.url} />
                    <input type="hidden" name="title" value={n.title} />
                    <input type="hidden" name="source" value={n.source} />
                    <input type="hidden" name="cat" value={n.cat} />
                    <button className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-dark">Da scrivere</button>
                  </form>
                )}
                {!n.inCoda && agendaAttiva() && (
                  <form action={mettiInAgenda}>
                    <input type="hidden" name="url" value={n.url} />
                    <input type="hidden" name="title" value={n.title} />
                    <input type="hidden" name="source" value={n.source} />
                    <input type="hidden" name="cat" value={n.cat} />
                    <button className="rounded-md border border-line px-3 py-1.5 text-xs text-muted hover:border-primary hover:text-primary">Metti su Cosmo Agenda</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
        {fontiVuote.length > 0 && <p className="mt-4 text-xs text-muted">Fonti senza risposta ora: {fontiVuote.join(", ")}.</p>}
      </Card>
    </>
  );
}
