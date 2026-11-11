"use server";

import { redirect } from "next/navigation";
import { facebookRispondi } from "@/lib/facebook";

export async function rispondi(fd: FormData) {
  const id = String(fd.get("commento") ?? "").trim();
  const testo = String(fd.get("testo") ?? "").trim();
  if (!id || !testo) redirect("/facebook/attivita?esito=vuoto");
  if (testo.length > 1500) redirect("/facebook/attivita?esito=lungo");
  const r = await facebookRispondi(id, testo);
  if (r.ok) redirect("/facebook/attivita?esito=ok");
  redirect(`/facebook/attivita?esito=errore&msg=${encodeURIComponent((r.errore ?? "").slice(0, 200))}`);
}
