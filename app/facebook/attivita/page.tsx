import { facebookAttivita, facebookAttivo } from "@/lib/facebook";
import { Badge, Card, Kpi, PageHeader } from "@/components/ui";
import RispostaForm from "./RispostaForm";
import { rispondi } from "./actions";

export const dynamic = "force-dynamic";

const messaggi: Record<string, { tono: "ok" | "warn"; testo: string }> = {
  ok: { tono: "ok", testo: "Risposta pubblicata." },
  vuoto: { tono: "warn", testo: "La risposta è vuota." },
  lungo: { tono: "warn", testo: "La risposta è troppo lunga (max 1500 caratteri)." },
};

const quando = (iso: string) => new Date(iso).toLocaleString("it-IT", { timeZone: "Europe/Rome", dateStyle: "short", timeStyle: "short" });
const n = (x: number | null) => (x === null ? "n.d." : x.toLocaleString("it-IT"));
const prima = (t: string) => (t.split("\n").find((r) => r.trim()) ?? "").slice(0, 110);

export default async function Attivita({ searchParams }: { searchParams: { esito?: string; msg?: string } }) {
  const attivo = facebookAttivo();
  const r = attivo ? await facebookAttivita() : { ok: false, post: [], errore: "Facebook non è collegato" };
  const m = searchParams.esito && messaggi[searchParams.esito];
  const totReaz = r.post.reduce((s, p) => s + p.reazioni, 0);
  const totCom = r.post.reduce((s, p) => s + p.commenti, 0);
  const totSh = r.post.reduce((s, p) => s + p.condivisioni, 0);

  return (
    <>
      <PageHeader title="Facebook: commenti e statistiche" subtitle="Gli ultimi post della pagina con reazioni, commenti e risposte" />
      {m && (
        <div className="mb-6">
          <Badge tone={m.tono}>{m.testo}</Badge>
        </div>
      )}
      {searchParams.esito === "errore" && <Card className="mb-6 border-danger/30 bg-danger-soft">La risposta non è partita. Problema: {searchParams.msg}. Se parla di permessi, serve <code>pages_manage_engagement</code> nel token della pagina.</Card>}
      {!r.ok && (
        <Card className="mb-6 border-danger/30 bg-danger-soft">
          Non riesco a leggere i post: {r.errore}
          {r.codice === 10 || r.codice === 200 ? " Mancano permessi nel token: per leggere reazioni e commenti serve pages_read_engagement (e pages_read_user_content per vedere chi commenta)." : ""}
        </Card>
      )}
      {r.ok && (
        <>
          <div className="grid grid-cols-3 gap-5">
            <Kpi label="Reazioni" value={totReaz} hint={`sugli ultimi ${r.post.length} post`} />
            <Kpi label="Commenti" value={totCom} hint="sugli stessi post" />
            <Kpi label="Condivisioni" value={totSh} hint="sugli stessi post" />
          </div>
          <div className="mt-5 space-y-4">
            {r.post.map((p) => (
              <Card key={p.id}>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-xs text-muted">{quando(p.quando)}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{prima(p.testo)}</span>
                  {p.link && (
                    <a href={p.link} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
                      apri su Facebook
                    </a>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <Badge tone="ok">{p.reazioni} reazioni</Badge>
                  <Badge tone="ok">{p.commenti} commenti</Badge>
                  <Badge tone="ok">{p.condivisioni} condivisioni</Badge>
                  <Badge tone="ok">copertura {n(p.copertura)}</Badge>
                  <Badge tone="ok">visualizzazioni {n(p.visualizzazioni)}</Badge>
                </div>
                {p.ultimiCommenti.length > 0 && (
                  <ul className="mt-3 divide-y divide-line border-t border-line text-sm">
                    {p.ultimiCommenti.map((c) => (
                      <li key={c.id} className="py-2.5">
                        <div className="text-xs text-muted">
                          {c.autore} · {quando(c.quando)}
                        </div>
                        <div>{c.testo}</div>
                        <RispostaForm action={rispondi} commento={c.id} />
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted">Copertura e visualizzazioni compaiono solo se Facebook le fornisce per quel post: «n.d.» significa non disponibile, non zero.</p>
        </>
      )}
    </>
  );
}
