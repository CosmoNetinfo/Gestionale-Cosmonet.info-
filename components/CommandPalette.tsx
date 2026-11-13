"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

type Voce = { href: string; label: string; sub?: string };

const PAGINE: Voce[] = [
  { href: "/", label: "Panoramica", sub: "numeri generali" },
  { href: "/rivedere", label: "Da rivedere", sub: "articoli vecchi da aggiornare" },
  { href: "/prossimo", label: "Prossimo articolo da rivedere", sub: "il più urgente" },
  { href: "/sito", label: "Sito (elenco articoli)", sub: "tutti gli articoli" },
  { href: "/da-scrivere", label: "Da scrivere", sub: "notizie dai feed RSS" },
  { href: "/da-scrivere/fonti", label: "Fonti RSS", sub: "feed e notizie" },
  { href: "/messaggi", label: "Messaggi dal sito", sub: "modulo contatti" },
  { href: "/posta", label: "Posta", sub: "casella email" },
  { href: "/agenda", label: "Agenda", sub: "cose da fare" },
  { href: "/coda", label: "Coda di pubblicazione", sub: "programmati e bozze" },
  { href: "/pubblica", label: "Pubblica", sub: "Facebook, Instagram, Discord" },
  { href: "/facebook", label: "Facebook", sub: "pubblica o programma" },
  { href: "/facebook/attivita", label: "Commenti Facebook", sub: "reazioni e risposte" },
  { href: "/discord", label: "Discord", sub: "pubblica sul server" },
  { href: "/canali", label: "Canali", sub: "community" },
  { href: "/grafici", label: "Grafici", sub: "click e impressioni" },
  { href: "/report", label: "Report settimanale", sub: "ultimi 7 giorni" },
  { href: "/ricerche", label: "Ricerche", sub: "cosa cercano le persone" },
  { href: "/segmenti", label: "Segmenti (categorie, paesi, dispositivi)" },
  { href: "/avvisi", label: "Avvisi", sub: "cali e crescite" },
  { href: "/opportunita", label: "Opportunità", sub: "parole chiave e link interni" },
  { href: "/impatto", label: "Impatto delle revisioni", sub: "prima e dopo" },
  { href: "/salute", label: "Salute del sito", sub: "controlli automatici" },
  { href: "/link", label: "Link e immagini", sub: "link rotti, alt mancanti" },
  { href: "/indicizzazione", label: "Indicizzazione", sub: "articoli su Google" },
  { href: "/velocita", label: "Velocità", sub: "PageSpeed" },
  { href: "/repository", label: "Repository", sub: "GitHub" },
  { href: "/memo", label: "Cosmo Memo", sub: "memoria esterna" },
  { href: "/archivio", label: "Archivio", sub: "spazio database" },
  { href: "/stato", label: "Stato servizi", sub: "sito online?" },
  { href: "/debug", label: "Debug", sub: "controllo del gestionale" },
  { href: "/impostazioni", label: "Impostazioni", sub: "collegamenti e regole" },
];

/** Cmd+K (o Ctrl+K): cerca un articolo o una pagina e ci va. */
export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const [articoli, setArticoli] = useState<Voce[] | null>(null);
  const [errore, setErrore] = useState("");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") setOpen(false);
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("cc-open-search", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("cc-open-search", onOpen);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    setQ("");
    setSel(0);
    setTimeout(() => input.current?.focus(), 20);
    if (articoli) return;
    fetch("/api/indice")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`errore ${r.status}`))))
      .then((list: { id: number; t: string; c: string; s: string }[]) =>
        setArticoli(list.map((a) => ({ href: `/sito/${a.id}`, label: a.t, sub: `${a.c}${a.s === "publish" ? "" : " · " + a.s}` }))),
      )
      .catch((e: Error) => setErrore(e.message));
  }, [open, articoli]);

  const risultati = useMemo(() => {
    const t = q.trim().toLowerCase();
    const tutti = [...PAGINE, ...(articoli ?? [])];
    if (!t) return PAGINE.slice(0, 8);
    const parole = t.split(/\s+/);
    return tutti.filter((v) => parole.every((p) => v.label.toLowerCase().includes(p) || (v.sub ?? "").toLowerCase().includes(p))).slice(0, 8);
  }, [q, articoli]);

  const vai = (v?: Voce) => {
    if (!v) return;
    setOpen(false);
    router.push(v.href);
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-[15vh]" onClick={() => setOpen(false)}>
      <div className="w-[560px] max-w-[92vw] overflow-hidden rounded-card border border-line bg-surface shadow-xl" onClick={(e) => e.stopPropagation()}>
        <input
          ref={input}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setSel(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setSel((s) => Math.min(s + 1, risultati.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setSel((s) => Math.max(s - 1, 0));
            } else if (e.key === "Enter") vai(risultati[sel]);
          }}
          placeholder="Cerca un articolo o una pagina…"
          className="w-full border-b border-line bg-transparent px-4 py-3 text-sm outline-none"
        />
        <ul className="max-h-[50vh] overflow-y-auto py-1">
          {risultati.map((v, i) => (
            <li key={v.href}>
              <button
                onClick={() => vai(v)}
                onMouseEnter={() => setSel(i)}
                className={"block w-full px-4 py-2 text-left text-sm " + (i === sel ? "bg-primary-soft text-primary-dark" : "text-ink")}
              >
                <span className="line-clamp-1">{v.label}</span>
                {v.sub && <span className="block text-xs text-muted">{v.sub}</span>}
              </button>
            </li>
          ))}
          {risultati.length === 0 && <li className="px-4 py-3 text-sm text-muted">{articoli ? "Nessun risultato." : errore ? `Articoli non caricati (${errore})` : "Carico gli articoli…"}</li>}
        </ul>
        <div className="border-t border-line px-4 py-2 text-[11px] text-muted">↑↓ per scegliere · Invio per aprire · Esc per chiudere</div>
      </div>
    </div>
  );
}
