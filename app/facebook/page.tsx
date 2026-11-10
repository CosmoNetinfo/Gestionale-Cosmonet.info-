import { facebookAttivo, facebookStato } from "@/lib/facebook";
import { Badge, Card, Kpi, PageHeader } from "@/components/ui";
import FormPubblica from "./FormPubblica";
import { pubblica } from "./actions";

export const dynamic = "force-dynamic";

const messaggi: Record<string, { tono: "ok" | "warn"; testo: string }> = {
  ok: { tono: "ok", testo: "Post pubblicato sulla pagina Facebook." },
  programmato: { tono: "ok", testo: "Post programmato su Facebook." },
  vuoto: { tono: "warn", testo: "Il testo del post è vuoto." },
  link: { tono: "warn", testo: "Il link deve iniziare con https://" },
  data: { tono: "warn", testo: "La data deve essere tra 15 minuti e 29 giorni da adesso." },
  immagine: { tono: "warn", testo: "L'immagine deve essere JPG, PNG, WebP o GIF e pesare al massimo 4 MB." },
};

export default async function Facebook({ searchParams }: { searchParams: { esito?: string; codice?: string; msg?: string } }) {
  if (!facebookAttivo())
    return (
      <>
        <PageHeader title="Facebook" subtitle="Pubblica sulla pagina Cosmonet.Info" />
        <Card>
          Per usare questa pagina servono due variabili su Vercel (progetto cosmo-control): <code>FACEBOOK_PAGE_ID</code> e <code>FACEBOOK_PAGE_TOKEN</code>. Poi un nuovo deploy.
        </Card>
      </>
    );

  const s = await facebookStato();
  const esito = searchParams.esito;
  const m = esito && messaggi[esito];
  const riconnetti = !s.ok && (s.codice === 190 || /token|session|expired/i.test(s.errore ?? ""));

  return (
    <>
      <PageHeader title="Facebook" subtitle="Pubblica o programma un post sulla pagina Cosmonet.Info" />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Kpi label="Pagina" value={s.nome ?? "—"} tone={s.ok ? "default" : "danger"} />
        <Kpi label="Follower" value={s.follower ?? "—"} />
        <Kpi
          label="Collegamento"
          value={s.ok ? "Attivo" : "Non funziona"}
          tone={s.ok ? "ok" : "danger"}
          hint={s.ok ? (s.scade ? `Il token scade: ${s.scade}` : undefined) : s.errore}
        />
      </div>

      {riconnetti && (
        <Card className="mb-6 border-danger/30 bg-danger-soft">
          Il token di Facebook non è più valido. Va rifatto il login: Graph API Explorer, nuovo token, poi aggiorna <code>FACEBOOK_PAGE_TOKEN</code> su Vercel.
        </Card>
      )}
      {m && (
        <div className="mb-6">
          <Badge tone={m.tono}>{m.testo}</Badge>
        </div>
      )}
      {esito === "errore" && (
        <Card className="mb-6 border-danger/30 bg-danger-soft">
          Facebook ha rifiutato il post{searchParams.codice ? ` (codice ${searchParams.codice})` : ""}: {searchParams.msg}
        </Card>
      )}

      <Card>
        <FormPubblica action={pubblica} />
      </Card>
    </>
  );
}
