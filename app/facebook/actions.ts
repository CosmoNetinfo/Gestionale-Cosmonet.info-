"use server";

import { redirect } from "next/navigation";
import { facebookPubblica, romaToUnix } from "@/lib/facebook";
import { registraSocial } from "@/lib/social";

export async function pubblica(fd: FormData) {
  const message = String(fd.get("message") ?? "").trim();
  const link = String(fd.get("link") ?? "").trim();
  const quandoRaw = String(fd.get("quando") ?? "").trim();
  if (!message) redirect("/facebook?esito=vuoto");
  if (link && !/^https?:\/\//i.test(link)) redirect("/facebook?esito=link");

  const img = fd.get("immagine");
  const immagine = img instanceof File && img.size > 0 ? img : undefined;
  if (immagine && (!/^image\/(jpeg|png|webp|gif)$/.test(immagine.type) || immagine.size > 4 * 1024 * 1024)) redirect("/facebook?esito=immagine");

  let quando: number | undefined;
  if (quandoRaw) {
    const t = romaToUnix(quandoRaw);
    const ora = Math.floor(Date.now() / 1000);
    // Facebook accetta programmazioni da 10 minuti a 30 giorni da adesso.
    if (!t || t < ora + 11 * 60 || t > ora + 29 * 86400) redirect("/facebook?esito=data");
    quando = t;
  }

  const r = await facebookPubblica({ message, link: link || undefined, quando, immagine });
  await registraSocial({ testo: quando ? `[programmato] ${message}` : message, link: link || undefined, canali: [{ canale: "facebook", ok: r.ok, errore: r.errore ?? null }] });
  if (r.ok) redirect(`/facebook?esito=${quando ? "programmato" : "ok"}`);
  redirect(`/facebook?esito=errore&codice=${r.codice ?? ""}&msg=${encodeURIComponent((r.errore ?? "").slice(0, 200))}`);
}
