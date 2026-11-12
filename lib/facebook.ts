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

// ---------- Post programmati ----------

export type PostProgrammato = { id: string; testo: string; quando: string; immagine?: string };

/** Post della pagina programmati e non ancora usciti, dal più vicino al più lontano. */
export async function facebookProgrammati(limit = 50): Promise<{ ok: boolean; post: PostProgrammato[]; errore?: string; codice?: number }> {
  if (!facebookAttivo()) return { ok: false, post: [], errore: "Facebook non è configurato" };
  const page = process.env.FACEBOOK_PAGE_ID!.trim();
  try {
    const r = await fetch(`${BASE()}/${page}/scheduled_posts?fields=${encodeURIComponent("id,message,scheduled_publish_time,full_picture")}&limit=${limit}`, {
      headers: auth(),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    const j = (await r.json()) as { data?: { id: string; message?: string; scheduled_publish_time?: number | string; full_picture?: string }[] } & GraphErrore;
    if (!r.ok || j.error) return { ok: false, post: [], errore: j.error?.message ?? `Facebook ha risposto ${r.status}`, codice: j.error?.code };
    const post = (j.data ?? [])
      .map((p) => {
        const unix = typeof p.scheduled_publish_time === "number" ? p.scheduled_publish_time : Date.parse(String(p.scheduled_publish_time)) / 1000;
        return { unix, id: p.id, testo: p.message ?? "(senza testo)", immagine: p.full_picture };
      })
      .sort((a, b) => a.unix - b.unix)
      .map((p) => ({
        id: p.id,
        testo: p.testo,
        quando: Number.isFinite(p.unix)
          ? new Date(p.unix * 1000).toLocaleString("it-IT", { timeZone: "Europe/Rome", dateStyle: "short", timeStyle: "short" })
          : "orario non disponibile",
        immagine: p.immagine,
      }));
    return { ok: true, post };
  } catch (e) {
    return { ok: false, post: [], errore: (e as Error).message };
  }
}

/** Cancella un post programmato (non quelli già usciti). L'ID deve essere tra quelli programmati. */
export async function facebookEliminaProgrammato(id: string): Promise<{ ok: boolean; errore?: string; codice?: number }> {
  if (!/^[0-9_]+$/.test(id)) return { ok: false, errore: "ID post non valido" };
  const elenco = await facebookProgrammati(100);
  if (!elenco.ok) return { ok: false, errore: elenco.errore, codice: elenco.codice };
  if (!elenco.post.some((p) => p.id === id)) return { ok: false, errore: "Questo post non è tra quelli programmati: non lo cancello" };
  try {
    const r = await fetch(`${BASE()}/${id}`, { method: "DELETE", headers: auth(), cache: "no-store", signal: AbortSignal.timeout(15000) });
    const j = (await r.json()) as { success?: boolean } & GraphErrore;
    if (!r.ok || j.error) return { ok: false, errore: j.error?.message ?? `Facebook ha risposto ${r.status}`, codice: j.error?.code };
    return { ok: j.success !== false };
  } catch (e) {
    return { ok: false, errore: (e as Error).message };
  }
}

// ---------- Attività: post recenti, commenti, statistiche, risposte ----------

export type CommentoFb = { id: string; testo: string; autore: string; quando: string; link?: string };
export type PostFb = {
  id: string;
  testo: string;
  quando: string;
  link?: string;
  reazioni: number;
  commenti: number;
  condivisioni: number;
  ultimiCommenti: CommentoFb[];
  /** Persone raggiunte / visualizzazioni, se Facebook le dà (altrimenti null). */
  copertura: number | null;
  visualizzazioni: number | null;
};

/** Ultimi post della pagina con reazioni, commenti (gli ultimi 10) e condivisioni. */
export async function facebookAttivita(limit = 12): Promise<{ ok: boolean; post: PostFb[]; errore?: string; codice?: number }> {
  if (!facebookAttivo()) return { ok: false, post: [], errore: "Facebook non è configurato" };
  const page = process.env.FACEBOOK_PAGE_ID!.trim();
  const fields = [
    "id",
    "message",
    "created_time",
    "permalink_url",
    "shares",
    "reactions.limit(0).summary(total_count)",
    "comments.limit(10).order(reverse_chronological).summary(total_count){id,message,from{name},created_time,permalink_url}",
  ].join(",");
  try {
    const r = await fetch(`${BASE()}/${page}/posts?fields=${encodeURIComponent(fields)}&limit=${limit}`, { headers: auth(), cache: "no-store", signal: AbortSignal.timeout(15000) });
    const j = (await r.json()) as {
      data?: {
        id: string;
        message?: string;
        created_time: string;
        permalink_url?: string;
        shares?: { count?: number };
        reactions?: { summary?: { total_count?: number } };
        comments?: { summary?: { total_count?: number }; data?: { id: string; message?: string; from?: { name?: string }; created_time: string; permalink_url?: string }[] };
      }[];
    } & GraphErrore;
    if (!r.ok || j.error) return { ok: false, post: [], errore: j.error?.message ?? `Facebook ha risposto ${r.status}`, codice: j.error?.code };
    const post: PostFb[] = (j.data ?? []).map((p) => ({
      id: p.id,
      testo: p.message ?? "(post senza testo)",
      quando: p.created_time,
      link: p.permalink_url,
      reazioni: p.reactions?.summary?.total_count ?? 0,
      commenti: p.comments?.summary?.total_count ?? 0,
      condivisioni: p.shares?.count ?? 0,
      ultimiCommenti: (p.comments?.data ?? []).map((c) => ({ id: c.id, testo: c.message ?? "", autore: c.from?.name ?? "Utente", quando: c.created_time, link: c.permalink_url })),
      copertura: null,
      visualizzazioni: null,
    }));
    // Statistiche: facoltative e a parte, perché Facebook cambia spesso i nomi delle metriche.
    await Promise.all(
      post.slice(0, 8).map(async (p) => {
        try {
          const ir = await fetch(`${BASE()}/${p.id}/insights?metric=post_total_media_view_unique,post_media_view`, { headers: auth(), cache: "no-store", signal: AbortSignal.timeout(8000) });
          const ij = (await ir.json()) as { data?: { name: string; values?: { value?: number }[] }[] };
          for (const m of ij.data ?? []) {
            const v = m.values?.[0]?.value;
            if (typeof v !== "number") continue;
            if (m.name === "post_total_media_view_unique") p.copertura = v;
            if (m.name === "post_media_view") p.visualizzazioni = v;
          }
        } catch {}
      }),
    );
    return { ok: true, post };
  } catch (e) {
    return { ok: false, post: [], errore: (e as Error).message };
  }
}

/** Risponde a un commento come pagina. Serve il permesso pages_manage_engagement. */
export async function facebookRispondi(commentId: string, message: string): Promise<{ ok: boolean; id?: string; errore?: string; codice?: number }> {
  if (!facebookAttivo()) return { ok: false, errore: "Facebook non è configurato" };
  if (!/^[0-9_]+$/.test(commentId)) return { ok: false, errore: "ID commento non valido" };
  try {
    const r = await fetch(`${BASE()}/${commentId}/comments`, {
      method: "POST",
      headers: { ...auth(), "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ message }),
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
