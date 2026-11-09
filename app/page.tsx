import { getArticles } from "@/lib/wordpress";
import { getRepos } from "@/lib/github";
import { daysSinceTouched, isToReview, reviewDays } from "@/lib/review";
import { Badge, Card, DemoBanner, Kpi, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Panoramica() {
  const [{ articles, demo, note }, repos] = await Promise.all([
    getArticles(),
    getRepos(),
  ]);

  const published = articles.filter((a) => a.status === "publish");
  const scheduled = articles.filter((a) => a.status === "future");
  const drafts = articles.filter((a) => a.status === "draft" || a.status === "pending");
  const toReview = articles
    .filter(isToReview)
    .sort((a, b) => daysSinceTouched(b) - daysSinceTouched(a));

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

      <p className="mt-6 text-xs text-muted">
        Click e impressioni di Search Console arrivano nella fase 2.
      </p>
    </>
  );
}
