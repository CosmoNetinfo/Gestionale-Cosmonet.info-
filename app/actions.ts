"use server";

import { revalidatePath } from "next/cache";

/** Svuota la cache dei dati (WordPress, Search Console, GitHub) e ricarica la pagina. */
export async function aggiornaDati() {
  revalidatePath("/", "layout");
}
