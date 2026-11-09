import Link from "next/link";
import { loadArticles } from "@/lib/articles";
import { getComparison, getQueryPages, normUrl } from "@/lib/gsc";
import { Badge, Card, DemoBanner, Kpi, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

const n = (v: number) => v.toLocaleString("it-IT");
const dec = (v: number) => v.toFixed(1).replace(".", ",");

export default async function Avvisi() {
  const [{ articles }, cmp, qp] = await Promise.all([loadArticles(), getComparison(), getQueryPages()]);

  if (cmp.byUrl.size === 0 && qp.rows.length === 0) {
    return (
      <>
        <PageHeader title="Avvisi" subtitle="Cali, crescite e articoli in concorrenza tra loro" />
        <DemoBanner title="Attenzione." reason={cmp.note ?? qp.note ?? "Nessun dato da Search Console al momento."} />
      </>
    );
  }

  const meta = new Map(articles.map((a) => [normUrl(a.url), { id: a.id, title: a.title }]));
  const label = (key: string) => meta.get(key) ?? { id: 0, title: "/" + key.split("/").slice(1).join("/") };

  // Cali e crescite: ultimi 28 giorni contro i 28 precedenti
  const all = Array.from(cmp.byUrl.entries()).map(([key, v]) => ({ key, ...v }));
  const cali = all
    .filter((x) => x.prev.clicks >= 10 && x.cur.clicks <= x.prev.clicks * 0.7)
    .sort((a, b) => b.prev.clicks - b.cur.clicks - (a.prev.clicks - a.cur.clicks))
    .slice(0, 15);
  const crescite = all
    .filter((x) => x.cur.clicks - x.prev.clicks >= 10 && x.cur.clicks >= x.prev.clicks * 1.5)
    .sort((a, b) => b.cur.clicks - b.prev.clicks - (a.cur.clicks - a.prev.clicks))
    .slice(0, 15);

  // Cannibalizzazione: stessa ricerca, più articoli tuoi che si contendono la pagina
  type P = { key: string; clicks: number; impressions: number; position: number };
  const perQuery = new Map<string, Map<string, P>>();
  for (const r of qp.rows) {
    if (r.impressions < 5) continue;
    const key = normUrl(r.page);
    const pages = perQuery.get(r.query) ?? new Map<string, P>();
    const e = pages.get(key);
    if (e) {
      const imp = e.impressions + r.impressions;
      e.position = (e.position * e.impressions + r.position * r.impressions) / imp;
      e.clicks += r.clicks;
      e.impressions = imp;
    } else {
      pages.set(key, { key, clicks: r.clicks, impressions: r.impressions, position: r.position });
    }
    perQuery.set(r.query, pages);
  }
  const cannib = Array.from(perQuery.entries())
    .map(([query, pages]) => {
      const list = Array.from(pages.values()).sort((a, b) => a.position - b.position);
      return { query, list, total: list.reduce((s, p) => s + p.impressions, 0) };
    })
    .filter((x) => x.list.length >= 2 && x.total >= 50)
    .sort((a, b) => b.total - a.total)
    .slice(0, 25);

  const Delta = ({ cur, prev }: { cur: number; prev: number }) => {
    const d = cur - prev;
    return (
      <span className={d < 0 ? "text-danger" : "text-ok"}>
        {d > 0 ? "+" : ""}
        {n(d)}
      </span>
    );
  };

  const Table = ({ rows, empty }: { rows: typeof cali; empty: string }) => (
    <table className="w-full text-left text-sm">
      <thead className="border-b border-line bg-canvas text-xs uppercase tracking-wide text-muted">
        <tr>
          <th className="px-5 py-3 font-medium">Articolo</th>
          <th className="px-5 py-3 text-right font-medium">Click prima</th>
          <th className="px-5 py-3 text-right font-medium">Click ora</th>
          <th className="px-5 py-3 text-right font-medium">Diff.</th>
          <th className="px-5 py-3 text-right font-medium">Pos. prima → ora</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {rows.length === 0 && (
          <tr><td colSpan={5} className="px-5 py-8 text-center text-muted">{empty}</td></tr>
        )}
        {rows.map((x) => {
          const m = label(x.key);
          return (
            <tr key={x.key} className="hover:bg-canvas/60">
              <td className="max-w-md px-5 py-2.5">
                {m.id ? (
                  <Link href={`/sito/${m.id}`} className="line-clamp-1 font-medium hover:text-primary">{m.title}</Link>
                ) : (
                  <span className="line-clamp-1 font-medium">{m.title}</span>
                )}
              </td>
              <td className="px-5 py-2.5 text-right text-muted">{n(x.prev.clicks)}</td>
              <td className="px-5 py-2.5 text-right">{n(x.cur.clicks)}</td>
              <td className="px-5 py-2.5 text-right"><Delta cur={x.cur.clicks} prev={x.prev.clicks} /></td>
              <td className="px-5 py-2.5 text-right text-muted">
                {x.prev.position ? dec(x.prev.position) : "—"} → {x.cur.position ? dec(x.cur.position) : "—"}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  return (
    <>
      <PageHeader
        title="Avvisi"
        subtitle={`Ultimi 28 giorni (${cmp.curLabel}) contro i 28 precedenti (${cmp.prevLabel})`}
      />
      {(cmp.note || qp.note) && <DemoBanner title="Attenzione." reason={cmp.note ?? qp.note ?? ""} />}

      <div className="grid grid-cols-3 gap-5">
        <Kpi label="Articoli in calo" value={cali.length} hint="click scesi di almeno il 30%" tone={cali.length ? "warn" : "ok"} />
        <Kpi label="Articoli in crescita" value={crescite.length} hint="click saliti di almeno il 50%" tone="ok" />
        <Kpi label="Ricerche in concorrenza" value={cannib.length} hint="più articoli per la stessa ricerca" tone={cannib.length ? "warn" : "ok"} />
      </div>

      <Card className="mt-5 overflow-hidden p-0">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-base font-semibold">In calo</h2>
          <p className="text-xs text-muted">Solo articoli che avevano almeno 10 click nel periodo precedente. Sono i primi da rivedere.</p>
        </div>
        <Table rows={cali} empty="Nessun articolo in calo marcato." />
      </Card>

      <Card className="mt-5 overflow-hidden p-0">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-base font-semibold">In crescita</h2>
          <p className="text-xs text-muted">Stanno funzionando: conviene rinforzarli con link interni o un aggiornamento.</p>
        </div>
        <Table rows={crescite} empty="Nessun articolo in forte crescita." />
      </Card>

      <Card className="mt-5 overflow-hidden p-0">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-base font-semibold">Articoli in concorrenza tra loro</h2>
          <p className="text-xs text-muted">
            Stessa ricerca, più articoli di Cosmonet in classifica (ultimi 90 giorni). Spesso conviene tenere il più forte,
            rinforzarlo e collegare gli altri.
          </p>
        </div>
        <div className="divide-y divide-line">
          {cannib.length === 0 && <p className="px-5 py-8 text-center text-sm text-muted">Nessuna concorrenza interna rilevante.</p>}
          {cannib.map((c) => (
            <div key={c.query} className="px-5 py-3">
              <div className="mb-1.5 flex items-center gap-2">
                <span className="font-medium">{c.query}</span>
                <Badge tone="warn">{n(c.total)} impr.</Badge>
              </div>
              <ul className="space-y-1 text-sm">
                {c.list.map((p, i) => {
                  const m = label(p.key);
                  return (
                    <li key={p.key} className="flex items-center justify-between gap-4">
                      <span className="line-clamp-1">
                        {i === 0 && <span className="mr-1 text-ok">★</span>}
                        {m.id ? <Link href={`/sito/${m.id}`} className="hover:text-primary">{m.title}</Link> : m.title}
                      </span>
                      <span className="shrink-0 text-xs text-muted">
                        pos. {dec(p.position)} · {n(p.clicks)} click · {n(p.impressions)} impr.
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
