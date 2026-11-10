import Link from "next/link";
import { loadArticles } from "@/lib/articles";
import { getPageHistory, historyInfo, type HistoryDay } from "@/lib/history";
import { daysSince } from "@/lib/review";
import { Badge, Card, DemoBanner, Kpi, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const WINDOW = 28;
const DAY = 86400000;
const day = (iso: string) => Math.floor(Date.parse(iso.slice(0, 10)) / DAY);
const dec = (v: number) => v.toFixed(1).replace(".", ",");

function avg(h: HistoryDay[], from: number, to: number, k: "clicks" | "impressions"): number {
  const len = to - from + 1;
  if (len <= 0) return 0;
  let s = 0;
  for (const r of h) {
    const d = day(r.date);
    if (d >= from && d <= to) s += r[k];
  }
  return s / len;
}

export default async function Impatto() {
  const [{ articles, demo }, info] = await Promise.all([loadArticles(), historyInfo()]);
  if (demo || !info?.last) {
    return (
      <>
        <PageHeader title="Impatto delle revisioni" subtitle="Dopo aver ritoccato un articolo, i click sono saliti?" />
        <DemoBanner title="Mancano i dati." reason="Servono WordPress e lo storico di Search Console su Supabase (vedi pagina Debug)." />
      </>
    );
  }
  const lastData = day(info.last);

  // Data dell'intervento: revisione segnata nel gestionale, altrimenti ultima modifica vera su WordPress
  const cand = articles
    .filter((a) => a.status === "publish")
    .map((a) => {
      const rev = a.reviewedAt ? { date: a.reviewedAt, fonte: "revisione segnata" } : null;
      const mod = a.touched && daysSince(a.date) > 0 && day(a.touched) - day(a.date) >= 7 ? { date: a.touched, fonte: "modifica su WordPress" } : null;
      const ev = rev ?? mod;
      return ev ? { a, ev: day(ev.date), fonte: ev.fonte, evIso: ev.date.slice(0, 10) } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null && lastData - x.ev >= 14 && x.ev - day(x.a.date) >= 7)
    .sort((x, y) => y.ev - x.ev)
    .slice(0, 40);

  const hist: HistoryDay[][] = [];
  for (let i = 0; i < cand.length; i += 8) {
    hist.push(...(await Promise.all(cand.slice(i, i + 8).map((c) => getPageHistory(c.a.url)))));
  }

  const rows = cand
    .map((c, i) => {
      const h = hist[i];
      const afterEnd = Math.min(c.ev + WINDOW, lastData);
      const before = avg(h, c.ev - WINDOW, c.ev - 1, "clicks");
      const after = avg(h, c.ev + 1, afterEnd, "clicks");
      const giorni = afterEnd - c.ev;
      const imprB = avg(h, c.ev - WINDOW, c.ev - 1, "impressions");
      const imprA = avg(h, c.ev + 1, afterEnd, "impressions");
      const delta = before > 0 ? (after - before) / before : after > 0 ? 1 : 0;
      const poco = before * WINDOW < 5 && after * giorni < 5;
      return { ...c, before, after, giorni, imprB, imprA, delta, poco, completo: giorni >= WINDOW };
    })
    .filter((r) => r.giorni >= 14);

  const validi = rows.filter((r) => !r.poco);
  const meglio = validi.filter((r) => r.delta >= 0.15).length;
  const peggio = validi.filter((r) => r.delta <= -0.15).length;
  const med = validi.length ? [...validi].map((r) => r.delta).sort((a, b) => a - b)[Math.floor(validi.length / 2)] : 0;

  return (
    <>
      <PageHeader
        title="Impatto delle revisioni"
        subtitle={`Click al giorno nei ${WINDOW} giorni dopo l'intervento contro i ${WINDOW} prima. Dati fino al ${new Date(info.last).toLocaleDateString("it-IT")}`}
      />
      <div className="grid grid-cols-4 gap-5">
        <Kpi label="Articoli analizzati" value={rows.length} hint="con almeno 14 giorni dopo l'intervento" />
        <Kpi label="Migliorati" value={meglio} tone="ok" hint="click al giorno +15% o più" />
        <Kpi label="Peggiorati" value={peggio} tone={peggio ? "warn" : "default"} hint="click al giorno -15% o meno" />
        <Kpi label="Variazione tipica" value={`${med >= 0 ? "+" : ""}${Math.round(med * 100)}%`} hint="mediana, esclusi i pochi dati" />
      </div>

      <Card className="mt-5 overflow-hidden p-0">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-base font-semibold">Articolo per articolo</h2>
          <p className="text-xs text-muted">
            Come data dell&apos;intervento uso la revisione segnata qui; se manca, l&apos;ultima modifica vera su WordPress. Il confronto non tiene conto di stagionalità e aggiornamenti di Google: è un indizio, non una prova.
          </p>
        </div>
        {rows.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted">Nessun articolo con un intervento di almeno 14 giorni fa e dati sufficienti.</p>
        ) : (
          <table className="w-full text-left text-[13px]">
            <thead className="border-b border-line bg-canvas text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-3 py-3 font-medium">Articolo</th>
                <th className="px-2 py-3 font-medium">Intervento</th>
                <th className="px-2 py-3 text-right font-medium">Click/g prima</th>
                <th className="px-2 py-3 text-right font-medium">Click/g dopo</th>
                <th className="px-2 py-3 text-right font-medium">Impr./g</th>
                <th className="px-2 py-3 text-right font-medium">Esito</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.a.id} className="hover:bg-canvas/60">
                  <td className="max-w-[16rem] px-3 py-3">
                    <Link href={`/sito/${r.a.id}`} className="line-clamp-2 hover:text-primary">{r.a.title}</Link>
                  </td>
                  <td className="px-2 py-3 text-xs text-muted">
                    {new Date(r.evIso).toLocaleDateString("it-IT")}
                    <div>{r.fonte}{r.completo ? "" : ` · ${r.giorni} giorni di dati`}</div>
                  </td>
                  <td className="px-2 py-3 text-right tabular-nums">{dec(r.before)}</td>
                  <td className="px-2 py-3 text-right tabular-nums">{dec(r.after)}</td>
                  <td className="px-2 py-3 text-right text-xs tabular-nums text-muted">{dec(r.imprB)} → {dec(r.imprA)}</td>
                  <td className="px-2 py-3 text-right">
                    {r.poco ? (
                      <Badge tone="neutral">pochi dati</Badge>
                    ) : (
                      <Badge tone={r.delta >= 0.15 ? "ok" : r.delta <= -0.15 ? "warn" : "neutral"}>
                        {r.delta >= 0 ? "+" : ""}{Math.round(r.delta * 100)}%
                      </Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
