"use server";

import { inviaRisposta } from "@/lib/invio";

export async function rispondiAction(dati: { a: string; oggetto: string; testo: string; inRispostaA?: string }) {
  return inviaRisposta(dati);
}
