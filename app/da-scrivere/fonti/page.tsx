import Link from "next/link";
import { getSources } from "@/lib/news";
import { catLabel } from "@/lib/feeds";
import { Badge, Card, Kpi, PageHeader } from "@/components/ui";
import { CaricaFile } from "@/components/CaricaFile";
import { importaOpml, tornaAlCatalogo } from "./actions";

export const dynamic = "force-dynamic";

export default async function Fonti({ searchParams }: { searchParams: { fatto?: string; errore?: string } }) {
  const { feeds, origine, missing } = await getSources();
  const perCat = new Map<string, typeof feeds>();
  for (const f of feeds) perCat.set(f.cat, [...(perCat.get(f.cat) ?? []), f]);

  return (
    <>
      <PageHeader
        title="Fonti RSS"
        subtitle={`${feeds.length} fonti · ${origine === "database" ? "importate da OPML" : "catalogo di default"}`}
        right={
          <Link href="/da-scrivere" className="rounded-md border border-line px-3 py-1.5 text-sm text-muted hover:border-primary hover:text-primary">
            ← Torna a Da scrivere
          </Link>
        }
      />

      {searchParams.fatto && (
        <div className="mb-5 rounded-card border border-ok/30 bg-ok-soft px-4 py-3 text-sm text-ok">
          {searchParams.fatto === "0" ? "Catalogo di default ripristinato." : `Fonti importate: ${searchParams.fatto}.`}
        </div>
      )}
      {searchParams.errore && <div className="mb-5 rounded-card border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">{searchParams.errore}</div>}
      {missing && (
        <div className="mb-5 rounded-card border border-warn/30 bg-warn-soft px-4 py-3 text-sm text-warn">
          <strong>L&apos;importazione non è ancora attiva:</strong> {missing}. Esegui in Supabase l&apos;ultimo blocco di <code>supabase/schema.sql</code>.
        </div>
      )}

      <div className="grid grid-cols-4 gap-5">
        <Kpi label="Fonti attive" value={feeds.length} hint={origine === "database" ? "salvate nel database" : "catalogo di default"} />
        <Kpi label="Categorie" value={perCat.size} />
        <Kpi label="In inglese" value={feeds.filter((f) => f.lang === "en").length} />
        <Kpi label="In italiano" value={feeds.filter((f) => f.lang === "it").length} />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
        {Array.from(perCat.entries()).map(([cat, list]) => (
          <Card key={cat}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">{catLabel(cat)}</h2>
              <Badge tone="info">{list.length}</Badge>
            </div>
            <ul className="divide-y divide-line text-sm">
              {list.map((f) => {
                const host = (() => {
                  try {
                    return new URL(f.url).hostname.replace(/^www\./, "");
                  } catch {
                    return f.url;
                  }
                })();
                const release = /release/i.test(f.name) || f.url.includes("/releases.atom");
                return (
                  <li key={f.url} className="flex items-center gap-3 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{f.name.replace(/\s*\[GitHub\]/, "")}</div>
                      <div className="truncate text-xs text-muted">{host}</div>
                    </div>
                    {release && <Badge tone="neutral">release</Badge>}
                    <Badge tone={f.lang === "it" ? "ok" : "info"}>{f.lang === "it" ? "IT" : "EN"}</Badge>
                    <a href={f.url} target="_blank" rel="noreferrer" className="shrink-0 text-xs text-muted hover:text-primary">
                      apri
                    </a>
                  </li>
                );
              })}
            </ul>
          </Card>
        ))}
      </div>

      <details className="mt-5 rounded-card border border-line bg-surface p-5" open={origine === "catalogo"}>
        <summary className="cursor-pointer text-base font-semibold">Importa o cambia le fonti (file OPML)</summary>
        <p className="mb-3 mt-3 text-sm text-muted">Scegli il file .opml (oppure incolla il suo contenuto nella casella). Le fonti restano salvate nel database: non devi ricaricarle.</p>
        <form action={importaOpml} className="space-y-3">
          <CaricaFile targetId="opml" accept=".opml,.xml,text/xml" />
          <textarea id="opml" name="opml" required rows={6} placeholder='<?xml version="1.0"?> <opml version="2.0"> ...' className="w-full rounded-md border border-line bg-canvas p-3 font-mono text-xs" />
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="radio" name="modo" value="sostituisci" defaultChecked /> Sostituisci le fonti attuali
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="modo" value="aggiungi" /> Aggiungi a quelle attuali
            </label>
            <button className="ml-auto rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark">Importa</button>
          </div>
        </form>
        {origine === "database" && (
          <form action={tornaAlCatalogo} className="mt-3">
            <button className="text-xs text-muted underline hover:text-primary">Torna al catalogo di default</button>
          </form>
        )}
      </details>
    </>
  );
}
