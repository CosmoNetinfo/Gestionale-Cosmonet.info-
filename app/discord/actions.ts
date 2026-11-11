"use server";

import { redirect } from "next/navigation";
import { discordForum, discordPubblica } from "@/lib/discord";
import { registraSocial } from "@/lib/social";

export async function pubblica(fd: FormData) {
  const titolo = String(fd.get("titolo") ?? "").trim();
  const testo = String(fd.get("testo") ?? "").trim();
  const link = String(fd.get("link") ?? "").trim();
  if (!testo) redirect("/discord?esito=vuoto");
  if (discordForum() && !titolo) redirect("/discord?esito=titolo");
  if (link && !/^https?:\/\//i.test(link)) redirect("/discord?esito=link");
  const r = await discordPubblica({ titolo, testo, link: link || undefined });
  await registraSocial({ testo, link: link || undefined, canali: [{ canale: "discord", ok: r.ok, errore: r.errore ?? null }] });
  if (r.ok) redirect("/discord?esito=ok");
  redirect(`/discord?esito=errore&msg=${encodeURIComponent((r.errore ?? "").slice(0, 200))}`);
}
