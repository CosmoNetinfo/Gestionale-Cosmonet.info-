"use server";

import { redirect } from "next/navigation";
import { importaFonti, parseOpml, ripristinaCatalogo } from "@/lib/news";

export async function importaOpml(fd: FormData) {
  const testo = String(fd.get("opml") ?? "");
  const feeds = parseOpml(testo);
  if (feeds.length === 0) redirect("/da-scrivere/fonti?errore=" + encodeURIComponent("Nel testo non ho trovato nessuna fonte. Incolla tutto il contenuto del file OPML, dal primo <?xml fino a </opml>."));
  let n = 0;
  try {
    n = await importaFonti(feeds, fd.get("modo") === "sostituisci");
  } catch (e) {
    redirect("/da-scrivere/fonti?errore=" + encodeURIComponent((e as Error).message));
  }
  redirect(`/da-scrivere/fonti?fatto=${n}`);
}

export async function tornaAlCatalogo() {
  try {
    await ripristinaCatalogo();
  } catch (e) {
    redirect("/da-scrivere/fonti?errore=" + encodeURIComponent((e as Error).message));
  }
  redirect("/da-scrivere/fonti?fatto=0");
}
