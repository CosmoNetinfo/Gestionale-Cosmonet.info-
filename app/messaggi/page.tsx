import { leggiMessaggi, messaggiAttivi } from "@/lib/messaggi";
import { Badge, Card, Kpi, PageHeader } from "@/components/ui";
import { Rispondi } from "@/components/Rispondi";
import { invioAttivo } from "@/lib/invio";

export const dynamic = "force-dynamic";

const quando = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("it-IT", { timeZone: "Europe/Rome", dateStyle: "short", timeStyle: "short" }) : "data n.d.";

export default async function Messaggi() {
  const attivo = messaggiAttivi();
  const r = attivo ? await leggiMessaggi() : { ok: false, messaggi: [], errore: "Non collegato" };
  const nuovi = r.messaggi.filter((m) => m.letto === false).length;
  const ultimi7 = r.messaggi.filter((m) => m.data && Date.now() - new Date(m.data).getTime() < 7 * 86400000).length;

  return (
    <>
      <PageHeader title="Messaggi dal sito" subtitle="Quello che scrivono i lettori dal modulo Contatti (pagina «scrivici»)" />
      {!attivo && (
        <Card className="border-warn/30 bg-warn-soft">
          <p className="text-sm font-medium">Da collegare.</p>
          <p className="mt-1 text-sm text-muted">
            I messaggi stanno nel progetto Supabase del plugin contatti, diverso da quello del gestionale. Su Vercel aggiungi{" "}
            <code>CONTACT_SUPABASE_URL</code> e <code>CONTACT_SUPABASE_KEY</code> (la chiave segreta «service role» di quel
            progetto), poi fai un nuovo deploy. Se la tabella non si chiama <code>contacts</code>, aggiungi anche{" "}
            <code>CONTACT_TABLE</code>.
          </p>
        </Card>
      )}
      {attivo && !r.ok && <Card className="border-danger/30 bg-danger-soft">Non riesco a leggere i messaggi: {r.errore}</Card>}
      {r.ok && (
        <>
          <div className="grid grid-cols-3 gap-5">
            <Kpi label="Messaggi" value={r.messaggi.length} hint="ultimi 100" />
            <Kpi label="Ultimi 7 giorni" value={ultimi7} />
            <Kpi label="Non letti" value={nuovi} hint="solo se il plugin segna letto/non letto" />
          </div>
          <div className="mt-5 space-y-4">
            {r.messaggi.length === 0 && <Card className="text-sm text-muted">Nessun messaggio.</Card>}
            {r.messaggi.map((m) => (
              <Card key={m.id}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-medium">{m.nome || "Senza nome"}</div>
                    {m.email && (
                      <a href={`mailto:${m.email}`} className="text-sm text-primary hover:underline">
                        {m.email}
                      </a>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-xs text-muted">{quando(m.data)}</div>
                    {m.letto === false && <Badge tone="warn">Nuovo</Badge>}
                  </div>
                </div>
                {m.oggetto && <div className="mt-3 text-sm font-medium">{m.oggetto}</div>}
                <p className="mt-2 whitespace-pre-wrap break-words text-sm">{m.testo || "(nessun testo riconosciuto)"}</p>
                {m.email && invioAttivo() && <Rispondi a={m.email} oggetto={m.oggetto || "il tuo messaggio su Cosmonet.info"} citazione={m.testo} />}
                {!m.testo && (
                  <details className="mt-2 text-xs text-muted">
                    <summary className="cursor-pointer">Mostra i campi grezzi</summary>
                    <pre className="mt-2 overflow-auto">{JSON.stringify(m.campi, null, 2)}</pre>
                  </details>
                )}
              </Card>
            ))}
          </div>
          <p className="mt-6 text-xs text-muted">Le risposte partono dalla casella danielespalletti@cosmonet.info solo dopo la tua conferma. Per cancellare i messaggi usa la dashboard del plugin sul sito.</p>
        </>
      )}
    </>
  );
}
