"use server";

import { revalidatePath } from "next/cache";
import { agendaComplete, agendaPostpone } from "@/lib/agenda";

export async function fatto(fd: FormData) {
  await agendaComplete(String(fd.get("id")));
  revalidatePath("/agenda");
}

// Rimanda a "oggi + N giorni" (ora di Roma), così anche le arretrate finiscono nel futuro
export async function rimanda(fd: FormData) {
  const id = String(fd.get("id") ?? "");
  const giorni = Number(fd.get("giorni"));
  if (!id || !Number.isInteger(giorni) || giorni < 1 || giorni > 60) return;
  const oggi = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Rome" });
  const d = new Date(`${oggi}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + giorni);
  await agendaPostpone(id, d.toISOString().slice(0, 10));
  revalidatePath("/agenda");
}
