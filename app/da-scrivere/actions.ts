"use server";

import { revalidatePath } from "next/cache";
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
