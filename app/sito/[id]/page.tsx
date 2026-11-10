import Link from "next/link";
import { notFound } from "next/navigation";
import { loadArticles } from "@/lib/articles";
import { supabaseConfigured } from "@/lib/supabase";
import { getHistoryOrNone } from "./data";
import { segnaRivisto } from "../actions";
import { getGscStats, getPageDaily, getPageQueries, inspectUrl, normUrl, opportunity } from "@/lib/gsc";
import { daysSince, daysSinceTouched, isToReview } from "@/lib/review";
import { STATO_LABEL } from "@/lib/types";
import { Badge, Card, DemoBanner, Kpi, PageHeader } from "@/components/ui";
import { LineChart } from "@/components/LineChart";

export const dynamic = "force-dynamic";

const n = (v: number) => v.toLocaleString("it-IT");
const dm = (iso: string) => iso.slice(8, 10) + "/" + iso.slice(5, 7);
const dec = (v: number, d = 1) => v.toFixed(d).replace(".", ",");

export default async function Scheda({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { errore?: string };
}) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const { articles } = await loadArticles();
  const a = articles.find((x) => x.id === id);
  if (!a) notFound();

  const [gsc, queries, daily, history, index] = await Promise.all([
    getGscStats(),
    getPageQueries(a.url, 30),
    getPageDaily(a.url),
    getHistoryOrNone(a.url),
    a.status === "publish" ? inspectUrl(a.url) : Promise.resolve(null),
  ]);
  const g = gsc.configured ? gsc.byUrl.get(normUrl(a.url)) : undefined;

  // Se lo storico su Supabase ha più giorni di quelli recenti, lo uso: va oltre i 90 giorni
  const useHistory = history.length > daily.days.length;
  const series = useHistory ? history : daily.days;
  const base = process.env.WP_BASE_URL?.replace(/\/$/, "");
  const editUrl = base ? `${base}/wp-admin/post.php?post=${a.id}&action=edit` : null;
  const dub = isToReview(a);

  return (
    <>
      <PageHeader
        title={a.title}
        subtitle={`Articolo ${a.id} · ${a.category} · ${STATO_LABEL[a.status]}`}
        right={
          <div className="flex gap-2">
            <Link href="/sito" className="rounded-lg border border-line px-3 py-2 text-sm text-muted hover:text-ink">
              ← Elenco
            </Link>
            <a
              href={a.url}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-line px-3 py-2 text-sm text-muted hover:text-ink"
            >
              Apri articolo ↗
            </a>
            {editUrl && (
              <a
                href={editUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                Modifica su WordPress ↗
              </a>
            )}
          </div>
        }
      />

      {searchParams?.errore === "salvataggio" && (
        <DemoBanner
          title="Revisione non salvata."
          reason="Supabase ha rifiutato la scrittura (errore 403). Controlla che SUPABASE_SECRET_KEY su Vercel sia la chiave segreta (sb_secret_… o service_role), non quella pubblica."
        />
      )}

      {!gsc.configured && gsc.note && <DemoBanner title="Attenzione." reason={gsc.note} />}

      <div className="grid grid-cols-4 gap-5">
        <Kpi label="Click" value={g ? n(g.clicks) : "—"} hint={`ultimi ${gsc.days} giorni`} />
        <Kpi label="Impressioni" value={g ? n(g.impressions) : "—"} hint={g ? `CTR ${dec(g.ctr * 100)}%` : undefined} />
        <Kpi label="Posizione media" value={g ? dec(g.position) : "—"} />
        <Kpi
          label="Potenziale"
          value={g ? n(opportunity(g)) : "—"}
          hint="impressioni non diventate click"
          tone={g && opportunity(g) > 500 ? "warn" : "default"}
        />
      </div>

      <div className="mt-5 grid grid-cols-3 gap-5">
        <Card className="col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold">Click al giorno</h2>
            <span className="text-xs text-muted">
              {series.length > 0
                ? `${useHistory ? "dallo storico salvato" : "da Search Console"} · ${dm(series[0].date)} → ${dm(series[series.length - 1].date)}`
                : ""}
            </span>
          </div>
          {series.length > 1 ? (
            <>
              <LineChart data={series.map((d) => d.clicks)} labels={series.map((d) => dm(d.date))} />
              <h2 className="mb-3 mt-6 text-base font-semibold">Impressioni al giorno</h2>
              <LineChart data={series.map((d) => d.impressions)} labels={series.map((d) => dm(d.date))} />
            </>
          ) : (
            <p className="py-10 text-center text-sm text-muted">Nessun dato giornaliero per questo articolo.</p>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 text-base font-semibold">Stato</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-muted">Pubblicato</dt><dd>{new Date(a.date).toLocaleDateString("it-IT")} · {daysSince(a.date)} g fa</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Ultima modifica</dt><dd>{new Date(a.modified).toLocaleDateString("it-IT")}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Non toccato da</dt><dd>{daysSinceTouched(a)} g</dd></div>
            {index && !index.error && (
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted">Google</dt>
                <dd>
                  <Badge tone={index.verdict === "PASS" ? "ok" : index.verdict === "FAIL" ? "danger" : "warn"}>
                    {index.coverage || "Sconosciuto"}
                  </Badge>
                </dd>
              </div>
            )}
            <div className="flex items-center justify-between">
              <dt className="text-muted">Revisione</dt>
              <dd>
                {dub ? (
                  <Badge tone="warn">Da rivedere</Badge>
                ) : a.reviewedAt ? (
                  <Badge tone="ok">Rivisto il {new Date(a.reviewedAt).toLocaleDateString("it-IT")}</Badge>
                ) : (
                  <Badge tone="neutral">In regola</Badge>
                )}
              </dd>
            </div>
          </dl>
          {supabaseConfigured() && (
            <form action={segnaRivisto} className="mt-4">
              <input type="hidden" name="id" value={a.id} />
              <button
                type="submit"
                className="w-full rounded-lg border border-line px-3 py-2 text-sm font-medium text-muted hover:border-primary hover:text-primary"
              >
                ✓ Segna come rivisto oggi
              </button>
            </form>
          )}
          <p className="mt-4 text-xs text-muted">
            Per una revisione approfondita chiedi a Claude: «rivedi l&apos;articolo {a.id}». Legge il testo e le ricerche
            reali qui a fianco e ti propone le modifiche.
          </p>
        </Card>
      </div>

      <Card className="mt-5 overflow-hidden p-0">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-base font-semibold">Ricerche che portano a questo articolo</h2>
          <p className="text-xs text-muted">Ultimi {gsc.days} giorni, ordinate per impressioni</p>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-canvas text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-5 py-3 font-medium">Ricerca</th>
              <th className="px-5 py-3 text-right font-medium">Click</th>
              <th className="px-5 py-3 text-right font-medium">Impr.</th>
              <th className="px-5 py-3 text-right font-medium">CTR</th>
              <th className="px-5 py-3 text-right font-medium">Pos.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {queries.queries.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-muted">
                  {queries.note ?? "Nessuna ricerca registrata."}
                </td>
              </tr>
            )}
            {queries.queries.map((r) => (
              <tr key={r.query} className="hover:bg-canvas/60">
                <td className="px-5 py-2.5 font-medium">{r.query}</td>
                <td className="px-5 py-2.5 text-right">{n(r.clicks)}</td>
                <td className="px-5 py-2.5 text-right">{n(r.impressions)}</td>
                <td className="px-5 py-2.5 text-right text-muted">{dec(r.ctr * 100)}%</td>
                <td className="px-5 py-2.5 text-right text-muted">{dec(r.position)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
