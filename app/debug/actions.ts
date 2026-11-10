"use server";

import { redirect } from "next/navigation";
import { sendTelegram } from "@/lib/telegram";

export async function inviaProvaTelegram() {
  const r = await sendTelegram("✅ <b>Cosmo Control</b>: il bot funziona. Da ora ti scrivo qui il riepilogo del lunedì e gli avvisi.");
  redirect(`/debug?${r.ok ? "tg=ok" : "tg=errore&m=" + encodeURIComponent(r.message)}`);
}
