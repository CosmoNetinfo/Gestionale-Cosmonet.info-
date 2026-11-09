import { getChannels } from "@/lib/channels";
import { Badge, Card, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

const TONE = { ok: "ok", "non-collegato": "warn", errore: "danger", "non-misurabile": "neutral" } as const;
const LABEL = { ok: "Collegato", "non-collegato": "Da collegare", errore: "Errore", "non-misurabile": "Non misurabile" } as const;

export default async function Canali() {
  const channels = await getChannels();
  return (
    <>
      <PageHeader title="Canali" subtitle="Le community di Cosmonet" />
      <div className="grid grid-cols-2 gap-5">
        {channels.map((c) => (
          <Card key={c.key}>
            <div className="flex items-start justify-between">
              <h2 className="text-base font-semibold">{c.nome}</h2>
              <Badge tone={TONE[c.stato]}>{LABEL[c.stato]}</Badge>
            </div>
            {c.stato === "ok" ? (
              <div className="mt-4 flex gap-8">
                {c.iscritti !== undefined && (
                  <div>
                    <div className="text-3xl font-semibold">{c.iscritti.toLocaleString("it-IT")}</div>
                    <div className="text-xs text-muted">iscritti</div>
                  </div>
                )}
                {c.online !== undefined && (
                  <div>
                    <div className="text-3xl font-semibold text-ok">{c.online.toLocaleString("it-IT")}</div>
                    <div className="text-xs text-muted">online ora</div>
                  </div>
                )}
              </div>
            ) : null}
            <p className="mt-3 text-sm text-muted">{c.dettaglio}</p>
            {c.link && (
              <a href={c.link} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-primary hover:underline">
                Apri ↗
              </a>
            )}
          </Card>
        ))}
      </div>
      <p className="mt-6 text-xs text-muted">
        Il conteggio degli iscritti non è storico: mostra il numero di adesso. Lo storico si può aggiungere salvando una
        rilevazione al giorno su Supabase.
      </p>
    </>
  );
}
