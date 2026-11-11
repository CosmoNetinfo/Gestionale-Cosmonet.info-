"use client";

import { useRef, useState } from "react";

export default function FormPubblica({ action, fb, dc, ig, forum }: { action: (fd: FormData) => void | Promise<void>; fb: boolean; dc: boolean; ig: boolean; forum: boolean }) {
  const [facebook, setFacebook] = useState(fb);
  const [discord, setDiscord] = useState(dc);
  const [instagram, setInstagram] = useState(false);
  const [copiato, setCopiato] = useState("");
  const testo = useRef<HTMLTextAreaElement>(null);
  const link = useRef<HTMLInputElement>(null);

  async function copia(cosa: "testo" | "link") {
    const v = cosa === "testo" ? testo.current?.value : link.current?.value;
    if (!v) return;
    try {
      await navigator.clipboard.writeText(v);
      setCopiato(cosa === "testo" ? "Testo copiato per LinkedIn" : "Link copiato per il primo commento");
      setTimeout(() => setCopiato(""), 2500);
    } catch {}
  }

  return (
    <form
      action={action}
      onSubmit={(e) => {
        const dove = [facebook && "Facebook", instagram && "Instagram", discord && "Discord"].filter(Boolean).join(" e ");
        if (!window.confirm(`Pubblicare ora su ${dove || "nessun canale"}?`)) e.preventDefault();
      }}
      className="space-y-4"
    >
      <label className="block text-sm font-medium">
        Testo del post (lo stesso per tutti i canali)
        <textarea ref={testo} name="testo" required rows={10} maxLength={1900} placeholder="Incolla qui il testo social dell'articolo" className="mt-1 w-full rounded-md border border-line bg-surface p-3 text-sm font-normal" />
      </label>
      <label className="block text-sm font-medium">
        Link dell&apos;articolo
        <input ref={link} name="link" type="url" placeholder="https://www.cosmonet.info/..." className="mt-1 w-full rounded-md border border-line bg-surface p-2.5 text-sm font-normal" />
      </label>
      <label className="block text-sm font-medium">
        Immagine per Facebook (facoltativa, max 4 MB)
        <input name="immagine" type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="mt-1 block w-full text-sm font-normal" />
      </label>
      <fieldset className="space-y-2 text-sm">
        <legend className="font-medium">Dove pubblicare</legend>
        <label className={`flex items-center gap-2 ${fb ? "" : "opacity-50"}`}>
          <input type="checkbox" name="facebook" checked={facebook} disabled={!fb} onChange={(e) => setFacebook(e.target.checked)} /> Facebook {fb ? "" : "(non collegato)"}
        </label>
        <label className={`flex items-center gap-2 ${ig ? "" : "opacity-50"}`}>
          <input type="checkbox" name="instagram" checked={instagram} disabled={!ig} onChange={(e) => setInstagram(e.target.checked)} /> Instagram {ig ? "" : "(non collegato)"}
        </label>
        <label className={`flex items-center gap-2 ${dc ? "" : "opacity-50"}`}>
          <input type="checkbox" name="discord" checked={discord} disabled={!dc} onChange={(e) => setDiscord(e.target.checked)} /> Discord {dc ? "" : "(manca il webhook)"}
        </label>
        <p className="text-xs text-muted">LinkedIn si fa a mano: usa i pulsanti qui sotto per copiare testo e link.</p>
      </fieldset>
      {instagram && (
        <label className="block text-sm font-medium">
          Indirizzo dell&apos;immagine per Instagram (https, JPEG)
          <input name="immagine_url" type="url" placeholder="https://www.cosmonet.info/wp-content/uploads/..." className="mt-1 w-full rounded-md border border-line bg-surface p-2.5 text-sm font-normal" />
          <span className="mt-1 block text-xs font-normal text-muted">Instagram scarica l&apos;immagine da qui: usa la copertina dell&apos;articolo. Il link nel testo su Instagram non è cliccabile, quindi non viene aggiunto.</span>
        </label>
      )}
      {discord && forum && (
        <label className="block text-sm font-medium">
          Titolo del thread su Discord
          <input name="titolo" maxLength={100} placeholder="Il titolo dell'articolo" className="mt-1 w-full rounded-md border border-line bg-surface p-2.5 text-sm font-normal" />
        </label>
      )}
      <label className="flex items-center gap-2 text-xs text-muted">
        <input type="checkbox" name="forza" /> Pubblica comunque anche se questo link risulta già pubblicato
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark">Pubblica ovunque</button>
        <button type="button" onClick={() => copia("testo")} className="rounded-md border border-line px-3 py-2 text-sm">Copia testo per LinkedIn</button>
        <button type="button" onClick={() => copia("link")} className="rounded-md border border-line px-3 py-2 text-sm">Copia link (primo commento)</button>
        {copiato && <span className="text-xs text-muted">{copiato}</span>}
      </div>
    </form>
  );
}
