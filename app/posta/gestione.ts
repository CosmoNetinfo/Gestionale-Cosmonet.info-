"use server";

import { revalidatePath } from "next/cache";
import { segnaLetto, spostaNelCestino } from "@/lib/posta";
import { eliminaMessaggio } from "@/lib/messaggi";
import { inviaRisposta } from "@/lib/invio";

export async function letturaAction(uid: number, letto: boolean, inviata: boolean) {
  const r = await segnaLetto(uid, letto, inviata);
  revalidatePath("/posta");
  return r;
}

export async function cestinoAction(uid: number, inviata: boolean) {
  const r = await spostaNelCestino(uid, inviata);
  revalidatePath("/posta");
  return r;
}

export async function eliminaMessaggioAction(id: string) {
  const r = await eliminaMessaggio(id);
  revalidatePath("/messaggi");
  return r;
}

export async function nuovaMailAction(dati: { a: string; oggetto: string; testo: string }) {
  return inviaRisposta(dati);
}
