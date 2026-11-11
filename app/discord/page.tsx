import { discordForum, discordPubblicaAttivo } from "@/lib/discord";
import { Badge, Card, PageHeader } from "@/components/ui";
import FormDiscord from "./FormDiscord";
import { pubblica } from "./actions";

export const dynamic = "force-dynamic";

const messaggi: Record<string, { tono: "ok" | "warn"; testo: string }> = {
  ok: { tono: "ok", testo: "Post pubblicato su Discord." },
  vuoto: { tono: "warn", testo: "Il testo del post è vuoto." },
  titolo: { tono: "warn", testo: "Serve il titolo del thread." },
  link: { tono: "warn", testo: "Il link deve iniziare con https://" },
};

export default function Discord({ searchParams }: { searchParams: { esito?: string; msg?: string } }) {
  if (!discordPubblicaAttivo())
    return (
      <>
        <PageHeader title="Discord" subtitle="Pubblica sul server Discord di Cosmonet" />
        <Card>
          Per pubblicare serve la variabile <code>DISCORD_WEBHOOK_URL</code> su Vercel (progetto cosmo-control), poi un nuovo deploy. Il webhook si crea dal canale Discord: Modifica canale → Integrazioni → Webhook.
        </Card>
      </>
    );
  const esito = searchParams.esito;
  const m = esito && messaggi[esito];
  const forum = discordForum();
  return (
    <>
      <PageHeader title="Discord" subtitle={forum ? "Ogni post diventa un thread nel canale Forum, dove i lettori possono commentare" : "Pubblica un messaggio nel canale Discord"} />
      {m && (
        <div className="mb-6">
          <Badge tone={m.tono}>{m.testo}</Badge>
        </div>
      )}
      {esito === "errore" && <Card className="mb-6 border-danger/30 bg-danger-soft">Discord ha rifiutato il post: {searchParams.msg}</Card>}
      <Card>
        <FormDiscord action={pubblica} forum={forum} />
      </Card>
    </>
  );
}
