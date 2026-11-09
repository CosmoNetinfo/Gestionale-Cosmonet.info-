import { loadArticles } from "@/lib/articles";
import { getGscDaily, getGscStats, normUrl } from "@/lib/gsc";
import { Card, DemoBanner, Kpi, PageHeader } from "@/components/ui";
import { LineChart } from "@/components/LineChart";

export const dynamic = "force-dynamic";

const n = (v: number) => v.toLocaleString("it-IT");
const dm = (iso: string) => iso.slice(8, 10) + "/" + iso.slice(5, 7);

export default async function Grafici() {
  const [{ articles, demo }, gsc, daily] = await Promise.all([
    loadArticles(),
    getGscStats(),
    getGscDaily(),
  ]);

  if (!gsc.configured || daily.days.length === 0) {
    return (
      <>
        <PageHeader title="Grafici" subtitle="Andamento di click e impressioni" />
        <DemoBanner
          title="Attenzione."
          reason={gsc.note ?? daily.note ?? "Nessun dato da Search Console al momento."}
        />
      </>
    );
  }

  const clicks = daily.days.reduce((s, d) => s + d.clicks, 0);
  const impr = daily.days.reduce((s, d) => s + d.impressions, 0);
  const ctr = impr ? (clicks / impr) * 100 : 0;

  // Per categoria e migliori articoli (solo pubblicati con dati)
  type Cat = { cat: string; articoli: number; click: number; impr: number };
  const cats = new Map<string, Cat>();
  const top: { id: number; titolo: string; url: string; click: number; impr: number }[] = [];
  for (const a of articles) {
    if (a.status !== "publish") continue;
    const g = gsc.byUrl.get(normUrl(a.url));
    const c = cats.get(a.category) ?? { cat: a.category, articoli: 0, click: 0, impr: 0 };
    c.articoli += 1;
    c.click += g?.clicks ?? 0;
    c.impr += g?.impressions ?? 0;
    cats.set(a.category, c);
    if (g) top.push({ id: a.id, titolo: a.title, url: a.url, click: g.clicks, impr: g.impressions });
  }
  const catRows = Array.from(cats.values()).sort((a, b) => b.click - a.click);
  const maxCatClick = Math.max(1, ...catRows.map((c) => c.click));
  top.sort((a, b) => b.click - a.click);

  return (
    <>
      <PageHeader
        title="Grafici"
        subtitle={`Search Console, ultimi ${gsc.days} giorni (i dati hanno 2-3 giorni di ritardo)`}
      />
      {demo && <DemoBanner reason="Gli articoli di WordPress sono dimostrativi: le categorie qui sotto non sono reali." />}

      <div className="grid grid-cols-3 gap-5">
        <Kpi label="Click" value={n(clicks)} />
        <Kpi label="Impressioni" value={n(impr)} />
        <Kpi label="CTR medio" value={ctr.toFixed(1).replace(".", ",") + "%"} hint="click ÷ impressioni" />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-5">
        <Card>
          <h2 className="mb-2 text-base font-semibold">Click al giorno</h2>
          <LineChart data={daily.days.map((d) => d.clicks)} labels={daily.days.map((d) => dm(d.date))} />
        </Card>
        <Card>
          <h2 className="mb-2 text-base font-semibold">Impressioni al giorno</h2>
          <LineChart data={daily.days.map((d) => d.impressions)} labels={daily.days.map((d) => dm(d.date))} />
        </Card>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-5">
        <Card>
          <h2 className="mb-4 text-base font-semibold">Click per categoria</h2>
          <ul className="space-y-3">
            {catRows.map((c) => (
              <li key={c.cat}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="font-medium">{c.cat}</span>
                  <span className="text-muted">
                    {n(c.click)} click · {n(c.articoli)} articoli
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-primary-soft">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${(c.click / maxCatClick) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <h2 className="mb-4 text-base font-semibold">Articoli con più click</h2>
          <ul className="divide-y divide-line">
            {top.slice(0, 10).map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 py-2.5">
                <a href={t.url} target="_blank" rel="noreferrer" className="min-w-0 truncate text-sm font-medium hover:text-primary">
                  {t.titolo}
                </a>
                <span className="shrink-0 text-sm text-muted">
                  <strong className="text-ink">{n(t.click)}</strong> click · {n(t.impr)} impr.
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
