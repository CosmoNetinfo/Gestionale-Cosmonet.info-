import { loadArticles } from "@/lib/articles";
import { PERIODI, getGscDaily, getGscPeriod, getGscStats, normUrl } from "@/lib/gsc";
import { getKoko } from "@/lib/traffico";
import { getPlugins, STATISTICHE } from "@/lib/plugins";
import { Periodo } from "@/components/Periodo";
import { Card, DemoBanner, Kpi, PageHeader } from "@/components/ui";
import { LineChart } from "@/components/LineChart";

export const dynamic = "force-dynamic";

const n = (v: number) => v.toLocaleString("it-IT");
const dm = (iso: string) => iso.slice(8, 10) + "/" + iso.slice(5, 7);

export default async function Grafici({ searchParams }: { searchParams?: { p?: string } }) {
  const periodo = PERIODI.find((x) => x.id === searchParams?.p) ?? PERIODI[3];
  const [{ articles, demo }, gsc, daily, per, koko, plug] = await Promise.all([
    loadArticles(),
    getGscStats(),
    getGscDaily(),
    getGscPeriod(periodo.days),
    getKoko(periodo.days),
    getPlugins(),
  ]);
  const delta = (cur: number, prev?: number) => {
    if (prev === undefined || prev === 0) return { hint: "confronto non disponibile", tone: "default" as const };
    const pct = ((cur - prev) / prev) * 100;
    return {
      hint: `${pct > 0 ? "+" : ""}${pct.toFixed(1).replace(".", ",")}% rispetto al periodo precedente`,
      tone: Math.abs(pct) < 0.5 ? ("default" as const) : pct > 0 ? ("ok" as const) : ("danger" as const),
    };
  };
  // Plugin di statistiche installati: quali leggo e quali no
  const LETTURA: { re: RegExp; stato: string }[] = [
    { re: /koko/i, stato: "Letto qui sopra (REST API nativa)." },
    { re: /wp statistics|wp-statistics/i, stato: "Non leggibile: la REST API è nel componente aggiuntivo a pagamento di WP Statistics." },
    { re: /jetpack$|^jetpack\b/i, stato: "Non ancora collegato: serve un token OAuth di WordPress.com (da creare tu, mai in chat)." },
    { re: /shinystat/i, stato: "Non leggibile: è un servizio esterno, non ho trovato una API pubblica." },
  ];
  const statPlugins = plug.plugins.filter((p) => STATISTICHE.test(p.name) && p.status !== "inactive" && !/social/i.test(p.name));

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

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Periodo attivo={periodo.id} base="/grafici" />
        <span className="text-sm text-muted">
          {per.start && `Periodo: ${per.start.split("-").reverse().join("/")} – ${per.end.split("-").reverse().join("/")}`}
        </span>
      </div>

      <h2 className="mb-3 text-lg font-semibold">Sul colpo d&apos;occhio</h2>
      <div className="grid grid-cols-4 gap-5">
        <Kpi label="Click da Google" value={n(per.cur.clicks)} {...delta(per.cur.clicks, per.prev?.clicks)} />
        <Kpi label="Impressioni" value={n(per.cur.impressions)} {...delta(per.cur.impressions, per.prev?.impressions)} />
        <Kpi
          label="Visitatori (Koko)"
          value={koko.note ? "—" : n(koko.cur.visitatori)}
          {...(koko.note ? { hint: "dato non disponibile" } : delta(koko.cur.visitatori, koko.prev?.visitatori))}
        />
        <Kpi
          label="Visualizzazioni (Koko)"
          value={koko.note ? "—" : n(koko.cur.visualizzazioni)}
          {...(koko.note ? { hint: "dato non disponibile" } : delta(koko.cur.visualizzazioni, koko.prev?.visualizzazioni))}
        />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-5">
        <Card>
          <h2 className="mb-2 text-base font-semibold">Click da Google al giorno</h2>
          <LineChart data={per.points.map((d) => d.clicks)} labels={per.points.map((d) => dm(d.date))} />
        </Card>
        <Card>
          <h2 className="mb-2 text-base font-semibold">Visitatori al giorno (Koko Analytics)</h2>
          {koko.note ? (
            <p className="text-sm text-muted">{koko.note}</p>
          ) : (
            <LineChart data={koko.points.map((d) => d.visitatori)} labels={koko.points.map((d) => dm(d.date))} />
          )}
        </Card>
      </div>
      {!koko.note && (
        <div className="mt-5">
          <Card>
            <h2 className="mb-2 text-base font-semibold">Visualizzazioni di pagina al giorno (Koko Analytics)</h2>
            <LineChart data={koko.points.map((d) => d.visualizzazioni)} labels={koko.points.map((d) => dm(d.date))} />
          </Card>
        </div>
      )}

      <div className="mt-5">
        <Card>
          <h2 className="mb-3 text-base font-semibold">Plugin di statistiche sul sito</h2>
          {statPlugins.length === 0 ? (
            <p className="text-sm text-muted">{plug.note ?? "Nessun plugin di statistiche attivo trovato."}</p>
          ) : (
            <ul className="divide-y divide-line">
              {statPlugins.map((p) => (
                <li key={p.plugin} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                  <span className="font-medium">
                    {p.name} <span className="text-muted">v{p.version}</span>
                  </span>
                  <span className="text-muted">{LETTURA.find((l) => l.re.test(p.name))?.stato ?? "Non collegato."}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-muted">
            Ogni plugin conta i visitatori a modo suo (bot, cookie, privacy): i numeri non coincidono mai. Qui ho messo
            solo dati reali, nessuna stima.
          </p>
        </Card>
      </div>

      <h2 className="mb-3 mt-8 text-lg font-semibold">Search Console nel dettaglio</h2>
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
