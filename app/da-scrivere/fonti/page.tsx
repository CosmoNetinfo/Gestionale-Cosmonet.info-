import Link from "next/link";
import { getSources } from "@/lib/news";
import { catLabel } from "@/lib/feeds";
import { Badge, Card, PageHeader } from "@/components/ui";
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

      <Card>
        <h2 className="mb-2 text-base font-semibold">Importa un file OPML</h2>
        <p className="mb-3 text-sm text-muted">
          Scegli il file .opml (oppure incolla il suo contenuto nella casella). Le cartelle diventano categorie e ogni sito diventa una fonte.
        </p>
        <form action={importaOpml} className="space-y-3">
          <CaricaFile targetId="opml" accept=".opml,.xml,text/xml" />
          <textarea id="opml" name="opml" required rows={8} placeholder='<?xml version="1.0"?> <opml version="2.0"> ...' className="w-full rounded-md border border-line bg-canvas p-3 font-mono text-xs" />
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
      </Card>

      <Card className="mt-5">
        <h2 className="mb-3 text-base font-semibold">Fonti attive</h2>
        {Array.from(perCat.entries()).map(([cat, list]) => (
          <div key={cat} className="mb-4">
            <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">
              {catLabel(cat)} ({list.length})
            </div>
            <div className="flex flex-wrap gap-2">
              {list.map((f) => (
                <a key={f.url} href={f.url} target="_blank" rel="noreferrer">
                  <Badge tone="neutral">{f.name}</Badge>
                </a>
              ))}
            </div>
          </div>
        ))}
      </Card>
    </>
  );
}
