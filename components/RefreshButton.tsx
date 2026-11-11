"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { aggiornaDati } from "@/app/actions";

export function RefreshButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await aggiornaDati();
          router.refresh();
        })
      }
      className="rounded-lg border border-line px-3 py-2 text-sm font-medium text-muted hover:border-primary hover:text-primary disabled:opacity-60"
    >
      {pending ? "Aggiorno…" : "↻ Aggiorna"}
    </button>
  );
}
