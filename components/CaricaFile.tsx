"use client";

import { useRef } from "react";

/** Carica un file di testo (es. .opml) dentro una casella di testo, senza copia-incolla. */
export function CaricaFile({ targetId, accept }: { targetId: string; accept?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          const t = document.getElementById(targetId) as HTMLTextAreaElement | null;
          if (f && t) t.value = await f.text();
        }}
      />
      <button type="button" onClick={() => ref.current?.click()} className="rounded-md border border-line px-3 py-2 text-sm hover:border-primary hover:text-primary">
        Scegli il file .opml…
      </button>
    </>
  );
}
