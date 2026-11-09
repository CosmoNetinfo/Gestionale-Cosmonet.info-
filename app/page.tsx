import { loadArticles } from "@/lib/articles";
import { getRepos } from "@/lib/github";
import { getGscDaily, getGscStats, normUrl, opportunity } from "@/lib/gsc";
import { LineChart } from "@/components/LineChart";
import { daysSinceTouched, isToReview, reviewDays } from "@/lib/review";
import { Badge, Card, DemoBanner, Kpi, PageHeader } from "@/components/ui";

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
  const drafts = articles.filter((a) => a.status === "draft" || a.status === "pending");
  const toReview = articles
    .filter(isToReview)
    .sort((a, b) => pot(b) - pot(a) || daysSinceTouched(b) - daysSinceTouched(a));

  return (
    <>
      <PageHeader
        title="Panoramica"
        subtitle="Il quadro generale di Cosmonet.info"
      />

      {demo && note && <DemoBanner reason={note} />}

      <div className="grid grid-cols-4 gap-5">
        <Kpi label="Pubblicati" value={published.length} />
        <Kpi label="Programmati" value={scheduled.length} />
        <Kpi label="Bozze" value={drafts.length} />
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
          <h2 className="mb-4 text-base font-semibold">Richiede attenzione</h2>
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
                  <Badge tone="warn">{daysSinceTouched(a)} giorni</Badge>
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
