import { discordForum, discordPubblicaAttivo } from "@/lib/discord";
import { facebookAttivo } from "@/lib/facebook";
import { instagramAttivo } from "@/lib/instagram";
import { storicoSocial } from "@/lib/social";
import { Badge, Card, PageHeader } from "@/components/ui";
import FormPubblica from "./FormPubblica";
import { pubblica } from "./actions";

export const dynamic = "force-dynamic";

const messaggi: Record<string, { tono: "ok" | "warn"; testo: string }> = {
  ok: { tono: "ok", testo: "Pubblicato su tutti i canali scelti." },
  vuoto: { tono: "warn", testo: "Il testo del post è vuoto." },
  canali: { tono: "warn", testo: "Scegli almeno un canale collegato." },
  titolo: { tono: "warn", testo: "Per Discord serve il titolo del thread." },
  link: { tono: "warn", testo: "Il link deve iniziare con https://" },
  immagine: { tono: "warn", testo: "L'immagine deve essere JPG, PNG, WebP o GIF e pesare al massimo 4 MB." },
  igimg: { tono: "warn", testo: "Per Instagram serve l'indirizzo dell'immagine, che deve iniziare con https://" },
  duplicato: { tono: "warn", testo: "Questo link risulta già pubblicato. Se vuoi ripubblicarlo, spunta \"Pubblica comunque\"." },
};

const nomeCanale = (c: string) => (c === "facebook" ? "Facebook" : c === "discord" ? "Discord" : c === "instagram" ? "Instagram" : c);
const prima = (t: string) => (t.split("\n").find((r) => r.trim()) ?? "").slice(0, 90);

export default async function Pubblica({ searchParams }: { searchParams: { esito?: string; ok?: string; msg?: string } }) {
  const fb = facebookAttivo();
  const dc = discordPubblicaAttivo();
  const ig = instagramAttivo();
  const { items, missing } = await storicoSocial();
  const esito = searchParams.esito;
  const m = esito && messaggi[esito];

  return (
    <>
      <PageHeader title="Pubblica" subtitle="Un solo testo su Facebook, Instagram e Discord, con lo storico di quello che hai già pubblicato" />

      {m && (
        <div className="mb-6">
          <Badge tone={m.tono}>{m.testo}</Badge>
        </div>
      )}
      {(esito === "parziale" || esito === "errore") && (
        <Card className="mb-6 border-danger/30 bg-danger-soft">
          {esito === "parziale" ? `Pubblicato solo su ${searchParams.ok?.split(",").map(nomeCanale).join(", ")}. ` : "Non è stato pubblicato. "}
          Problema: {searchParams.msg}
        </Card>
      )}
      {!fb && !dc && !ig && (
        <Card className="mb-6">Nessun canale collegato: servono le variabili di Facebook e/o Discord su Vercel (vedi le pagine Facebook e Discord).</Card>
      )}

      <Card>
        <FormPubblica action={pubblica} fb={fb} dc={dc} ig={ig} forum={discordForum()} />
      </Card>

      <h2 className="mb-3 mt-8 text-base font-semibold">Storico</h2>
      {missing ? (
        <Card>
          Lo storico non è ancora attivo: {missing}. Esegui nell&apos;editor SQL di Supabase la parte <code>social_posts</code> del file <code>supabase/schema.sql</code>. Intanto la pubblicazione funziona lo stesso.
        </Card>
      ) : items.length === 0 ? (
        <Card>Ancora nessun post registrato.</Card>
      ) : (
        <Card>
          <ul className="divide-y divide-line text-sm">
            {items.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                <span className="w-32 shrink-0 text-xs text-muted">{new Date(p.created_at).toLocaleString("it-IT", { timeZone: "Europe/Rome", dateStyle: "short", timeStyle: "short" })}</span>
                <span className="min-w-0 flex-1 truncate">{prima(p.testo)}</span>
                <span className="flex gap-1.5">
                  {p.canali.map((c) => (
                    <span key={c.canale} title={c.errore ?? undefined}>
                      <Badge tone={c.ok ? "ok" : "warn"}>{nomeCanale(c.canale)}{c.ok ? "" : " ✗"}</Badge>
                    </span>
                  ))}
                </span>
                {p.link && (
                  <a href={p.link} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
                    articolo
                  </a>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
