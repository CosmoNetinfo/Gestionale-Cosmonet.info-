import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, DemoBanner, PageHeader } from "@/components/ui";
import { CampoConteggio } from "@/components/CampoConteggio";
import { avvisi, cambiamenti, CAMPI, ETICHETTE, leggi, type Campo, type Modificabile } from "@/lib/wpedit";
import { applicaModifica } from "./actions";

export const dynamic = "force-dynamic";

type SP = Record<string, string | undefined>;
const STATI: [string, string][] = [
  ["publish", "Pubblicato"],
  ["draft", "Bozza"],
  ["pending", "In revisione"],
  ["future", "Programmato"],
];
const label = (k: Campo, v: string) => (k === "stato" ? STATI.find(([s]) => s === v)?.[1] ?? v : k === "data" ? v.replace("T", " ") : v) || "(vuoto)";

export default async function Modifica({ params, searchParams }: { params: { id: string }; searchParams: SP }) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const cur = await leggi(id);
  if (!cur.ok)
    return (
      <>
        <PageHeader title="Modifica articolo" subtitle={`Articolo ${id}`} />
        <DemoBanner title="Non riesco a leggere l'articolo." reason={cur.errore} />
      </>
    );
  const d = cur.dati;

  // Valori nel modulo: quelli dell'URL (anteprima o annullamento) oppure quelli attuali
  const val = {} as Modificabile;
  for (const k of CAMPI) val[k] = searchParams[k] ?? d[k];
  const diff = cambiamenti(d, val);
  const cambiati = Object.keys(diff) as Campo[];
  const anteprima = searchParams.anteprima === "1";
  const fatti = searchParams.fatto === "1";
  const prima: Partial<Modificabile> = {};
  for (const k of CAMPI) if (searchParams["prima_" + k] !== undefined) prima[k] = searchParams["prima_" + k];

  return (
    <>
      <PageHeader
        title="Modifica titolo, SEO e stato"
        subtitle={`Articolo ${id} · le modifiche partono solo dopo la tua conferma`}
        right={
          <Link href={`/sito/${id}`} className="rounded-lg border border-line px-3 py-2 text-sm text-muted hover:text-ink">
            ← Scheda articolo
          </Link>
        }
      />

      {searchParams.errore && <DemoBanner title="Modifica non completata." reason={searchParams.errore} />}
      {!cur.yoast && (
        <DemoBanner
          title="Campi SEO non visibili."
          reason="WordPress non mostra a questa app i campi Yoast (titolo SEO, meta description, parola chiave): qui sotto risultano vuoti. Titolo, stato e data funzionano; per i campi SEO chiedi a Claude, che ha un altro canale."
        />
      )}

      {fatti && (
        <Card className="mb-5 border-ok/30 bg-ok-soft">
          <h2 className="text-base font-semibold text-ok">Salvato su WordPress e verificato.</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {(Object.keys(prima) as Campo[]).map((k) => (
              <li key={k}>
                <span className="text-muted">{ETICHETTE[k]}:</span> <s>{label(k, prima[k] ?? "")}</s> → {label(k, d[k])}
              </li>
            ))}
          </ul>
          <Link
            href={`/sito/${id}/modifica?anteprima=1&${new URLSearchParams(Object.fromEntries(Object.entries(prima).map(([k, v]) => [k, v ?? ""]))).toString()}`}
            className="mt-3 inline-block rounded-md border border-line px-3 py-1.5 text-sm hover:border-primary hover:text-primary"
          >
            Annulla questa modifica (ti mostro prima l&apos;anteprima)
          </Link>
        </Card>
      )}

      {anteprima && (
        <Card className="mb-5">
          <h2 className="mb-3 text-base font-semibold">Anteprima: cosa cambierebbe</h2>
          {cambiati.length === 0 ? (
            <p className="text-sm text-muted">Nessuna differenza rispetto a WordPress.</p>
          ) : (
            <>
              <table className="w-full text-left text-sm">
                <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Campo</th>
                    <th className="py-2 pr-3 font-medium">Ora</th>
                    <th className="py-2 font-medium">Dopo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line align-top">
                  {cambiati.map((k) => (
                    <tr key={k}>
                      <td className="py-2 pr-3 text-muted">{ETICHETTE[k]}</td>
                      <td className="py-2 pr-3">{label(k, d[k])}</td>
                      <td className="py-2 font-medium">{label(k, val[k])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {avvisi(val).map((a) => (
                <p key={a} className="mt-3 text-sm text-warn">⚠ {a}</p>
              ))}
              <form action={applicaModifica} className="mt-4 flex flex-wrap items-center gap-3">
                <input type="hidden" name="id" value={id} />
                {CAMPI.map((k) => (
                  <input key={k} type="hidden" name={k} value={val[k]} />
                ))}
                <button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90">
                  Salva su WordPress
                </button>
                <span className="text-xs text-muted">L&apos;articolo è online: la modifica si vede subito sul sito.</span>
              </form>
            </>
          )}
        </Card>
      )}

      <Card>
        <h2 className="mb-1 text-base font-semibold">
          {anteprima ? "Cambia ancora" : "Modifica"} <Badge tone="neutral">{label("stato", d.stato)}</Badge>
        </h2>
        <form method="get" className="mt-3 space-y-4">
          <input type="hidden" name="anteprima" value="1" />
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Titolo</span>
            <CampoConteggio name="titolo" defaultValue={val.titolo} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Titolo SEO (Yoast)</span>
            <CampoConteggio name="seo" defaultValue={val.seo} max={60} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Meta description</span>
            <CampoConteggio name="meta" defaultValue={val.meta} max={160} rows={3} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Parola chiave principale</span>
            <CampoConteggio name="kw" defaultValue={val.kw} />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="block text-sm">
              <span className="mb-1 block text-muted">Stato</span>
              <select name="stato" defaultValue={val.stato} className="w-full rounded-md border border-line bg-canvas px-3 py-2 text-sm">
                {STATI.map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
                {!STATI.some(([v]) => v === d.stato) && <option value={d.stato}>{d.stato}</option>}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-muted">Data di pubblicazione (ora del sito)</span>
              <input type="datetime-local" name="data" defaultValue={val.data} className="w-full rounded-md border border-line bg-canvas px-3 py-2 text-sm" />
            </label>
          </div>
          <button className="rounded-lg border border-line px-4 py-2 text-sm font-medium hover:border-primary hover:text-primary">
            Vedi anteprima
          </button>
        </form>
      </Card>
    </>
  );
}
