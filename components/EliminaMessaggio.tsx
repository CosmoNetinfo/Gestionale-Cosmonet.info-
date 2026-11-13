"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { eliminaMessaggioAction } from "@/app/posta/gestione";

/** Cancella un messaggio del modulo contatti: DEFINITIVO, quindi due passi. */
export function EliminaMessaggio({ id }: { id: string }) {
  const router = useRouter();
  const [conferma, setConferma] = useState(false);
  const [errore, setErrore] = useState("");
  const [inCorso, avvia] = useTransition();
  const vai = () =>
    avvia(async () => {
      const r = await eliminaMessaggioAction(id);
      if (!r.ok) { setErrore(r.errore ?? "Errore"); setConferma(false); }
      else router.refresh();
    });
  return (
    <span className="ml-3 inline-flex items-center gap-2">
      {!conferma ? (
        <button type="button" onClick={() => setConferma(true)} className="rounded-md border border-line px-3 py-1.5 text-sm text-muted hover:border-danger hover:text-danger">Elimina</button>
      ) : (
        <>
          <button type="button" disabled={inCorso} onClick={vai} className="rounded-md bg-danger px-3 py-1.5 text-sm text-white disabled:opacity-60">
            {inCorso ? "Attendi…" : "Conferma: elimina per sempre"}
          </button>
          <button type="button" onClick={() => setConferma(false)} className="text-sm text-muted hover:underline">Annulla</button>
        </>
      )}
      {errore && <span className="text-sm text-danger">{errore}</span>}
    </span>
  );
}
