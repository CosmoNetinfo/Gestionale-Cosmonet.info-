"use server";

import { redirect } from "next/navigation";
import { elencoImmagini, eliminaImmagini } from "@/lib/archivio";

export async function elimina(fd: FormData) {
  const nome = String(fd.get("nome") ?? "");
  if (!/^[\w.-]+$/.test(nome)) redirect("/archivio?esito=errore");
  redirect(`/archivio?esito=${(await eliminaImmagini([nome])) ? "ok" : "errore"}`);
}

export async function svuota() {
  const { file } = await elencoImmagini();
  redirect(`/archivio?esito=${file.length === 0 || (await eliminaImmagini(file.map((f) => f.nome))) ? "ok" : "errore"}`);
}
