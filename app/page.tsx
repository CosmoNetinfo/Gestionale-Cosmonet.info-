import Link from "next/link";
import { loadArticles } from "@/lib/articles";
import { getRepos } from "@/lib/github";
import { getGscDaily, getGscStats, normUrl, opportunity } from "@/lib/gsc";
import { LineChart } from "@/components/LineChart";
import { daysSinceTouched, fasciaPerGiorni, isToReview, reviewDays } from "@/lib/review";
import { Badge, Card, DemoBanner, Kpi, PageHeader } from "@/components/ui";
import { CopyButton } from "@/components/CopyButton";

export const dynamic = "force-dynamic";

export default async function Panoramica() {
  const [{ articles, demo, note }, repos, daily, gsc] = await Promise.all([
    loadArticles(),
    getRepos(),
    getGscDaily(),
    getGscStats(),
  ]);
  const pot = (a: (typeof articles)[number]) => (gsc.configured ? opportunity(gsc.byUrl.get(normUrl(a.url))) : 0);
  const gClicks = daily.days.reduce((s, d) => s + d.clicks, 0);
  const gImpr = daily.days.reduce((s, d) => s + d.impressions, 0);
  const fmt = (v: number) => v.toLocaleString("it-IT");

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

      {daily.days.length > 0 && (
        <div className="mt-5 grid grid-cols-3 gap-5">
          <Card className="col-span-2">
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-base font-semibold">Click al giorno</h2>
              <span className="text-xs text-muted">ultimi {daily.days.length} giorni</span>
            </div>
            <LineChart
              data={daily.days.map((d) => d.clicks)}
              labels={daily.days.map((d) => d.date.slice(8, 10) + "/" + d.date.slice(5, 7))}
              height={160}
            />
          </Card>
          <div className="grid gap-5">
            <Kpi label="Click" value={fmt(gClicks)} />
            <Kpi label="Impressioni" value={fmt(gImpr)} />
          </div>
        </div>
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
