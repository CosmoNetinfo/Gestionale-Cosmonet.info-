"use server";

import { redirect } from "next/navigation";
import { eseguiControlli } from "@/lib/controlli";

/** Rifà i controlli e rimanda il report su Telegram (anche se non ci sono segnalazioni). */
export async function rimandaReport() {
  const r = await eseguiControlli({ sempre: true });
  const ok = r.telegram.startsWith("inviato");
  redirect(`/stato-360?rep=${ok ? "ok" : "errore"}${ok ? "" : "&m=" + encodeURIComponent(r.telegram)}`);
}
