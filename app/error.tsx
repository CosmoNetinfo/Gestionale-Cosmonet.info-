"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, PageHeader } from "@/components/ui";

/** Schermata di errore dell'app: mostra il messaggio vero (da copiare) invece di una pagina bianca. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [copied, setCopied] = useState(false);
  const [where, setWhere] = useState("");
  useEffect(() => {
    setWhere(window.location.pathname + window.location.search);
    console.error(error);
  }, [error]);

  const report = [
    "Errore in Cosmo Control",
    `Pagina: ${where}`,
    `Messaggio: ${error.message}`,
    error.digest ? `Codice (digest): ${error.digest}` : "",
    `Quando: ${new Date().toISOString()}`,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <>
      <PageHeader title="Qualcosa non ha funzionato" subtitle="Questa pagina si è rotta: ecco i dettagli per sistemarla" />
      <Card>
        <pre className="whitespace-pre-wrap break-words rounded-md bg-canvas p-3 text-xs text-ink">{report}</pre>
        {error.digest && (
          <p className="mt-3 text-xs text-muted">
            Il messaggio completo di un errore del server resta nei log di Vercel: il codice sopra serve a ritrovarlo. Claude può leggerlo da solo.
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={reset} className="rounded-md border border-line px-3 py-1.5 text-sm hover:border-primary hover:text-primary">
            Riprova
          </button>
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(report);
                setCopied(true);
              } catch {
                window.prompt("Copia questo testo:", report);
              }
            }}
            className="rounded-md border border-line px-3 py-1.5 text-sm hover:border-primary hover:text-primary"
          >
            {copied ? "Copiato ✓" : "Copia errore per Claude"}
          </button>
          <Link href="/debug" className="rounded-md border border-line px-3 py-1.5 text-sm hover:border-primary hover:text-primary">
            Apri Debug
          </Link>
        </div>
      </Card>
    </>
  );
}
