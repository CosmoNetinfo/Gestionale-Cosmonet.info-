"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Badge, Card, Kpi } from "@/components/ui";
import type { BatchResult, BrokenItem, NoAlt } from "@/lib/linkcheck";

const n = (v: number) => v.toLocaleString("it-IT");

function Righe({ items, vuoto }: { items: BrokenItem[]; vuoto: string }) {
  if (!items.length) return <p className="px-5 py-5 text-sm text-muted">{vuoto}</p>;
  return (
    <table className="w-full text-left text-[13px]">
      <thead className="border-b border-line bg-canvas text-xs uppercase tracking-wide text-muted">
        <tr>
          <th className="px-3 py-2.5 font-medium">Articolo</th>
          <th className="px-2 py-2.5 font-medium">Indirizzo</th>
          <th className="px-2 py-2.5 text-right font-medium">Esito</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {items.slice(0, 100).map((b, i) => (
          <tr key={b.articleId + b.url + i} className="hover:bg-canvas/60">
            <td className="max-w-[14rem] px-3 py-2.5">
              <Link href={`/sito/${b.articleId}`} className="line-clamp-2 hover:text-primary">{b.title}</Link>
              <div className="line-clamp-1 text-xs text-muted">{b.kind === "img" ? "immagine" : "link"}: {b.text}</div>
            </td>
            <td className="max-w-[18rem] px-2 py-2.5 text-xs">
              <a href={b.url} target="_blank" rel="noreferrer" className="break-all hover:text-primary">{b.url}</a>
            </td>
            <td className="px-2 py-2.5 text-right"><Badge tone="warn">{b.status}</Badge></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Box({ titolo, nota, children }: { titolo: string; nota: string; children: React.ReactNode }) {
  return (
    <Card className="mt-5 overflow-hidden p-0">
      <div className="border-b border-line px-5 py-4">
        <h2 className="text-base font-semibold">{titolo}</h2>
        <p className="text-xs text-muted">{nota}</p>
      </div>
      {children}
    </Card>
  );
}

export default function LinkScanner() {
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [batch, setBatch] = useState(0);
  const [pages, setPages] = useState(0);
  const [tot, setTot] = useState(0);
  const [errore, setErrore] = useState("");
  const [saltati, setSaltati] = useState<{ p: number; motivo: string }[]>([]);
  const [copiato, setCopiato] = useState(false);
  const [acc, setAcc] = useState({ articoli: 0, url: 0, rotti: [] as BrokenItem[], soft: [] as BrokenItem[], alt: [] as NoAlt[], http: [] as BrokenItem[] });
  const stop = useRef(false);

  const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms));

  /** Un blocco, con 3 tentativi e attese crescenti (WordPress può rispondere 429 = troppe richieste). */
  async function blocco(p: number): Promise<{ r?: BatchResult; motivo?: string }> {
    let motivo = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(`/api/link-batch?p=${p}`, { cache: "no-store" });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error ?? `errore ${res.status}`);
        return { r: j as BatchResult };
      } catch (e) {
        motivo = (e as Error).message;
        if (stop.current) break;
        await pausa(4000 * (attempt + 1));
      }
    }
    return { motivo };
  }

  function aggiungi(r: BatchResult) {
    setAcc((a) => ({
      articoli: a.articoli + r.articoli,
      url: a.url + r.controllati,
      rotti: [...a.rotti, ...r.rotti],
      soft: [...a.soft, ...r.nonVerificabili],
      alt: [...a.alt, ...r.senzaAlt],
      http: [...a.http, ...r.httpInterni],
    }));
  }

  async function run(maxBatch: number) {
    stop.current = false;
    setRunning(true);
    setDone(false);
    setErrore("");
    setSaltati([]);
    setAcc({ articoli: 0, url: 0, rotti: [], soft: [], alt: [], http: [] });
    let p = 1;
    let last = maxBatch;
    while (p <= last && !stop.current) {
      setBatch(p);
      const { r, motivo } = await blocco(p);
      if (!r) {
        // Non mi fermo: segno il blocco come saltato e vado avanti
        setSaltati((s) => [...s, { p, motivo: motivo ?? "errore" }]);
        p++;
        continue;
      }
      if (r.articoli === 0) break;
      setPages(r.pagine);
      setTot(r.articoliTotali);
      last = Math.min(maxBatch, r.pagine);
      aggiungi(r);
      p++;
      await pausa(1200); // piccola pausa tra un blocco e l'altro, per non farsi bloccare da WordPress
    }
    setRunning(false);
    setDone(!stop.current);
  }

  async function riprovaSaltati() {
    stop.current = false;
    setRunning(true);
    setDone(false);
    const restano: { p: number; motivo: string }[] = [];
    for (const s of saltati) {
      if (stop.current) {
        restano.push(s);
        continue;
      }
      setBatch(s.p);
      const { r, motivo } = await blocco(s.p);
      if (r) aggiungi(r);
      else restano.push({ p: s.p, motivo: motivo ?? "errore" });
      await pausa(1200);
    }
    setSaltati(restano);
    setRunning(false);
    setDone(true);
  }

  const interni = acc.rotti.filter((b) => b.interno);
  const esterni = acc.rotti.filter((b) => !b.interno);
  const altPerArt = new Map<number, { title: string; count: number }>();
  for (const x of acc.alt) altPerArt.set(x.articleId, { title: x.title, count: (altPerArt.get(x.articleId)?.count ?? 0) + 1 });
  const totBatch = Math.min(pages || 1, 99);
  const started = running || done || acc.articoli > 0;
  function reportText(): string {
    const L: string[] = [];
    L.push(`Report Link e immagini Cosmo Control — controllati ${acc.articoli} articoli e ${acc.url} indirizzi`);
    L.push("");
    const sez = (t: string, items: BrokenItem[]) => {
      L.push(`## ${t} (${items.length})`);
      for (const b of items) L.push(`- Articolo ${b.articleId} «${b.title}» → ${b.url} [${b.status}] testo: ${b.text}`);
      if (!items.length) L.push("- nessuno");
      L.push("");
    };
    sez("Link interni rotti", interni);
    sez("Link esterni rotti", esterni);
    L.push(`## Immagini senza alt (${acc.alt.length})`);
    for (const [id, v] of Array.from(altPerArt.entries()).sort((a, b) => b[1].count - a[1].count))
      L.push(`- Articolo ${id} «${v.title}»: ${v.count} immagini`);
    if (!acc.alt.length) L.push("- nessuna");
    L.push("");
    sez("Link interni http", acc.http);
    sez("Non verificabili (probabilmente funzionano)", acc.soft);
    if (saltati.length) L.push(`## Blocchi saltati: ${saltati.map((x) => `${x.p} (${x.motivo})`).join(", ")}`);
    return L.join("\n");
  }
  async function copia() {
    try {
      await navigator.clipboard.writeText(reportText());
      setCopiato(true);
      setTimeout(() => setCopiato(false), 2000);
    } catch {
      setErrore("Non riesco a copiare: usa «Scarica file».");
    }
  }
  function scarica() {
    const url = URL.createObjectURL(new Blob([reportText()], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `report-link-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }
  const btn = "rounded-md border border-line px-3 py-1.5 text-sm hover:border-primary hover:text-primary disabled:opacity-50";

  return (
    <>
      <Card>
        <p className="text-sm">
          Il controllo apre link e immagini degli articoli pubblicati, 25 articoli alla volta, dai più recenti. Tieni questa pagina aperta finché finisce.
          {tot ? ` Gli articoli pubblicati sono ${n(tot)}.` : ""}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button className={btn} disabled={running} onClick={() => run(8)}>Ultimi 200 articoli (circa 2 minuti)</button>
          <button className={btn} disabled={running} onClick={() => run(99)}>Tutti gli articoli (molto più lungo)</button>
          {running && (
            <button className={btn} onClick={() => (stop.current = true)}>Ferma</button>
          )}
        </div>
        {started && (
          <div className="mt-4">
            <div className="h-2 w-full overflow-hidden rounded-full bg-primary-soft">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.round((Math.min(batch, totBatch) / totBatch) * 100)}%` }} />
            </div>
            <p className="mt-2 text-xs text-muted">
              {done ? "Finito." : running ? `Blocco ${batch}…` : "Fermato."} Controllati {n(acc.articoli)} articoli e {n(acc.url)} indirizzi.
            </p>
          </div>
        )}
        {errore && <p className="mt-3 text-sm text-danger">{errore}</p>}
        {saltati.length > 0 && !running && (
          <p className="mt-3 text-sm text-warn">
            {saltati.length === 1 ? "Un blocco" : `${saltati.length} blocchi`} non {saltati.length === 1 ? "è stato" : "sono stati"} controllat{saltati.length === 1 ? "o" : "i"} (blocco {saltati.map((x) => x.p).join(", ")}: {saltati[0].motivo}).{" "}
            <button className="underline" onClick={riprovaSaltati}>Riprova solo {saltati.length === 1 ? "quello" : "questi"}</button>
          </p>
        )}
        {started && !running && acc.articoli > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
            <button className={btn} onClick={copia}>{copiato ? "Copiato ✓" : "Copia il report da incollare a Claude"}</button>
            <button className={btn} onClick={scarica}>Scarica file .txt</button>
          </div>
        )}
      </Card>

      {started && (
        <>
          <div className="mt-5 grid grid-cols-4 gap-5">
            <Kpi label="Link interni rotti" value={interni.length} tone={interni.length ? "danger" : "ok"} hint="verso pagine tue che non esistono" />
            <Kpi label="Link esterni rotti" value={esterni.length} tone={esterni.length ? "warn" : "ok"} hint="siti che non rispondono o 404" />
            <Kpi label="Immagini senza alt" value={acc.alt.length} tone={acc.alt.length ? "warn" : "ok"} hint={`in ${altPerArt.size} articoli`} />
            <Kpi label="Link interni http" value={acc.http.length} tone={acc.http.length ? "warn" : "ok"} hint="meglio https" />
          </div>
          <Box titolo="Link interni rotti" nota="Da correggere per primi: puntano a una pagina di Cosmonet che non c'è più.">
            <Righe items={interni} vuoto="Nessun link interno rotto finora." />
          </Box>
          <Box titolo="Link esterni rotti" nota="Sostituisci o togli il link. Aprilo prima a mano: qualche sito risponde male ai controlli automatici.">
            <Righe items={esterni} vuoto="Nessun link esterno rotto finora." />
          </Box>
          <Box titolo="Immagini senza testo alternativo (alt)" nota="Il testo alt serve ad accessibilità e SEO delle immagini.">
            {altPerArt.size === 0 ? (
              <p className="px-5 py-5 text-sm text-muted">Nessuna finora.</p>
            ) : (
              <ul className="divide-y divide-line text-sm">
                {Array.from(altPerArt.entries())
                  .sort((a, b) => b[1].count - a[1].count)
                  .slice(0, 60)
                  .map(([id, v]) => (
                    <li key={id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                      <Link href={`/sito/${id}`} className="line-clamp-1 hover:text-primary">{v.title}</Link>
                      <Badge tone="warn">{v.count} {v.count === 1 ? "immagine" : "immagini"}</Badge>
                    </li>
                  ))}
              </ul>
            )}
          </Box>
          <Box titolo="Non verificabili" nota="Il sito ha rifiutato il controllo (403/429) o non ha risposto in tempo: probabilmente funzionano.">
            <Righe items={acc.soft} vuoto="Nessuno." />
          </Box>
        </>
      )}
    </>
  );
}
