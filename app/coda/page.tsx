import Link from "next/link";
import { loadArticles } from "@/lib/articles";
import { daysSince } from "@/lib/review";
import { Badge, Card, Kpi, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

const DAYS = ["dom", "lun", "mar", "mer", "gio", "ven", "sab"];
const key = (d: Date) => d.toISOString().slice(0, 10);

export default async function Coda() {
  const { articles } = await loadArticles();
  const now = new Date();
  const programmati = articles.filter((a) => a.status === "future").sort((a, b) => a.date.localeCompare(b.date));
  const bozze = articles
    .filter((a) => a.status === "draft" || a.status === "pending")
    .sort((a, b) => b.modified.localeCompare(a.modified));
  const ultimi30 = articles.filter((a) => a.status === "publish" && daysSince(a.date) <= 30).length;
  const perSett = Math.round((ultimi30 / 30) * 7 * 10) / 10;

  // I prossimi 14 giorni: cosa esce e quali giorni restano vuoti
  const perGiorno = new Map<string, typeof programmati>();
  for (const a of programmati) {
    const k = a.date.slice(0, 10);
    perGiorno.set(k, [...(perGiorno.get(k) ?? []), a]);
  }
  const giorni = Array.from({ length: 14 }, (_, i) => new Date(now.getTime() + i * 86400000));
  const vuoti = giorni.filter((d) => !perGiorno.has(key(d))).length;

  return (
    <>
      <PageHeader title="Coda di pubblicazione" subtitle="Cosa è programmato, cosa è in bozza e quali giorni sono vuoti" />

      <div className="grid grid-cols-4 gap-5">
        <Kpi label="Programmati" value={programmati.length} tone="ok" />
        <Kpi label="Bozze" value={bozze.length} />
        <Kpi label="Pubblicati negli ultimi 30 giorni" value={ultimi30} hint={`circa ${String(perSett).replace(".", ",")} a settimana`} />
        <Kpi label="Giorni vuoti nei prossimi 14" value={vuoti} tone={vuoti > 7 ? "warn" : "default"} />
      </div>

      <Card className="mt-5">
        <h2 className="mb-4 text-base font-semibold">Prossimi 14 giorni</h2>
        <ul className="divide-y divide-line text-sm">
          {giorni.map((d) => {
            const list = perGiorno.get(key(d)) ?? [];
            return (
              <li key={key(d)} className="flex items-start gap-4 py-2.5">
                <span className="w-28 shrink-0 text-muted">
                  {DAYS[d.getDay()]} {d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" })}
                </span>
                {list.length === 0 ? (
                  <span className="text-muted">— nessun articolo programmato</span>
                ) : (
                  <span className="min-w-0 space-y-1">
                    {list.map((a) => (
                      <span key={a.id} className="flex items-center gap-2">
                        <Link href={`/sito/${a.id}`} className="truncate font-medium hover:text-primary">{a.title}</Link>
                        <Badge tone="info">{new Date(a.date).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}</Badge>
                      </span>
                    ))}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        {programmati.some((a) => new Date(a.date).getTime() > now.getTime() + 14 * 86400000) && (
          <p className="mt-3 text-xs text-muted">
            Altri {programmati.filter((a) => new Date(a.date).getTime() > now.getTime() + 14 * 86400000).length} articoli
            sono programmati oltre i 14 giorni.
          </p>
        )}
      </Card>

      <Card className="mt-5">
        <h2 className="mb-4 text-base font-semibold">Bozze e articoli in revisione</h2>
        {bozze.length === 0 ? (
          <p className="text-sm text-muted">Nessuna bozza.</p>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {bozze.slice(0, 30).map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-4 py-2.5">
                <Link href={`/sito/${a.id}`} className="min-w-0 truncate font-medium hover:text-primary">{a.title}</Link>
                <span className="flex shrink-0 items-center gap-3 text-xs text-muted">
                  {a.category}
                  <span>modificata {daysSince(a.modified)} g fa</span>
                  <Badge tone={a.status === "pending" ? "warn" : "neutral"}>{a.status === "pending" ? "In revisione" : "Bozza"}</Badge>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
