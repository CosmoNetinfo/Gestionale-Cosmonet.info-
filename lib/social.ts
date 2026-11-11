// Storico dei post social pubblicati da Cosmo Control (tabella social_posts su Supabase).
import { discordForum, discordPubblica, discordPubblicaAttivo } from "./discord";
import { facebookAttivo, facebookPubblica } from "./facebook";
import { instagramAttivo, instagramPubblica } from "./instagram";

function conf() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SECRET_KEY;
  return url && key ? { url, key } : null;
}
const hdr = (key: string, extra: Record<string, string> = {}) => ({ apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...extra });

export type EsitoCanale = { canale: "facebook" | "discord" | "instagram"; ok: boolean; errore?: string | null };
export type PostSocial = { id: number; created_at: string; testo: string; link: string | null; canali: EsitoCanale[] };

export async function storicoSocial(limit = 60): Promise<{ items: PostSocial[]; missing?: string }> {
  const c = conf();
  if (!c) return { items: [], missing: "Supabase non collegato" };
  try {
    const res = await fetch(`${c.url}/rest/v1/social_posts?select=*&order=created_at.desc&limit=${limit}`, { headers: hdr(c.key), cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!res.ok) return { items: [], missing: res.status === 404 ? "tabella social_posts non creata (vedi supabase/schema.sql)" : `errore ${res.status}` };
    return { items: (await res.json()) as PostSocial[] };
  } catch (e) {
    return { items: [], missing: (e as Error).message };
  }
}

/** True se questo link è già stato pubblicato (con almeno un canale riuscito). */
export async function giaPubblicato(link: string): Promise<boolean> {
  const c = conf();
  if (!c || !link) return false;
  try {
    const res = await fetch(`${c.url}/rest/v1/social_posts?select=canali&link=eq.${encodeURIComponent(link)}&limit=10`, { headers: hdr(c.key), cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!res.ok) return false;
    return ((await res.json()) as { canali: EsitoCanale[] }[]).some((r) => r.canali.some((x) => x.ok));
  } catch {
    return false;
  }
}

/** Registra un post nello storico. Se la tabella manca non blocca nulla. */
export async function registraSocial(p: { testo: string; link?: string; canali: EsitoCanale[] }): Promise<void> {
  const c = conf();
  if (!c) return;
  try {
    await fetch(`${c.url}/rest/v1/social_posts`, {
      method: "POST",
      headers: hdr(c.key, { Prefer: "return=minimal" }),
      body: JSON.stringify({ testo: p.testo, link: p.link ?? null, canali: p.canali }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
  } catch {}
}

/** Pubblica sui canali richiesti, registra lo storico e restituisce l'esito di ciascuno. */
export async function pubblicaOvunque(p: { testo: string; link?: string; titolo?: string; immagine?: File; immagineUrl?: string; facebook: boolean; discord: boolean; instagram?: boolean }): Promise<EsitoCanale[]> {
  const esiti: EsitoCanale[] = [];
  if (p.facebook && facebookAttivo()) {
    const r = await facebookPubblica({ message: p.testo, link: p.link, immagine: p.immagine });
    esiti.push({ canale: "facebook", ok: r.ok, errore: r.errore ?? null });
  }
  if (p.discord && discordPubblicaAttivo()) {
    const r = await discordPubblica({ titolo: p.titolo, testo: p.testo, link: p.link });
    esiti.push({ canale: "discord", ok: r.ok, errore: r.errore ?? null });
  }
  if (p.instagram && instagramAttivo()) {
    if (!p.immagineUrl) esiti.push({ canale: "instagram", ok: false, errore: "Serve l'indirizzo dell'immagine" });
    else {
      const r = await instagramPubblica({ didascalia: p.testo, immagineUrl: p.immagineUrl });
      esiti.push({ canale: "instagram", ok: r.ok, errore: r.errore ?? null });
    }
  }
  if (esiti.length) await registraSocial({ testo: p.testo, link: p.link, canali: esiti });
  return esiti;
}

export { discordForum };
