import { loadHistory } from "@/lib/monitor";
import { LineChart } from "@/components/LineChart";
import { Card } from "@/components/ui";

const dm = (iso: string) => new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", timeZone: "Europe/Rome" });

/** Andamento giornaliero della home (misurato ogni mattina dal monitor) e stato del sito. */
export default async function SpeedTrend({ strategy }: { strategy: "mobile" | "desktop" }) {
  const [sp, up] = await Promise.all([loadHistory(strategy, 45), loadHistory("uptime", 45)]);
  const speed = sp.rows.filter((r) => r.score !== null);
  const ultimoUp = up.rows[up.rows.length - 1];
  const ttfb = up.rows.filter((r) => r.ttfb_ms !== null);
  const giorniOk = up.rows.filter((r) => !r.errore && (r.http_status ?? 0) > 0 && (r.http_status ?? 0) < 400).length;

  return (
    <Card className="mt-10">
      <h2 className="mb-1 text-base font-semibold">Andamento nel tempo (home, {strategy === "mobile" ? "cellulare" : "computer"})</h2>
      <p className="mb-4 text-xs text-muted">Una misura ogni mattina: se il punteggio cala di molto o il sito non risponde ricevi un avviso su Telegram.</p>
      {sp.errore && up.errore ? (
        <p className="text-sm text-muted">{sp.errore}</p>
      ) : (
        <>
          {speed.length >= 2 ? (
            <>
              <p className="mb-1 text-sm font-medium">Punteggio Prestazioni (0–100)</p>
              <LineChart data={speed.map((r) => r.score as number)} labels={speed.map((r) => dm(r.taken_at))} height={150} />
            </>
          ) : (
            <p className="text-sm text-muted">Servono almeno due giorni di misure per il grafico della velocità: parte dalla prossima mattina.</p>
          )}
          {ttfb.length >= 2 && (
            <>
              <p className="mb-1 mt-5 text-sm font-medium">Tempo di prima risposta del sito (ms)</p>
              <LineChart data={ttfb.map((r) => r.ttfb_ms as number)} labels={ttfb.map((r) => dm(r.taken_at))} height={150} />
            </>
          )}
          {ultimoUp && (
            <p className="mt-4 text-xs text-muted">
              Ultimo controllo {new Date(ultimoUp.taken_at).toLocaleString("it-IT", { timeZone: "Europe/Rome" })}:{" "}
              {ultimoUp.errore ? `errore (${ultimoUp.errore})` : `stato ${ultimoUp.http_status}, ${ultimoUp.ttfb_ms} ms`}
              {ultimoUp.cert_days !== null ? ` · certificato valido ancora ${ultimoUp.cert_days} giorni` : ""} · sito raggiungibile in {giorniOk} di {up.rows.length} controlli
            </p>
          )}
        </>
      )}
    </Card>
  );
}
