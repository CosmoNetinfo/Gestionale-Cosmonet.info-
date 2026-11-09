import { getRepos } from "@/lib/github";
import { daysSince } from "@/lib/review";
import { Badge, Card, DemoBanner, Kpi, PageHeader } from "@/components/ui";

export default async function Repository({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const { repos, demo, note } = await getRepos();
  const q = (searchParams.q ?? "").trim().toLowerCase();

  const rows = repos
    .filter(
      (r) =>
        !q ||
        r.name.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.language.toLowerCase().includes(q),
    )
    .sort((a, b) => b.pushedAt.localeCompare(a.pushedAt));

  const recent = repos.filter((r) => r.pushedAt && daysSince(r.pushedAt) <= 30).length;
  const langs = new Map<string, number>();
  for (const r of repos) langs.set(r.language, (langs.get(r.language) ?? 0) + 1);
  const topLang = Array.from(langs.entries())
    .filter(([l]) => l !== "—")
    .sort((a, b) => b[1] - a[1])[0];

  return (
    <>
      <PageHeader
        title="Repository"
        subtitle="Tutte le repository GitHub"
        right={
          <form action="/repository">
            <input
              name="q"
              defaultValue={q}
              placeholder="Cerca nome, descrizione o linguaggio"
              className="w-72 rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </form>
        }
      />

      {demo && note && <DemoBanner reason={note} />}

      <div className="mb-5 grid grid-cols-4 gap-5">
        <Kpi label="Repository" value={repos.length} />
        <Kpi label="Private" value={repos.filter((r) => r.isPrivate).length} />
        <Kpi label="Aggiornate negli ultimi 30 giorni" value={recent} tone="ok" />
        <Kpi
          label="Linguaggio più usato"
          value={topLang ? topLang[0] : "—"}
          hint={topLang ? `${topLang[1]} repository` : undefined}
        />
      </div>

      <Card className="overflow-hidden p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-canvas text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">Descrizione</th>
              <th className="px-4 py-3 font-medium">Linguaggio</th>
              <th className="px-4 py-3 font-medium">Visibilità</th>
              <th className="px-4 py-3 font-medium">Ultimo aggiornamento</th>
              <th className="px-4 py-3 font-medium">Sito</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted">
                  Nessuna repository trovata.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.url} className="hover:bg-canvas/60">
                <td className="px-4 py-3">
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium hover:text-primary"
                  >
                    {r.name}
                  </a>
                  {r.archived && (
                    <span className="ml-2">
                      <Badge tone="neutral">Archiviata</Badge>
                    </span>
                  )}
                  {r.fork && (
                    <span className="ml-2">
                      <Badge tone="neutral">Fork</Badge>
                    </span>
                  )}
                </td>
                <td className="max-w-sm truncate px-4 py-3 text-muted">
                  {r.description || "—"}
                </td>
                <td className="px-4 py-3 text-muted">{r.language}</td>
                <td className="px-4 py-3">
                  <Badge tone={r.isPrivate ? "warn" : "info"}>
                    {r.isPrivate ? "Privata" : "Pubblica"}
                  </Badge>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-muted">
                  {r.pushedAt
                    ? `${new Date(r.pushedAt).toLocaleDateString("it-IT")} (${daysSince(r.pushedAt)} g fa)`
                    : "—"}
                </td>
                <td className="px-4 py-3">
                  {r.homepage ? (
                    <a
                      href={r.homepage}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline"
                    >
                      Apri
                    </a>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
