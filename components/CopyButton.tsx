"use client";

import { useState } from "react";

/** Copia un testo negli appunti e conferma con "Copiato". */
export function CopyButton({ text, label = "Copia URL" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 2000);
        } catch {
          window.prompt("Copia questo indirizzo:", text);
        }
      }}
      className="rounded-md border border-line px-2 py-1 text-xs text-muted hover:border-primary hover:text-primary"
    >
      {done ? "Copiato ✓" : label}
    </button>
  );
}
