import Link from "next/link";
import { loadArticles } from "@/lib/articles";
import { getGscStats, normUrl } from "@/lib/gsc";
import { pagespeedConfigured, runMany, type FieldMetric, type Strategy } from "@/lib/pagespeed";
import { Badge, Card, DemoBanner, Kpi, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const dec = (v: number, d = 1) => v.toFixed(d).replace(".", ",");
const COUNT = 6;

function scoreTone(s: number): "ok" | "warn" | "danger" {
  return s >= 90 ? "ok" : s >= 50 ? "warn" : "danger";
}
function catTone(c: FieldMetric["category"] | undefined): "ok" | "warn" | "danger" | "neutral" {
  return c === "FAST" ? "ok" : c === "AVERAGE" ? "warn" : c === "SLOW" ? "danger" : "neutral";
}

export default async function Velocita({ searchParams }: { searchParams?: { s?: string; url?: string } }) {
  const strategy: Strategy = searchParams?.s === "desktop" ? "desktop" : "mobile";
  const base = process.env.WP_BASE_URL?.replace(/\/$/, "") ?? "https://www.cosmonet.info";

  const header = (
    <PageHeader
      title="Velocità"
      subtitle="PageSpeed e Core Web Vitals: home e gli articoli che portano più click"
      right={
        <div className="flex gap-2 text-sm">
          {(["mobile", "desktop"] as const).map((x) => (
            <Link
              key={x}
              href={`/velocita?s=${x}`}
              className={
                "rounded-lg border px-3 py-2 " +
                (strategy === x ? "border-primary bg-primary text-white" : "border-line text-muted hover:text-ink")
              }
            >
              {x === "mobile" ? "Mobile" : "Desktop"}
            </Link>
          ))}
        </div>
      }
    />
  );

  if (!pagespeedConfigured()) {
    return (
      <>
        {header}
        <DemoBanner
          title="Manca la chiave."
          reason="Imposta PAGESPEED_API_KEY su Vercel (chiave API di Google Cloud con PageSpeed Insights API abilitata) e rifai il deploy."
        />
      </>
    );
  }

  const { articles } = await loadArticles();
  const gsc = await getGscStats();
  const top = articles
    .filter((a) => a.status === "publish")
    .map((a) => ({ a, clicks: gsc.configured ? (gsc.byUrl.get(normUrl(a.url))?.clicks ?? 0) : 0 }))
    .sort((x, y) => y.clicks - x.clicks)
    .slice(0, COUNT)
    .map((x) => x.a);

  const titles = new Map<string, { title: string; id?: number }>([[base + "/", { title: "Home" }]]);
  top.forEach((a) => titles.set(a.url, { title: a.title, id: a.id }));
  const custom = searchParams?.url && /^https?:\/\//.test(searchParams.url) ? searchParams.url : null;
  if (custom && !titles.has(custom)) titles.set(custom, { title: "Indirizzo scelto" });

  const results = await runMany(Array.from(titles.keys()), strategy);
  const okRes = results.filter((r) => r.ok);
  const err = results.find((r) => !r.ok)?.error;
  const media = okRes.length ? Math.round(okRes.reduce((s, r) => s + (r.score ?? 0), 0) / okRes.length) : 0;
  const mediaTone: "default" | "warn" | "ok" = !okRes.length ? "default" : media >= 90 ? "ok" : "warn";
  const lenti = okRes.filter((r) => (r.score ?? 0) < 50).length;
  const sotto = okRes.filter((r) => (r.score ?? 0) < 90).length;

  return (
    <>
      {header}
      {err && <DemoBanner title="Attenzione." reason={err} />}

      <div className="grid grid-cols-3 gap-5">
        <Kpi label="Punteggio medio" value={okRes.length ? media : "—"} hint={`su ${okRes.length} pagine (${strategy})`} tone={mediaTone} />
        <Kpi label="Sotto 90" value={sotto} hint="da migliorare" tone={sotto ? "warn" : "ok"} />
        <Kpi label="Lente (sotto 50)" value={lenti} hint="priorità" tone={lenti ? "warn" : "ok"} />
      </div>

      <Card className="mt-5 overflow-hidden p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-canvas text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-5 py-3 font-medium">Pagina</th>
              <th className="px-5 py-3 font-medium">Punteggio</th>
              <th className="px-5 py-3 font-medium">LCP</th>
              <th className="px-5 py-3 font-medium">CLS</th>
              <th className="px-5 py-3 font-medium">INP (utenti)</th>
              <th className="px-5 py-3 font-medium">TBT</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {results.map((r) => {
              const t = titles.get(r.url)!;
              const lcp = r.field?.lcp;
              const cls = r.field?.cls;
              const inp = r.field?.inp;
              return (
                <tr key={r.url} className="hover:bg-canvas/60">
                  <td className="max-w-sm px-5 py-2.5">
                    {t.id ? (
                      <Link href={`/sito/${t.id}`} className="line-clamp-1 font-medium hover:text-primary">{t.title}</Link>
                    ) : (
                      <span className="font-medium">{t.title}</span>
                    )}
                  </td>
                  {r.ok && r.lab ? (
                    <>
                      <td className="px-5 py-2.5"><Badge tone={scoreTone(r.score ?? 0)}>{r.score}</Badge></td>
                      <td className="whitespace-nowrap px-5 py-2.5">
                        {dec(r.lab.lcp)} s{" "}
                        {lcp && <Badge tone={catTone(lcp.category)}>utenti {dec(lcp.value)} s</Badge>}
                      </td>
                      <td className="whitespace-nowrap px-5 py-2.5">
                        {dec(r.lab.cls, 2)} {cls && <Badge tone={catTone(cls.category)}>utenti {dec(cls.value, 2)}</Badge>}
                      </td>
                      <td className="whitespace-nowrap px-5 py-2.5">
                        {inp ? <Badge tone={catTone(inp.category)}>{Math.round(inp.value)} ms</Badge> : <span className="text-muted">—</span>}
                      </td>
                      <td className="whitespace-nowrap px-5 py-2.5 text-muted">{Math.round(r.lab.tbt)} ms</td>
                    </>
                  ) : (
                    <td colSpan={5} className="px-5 py-2.5 text-xs text-muted">Non disponibile</td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <Card className="mt-5">
        <h2 className="mb-2 text-base font-semibold">Controlla un altro indirizzo</h2>
        <form className="flex gap-2" action="/velocita">
          <input type="hidden" name="s" value={strategy} />
          <input
            name="url"
            defaultValue={custom ?? ""}
            placeholder="https://www.cosmonet.info/..."
            className="flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm"
          />
          <button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90" type="submit">
            Analizza
          </button>
        </form>
        <p className="mt-3 text-xs text-muted">
          Valori buoni per Google: LCP sotto 2,5 s, CLS sotto 0,1, INP sotto 200 ms. «Utenti» sono i dati reali di
          Chrome degli ultimi 28 giorni (mancano per le pagine con poco traffico). I risultati restano in cache 6 ore.
        </p>
      </Card>
    </>
  );
}
