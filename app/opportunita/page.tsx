import Link from "next/link";
import { loadArticles } from "@/lib/articles";
import { getQueryPages, normUrl } from "@/lib/gsc";
import { Card, DemoBanner, Kpi, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

const n = (v: number) => v.toLocaleString("it-IT");
const dec = (v: number) => v.toFixed(1).replace(".", ",");

export default async function Opportunita() {
  const [{ articles }, qp] = await Promise.all([loadArticles(), getQueryPages()]);
  if (qp.rows.length === 0) {
    return (
      <>
        <PageHeader title="Opportunità" subtitle="Parole chiave vicine alla prima pagina e link interni consigliati" />
        <DemoBanner title="Attenzione." reason={qp.note ?? "Nessun dato da Search Console al momento."} />
      </>
    );
  }

  const meta = new Map(articles.map((a) => [normUrl(a.url), { id: a.id, title: a.title }]));
  const art = (page: string) => meta.get(normUrl(page));

  // 1) Ricerche in posizione 6-20 con molte impressioni: con un ritocco all'articolo salgono
  const vicine = qp.rows
    .filter((r) => r.position >= 6 && r.position <= 20 && r.impressions >= 20 && art(r.page))
    .map((r) => ({ ...r, potenziale: Math.round(r.impressions * (1 - r.clicks / Math.max(r.impressions, 1))) }))
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 30);

  // 2) Link interni: se due articoli compaiono per le stesse ricerche, quello messo meglio può linkare l'altro
  const perQuery = new Map<string, { page: string; position: number; impressions: number }[]>();
  for (const r of qp.rows) {
    if (r.impressions < 5 || !art(r.page)) continue;
    const list = perQuery.get(r.query) ?? [];
    list.push({ page: normUrl(r.page), position: r.position, impressions: r.impressions });
    perQuery.set(r.query, list);
  }
  const coppie = new Map<string, { da: string; a: string; condivise: string[] }>();
  perQuery.forEach((list, query) => {
    if (list.length < 2) return;
    const ord = [...list].sort((x, y) => x.position - y.position);
    const migliore = ord[0];
    for (const altro of ord.slice(1)) {
      if (altro.page === migliore.page) continue;
      const k = migliore.page + "→" + altro.page;
      const e = coppie.get(k) ?? { da: migliore.page, a: altro.page, condivise: [] };
      e.condivise.push(query);
      coppie.set(k, e);
    }
  });
  const link = Array.from(coppie.values())
    .filter((c) => c.condivise.length >= 2)
    .sort((a, b) => b.condivise.length - a.condivise.length)
    .slice(0, 20);

  const totPot = vicine.reduce((s, r) => s + r.potenziale, 0);

  return (
    <>
      <PageHeader title="Opportunità" subtitle="Parole chiave vicine alla prima pagina e link interni consigliati" />
      {qp.note && <DemoBanner title="Attenzione." reason={qp.note} />}

      <div className="grid grid-cols-3 gap-5">
        <Kpi label="Ricerche a un passo" value={vicine.length} hint="posizione 6-20, almeno 20 impressioni" tone={vicine.length ? "warn" : "default"} />
        <Kpi label="Impressioni in gioco" value={n(totPot)} hint="non diventate click" />
        <Kpi label="Link interni suggeriti" value={link.length} hint="coppie di articoli sulle stesse ricerche" />
      </div>

      <Card className="mt-5 overflow-hidden p-0">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-base font-semibold">Ricerche da spingere</h2>
          <p className="text-xs text-muted">Ultimi 90 giorni. Migliora titolo, paragrafo iniziale e H2 dell&apos;articolo per questa ricerca.</p>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-canvas text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-5 py-3 font-medium">Ricerca</th>
              <th className="px-5 py-3 font-medium">Articolo</th>
              <th className="px-5 py-3 text-right font-medium">Impr.</th>
              <th className="px-5 py-3 text-right font-medium">Click</th>
              <th className="px-5 py-3 text-right font-medium">Pos.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {vicine.map((r) => {
              const a = art(r.page)!;
              return (
                <tr key={r.query + r.page} className="hover:bg-canvas/60">
                  <td className="max-w-xs px-5 py-2.5 font-medium">{r.query}</td>
                  <td className="max-w-sm px-5 py-2.5">
                    <Link href={`/sito/${a.id}`} className="line-clamp-1 hover:text-primary">{a.title}</Link>
                  </td>
                  <td className="px-5 py-2.5 text-right">{n(r.impressions)}</td>
                  <td className="px-5 py-2.5 text-right">{n(r.clicks)}</td>
                  <td className="px-5 py-2.5 text-right">{dec(r.position)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {vicine.length === 0 && <p className="px-5 py-6 text-sm text-muted">Nessuna ricerca in questa fascia.</p>}
      </Card>

      <Card className="mt-5">
        <h2 className="text-base font-semibold">Link interni consigliati</h2>
        <p className="mb-3 text-xs text-muted">
          L&apos;articolo di partenza è quello messo meglio per le ricerche in comune: aggiungi un link verso l&apos;articolo di arrivo.
        </p>
        {link.length === 0 ? (
          <p className="text-sm text-muted">Nessun suggerimento al momento.</p>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {link.map((c) => {
              const da = meta.get(c.da)!;
              const a = meta.get(c.a)!;
              return (
                <li key={c.da + c.a} className="py-3">
                  <div className="flex items-center gap-2">
                    <Link href={`/sito/${da.id}`} className="line-clamp-1 font-medium hover:text-primary">{da.title}</Link>
                    <span className="text-muted">→</span>
                    <Link href={`/sito/${a.id}`} className="line-clamp-1 font-medium hover:text-primary">{a.title}</Link>
                  </div>
                  <div className="mt-1 text-xs text-muted">
                    {c.condivise.length} ricerche in comune, per esempio: {c.condivise.slice(0, 3).join(" · ")}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
