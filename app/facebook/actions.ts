"use server";

import { redirect } from "next/navigation";
import { facebookPubblica, romaToUnix } from "@/lib/facebook";

export async function pubblica(fd: FormData) {
  const message = String(fd.get("message") ?? "").trim();
  const link = String(fd.get("link") ?? "").trim();
  const quandoRaw = String(fd.get("quando") ?? "").trim();
  if (!message) redirect("/facebook?esito=vuoto");
  if (link && !/^https?:\/\//i.test(link)) redirect("/facebook?esito=link");

  let quando: number | undefined;
  if (quandoRaw) {
    const t = romaToUnix(quandoRaw);
    const ora = Math.floor(Date.now() / 1000);
    // Facebook accetta programmazioni da 10 minuti a 30 giorni da adesso.
    if (!t || t < ora + 11 * 60 || t > ora + 29 * 86400) redirect("/facebook?esito=data");
    quando = t;
  }

  const r = await facebookPubblica({ message, link: link || undefined, quando });
  if (r.ok) redirect(`/facebook?esito=${quando ? "programmato" : "ok"}`);
  redirect(`/facebook?esito=errore&codice=${r.codice ?? ""}&msg=${encodeURIComponent((r.errore ?? "").slice(0, 200))}`);
}
