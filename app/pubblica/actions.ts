"use server";

import { redirect } from "next/navigation";
import { discordForum } from "@/lib/discord";
import { giaPubblicato, pubblicaOvunque } from "@/lib/social";
import { caricaImmagine } from "@/lib/storage";

export async function pubblica(fd: FormData) {
  const testo = String(fd.get("testo") ?? "").trim();
  const link = String(fd.get("link") ?? "").trim();
  const titolo = String(fd.get("titolo") ?? "").trim();
  const facebook = fd.get("facebook") === "on";
  const discord = fd.get("discord") === "on";
  const instagram = fd.get("instagram") === "on";
  let immagineUrl = String(fd.get("immagine_url") ?? "").trim();
  const forza = fd.get("forza") === "on";
  if (!testo) redirect("/pubblica?esito=vuoto");
  if (!facebook && !discord && !instagram) redirect("/pubblica?esito=canali");
  if (link && !/^https?:\/\//i.test(link)) redirect("/pubblica?esito=link");
  if (discord && discordForum() && !titolo) redirect("/pubblica?esito=titolo");
  const img = fd.get("immagine");
  const immagine = img instanceof File && img.size > 0 ? img : undefined;
  if (immagine && (!/^image\/(jpeg|png|webp|gif)$/.test(immagine.type) || immagine.size > 4 * 1024 * 1024)) redirect("/pubblica?esito=immagine");
  if (link && !forza && (await giaPubblicato(link))) redirect("/pubblica?esito=duplicato");
  if (instagram && !immagineUrl) {
    // Instagram vuole un indirizzo web: se hai caricato un file lo pubblico io su Supabase Storage.
    if (!immagine) redirect("/pubblica?esito=igimg");
    if (!/^image\/(jpeg|png)$/.test(immagine!.type)) redirect("/pubblica?esito=igtipo");
    const up = await caricaImmagine(immagine!);
    if (!up.ok) redirect(`/pubblica?esito=errore&msg=${encodeURIComponent((up.errore ?? "").slice(0, 250))}`);
    immagineUrl = up.url!;
  }
  if (instagram && !/^https:\/\//i.test(immagineUrl)) redirect("/pubblica?esito=igimg");

  const esiti = await pubblicaOvunque({ testo, link: link || undefined, titolo, immagine, immagineUrl: immagineUrl || undefined, facebook, discord, instagram });
  const ok = esiti.filter((e) => e.ok).map((e) => e.canale).join(",");
  const ko = esiti.filter((e) => !e.ok).map((e) => `${e.canale}: ${e.errore ?? "errore"}`).join(" | ");
  if (!esiti.length) redirect("/pubblica?esito=canali");
  redirect(`/pubblica?esito=${ko ? (ok ? "parziale" : "errore") : "ok"}&ok=${encodeURIComponent(ok)}&msg=${encodeURIComponent(ko.slice(0, 300))}`);
}
