"use client";

import { useState } from "react";

export default function FormPubblica({ action }: { action: (fd: FormData) => void | Promise<void> }) {
  const [programma, setProgramma] = useState(false);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        const quando = (e.currentTarget.elements.namedItem("quando") as HTMLInputElement | null)?.value;
        const testo = quando ? "Programmare questo post su Facebook?" : "Pubblicare ora questo post sulla pagina Facebook?";
        if (!window.confirm(testo)) e.preventDefault();
      }}
      className="space-y-4"
    >
      <label className="block text-sm font-medium">
        Testo del post
        <textarea
          name="message"
          required
          rows={10}
          placeholder="Incolla qui la frase social dell'articolo (la stessa di LinkedIn)"
          className="mt-1 w-full rounded-md border border-line bg-surface p-3 text-sm font-normal"
        />
      </label>
      <label className="block text-sm font-medium">
        Link dell&apos;articolo (diventa l&apos;anteprima)
        <input
          name="link"
          type="url"
          placeholder="https://www.cosmonet.info/..."
          className="mt-1 w-full rounded-md border border-line bg-surface p-2.5 text-sm font-normal"
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={programma} onChange={(e) => setProgramma(e.target.checked)} />
        Programma invece di pubblicare subito
      </label>
      {programma && (
        <label className="block text-sm font-medium">
          Data e ora (ora italiana, da 15 minuti a 29 giorni da adesso)
          <input name="quando" type="datetime-local" required className="mt-1 rounded-md border border-line bg-surface p-2 text-sm font-normal" />
        </label>
      )}
      <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark">
        {programma ? "Programma su Facebook" : "Pubblica su Facebook"}
      </button>
    </form>
  );
}
