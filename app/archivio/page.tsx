import { elencoImmagini, statoDb } from "@/lib/archivio";
import { Badge, Card, Kpi, PageHeader } from "@/components/ui";
import ConfermaForm from "./ConfermaForm";
import { elimina, svuota } from "./actions";

export const dynamic = "force-dynamic";

const mb = (b: number) => (b >= 1024 * 1024 * 1024 ? `${(b / 1024 / 1024 / 1024).toFixed(2)} GB` : b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const LIMITE_DB = Number(process.env.DB_LIMITE_MB) > 0 ? Number(process.env.DB_LIMITE_MB) * 1024 * 1024 : 500 * 1024 * 1024;

export default async function Archivio({ searchParams }: { searchParams: { esito?: string } }) {
  const [{ stato, errore, manca }, { file, errore: erroreFile }] = await Promise.all([statoDb(), elencoImmagini()]);
  const usoFile = file.reduce((s, f) => s + f.bytes, 0);

  return (
    <>
      <PageHeader title="Archivio" subtitle="Quanto spazio usa il database e quali file temporanei ci sono dentro" />
      {searchParams.esito === "ok" && (
        <div className="mb-6">
          <Badge tone="ok">Fatto.</Badge>
        </div>
      )}
      {searchParams.esito === "errore" && <Card className="mb-6 border-danger/30 bg-danger-soft">Non sono riuscito a cancellare. Riprova.</Card>}

      {manca && (
        <Card className="mb-6">
          Per vedere lo spazio usato esegui una volta nell&apos;editor SQL di Supabase la parte <code>cosmo_db_stato</code> in fondo al file <code>supabase/schema.sql</code>. Le immagini qui sotto si vedono già.
        </Card>
      )}
      {errore && <Card className="mb-6 border-danger/30 bg-danger-soft">{errore}</Card>}

      {stato && (
        <>
          <div className="grid grid-cols-3 gap-5">
            <Kpi label="Database" value={mb(stato.dbBytes)} hint={`${Math.round((stato.dbBytes / LIMITE_DB) * 100)}% di ${mb(LIMITE_DB)} (limite del piano gratuito)`} tone={stato.dbBytes / LIMITE_DB > 0.8 ? "danger" : stato.dbBytes / LIMITE_DB > 0.6 ? "warn" : "default"} />
            <Kpi label="File (Storage)" value={mb(stato.storageBytes)} hint="immagini e altri file" />
            <Kpi label="Immagini temporanee" value={file.length} hint={`${mb(usoFile)} in attesa di essere cancellate`} />
          </div>

          <Card className="mt-5 overflow-hidden p-0">
            <div className="border-b border-line px-5 py-4">
              <h2 className="text-base font-semibold">Tabelle, dalla più pesante</h2>
              <p className="text-xs text-muted">Le righe sono una stima di Supabase. Una tabella grossa come lo storico Search Console è normale.</p>
            </div>
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-canvas text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-5 py-3 font-medium">Tabella</th>
                  <th className="px-5 py-3 text-right font-medium">Righe</th>
                  <th className="px-5 py-3 text-right font-medium">Spazio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {stato.tabelle.map((t) => (
                  <tr key={t.nome}>
                    <td className="px-5 py-2.5 font-medium">{t.nome}</td>
                    <td className="px-5 py-2.5 text-right">{t.righe.toLocaleString("it-IT")}</td>
                    <td className="px-5 py-2.5 text-right">{mb(t.bytes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}

      <div className="mb-3 mt-8 flex items-center justify-between">
        <h2 className="text-base font-semibold">Immagini temporanee dei post</h2>
        {file.length > 0 && (
          <ConfermaForm action={svuota} domanda={`Cancellare tutte le ${file.length} immagini? I post già pubblicati non cambiano.`}>
            <button className="rounded-md border border-line px-3 py-1.5 text-sm hover:bg-canvas">Cancella tutte</button>
          </ConfermaForm>
        )}
      </div>
      {erroreFile && <Card className="mb-3 border-danger/30 bg-danger-soft">{erroreFile}</Card>}
      {file.length === 0 ? (
        <Card>Nessuna immagine temporanea: si cancellano da sole dopo ogni pubblicazione.</Card>
      ) : (
        <Card>
          <ul className="divide-y divide-line text-sm">
            {file.map((f) => (
              <li key={f.nome} className="flex items-center gap-3 py-2.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.url} alt="" className="h-12 w-12 shrink-0 rounded object-cover" />
                <span className="min-w-0 flex-1 truncate">{f.nome}</span>
                <span className="w-20 shrink-0 text-right text-xs text-muted">{mb(f.bytes)}</span>
                <span className="w-32 shrink-0 text-right text-xs text-muted">{f.creato ? new Date(f.creato).toLocaleString("it-IT", { timeZone: "Europe/Rome", dateStyle: "short", timeStyle: "short" }) : ""}</span>
                <ConfermaForm action={elimina} domanda="Cancellare questa immagine?" nome={f.nome}>
                  <button className="rounded-md border border-line px-2.5 py-1 text-xs hover:bg-canvas">Cancella</button>
                </ConfermaForm>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
