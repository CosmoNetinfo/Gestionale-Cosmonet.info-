"use client";

import { useState, useTransition } from "react";
import { nuovaMailAction } from "@/app/posta/gestione";

/** Scrivi una mail nuova: scrivi → «Controlla» → «Conferma e invia». */
export function NuovaMail() {
  const [a, setA] = useState("");
  const [ogg, setOgg] = useState("");
  const [testo, setTesto] = useState("");
  const [conferma, setConferma] = useState(false);
  const [esito, setEsito] = useState<{ ok: boolean; testo: string } | null>(null);
  const [inCorso, avvia] = useTransition();

  const modifica = (f: (v: string) => void) => (e: { target: { value: string } }) => { f(e.target.value); setConferma(false); };
  const invia = () =>
    avvia(async () => {
      const r = await nuovaMailAction({ a, oggetto: ogg, testo });
      setConferma(false);
      if (r.ok) { setEsito({ ok: true, testo: `Inviata a ${a}.` }); setA(""); setOgg(""); setTesto(""); }
      else setEsito({ ok: false, testo: `Non inviata: ${r.errore}` });
    });
  const inp = "w-full rounded-md border border-line px-3 py-2 text-sm";
  return (
    <div className="space-y-3">
      <input value={a} onChange={modifica(setA)} placeholder="Destinatario (indirizzo email)" className={inp} aria-label="Destinatario" inputMode="email" />
      <input value={ogg} onChange={modifica(setOgg)} placeholder="Oggetto" className={inp} aria-label="Oggetto" />
      <textarea value={testo} onChange={modifica(setTesto)} rows={10} placeholder="Scrivi il messaggio…" className={inp} aria-label="Testo" />
      {esito && <p className={"rounded-md px-3 py-2 text-sm " + (esito.ok ? "bg-ok-soft" : "bg-danger-soft")}>{esito.testo}</p>}
      {!conferma ? (
        <button type="button" disabled={!a.trim() || !ogg.trim() || !testo.trim()} onClick={() => setConferma(true)} className="rounded-md bg-primary px-3 py-1.5 text-sm text-white disabled:opacity-40">Controlla</button>
      ) : (
        <>
          <button type="button" disabled={inCorso} onClick={invia} className="rounded-md bg-primary px-3 py-1.5 text-sm text-white disabled:opacity-60">{inCorso ? "Invio…" : `Conferma e invia a ${a}`}</button>
          <p className="text-xs text-muted">Premendo «Conferma e invia» la mail parte subito, firmata Daniele Spalletti.</p>
        </>
      )}
    </div>
  );
}
