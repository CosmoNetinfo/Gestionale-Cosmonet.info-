import { getPlugins, getSnippets, STATISTICHE } from "@/lib/plugins";
import { Badge, Card, Kpi, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function PluginPage() {
  const [{ plugins, note }, { snippets, note: noteSnippet }] = await Promise.all([getPlugins(), getSnippets()]);
  const attivi = plugins.filter((p) => p.status !== "inactive");
  const spenti = plugins.filter((p) => p.status === "inactive");
  const stat = plugins.filter((p) => STATISTICHE.test(p.name + " " + p.plugin));

  return (
    <>
      <PageHeader title="Plugin e snippet" subtitle="Cosa c'è installato su Cosmonet.info" />

      {note && (
        <Card>
          <p className="text-sm text-muted">{note}</p>
        </Card>
      )}

      {plugins.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-5">
            <Kpi label="Plugin installati" value={plugins.length} />
            <Kpi label="Attivi" value={attivi.length} tone="ok" />
            <Kpi label="Spenti" value={spenti.length} tone={spenti.length > 0 ? "warn" : "ok"} hint="se non servono, meglio toglierli" />
          </div>

          {stat.length > 0 && (
            <Card className="mt-5">
              <h2 className="mb-1 text-base font-semibold">Plugin di statistiche e traffico</h2>
              <p className="mb-3 text-xs text-muted">Quelli che probabilmente misurano le visite. Da qui decidiamo quali collegare per confrontare i dati.</p>
              <ul className="divide-y divide-line text-sm">
                {stat.map((p) => (
                  <li key={p.plugin} className="flex items-center justify-between gap-4 py-2">
                    <span className="font-medium">{p.name}</span>
                    <span className="flex items-center gap-2 text-xs text-muted">
                      v{p.version}
                      <Badge tone={p.status === "inactive" ? "warn" : "ok"}>{p.status === "inactive" ? "spento" : "attivo"}</Badge>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card className="mt-5">
            <h2 className="mb-3 text-base font-semibold">Tutti i plugin</h2>
            <ul className="divide-y divide-line text-sm">
              {plugins.map((p) => (
                <li key={p.plugin} className="py-2">
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-medium">{p.name}</span>
                    <span className="flex shrink-0 items-center gap-2 text-xs text-muted">
                      v{p.version}
                      <Badge tone={p.status === "inactive" ? "warn" : "ok"}>{p.status === "inactive" ? "spento" : "attivo"}</Badge>
                    </span>
                  </div>
                  {p.description && <div className="mt-0.5 line-clamp-1 text-xs text-muted">{p.description}</div>}
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}

      <Card className="mt-5">
        <h2 className="mb-3 text-base font-semibold">Snippet di codice</h2>
        {snippets.length > 0 ? (
          <ul className="divide-y divide-line text-sm">
            {snippets.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-4 py-2">
                <span>{s.name}</span>
                <Badge tone={s.active ? "ok" : "warn"}>{s.active ? "attivo" : "spento"}</Badge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">{noteSnippet ?? "Nessuno snippet trovato."}</p>
        )}
      </Card>
    </>
  );
}
