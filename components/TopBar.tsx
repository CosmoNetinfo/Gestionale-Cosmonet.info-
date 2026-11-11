"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { guidaPer } from "@/lib/help";
import { RefreshButton } from "@/components/RefreshButton";

/** Barra in alto su ogni pagina: cerca (⌘K), aiuto della pagina, aggiorna dati. */
export default function TopBar() {
  const pathname = usePathname();
  const [aperto, setAperto] = useState(false);
  const g = guidaPer(pathname);

  useEffect(() => setAperto(false), [pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const scrive = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
      if (e.key === "?" && !scrive) {
        e.preventDefault();
        setAperto((o) => !o);
      } else if (e.key === "Escape") setAperto(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const btn =
    "rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-muted hover:border-primary hover:text-primary";

  return (
    <div className="mb-4 flex flex-col items-end gap-3">
      <div className="flex items-center gap-2">
        <button type="button" className={btn} onClick={() => window.dispatchEvent(new Event("cc-open-search"))}>
          ⌕ Cerca <span className="ml-1 text-xs">⌘K</span>
        </button>
        <button type="button" className={btn} aria-expanded={aperto} onClick={() => setAperto((o) => !o)}>
          ? Aiuto <span className="ml-1 text-xs">?</span>
        </button>
        <RefreshButton />
      </div>
      {aperto && (
        <div className="w-full max-w-xl rounded-card border border-primary/30 bg-primary-soft p-5 text-sm shadow-sm" role="dialog" aria-label={`Aiuto: ${g.titolo}`}>
          <div className="flex items-start justify-between gap-4">
            <h2 className="text-base font-semibold text-ink">{g.titolo}: a cosa serve</h2>
            <button type="button" onClick={() => setAperto(false)} className="text-muted hover:text-ink" aria-label="Chiudi aiuto">
              ✕
            </button>
          </div>
          <p className="mt-2 text-ink">{g.cosa}</p>
          <div className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted">Cosa puoi fare</div>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-ink">
            {g.azioni.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
          {g.consiglio && (
            <p className="mt-3 rounded-lg bg-surface px-3 py-2 text-ink">
              <strong>Consiglio:</strong> {g.consiglio}
            </p>
          )}
          <p className="mt-3 text-xs text-muted">
            Scorciatoie: <kbd>⌘K</kbd> cerca articoli e pagine · <kbd>?</kbd> apre o chiude questo aiuto · <kbd>Esc</kbd> chiude.
          </p>
        </div>
      )}
    </div>
  );
}
