"use client";

import { useFormStatus } from "react-dom";
import { rimandaReport } from "@/app/stato-360/actions";

function Bottone() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg border border-line px-3 py-2 text-sm font-medium text-muted hover:border-primary hover:text-primary disabled:opacity-60"
    >
      {pending ? "Rifaccio i controlli e invio…" : "📨 Rimanda il report su Telegram"}
    </button>
  );
}

/** Rifà i controlli del sito e rimanda il report su Telegram. */
export function RimandaReport() {
  return (
    <form action={rimandaReport}>
      <Bottone />
    </form>
  );
}
