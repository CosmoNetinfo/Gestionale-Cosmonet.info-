"use client";

import { useState, useTransition } from "react";
import { rispondiAction } from "@/app/posta/rispondi";

/** Risposta in due passi: scrivi → «Controlla» → «Conferma e invia». Niente parte da solo. */
export function Rispondi({ a, oggetto, citazione, inRispostaA }: { a: string; oggetto: string; citazione?: string; inRispostaA?: string }) {
  const [aperto, setAperto] = useState(false);
  const [ogg, setOgg] = useState(/^re:/i.test(oggetto) ? oggetto : `Re: ${oggetto || "il tuo messaggio"}`);
  const [testo, setTesto] = useState("");
  const [conferma, setConferma] = useState(false);
  const [esito, setEsito] = useState<{ ok: boolean; testo: string } | null>(null);
  const [inCorso, avvia] = useTransition();

  if (esito?.ok) return <p className="mt-4 rounded-md bg-ok-soft px-3 py-2 text-sm">{esito.testo}</p>;

  if (!aperto) {
    return (
      <button type="button" onClick={() => setAperto(true)} className="mt-4 rounded-md border border-line px-3 py-1.5 text-sm text-primary hover:border-primary">
        Rispondi
      </button>
    );
  }

  const invia = () =>
    avvia(async () => {
      const corpo = citazione ? `${testo.trim()}\n\n\n> ${citazione.split("\n").slice(0, 40).join("\n> ")}` : testo;
      const r = await rispondiAction({ a, oggetto: ogg, testo: corpo, inRispostaA });
      setConferma(false);
      setEsito(
        r.ok
          ? { ok: true, testo: `Inviato a ${a}.${r.copiaSalvata ? "" : " (Copia non salvata in «Posta inviata»: controlla la webmail se ti serve.)"}` }
          : { ok: false, testo: `Non inviato: ${r.errore}` },
      );
    });

  return (
    <div className="mt-4 space-y-3 rounded-md border border-line p-4">
      <div className="text-sm"><span className="text-muted">A:</span> {a}</div>
      <input
        value={ogg}
        onChange={(e) => { setOgg(e.target.value); setConferma(false); }}
        className="w-full rounded-md border border-line px-3 py-2 text-sm"
        aria-label="Oggetto"
      />
      <textarea
        value={testo}
        onChange={(e) => { setTesto(e.target.value); setConferma(false); }}
        rows={8}
        placeholder="Scrivi la risposta…"
        className="w-full rounded-md border border-line px-3 py-2 text-sm"
        aria-label="Testo della risposta"
      />
      {esito && !esito.ok && <p className="text-sm text-danger">{esito.testo}</p>}
      <div className="flex flex-wrap items-center gap-2">
        {!conferma ? (
          <button type="button" disabled={!testo.trim() || !ogg.trim()} onClick={() => setConferma(true)} className="rounded-md bg-primary px-3 py-1.5 text-sm text-white disabled:opacity-40">
            Controlla
          </button>
        ) : (
          <button type="button" disabled={inCorso} onClick={invia} className="rounded-md bg-primary px-3 py-1.5 text-sm text-white disabled:opacity-60">
            {inCorso ? "Invio…" : `Conferma e invia a ${a}`}
          </button>
        )}
        <button type="button" onClick={() => { setAperto(false); setConferma(false); }} className="text-sm text-muted hover:underline">
          Annulla
        </button>
      </div>
      {conferma && <p className="text-xs text-muted">Rileggi: premendo «Conferma e invia» la mail parte subito da {`danielespalletti@cosmonet.info`}, firmata Daniele Spalletti.</p>}
    </div>
  );
}
