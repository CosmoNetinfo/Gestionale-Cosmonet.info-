import { getMemoSummary } from "@/lib/memo";
import { getRepos, type Repo } from "@/lib/github";
import { daysSince } from "@/lib/review";
import { Badge, Card, DemoBanner, Kpi, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

const KIND = { note: "Appunto", idea: "Idea", project: "Progetto" } as const;
const STATUS = { draft: "Bozza", active: "In corso", done: "Completato", archived: "Archiviato" } as const;

export default async function Memo() {
  const [{ summary, url, note }, { repos, demo: reposDemo }] = await Promise.all([getMemoSummary(), getRepos()]);
  // Abbino un progetto alla sua repository quando i nomi coincidono (ignorando spazi e simboli)
  const flat = (t: string) => t.toLowerCase().replace(/[^a-z0-9]/g, "");
  const repoOf = (title: string): Repo | undefined => {
    if (reposDemo) return undefined;
    const t = flat(title);
    return t.length < 4 ? undefined : repos.find((r) => flat(r.name) === t);
  };
  const open = url ? (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
    >
      Apri Cosmo Memo ↗
    </a>
  ) : undefined;

  if (!summary) {
    return (
      <>
        <PageHeader title="Cosmo Memo" subtitle="La tua memoria esterna" right={open} />
        <DemoBanner title="Attenzione." reason={note ?? "Nessun dato."} />
        <Card>
          <p className="text-sm text-muted">
            Cosmo Memo funziona già con Claude tramite il suo connettore. Per vederlo anche qui, Cosmo Memo deve
            offrire un accesso in sola lettura protetto da un token. Le istruzioni per GPT sono nel file{" "}
            <code>docs/brief-cosmomemo-api.md</code> del repository del gestionale.
          </p>
        </Card>
      </>
    );
  }

  const active = summary.pages.filter((p) => p.status !== "archived");
  const projects = active.filter((p) => p.kind === "project");
  const openTasks = summary.tasks.filter((t) => t.status !== "Completato");
  const recent = [...active].sort((a, b) => b.updated - a.updated).slice(0, 10);
  const date = (ms: number) => new Date(ms).toLocaleDateString("it-IT");

  return (
    <>
      <PageHeader title="Cosmo Memo" subtitle="La tua memoria esterna (sola lettura)" right={open} />

      <div className="grid grid-cols-4 gap-5">
        <Kpi label="Pagine" value={active.length} />
        <Kpi label="Progetti" value={projects.length} />
        <Kpi label="Attività aperte" value={openTasks.length} tone={openTasks.length > 0 ? "warn" : "ok"} />
        <Kpi label="Ricordi" value={summary.memories_count} />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-5">
        <Card>
          <h2 className="mb-4 text-base font-semibold">Progetti</h2>
          {projects.length === 0 ? (
            <p className="text-sm text-muted">Nessun progetto.</p>
          ) : (
            <ul className="divide-y divide-line">
              {projects.map((p) => {
                const aperte = openTasks.filter((t) => t.project_id === p.id).length;
                const repo = repoOf(p.title);
                return (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="min-w-0 truncate text-sm font-medium">{p.title}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      {repo && (
                        <a
                          href={repo.url}
                          target="_blank"
                          rel="noreferrer"
                          title={`Repository ${repo.name}`}
                          className="text-xs text-muted hover:text-primary"
                        >
                          GitHub · {repo.pushedAt ? `${daysSince(repo.pushedAt)} g fa` : "↗"}
                        </a>
                      )}
                      {aperte > 0 && <span className="text-xs text-muted">{aperte} attività</span>}
                      <Badge tone={p.status === "active" ? "info" : p.status === "done" ? "ok" : "neutral"}>
                        {STATUS[p.status]}
                      </Badge>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-4 text-base font-semibold">Modificate di recente</h2>
          <ul className="divide-y divide-line">
            {recent.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="min-w-0 truncate text-sm font-medium">{p.title}</span>
                <span className="shrink-0 text-xs text-muted">
                  {KIND[p.kind]} · {date(p.updated)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {openTasks.length > 0 && (
        <Card className="mt-5">
          <h2 className="mb-4 text-base font-semibold">Attività aperte</h2>
          <ul className="divide-y divide-line">
            {openTasks.slice(0, 15).map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="min-w-0 truncate text-sm">{t.title}</span>
                <span className="flex shrink-0 items-center gap-2">
                  {t.due && <span className="text-xs text-muted">entro {t.due}</span>}
                  {t.priority && (
                    <Badge tone={t.priority === "Alta" ? "danger" : t.priority === "Media" ? "warn" : "neutral"}>
                      {t.priority}
                    </Badge>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
