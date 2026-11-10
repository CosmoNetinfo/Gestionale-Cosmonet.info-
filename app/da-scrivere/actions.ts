"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { agendaAddTask } from "@/lib/agenda";
import { queueRemove, queueUpsert, type QueueItem } from "@/lib/news";

export async function aggiungiInCoda(fd: FormData) {
  await queueUpsert({
    url: String(fd.get("url")),
    title: String(fd.get("title")),
    source: String(fd.get("source") ?? ""),
    cat: String(fd.get("cat") ?? ""),
  });
  revalidatePath("/da-scrivere");
}

export async function cambiaStato(fd: FormData) {
  const stato = String(fd.get("stato")) as QueueItem["stato"];
  if (stato === ("rimuovi" as string)) await queueRemove(String(fd.get("url")));
  else await queueUpsert({ url: String(fd.get("url")), title: String(fd.get("title")), stato });
  revalidatePath("/da-scrivere");
}

export async function mettiInAgenda(fd: FormData) {
  const url = String(fd.get("url"));
  const title = String(fd.get("title"));
  const source = String(fd.get("source") ?? "");
  let esito = "ok";
  try {
    const oggi = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Rome" });
    await agendaAddTask({ title: `🤖 Scrivere: ${title}`, date: oggi, notes: `${url}${source ? `\nFonte: ${source}` : ""}` });
    await queueUpsert({ url, title, source, cat: String(fd.get("cat") ?? "") });
  } catch {
    esito = "errore";
  }
  revalidatePath("/da-scrivere");
  redirect(`/da-scrivere?agenda=${esito}`);
}
