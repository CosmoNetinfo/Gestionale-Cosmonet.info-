import Link from "next/link";
import { loadArticles } from "@/lib/articles";
import { gscEndDate, gscRows, isoDate, normUrl, type GscRow } from "@/lib/gsc";
import { Card, DemoBanner, Kpi, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const n = (v: number) => v.toLocaleString("it-IT");
const dec = (v: number) => v.toFixed(1).replace(".", ",");
const D = 86400000;

type Q = { clicks: number; impressions: number; position: number };

function toMap(rows: GscRow[]): Map<string, Q> {
  const m = new Map<string, Q>();
  for (const r of rows) m.set(r.keys[0], { clicks: r.clicks, impressions: r.impressions, position: r.position });
  return m;
}

export default async function Ricerche({ searchParams }: { searchParams: { q?: string } }) {
  const end = gscEndDate();
  const curStart = new Date(end.getTime() - 27 * D);
  const prevEnd = new Date(curStart.getTime() - D);
  const prevStart = new Date(prevEnd.getTime() - 27 * D);
  const [cur, prev, pq, { articles }] = await Promise.all([
    gscRows({ startDate: isoDate(curStart), endDate: isoDate(end), dimensions: ["query"] }, { maxPages: 2, revalidate: 3600 }),
    gscRows({ startDate: isoDate(prevStart), endDate: isoDate(prevEnd), dimensions: ["query"] }, { maxPages: 2, revalidate: 3600 }),
    gscRows({ startDate: isoDate(curStart), endDate: isoDate(end), dimensions: ["query", "page"] }, { maxPages: 2, revalidate: 3600 }),
    loadArticles(),
  ]);
  if (cur.rows.length === 0) {
    return (
      <>
        <PageHeader title="Ricerche" subtitle="Cosa cercano le persone per arrivare da te" />
        <DemoBanner title="Attenzione." reason={cur.note ?? "Nessun dato da Search Console al momento."} />
      </>
    );
  }

  const C = toMap(cur.rows);
  const P = toMap(prev.rows);
  const filtro = (searchParams.q ?? "").trim().toLowerCase();

  // pagina migliore per ogni ricerca (più impressioni)
  const meta = new Map(articles.map((a) => [normUrl(a.url), { id: a.id, title: a.title }]));
  const best = new Map<string, { page: string; impressions: number }>();
  for (const r of pq.rows) {
    const e = best.get(r.keys[0]);
    if (!e || r.impressions > e.impressions) best.set(r.keys[0], { page: normUrl(r.keys[1]), impressions: r.impressions });
  }
  const art = (q: string) => {
    const b = best.get(q);
    return b ? meta.get(b.page) : undefined;
  };

  const all = Array.from(C.entries()).map(([query, v]) => ({ query, ...v }));
  const tot = all.reduce((s, x) => s + x.clicks, 0);
  const nuove = all.filter((x) => !P.has(x.query) && x.impressions >= 10).sort((a, b) => b.impressions - a.impressions).slice(0, 15);
  const perse = Array.from(P.entries())
    .filter(([q, v]) => !C.has(q) && v.impressions >= 15)
    .map(([query, v]) => ({ query, ...v }))
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 15);
  const senzaClick = all.filter((x) => x.clicks === 0 && x.impressions >= 50).sort((a, b) => b.impressions - a.impressions).slice(0, 20);
  const top = all.filter((x) => !filtro || x.query.toLowerCase().includes(filtro)).sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions).slice(0, 40);

  const Tabella = ({ rows, prevCol }: { rows: { query: string; clicks: number; impressions: number; position: number }[]; prevCol?: boolean }) => (
    <table className="w-full text-left text-[13px]">
      <thead className="border-b border-line bg-canvas text-xs uppercase tracking-wide text-muted">
        <tr>
          <th className="px-3 py-2.5 font-medium">Ricerca</th>
          <th className="px-2 py-2.5 font-medium">Articolo</th>
          <th className="px-2 py-2.5 text-right font-medium">Impr.</th>
          <th className="px-2 py-2.5 text-right font-medium">Click</th>
          <th className="px-2 py-2.5 text-right font-medium">Pos.</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {rows.map((r) => {
          const a = art(r.query);
          return (
            <tr key={r.query} className="hover:bg-canvas/60">
              <td className="max-w-[14rem] px-3 py-2.5">{r.query}</td>
              <td className="max-w-[12rem] px-2 py-2.5 text-xs">
                {a ? <Link href={`/sito/${a.id}`} className="line-clamp-1 hover:text-primary">{a.title}</Link> : <span className="text-muted">{prevCol ? "—" : "altra pagina"}</span>}
              </td>
              <td className="px-2 py-2.5 text-right tabular-nums">{n(r.impressions)}</td>
              <td className="px-2 py-2.5 text-right tabular-nums">{n(r.clicks)}</td>
              <td className="px-2 py-2.5 text-right tabular-nums">{dec(r.position)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  const box = (titolo: string, nota: string, rows: typeof all, prevCol = false) => (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-line px-5 py-4">
        <h2 className="text-base font-semibold">{titolo}</h2>
        <p className="text-xs text-muted">{nota}</p>
      </div>
      {rows.length ? <Tabella rows={rows} prevCol={prevCol} /> : <p className="px-5 py-5 text-sm text-muted">Niente da segnalare.</p>}
    </Card>
  );

  return (
    <>
      <PageHeader
        title="Ricerche"
        subtitle={`Ultimi 28 giorni (${isoDate(curStart).slice(8, 10)}/${isoDate(curStart).slice(5, 7)} – ${isoDate(end).slice(8, 10)}/${isoDate(end).slice(5, 7)}) contro i 28 precedenti`}
      />
      <div className="grid grid-cols-4 gap-5">
        <Kpi label="Ricerche diverse" value={n(all.length)} hint="che hanno mostrato il sito" />
        <Kpi label="Click" value={n(tot)} />
        <Kpi label="Nuove" value={nuove.length} tone={nuove.length ? "ok" : "default"} hint="non c'erano nei 28 giorni prima" />
        <Kpi label="Sparite" value={perse.length} tone={perse.length ? "warn" : "default"} hint="c'erano prima, ora no" />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-5">
        {box("Ricerche nuove", "Compaiono da poco: segnali di argomenti da coprire meglio.", nuove)}
        {box("Ricerche sparite", "Mostravano il sito e ora no: controlla l'articolo collegato.", perse, true)}
      </div>
      <div className="mt-5">{box("Impressioni senza click", "Almeno 50 impressioni e nessun click: titolo e descrizione non convincono, oppure la risposta è già sotto gli occhi in Google.", senzaClick)}</div>

      <Card className="mt-5 overflow-hidden p-0">
        <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 className="text-base font-semibold">Tutte le ricerche</h2>
            <p className="text-xs text-muted">Le prime 40 per click. Cerca una parola per filtrare.</p>
          </div>
          <form className="flex gap-2">
            <input name="q" defaultValue={searchParams.q ?? ""} placeholder="Cerca…" className="w-44 rounded-md border border-line px-2 py-1 text-sm" />
            <button className="rounded-md border border-line px-3 py-1 text-sm hover:border-primary hover:text-primary">Filtra</button>
          </form>
        </div>
        {top.length ? <Tabella rows={top} /> : <p className="px-5 py-5 text-sm text-muted">Nessuna ricerca con questa parola.</p>}
      </Card>
    </>
  );
}
