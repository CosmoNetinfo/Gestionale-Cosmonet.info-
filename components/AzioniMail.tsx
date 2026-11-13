"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cestinoAction, letturaAction } from "@/app/posta/gestione";

/** Azioni su un messaggio di posta: letto/non letto e Cestino (recuperabile dalla webmail). */
export function AzioniMail({ uid, inviata, nonLetta }: { uid: number; inviata: boolean; nonLetta: boolean }) {
  const router = useRouter();
  const [conferma, setConferma] = useState(false);
  const [errore, setErrore] = useState("");
  const [inCorso, avvia] = useTransition();

  const lettura = (letto: boolean) =>
    avvia(async () => {
      const r = await letturaAction(uid, letto, inviata);
      if (!r.ok) setErrore(r.errore ?? "Errore");
      else router.refresh();
    });
  const cestina = () =>
    avvia(async () => {
      const r = await cestinoAction(uid, inviata);
      if (!r.ok) { setErrore(r.errore ?? "Errore"); setConferma(false); }
      else router.push(inviata ? "/posta?c=inviata" : "/posta");
    });

  const btn = "rounded-md border border-line px-3 py-1.5 text-sm text-muted hover:border-primary hover:text-primary disabled:opacity-50";
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      {!inviata && (
        <button type="button" disabled={inCorso} onClick={() => lettura(nonLetta)} className={btn}>
          {nonLetta ? "Segna come letto" : "Segna come non letto"}
        </button>
      )}
      {!conferma ? (
        <button type="button" disabled={inCorso} onClick={() => setConferma(true)} className={btn}>Sposta nel cestino</button>
      ) : (
        <>
          <button type="button" disabled={inCorso} onClick={cestina} className="rounded-md bg-danger px-3 py-1.5 text-sm text-white disabled:opacity-60">
            {inCorso ? "Attendi…" : "Conferma: sposta nel cestino"}
          </button>
          <button type="button" onClick={() => setConferma(false)} className="text-sm text-muted hover:underline">Annulla</button>
        </>
      )}
      {errore && <span className="text-sm text-danger">{errore}</span>}
    </div>
  );
}
