import type { ReactNode } from "react";
import { Badge, Card, Kpi } from "@/components/ui";
import type { AuditItem, CategoryId, FieldCategory, FieldMetric, FieldSet, SpeedResult } from "@/lib/pagespeed";

const dec = (v: number, d = 1) => v.toFixed(d).replace(".", ",");
const kib = (b: number) => (b >= 1048576 ? `${dec(b / 1048576)} MiB` : `${Math.round(b / 1024)} KiB`);
const plain = (s: string) => s.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/`/g, "");

type Tone = "ok" | "warn" | "danger" | "neutral";
const scoreTone = (s: number): Tone => (s >= 90 ? "ok" : s >= 50 ? "warn" : "danger");
const unitTone = (s: number | null): Tone => (s === null ? "neutral" : s >= 0.9 ? "ok" : s >= 0.5 ? "warn" : "danger");
const catTone = (c: FieldCategory | undefined): Tone => (c === "FAST" ? "ok" : c === "AVERAGE" ? "warn" : c === "SLOW" ? "danger" : "neutral");
const catLabel = (c: FieldCategory | undefined) =>
  c === "FAST" ? "Buono" : c === "AVERAGE" ? "Da migliorare" : c === "SLOW" ? "Scarso" : "—";

const CAT_LABEL: Record<CategoryId, string> = {
  performance: "Prestazioni",
  accessibility: "Accessibilità",
  "best-practices": "Best practice",
  seo: "SEO",
};

function ms(v: number) {
  return v >= 1000 ? `${dec(v / 1000)} s` : `${Math.round(v)} ms`;
}

function fieldValue(key: keyof Omit<FieldSet, "overall">, m: FieldMetric) {
  return key === "cls" ? dec(m.value, 2) : ms(m.value);
}

const FIELD_ROWS: { key: keyof Omit<FieldSet, "overall">; label: string; note: string }[] = [
  { key: "lcp", label: "LCP", note: "buono sotto 2,5 s" },
  { key: "inp", label: "INP", note: "buono sotto 200 ms" },
  { key: "cls", label: "CLS", note: "buono sotto 0,1" },
  { key: "fcp", label: "FCP", note: "buono sotto 1,8 s" },
  { key: "ttfb", label: "TTFB", note: "buono sotto 0,8 s" },
];

function Dist({ d }: { d?: FieldMetric["dist"] }) {
  if (!d) return <span className="text-muted">—</span>;
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-2 w-40 overflow-hidden rounded-full bg-canvas">
        <div className="bg-ok" style={{ width: `${d.good}%` }} />
        <div className="bg-warn" style={{ width: `${d.average}%` }} />
        <div className="bg-danger" style={{ width: `${d.poor}%` }} />
      </div>
      <span className="whitespace-nowrap text-xs text-muted">
        {d.good}% · {d.average}% · {d.poor}%
      </span>
    </div>
  );
}

function FieldTable({ title, set, empty }: { title: string; set: FieldSet | undefined; empty: string }) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        {set?.overall ? <Badge tone={catTone(set.overall)}>Core Web Vitals: {catLabel(set.overall)}</Badge> : null}
      </div>
      {!set ? (
        <p className="px-5 py-4 text-sm text-muted">{empty}</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-canvas text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-5 py-2.5 font-medium">Metrica</th>
              <th className="px-5 py-2.5 font-medium">Valore (75° percentile)</th>
              <th className="px-5 py-2.5 font-medium">Giudizio</th>
              <th className="px-5 py-2.5 font-medium">Visite buone · medie · scarse</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {FIELD_ROWS.map((r) => {
              const m = set[r.key];
              return (
                <tr key={r.key}>
                  <td className="px-5 py-2.5">
                    <span className="font-medium">{r.label}</span>
                    <span className="ml-2 text-xs text-muted">{r.note}</span>
                  </td>
                  {m ? (
                    <>
                      <td className="whitespace-nowrap px-5 py-2.5">{fieldValue(r.key, m)}</td>
                      <td className="px-5 py-2.5"><Badge tone={catTone(m.category)}>{catLabel(m.category)}</Badge></td>
                      <td className="px-5 py-2.5"><Dist d={m.dist} /></td>
                    </>
                  ) : (
                    <td colSpan={3} className="px-5 py-2.5 text-xs text-muted">Dato non disponibile</td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Card>
  );
}

function AuditList({ items }: { items: AuditItem[] }) {
  if (!items.length) return <p className="text-sm text-ok">Nessun problema segnalato.</p>;
  return (
    <ul className="divide-y divide-line">
      {items.map((a) => (
        <li key={a.id} className="py-2.5">
          <details>
            <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-medium">{plain(a.title)}</span>
              {a.savingsMs ? <Badge tone="warn">−{ms(a.savingsMs)}</Badge> : null}
              {a.savingsBytes ? <Badge tone="info">−{kib(a.savingsBytes)}</Badge> : null}
              {a.display ? <span className="text-xs text-muted">{plain(a.display)}</span> : null}
              {a.score !== null ? <Badge tone={unitTone(a.score)}>{Math.round(a.score * 100)}</Badge> : null}
            </summary>
            {a.description ? <p className="mt-1.5 text-xs text-muted">{plain(a.description)}</p> : null}
          </details>
        </li>
      ))}
    </ul>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="mt-8">
      <h2 className="text-base font-semibold">{title}</h2>
      {hint && <p className="mb-3 mt-0.5 text-xs text-muted">{hint}</p>}
      {!hint && <div className="mb-3" />}
      {children}
    </div>
  );
}

/** Tutti i dati di un'analisi PageSpeed: punteggi, misure, utenti reali, peso, problemi. */
export default function SpeedDetail({ r, title }: { r: SpeedResult; title: string }) {
  if (!r.ok) return null;
  const scores = r.scores ?? {};
  const audits = r.audits ?? {};
  const cats = (Object.keys(CAT_LABEL) as CategoryId[]).filter((c) => scores[c] !== undefined);
  const when = r.info?.fetchTime ? new Date(r.info.fetchTime).toLocaleString("it-IT", { timeZone: "Europe/Rome" }) : null;

  return (
    <div id="dettaglio" className="mt-10 border-t border-line pt-8">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold">Dettaglio: {title}</h2>
          <p className="mt-1 truncate text-xs text-muted">
            {r.info?.finalUrl ?? r.url} · {r.strategy === "desktop" ? "computer" : "telefono"}
            {when ? ` · test del ${when}` : ""}
          </p>
        </div>
        {r.info?.reportUrl && (
          <a
            href={r.info.reportUrl}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 rounded-lg border border-line px-3 py-2 text-sm text-muted hover:text-ink"
          >
            Apri il report su Google ↗
          </a>
        )}
      </div>

      <div className="grid grid-cols-4 gap-5">
        {cats.map((c) => (
          <Kpi
            key={c}
            label={CAT_LABEL[c]}
            value={scores[c] ?? "—"}
            hint={c === "performance" ? "laboratorio, da 0 a 100" : "da 0 a 100"}
            tone={scoreTone(scores[c] ?? 0) === "ok" ? "ok" : scoreTone(scores[c] ?? 0) === "warn" ? "warn" : "danger"}
          />
        ))}
      </div>

      <Section
        title="Misure di laboratorio"
        hint="Test simulato da Google (telefono lento o computer): serve a capire le cause, ma non è ciò che vivono i visitatori."
      >
        <Card className="overflow-hidden p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-canvas text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-5 py-2.5 font-medium">Metrica</th>
                <th className="px-5 py-2.5 font-medium">Valore</th>
                <th className="px-5 py-2.5 font-medium">Giudizio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {(r.labMetrics ?? []).map((m) => (
                <tr key={m.id}>
                  <td className="px-5 py-2.5 font-medium">{m.label}</td>
                  <td className="whitespace-nowrap px-5 py-2.5">
                    {m.text || (m.id === "cls" ? dec(m.value, 3) : ms(m.value))}
                  </td>
                  <td className="px-5 py-2.5">
                    <Badge tone={unitTone(m.score)}>
                      {m.score === null ? "—" : m.score >= 0.9 ? "Buono" : m.score >= 0.5 ? "Da migliorare" : "Scarso"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </Section>

      <Section
        title="Visitatori reali (ultimi 28 giorni)"
        hint="Dati di Chrome raccolti da Google: sono quelli che contano per la posizione nei risultati di ricerca. Le visite sono divise in buone, da migliorare e scarse."
      >
        <div className="grid gap-5">
          <FieldTable
            title="Questa pagina"
            set={r.field}
            empty="Google non ha abbastanza visite reali su questa pagina: guarda i dati di tutto il sito qui sotto."
          />
          <FieldTable
            title="Tutto il sito (origine)"
            set={r.origin}
            empty="Dati dell'origine non disponibili."
          />
        </div>
      </Section>

      {r.resources && (
        <Section title="Peso della pagina" hint="Quanto scarica un visitatore per aprire questa pagina.">
          <Card className="overflow-hidden p-0">
            <div className="flex gap-10 border-b border-line px-5 py-4 text-sm">
              {r.resources.totalBytes !== undefined && (
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted">Totale</div>
                  <div className="mt-1 text-lg font-semibold">{kib(r.resources.totalBytes)}</div>
                </div>
              )}
              {r.resources.requests !== undefined && (
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted">Richieste</div>
                  <div className="mt-1 text-lg font-semibold">{r.resources.requests}</div>
                </div>
              )}
            </div>
            {r.resources.byType && r.resources.byType.length > 0 && (
              <table className="w-full text-left text-sm">
                <thead className="border-b border-line bg-canvas text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-5 py-2.5 font-medium">Tipo</th>
                    <th className="px-5 py-2.5 font-medium">Richieste</th>
                    <th className="px-5 py-2.5 font-medium">Peso</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {r.resources.byType.map((t) => (
                    <tr key={t.type}>
                      <td className="px-5 py-2 font-medium">{t.type}</td>
                      <td className="px-5 py-2">{t.requests}</td>
                      <td className="px-5 py-2">{kib(t.bytes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </Section>
      )}

      {cats.map((c) => (
        <Section
          key={c}
          title={`${CAT_LABEL[c]}: cosa sistemare`}
          hint={
            c === "performance"
              ? "In ordine di risparmio stimato. Clicca una voce per leggere la spiegazione di Google."
              : "Controlli non superati. Clicca una voce per leggere la spiegazione di Google."
          }
        >
          <Card>
            <AuditList items={audits[c] ?? []} />
          </Card>
        </Section>
      ))}

      <p className="mt-6 text-xs text-muted">
        Lighthouse {r.info?.lighthouse ?? "?"}
        {r.info?.throttling ? ` · limitazione: ${r.info.throttling}` : ""}. I valori di laboratorio cambiano un po&apos; da un
        test all&apos;altro: per un confronto serio ripeti la misura due o tre volte.
      </p>
    </div>
  );
}
