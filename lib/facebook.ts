// Collegamento alla pagina Facebook di Cosmonet via Graph API.
// Variabili su Vercel: FACEBOOK_PAGE_ID, FACEBOOK_PAGE_TOKEN (token della Pagina che non scade).
// Facoltativa: FACEBOOK_API_VERSION (default v27.0, quella dell'Explorer).

const VERSIONE = () => process.env.FACEBOOK_API_VERSION?.trim() || "v27.0";
const BASE = () => `https://graph.facebook.com/${VERSIONE()}`;

export const facebookAttivo = () => Boolean(process.env.FACEBOOK_PAGE_ID?.trim() && process.env.FACEBOOK_PAGE_TOKEN?.trim());

export type FacebookStato = {
  ok: boolean;
  nome?: string;
  follower?: number;
  scade?: string; // "mai" oppure data
  errore?: string;
  codice?: number; // 190 = token non valido, serve rifare il login
};

type GraphErrore = { error?: { message?: string; code?: number } };

function auth() {
  return { Authorization: `Bearer ${process.env.FACEBOOK_PAGE_TOKEN?.trim()}` };
}

/** Controlla che il token funzioni ancora e legge nome e follower della pagina. */
export async function facebookStato(): Promise<FacebookStato> {
  if (!facebookAttivo()) return { ok: false, errore: "Mancano FACEBOOK_PAGE_ID e FACEBOOK_PAGE_TOKEN" };
  const page = process.env.FACEBOOK_PAGE_ID!.trim();
  try {
    const r = await fetch(`${BASE()}/${page}?fields=id,name,fan_count`, { headers: auth(), cache: "no-store", signal: AbortSignal.timeout(10000) });
    const j = (await r.json()) as { name?: string; fan_count?: number } & GraphErrore;
    if (!r.ok || j.error) return { ok: false, errore: j.error?.message ?? `Facebook ha risposto ${r.status}`, codice: j.error?.code };
    const stato: FacebookStato = { ok: true, nome: j.name, follower: j.fan_count };
    // Scadenza del token (facoltativa: se la richiesta fallisce non è un problema).
    try {
      const d = await fetch(`${BASE()}/debug_token?input_token=${encodeURIComponent(process.env.FACEBOOK_PAGE_TOKEN!.trim())}`, {
        headers: auth(),
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      });
      const dj = (await d.json()) as { data?: { expires_at?: number; is_valid?: boolean } };
      if (dj.data && typeof dj.data.expires_at === "number") {
        stato.scade = dj.data.expires_at === 0 ? "mai" : new Date(dj.data.expires_at * 1000).toLocaleDateString("it-IT");
      }
    } catch {}
    return stato;
  } catch (e) {
    return { ok: false, errore: (e as Error).message };
  }
}

/** "2026-11-11T09:30" (ora italiana) -> secondi unix. */
export function romaToUnix(local: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Rome",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(guess));
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const romeAsUtc = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"));
  const offset = romeAsUtc - guess;
  return Math.round((guess - offset) / 1000);
}

/** Pubblica subito, oppure programma se `quando` (unix) è indicato. Il link, se c'è, diventa l'anteprima del post. */
export async function facebookPubblica(p: { message: string; link?: string; quando?: number; immagine?: File }): Promise<{ ok: boolean; id?: string; errore?: string; codice?: number }> {
  if (!facebookAttivo()) return { ok: false, errore: "Facebook non è configurato" };
  const page = process.env.FACEBOOK_PAGE_ID!.trim();
  if (p.immagine) {
    // Post con foto: Facebook non permette foto + anteprima link insieme, quindi il link va in fondo al testo.
    const form = new FormData();
    form.set("caption", p.link ? `${p.message}\n\n${p.link}` : p.message);
    form.set("source", p.immagine, p.immagine.name || "immagine.jpg");
    if (p.quando) {
      form.set("published", "false");
      form.set("scheduled_publish_time", String(p.quando));
    }
    try {
      const r = await fetch(`${BASE()}/${page}/photos`, { method: "POST", headers: auth(), body: form, cache: "no-store", signal: AbortSignal.timeout(30000) });
      const j = (await r.json()) as { id?: string; post_id?: string } & GraphErrore;
      if (!r.ok || j.error) return { ok: false, errore: j.error?.message ?? `Facebook ha risposto ${r.status}`, codice: j.error?.code };
      return { ok: true, id: j.post_id ?? j.id };
    } catch (e) {
      return { ok: false, errore: (e as Error).message };
    }
  }
  const body = new URLSearchParams({ message: p.message });
  if (p.link) body.set("link", p.link);
  if (p.quando) {
    body.set("published", "false");
    body.set("scheduled_publish_time", String(p.quando));
  }
  try {
    const r = await fetch(`${BASE()}/${page}/feed`, {
      method: "POST",
      headers: { ...auth(), "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    const j = (await r.json()) as { id?: string } & GraphErrore;
    if (!r.ok || j.error) return { ok: false, errore: j.error?.message ?? `Facebook ha risposto ${r.status}`, codice: j.error?.code };
    return { ok: true, id: j.id };
  } catch (e) {
    return { ok: false, errore: (e as Error).message };
  }
}
