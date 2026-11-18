import Link from "next/link";
import { runDiagnostics, type Esito } from "@/lib/diagnostics";
import { loadHistory } from "@/lib/monitor";
import { Badge, Card, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const peso: Record<Esito, number> = { ok: 0, info: 0, warn: 1, fail: 2 };
const tono = (e: number) => (e === 2 ? "danger" : e === 1 ? "warn" : "ok") as "danger" | "warn" | "ok";
const nomeTono = (e: number) => (e === 2 ? "Problema" : e === 1 ? "Attenzione" : "Tutto ok");

/** Un solo sguardo su tutto: un semaforo per ogni area e le ultime misure del monitor. */
export default async function Stato360() {
  const [diag, up, mob, art] = await Promise.all([
    runDiagnostics({ origin: null, full: false }),
    loadHistory("uptime", 1),
    loadHistory("mobile", 1),
    loadHistory("articolo", 3),
  ]);

  const gruppi = new Map<string, { peggio: number; problemi: string[]; tot: number }>();
  for (const c of diag.checks) {
    const g = gruppi.get(c.gruppo) ?? { peggio: 0, problemi: [], tot: 0 };
    g.tot++;
    const w = peso[c.esito];
    if (w > g.peggio) g.peggio = w;
    if (w > 0) g.problemi.push(`${c.nome}: ${c.dettaglio}`);
    gruppi.set(c.gruppo, g);
  }
  const u = up.rows[0];
  const m = mob.rows[0];
  const peggioTot = Math.max(0, ...Array.from(gruppi.values()).map((g) => g.peggio));

  return (
    <>
      <PageHeader title="Stato 360" subtitle="Tutto Cosmonet in un colpo d'occhio: sito, velocità, Google, collegamenti" />

      <Card>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Situazione generale</h2>
          <Badge tone={tono(peggioTot)}>{nomeTono(peggioTot)}</Badge>
        </div>
        <ul className="mt-3 space-y-1.5 text-sm">
          <li>
            <span className="text-muted">Sito online: </span>
            {u ? (u.errore ? `non risponde (${u.errore})` : `sì, stato ${u.http_status} in ${u.ttfb_ms} ms`) : "nessun controllo ancora salvato"}
            {u?.cert_days != null ? ` · certificato ancora valido ${u.cert_days} giorni` : ""}
          </li>
          <li>
            <span className="text-muted">Velocità home (cellulare): </span>
            {m?.score != null ? `${m.score}/100` : "nessuna misura ancora salvata"} · <Link className="text-primary" href="/velocita">dettagli</Link>
          </li>
          {art.rows.length > 0 && (
            <li>
              <span className="text-muted">Articoli migliori: </span>
              {art.rows.map((r) => (r.score != null ? r.score : "—")).join(" · ")} /100
            </li>
          )}
          {(up.errore || mob.errore) && <li className="text-xs text-muted">{up.errore ?? mob.errore}</li>}
        </ul>
        <p className="mt-3 text-xs text-muted">Controllo eseguito alle {new Date(diag.generato).toLocaleTimeString("it-IT", { timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit" })}. Le misure di velocità e disponibilità arrivano dal monitor delle 6:30.</p>
      </Card>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {Array.from(gruppi.entries()).map(([nome, g]) => (
          <Card key={nome}>
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold">{nome}</h3>
              <Badge tone={tono(g.peggio)}>{nomeTono(g.peggio)}</Badge>
            </div>
            <p className="mt-1 text-xs text-muted">{g.tot} controlli</p>
            {g.problemi.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs">
                {g.problemi.slice(0, 4).map((p) => (
                  <li key={p}>• {p}</li>
                ))}
              </ul>
            )}
          </Card>
        ))}
      </div>

      <p className="mt-5 text-sm text-muted">
        Per i dettagli e come risolvere: <Link className="text-primary" href="/debug">Debug</Link> · <Link className="text-primary" href="/indicizzazione">Indicizzazione</Link> · <Link className="text-primary" href="/link">Link e immagini</Link> · <Link className="text-primary" href="/salute">Salute del sito</Link>
      </p>
    </>
  );
}
