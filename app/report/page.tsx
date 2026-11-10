import Link from "next/link";
import { loadArticles } from "@/lib/articles";
import { getComparison, getGscDaily, normUrl } from "@/lib/gsc";
import { daysSince, isToReview } from "@/lib/review";
import { Card, DemoBanner, Kpi, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

const n = (v: number) => v.toLocaleString("it-IT");
const pct = (cur: number, prev: number) => (prev ? `${cur >= prev ? "+" : ""}${Math.round(((cur - prev) / prev) * 100)}%` : "—");

export default async function Report() {
  const [{ articles }, daily, cmp] = await Promise.all([loadArticles(), getGscDaily(), getComparison()]);
  const d = daily.days;
  const cur = d.slice(-7);
  const prev = d.slice(-14, -7);
  const sum = (a: typeof d, k: "clicks" | "impressions") => a.reduce((s, x) => s + x[k], 0);

  const meta = new Map(articles.map((a) => [normUrl(a.url), { id: a.id, title: a.title }]));
  const all = Array.from(cmp.byUrl.entries())
    .map(([key, v]) => ({ key, diff: v.cur.clicks - v.prev.clicks, ...v }))
    .filter((x) => meta.has(x.key));
  const saliti = [...all].filter((x) => x.diff > 0).sort((a, b) => b.diff - a.diff).slice(0, 5);
  const calati = [...all].filter((x) => x.diff < 0).sort((a, b) => a.diff - b.diff).slice(0, 5);

  const nuovi = articles.filter((a) => a.status === "publish" && daysSince(a.date) <= 7);
  const programmati = articles.filter((a) => a.status === "future").length;
  const daRivedere = articles.filter(isToReview).length;

  return (
    <>
      <PageHeader title="Report settimanale" subtitle="Gli ultimi 7 giorni contro i 7 precedenti (i dati Google hanno qualche giorno di ritardo)" />
      {d.length < 14 && <DemoBanner title="Attenzione." reason={daily.note ?? "Dati giornalieri insufficienti da Search Console."} />}

      <div className="grid grid-cols-4 gap-5">
        <Kpi label="Click" value={n(sum(cur, "clicks"))} hint={`${pct(sum(cur, "clicks"), sum(prev, "clicks"))} sui 7 giorni prima`} />
        <Kpi label="Impressioni" value={n(sum(cur, "impressions"))} hint={`${pct(sum(cur, "impressions"), sum(prev, "impressions"))} sui 7 giorni prima`} />
        <Kpi label="Nuovi articoli" value={nuovi.length} hint={`${programmati} programmati`} />
        <Kpi label="Da rivedere" value={daRivedere} tone={daRivedere ? "warn" : "ok"} />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-5">
        {[
          { t: "Saliti (ultimi 28 giorni)", list: saliti, segno: "+" },
          { t: "Calati (ultimi 28 giorni)", list: calati, segno: "" },
        ].map((b) => (
          <Card key={b.t}>
            <h2 className="mb-3 text-base font-semibold">{b.t}</h2>
            {b.list.length === 0 ? (
              <p className="text-sm text-muted">Nessuna variazione rilevante.</p>
            ) : (
              <ul className="divide-y divide-line text-sm">
                {b.list.map((x) => {
                  const a = meta.get(x.key)!;
                  return (
                    <li key={x.key} className="flex items-center justify-between gap-3 py-2">
                      <Link href={`/sito/${a.id}`} className="line-clamp-1 hover:text-primary">{a.title}</Link>
                      <span className="shrink-0 text-xs text-muted">{b.segno}{x.diff} click ({cmp.prevLabel} → {cmp.curLabel})</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        ))}
      </div>

      <Card className="mt-5">
        <h2 className="mb-3 text-base font-semibold">Pubblicati questa settimana</h2>
        {nuovi.length === 0 ? (
          <p className="text-sm text-muted">Nessun articolo pubblicato negli ultimi 7 giorni.</p>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {nuovi.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-2">
                <Link href={`/sito/${a.id}`} className="line-clamp-1 hover:text-primary">{a.title}</Link>
                <span className="shrink-0 text-xs text-muted">{new Date(a.date).toLocaleDateString("it-IT")}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
