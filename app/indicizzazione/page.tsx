import Link from "next/link";
import { loadArticles } from "@/lib/articles";
import { inspectLink, inspectMany, listSitemaps } from "@/lib/gsc";
import { inviaSitemap } from "./actions";
import { Badge, Card, DemoBanner, Kpi, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

const n = (v: number) => v.toLocaleString("it-IT");
const COUNT = 25;

function tone(verdict: string): "ok" | "warn" | "danger" | "neutral" {
  if (verdict === "PASS") return "ok";
  if (verdict === "FAIL") return "danger";
  if (verdict === "ERROR") return "neutral";
  return "warn";
}

export default async function Indicizzazione({ searchParams }: { searchParams?: { ok?: string; errore?: string } }) {
  const { articles } = await loadArticles();
  const recenti = articles
    .filter((a) => a.status === "publish")
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, COUNT);

  const [map, sm] = await Promise.all([inspectMany(recenti.map((a) => a.url)), listSitemaps()]);
  const rows = recenti.map((a) => ({ a, s: map.get(a.url)! }));
  const ok = rows.filter((r) => r.s.verdict === "PASS").length;
  const ko = rows.filter((r) => r.s.verdict === "FAIL" || r.s.verdict === "NEUTRAL" || r.s.verdict === "PARTIAL").length;
  const err = rows.find((r) => r.s.verdict === "ERROR")?.s.error;

  return (
    <>
      <PageHeader title="Indicizzazione" subtitle={`Gli ultimi ${COUNT} articoli pubblicati, secondo Google`} />
      {searchParams?.ok && (
        <div className="mb-6 rounded-card border border-ok/30 bg-ok-soft px-4 py-3 text-sm text-ok">{searchParams.ok}. Google la rilegge a breve.</div>
      )}
      {searchParams?.errore && <DemoBanner title="Sitemap non inviata." reason={searchParams.errore} />}
      {err && <DemoBanner title="Attenzione." reason={`Controllo indicizzazione: ${err}`} />}
      {sm.note && <DemoBanner title="Attenzione." reason={`Sitemap: ${sm.note}`} />}

      <div className="grid grid-cols-3 gap-5">
        <Kpi label="Indicizzati" value={ok} hint={`su ${rows.length} controllati`} tone="ok" />
        <Kpi label="Da controllare" value={ko} hint="non indicizzati o con problemi" tone={ko ? "warn" : "ok"} />
        <Kpi label="Sitemap" value={sm.sitemaps.length} hint={sm.sitemaps.reduce((s, x) => s + x.errors, 0) + " errori"} />
      </div>

      <Card className="mt-5 overflow-hidden p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-canvas text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-5 py-3 font-medium">Articolo</th>
              <th className="px-5 py-3 font-medium">Pubblicato</th>
              <th className="px-5 py-3 font-medium">Stato per Google</th>
              <th className="px-5 py-3 font-medium">Ultima scansione</th>
              <th className="px-5 py-3 font-medium">Indicizzazione</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map(({ a, s }) => (
              <tr key={a.id} className="hover:bg-canvas/60">
                <td className="max-w-md px-5 py-2.5">
                  <Link href={`/sito/${a.id}`} className="line-clamp-1 font-medium hover:text-primary">
                    {a.title}
                  </Link>
                </td>
                <td className="whitespace-nowrap px-5 py-2.5 text-muted">{new Date(a.date).toLocaleDateString("it-IT")}</td>
                <td className="px-5 py-2.5">
                  <Badge tone={tone(s.verdict)}>{s.coverage || (s.error ? "Non disponibile" : "Sconosciuto")}</Badge>
                  {s.googleCanonical && s.userCanonical && s.googleCanonical !== s.userCanonical && (
                    <span className="ml-2 text-xs text-warn">Google sceglie un altro indirizzo canonico</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-5 py-2.5 text-muted">
                  {s.lastCrawl ? new Date(s.lastCrawl).toLocaleDateString("it-IT") : "—"}
                </td>
                <td className="whitespace-nowrap px-5 py-2.5">
                  {inspectLink(a.url) && (
                    <a
                      href={inspectLink(a.url)!}
                      target="_blank"
                      rel="noreferrer"
                      className={
                        "rounded-md border px-2 py-1 text-xs " +
                        (s.verdict === "PASS" ? "border-line text-muted hover:text-ink" : "border-primary text-primary hover:bg-primary-soft")
                      }
                    >
                      Richiedi ↗
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="mt-5">
        <h2 className="mb-3 text-base font-semibold">Sitemap inviate</h2>
        {sm.sitemaps.length === 0 ? (
          <p className="text-sm text-muted">Nessuna sitemap trovata.</p>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {sm.sitemaps.map((s) => (
              <li key={s.path} className="flex items-center justify-between gap-4 py-2.5">
                <span className="min-w-0 truncate">{s.path}</span>
                <span className="flex shrink-0 items-center gap-3 text-xs text-muted">
                  {n(s.submitted)} URL
                  {s.lastDownloaded && <span>letta il {new Date(s.lastDownloaded).toLocaleDateString("it-IT")}</span>}
                  {s.errors > 0 ? <Badge tone="danger">{s.errors} errori</Badge> : <Badge tone="ok">nessun errore</Badge>}
                  {s.warnings > 0 && <Badge tone="warn">{s.warnings} avvisi</Badge>}
                  <form action={inviaSitemap}>
                    <input type="hidden" name="path" value={s.path} />
                    <button type="submit" className="rounded-md border border-line px-2 py-1 text-xs text-muted hover:border-primary hover:text-primary">
                      Reinvia
                    </button>
                  </form>
                </span>
              </li>
            ))}
          </ul>
        )}
        <form action={inviaSitemap} className="mt-4 flex gap-2 border-t border-line pt-4">
          <input
            name="path"
            placeholder="https://www.cosmonet.info/sitemap_index.xml"
            className="flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm"
          />
          <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90">
            Invia sitemap
          </button>
        </form>
      </Card>
    </>
  );
}
