import { loadArticles } from "@/lib/articles";
import { getComparison, gscEndDate, gscRows, isoDate, normUrl, type GscRow } from "@/lib/gsc";
import { Badge, Card, DemoBanner, Kpi, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const n = (v: number) => v.toLocaleString("it-IT");
const D = 86400000;

const PAESI: Record<string, string> = {
  ita: "Italia", usa: "Stati Uniti", gbr: "Regno Unito", deu: "Germania", fra: "Francia", esp: "Spagna", che: "Svizzera", aut: "Austria",
  bel: "Belgio", nld: "Paesi Bassi", prt: "Portogallo", bra: "Brasile", can: "Canada", aus: "Australia", ind: "India", rou: "Romania",
  pol: "Polonia", alb: "Albania", mlt: "Malta", irl: "Irlanda", swe: "Svezia", nor: "Norvegia", dnk: "Danimarca", fin: "Finlandia",
  grc: "Grecia", tur: "Turchia", rus: "Russia", ukr: "Ucraina", mex: "Messico", arg: "Argentina", jpn: "Giappone", chn: "Cina",
  hrv: "Croazia", svn: "Slovenia", cze: "Cechia", hun: "Ungheria", san: "San Marino", vat: "Vaticano", mar: "Marocco", tun: "Tunisia",
};
const DEVICE: Record<string, string> = { mobile: "Telefono", desktop: "Computer", tablet: "Tablet" };

type Tot = { clicks: number; impressions: number };
const pct = (cur: number, prev: number) => (prev ? `${cur >= prev ? "+" : ""}${Math.round(((cur - prev) / prev) * 100)}%` : "—");
const tone = (cur: number, prev: number) => (!prev ? "neutral" : cur >= prev * 1.1 ? "ok" : cur <= prev * 0.9 ? "warn" : "neutral") as "ok" | "warn" | "neutral";

function map(rows: GscRow[], label: (k: string) => string): Map<string, Tot> {
  const m = new Map<string, Tot>();
  for (const r of rows) {
    const k = label(r.keys[0]);
    const e = m.get(k) ?? { clicks: 0, impressions: 0 };
    e.clicks += r.clicks;
    e.impressions += r.impressions;
    m.set(k, e);
  }
  return m;
}

function Tabella({ titolo, nota, cur, prev, max = 12 }: { titolo: string; nota: string; cur: Map<string, Tot>; prev: Map<string, Tot>; max?: number }) {
  const righe = Array.from(cur.entries()).sort((a, b) => b[1].clicks - a[1].clicks || b[1].impressions - a[1].impressions).slice(0, max);
  const totale = Array.from(cur.values()).reduce((s, x) => s + x.clicks, 0) || 1;
  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-line px-5 py-4">
        <h2 className="text-base font-semibold">{titolo}</h2>
        <p className="text-xs text-muted">{nota}</p>
      </div>
      <table className="w-full text-left text-[13px]">
        <thead className="border-b border-line bg-canvas text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="px-3 py-2.5 font-medium">&nbsp;</th>
            <th className="px-2 py-2.5 text-right font-medium">Click</th>
            <th className="px-2 py-2.5 text-right font-medium">Quota</th>
            <th className="px-2 py-2.5 text-right font-medium">Impr.</th>
            <th className="px-2 py-2.5 text-right font-medium">Click vs prima</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {righe.map(([k, v]) => {
            const p = prev.get(k);
            return (
              <tr key={k} className="hover:bg-canvas/60">
                <td className="max-w-[14rem] px-3 py-2.5">{k}</td>
                <td className="px-2 py-2.5 text-right tabular-nums">{n(v.clicks)}</td>
                <td className="px-2 py-2.5 text-right tabular-nums text-muted">{Math.round((v.clicks / totale) * 100)}%</td>
                <td className="px-2 py-2.5 text-right tabular-nums">{n(v.impressions)}</td>
                <td className="px-2 py-2.5 text-right"><Badge tone={tone(v.clicks, p?.clicks ?? 0)}>{pct(v.clicks, p?.clicks ?? 0)}</Badge></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

export default async function Segmenti() {
  const end = gscEndDate();
  const curStart = new Date(end.getTime() - 27 * D);
  const prevEnd = new Date(curStart.getTime() - D);
  const prevStart = new Date(prevEnd.getTime() - 27 * D);
  const q = (dim: string, s: Date, e: Date) => gscRows({ startDate: isoDate(s), endDate: isoDate(e), dimensions: [dim] }, { maxPages: 1, revalidate: 3600 });
  const [dc, dp, cc, cp, cmp, { articles }] = await Promise.all([
    q("device", curStart, end),
    q("device", prevStart, prevEnd),
    q("country", curStart, end),
    q("country", prevStart, prevEnd),
    getComparison(),
    loadArticles(),
  ]);
  if (dc.rows.length === 0 && cmp.byUrl.size === 0) {
    return (
      <>
        <PageHeader title="Segmenti" subtitle="Come va per categoria, paese e dispositivo" />
        <DemoBanner title="Attenzione." reason={dc.note ?? cmp.note ?? "Nessun dato da Search Console al momento."} />
      </>
    );
  }

  const cat = new Map(articles.map((a) => [normUrl(a.url), a.category || "Senza categoria"]));
  const catCur = new Map<string, Tot>();
  const catPrev = new Map<string, Tot>();
  const conta = new Map<string, number>();
  cmp.byUrl.forEach((v, key) => {
    const c = cat.get(key);
    if (!c) return;
    for (const [m, s] of [[catCur, v.cur], [catPrev, v.prev]] as const) {
      const e = m.get(c) ?? { clicks: 0, impressions: 0 };
      e.clicks += s.clicks;
      e.impressions += s.impressions;
      m.set(c, e);
    }
    if (v.cur.impressions > 0) conta.set(c, (conta.get(c) ?? 0) + 1);
  });

  const dev = map(dc.rows, (k) => DEVICE[k.toLowerCase()] ?? k);
  const devP = map(dp.rows, (k) => DEVICE[k.toLowerCase()] ?? k);
  const paesi = map(cc.rows, (k) => PAESI[k.toLowerCase()] ?? k.toUpperCase());
  const paesiP = map(cp.rows, (k) => PAESI[k.toLowerCase()] ?? k.toUpperCase());
  const totale = Array.from(dev.values()).reduce((s, x) => s + x.clicks, 0);
  const mobile = dev.get("Telefono")?.clicks ?? 0;
  const italia = paesi.get("Italia")?.clicks ?? 0;
  const topCat = Array.from(catCur.entries()).sort((a, b) => b[1].clicks - a[1].clicks)[0];

  return (
    <>
      <PageHeader title="Segmenti" subtitle={`Ultimi 28 giorni (${cmp.curLabel}) contro i 28 precedenti`} />
      <div className="grid grid-cols-3 gap-5">
        <Kpi label="Da telefono" value={totale ? `${Math.round((mobile / totale) * 100)}%` : "—"} hint="dei click" />
        <Kpi label="Dall'Italia" value={totale ? `${Math.round((italia / totale) * 100)}%` : "—"} hint="dei click" />
        <Kpi label="Categoria che rende di più" value={topCat?.[0] ?? "—"} hint={topCat ? `${n(topCat[1].clicks)} click` : undefined} />
      </div>
      <div className="mt-5">
        <Tabella
          titolo="Categorie"
          nota={`Somma dei click degli articoli di ogni categoria (${n(Array.from(conta.values()).reduce((s, x) => s + x, 0))} articoli con impressioni).`}
          cur={catCur}
          prev={catPrev}
          max={15}
        />
      </div>
      <div className="mt-5 grid grid-cols-2 gap-5">
        <Tabella titolo="Dispositivi" nota="Da cosa ti leggono." cur={dev} prev={devP} />
        <Tabella titolo="Paesi" nota="Da dove arrivano i click." cur={paesi} prev={paesiP} />
      </div>
    </>
  );
}
