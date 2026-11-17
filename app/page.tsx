import Link from "next/link";
import { loadArticles } from "@/lib/articles";
import { getRepos } from "@/lib/github";
import { PERIODI, getGscPeriod, getGscStats, normUrl, opportunity } from "@/lib/gsc";
import { Periodo } from "@/components/Periodo";
import { LineChart } from "@/components/LineChart";
import { daysSinceTouched, fasciaPerGiorni, isToReview, reviewDays } from "@/lib/review";
import { Badge, Card, DemoBanner, Kpi, PageHeader } from "@/components/ui";
import { CopyButton } from "@/components/CopyButton";

export const dynamic = "force-dynamic";

export default async function Panoramica({ searchParams }: { searchParams?: { p?: string } }) {
  const periodo = PERIODI.find((x) => x.id === searchParams?.p) ?? PERIODI[3];
  const [{ articles, demo, note }, repos, per, gsc] = await Promise.all([
    loadArticles(),
    getRepos(),
    getGscPeriod(periodo.days),
    getGscStats(),
  ]);
  const pot = (a: (typeof articles)[number]) => (gsc.configured ? opportunity(gsc.byUrl.get(normUrl(a.url))) : 0);
  const fmt = (v: number) => v.toLocaleString("it-IT");
  // Variazione rispetto al periodo precedente di pari durata ("meglio" = su, tranne la posizione: meno è meglio)
  const delta = (cur: number, prev: number | undefined, invert = false) => {
    if (prev === undefined) return { hint: "confronto non disponibile (oltre 16 mesi)", tone: "default" as const };
    if (prev === 0) return { hint: "periodo precedente: nessun dato", tone: "default" as const };
    const pct = ((cur - prev) / prev) * 100;
    const good = invert ? pct < 0 : pct > 0;
    const sign = pct > 0 ? "+" : "";
    return {
      hint: `${sign}${pct.toFixed(1).replace(".", ",")}% rispetto al periodo precedente`,
      tone: Math.abs(pct) < 0.5 ? ("default" as const) : good ? ("ok" as const) : ("danger" as const),
    };
  };
  const dClick = delta(per.cur.clicks, per.prev?.clicks);
  const dImpr = delta(per.cur.impressions, per.prev?.impressions);
  const dCtr = delta(per.cur.ctr, per.prev?.ctr);
  const dPos = delta(per.cur.position, per.prev?.position, true);
  const dm = (iso: string) => iso.slice(8, 10) + "/" + iso.slice(5, 7);

  const published = articles.filter((a) => a.status === "publish");
  const scheduled = articles.filter((a) => a.status === "future");
  const drafts = articles.filter((a) => a.status === "draft");
  const pending = articles.filter((a) => a.status === "pending");
  const toReview = articles
    .filter(isToReview)
    .sort((a, b) => pot(b) - pot(a) || daysSinceTouched(b) - daysSinceTouched(a));

  return (
    <>
      <PageHeader
        title="Panoramica"
        subtitle="Il quadro generale di Cosmonet.info"
        right={
          <div className="flex items-center gap-2">
            {toReview.length > 0 && (
              <Link href="/prossimo" className="rounded-lg border border-line px-3 py-2 text-sm font-medium text-muted hover:border-primary hover:text-primary">
                Prossimo da rivedere →
              </Link>
            )}
          </div>
        }
      />

      {demo && note && <DemoBanner reason={note} />}

      <div className="grid grid-cols-4 gap-5">
        <Kpi label="Pubblicati" value={published.length} />
        <Kpi label="Programmati" value={scheduled.length} />
        <Kpi label="Bozze" value={drafts.length} hint={pending.length > 0 ? `più ${pending.length} in attesa di revisione` : undefined} />
        <Kpi
          label="Da rivedere"
          value={toReview.length}
          tone={toReview.length > 0 ? "warn" : "ok"}
          hint={`non toccati da più di ${reviewDays()} giorni`}
        />
      </div>

      {per.points.length > 0 ? (
        <div className="mt-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm text-muted">
              Dati reali di Search Console · dal {dm(per.start)} al {dm(per.end)}
              {periodo.days === 1 && " (ultimo giorno completo)"}
            </div>
            <Periodo attivo={periodo.id} />
          </div>
          <div className="grid grid-cols-4 gap-5">
            <Kpi label="Click" value={fmt(per.cur.clicks)} hint={dClick.hint} tone={dClick.tone} />
            <Kpi label="Impressioni" value={fmt(per.cur.impressions)} hint={dImpr.hint} tone={dImpr.tone} />
            <Kpi label="CTR" value={(per.cur.ctr * 100).toFixed(2).replace(".", ",") + "%"} hint={dCtr.hint} tone={dCtr.tone} />
            <Kpi label="Posizione media" value={per.cur.position.toFixed(1).replace(".", ",")} hint={dPos.hint} tone={dPos.tone} />
          </div>
          <div className="mt-5 grid grid-cols-2 gap-5">
            <Card>
              <div className="mb-2 flex items-baseline justify-between">
                <h2 className="text-base font-semibold">Click al giorno</h2>
                <span className="text-xs text-muted">{per.points.length} giorni</span>
              </div>
              <LineChart data={per.points.map((d) => d.clicks)} labels={per.points.map((d) => dm(d.date))} height={160} />
            </Card>
            <Card>
              <div className="mb-2 flex items-baseline justify-between">
                <h2 className="text-base font-semibold">Impressioni al giorno</h2>
                <span className="text-xs text-muted">{per.points.length} giorni</span>
              </div>
              <LineChart data={per.points.map((d) => d.impressions)} labels={per.points.map((d) => dm(d.date))} height={160} />
            </Card>
          </div>
        </div>
      ) : (
        per.note && <p className="mt-5 text-sm text-muted">{per.note}</p>
      )}

      <div className="mt-5 grid grid-cols-3 gap-5">
        <Card className="col-span-2">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-base font-semibold">Richiede attenzione</h2>
            <Link href="/rivedere" className="text-xs font-medium text-primary hover:underline">Vedi tutti ({toReview.length}) →</Link>
          </div>
          {toReview.length === 0 ? (
            <p className="text-sm text-muted">Nessun articolo da rivedere.</p>
          ) : (
            <ul className="divide-y divide-line">
              {toReview.slice(0, 8).map((a) => (
                <li key={a.id} className="flex items-center justify-between py-3">
                  <div className="min-w-0">
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block truncate text-sm font-medium hover:text-primary"
                    >
                      {a.title}
                    </a>
                    <div className="text-xs text-muted">
                      ID {a.id} · {a.category}
                      {pot(a) > 0 && ` · potenziale ${pot(a).toLocaleString("it-IT")}`}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <CopyButton text={a.url} label="🔗 Copia link" />
                    <Badge tone={fasciaPerGiorni(daysSinceTouched(a)).tone}>{daysSinceTouched(a)} giorni · {fasciaPerGiorni(daysSinceTouched(a)).label}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-4 text-base font-semibold">Repository</h2>
          <div className="text-3xl font-semibold">{repos.repos.length}</div>
          <p className="mt-1 text-xs text-muted">
            {repos.repos.filter((r) => r.isPrivate).length} private ·{" "}
            {repos.repos.filter((r) => !r.isPrivate).length} pubbliche
          </p>
          {repos.demo && (
            <p className="mt-3 text-xs text-warn">Dati di esempio</p>
          )}
        </Card>
      </div>

    </>
  );
}
