// Pubblicazione sul server Discord di Cosmonet tramite webhook.
// Variabile su Vercel: DISCORD_WEBHOOK_URL (webhook del canale). Il canale ideale è un Forum:
// ogni post diventa un thread dove i lettori possono commentare. Se il canale è di testo normale,
// impostare DISCORD_FORUM=no (così non viene chiesto il titolo del thread).

export const discordPubblicaAttivo = () => Boolean(process.env.DISCORD_WEBHOOK_URL?.trim());
export const discordForum = () => (process.env.DISCORD_FORUM ?? "").trim().toLowerCase() !== "no";

export async function discordPubblica(p: { titolo?: string; testo: string; link?: string }): Promise<{ ok: boolean; errore?: string }> {
  const url = process.env.DISCORD_WEBHOOK_URL?.trim();
  if (!url) return { ok: false, errore: "Manca DISCORD_WEBHOOK_URL" };
  const content = (p.link ? `${p.testo}\n\n${p.link}` : p.testo).slice(0, 2000);
  const body: Record<string, unknown> = { content, allowed_mentions: { parse: [] } };
  if (discordForum() && p.titolo) body.thread_name = p.titolo.slice(0, 100);
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (r.ok) return { ok: true };
    let msg = `Discord ha risposto ${r.status}`;
    try {
      const j = (await r.json()) as { message?: string };
      if (j.message) msg = j.message;
    } catch {}
    return { ok: false, errore: msg };
  } catch (e) {
    return { ok: false, errore: (e as Error).message };
  }
}
