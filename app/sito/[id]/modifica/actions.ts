"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { CAMPI, cambiamenti, leggi, salva, type Campo, type Modificabile } from "@/lib/wpedit";

export async function applicaModifica(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return;
  const proposta: Partial<Modificabile> = {};
  for (const k of CAMPI) {
    const v = formData.get(k);
    if (typeof v === "string") proposta[k] = v;
  }
  const prima = await leggi(id);
  if (!prima.ok) redirect(`/sito/${id}/modifica?errore=${encodeURIComponent(prima.errore)}`);
  const patch = cambiamenti(prima.dati, proposta);
  const r = await salva(id, patch);
  revalidatePath("/", "layout");
  if (!r.ok) redirect(`/sito/${id}/modifica?errore=${encodeURIComponent(r.errore)}`);
  // Valori di prima nel link: servono per «Annulla questa modifica» (una nuova anteprima, senza salvare nulla)
  const q = new URLSearchParams({ fatto: "1" });
  for (const k of Object.keys(patch) as Campo[]) q.set("prima_" + k, prima.dati[k]);
  redirect(`/sito/${id}/modifica?${q.toString()}`);
}
