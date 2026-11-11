// Pubblicazione su Instagram (account professionale) via Graph API.
// Variabili su Vercel: INSTAGRAM_ACCOUNT_ID, INSTAGRAM_TOKEN (token dell'utente di sistema, non scade).
// Facoltativa: FACEBOOK_API_VERSION (default v27.0).

const BASE = () => `https://graph.facebook.com/${process.env.FACEBOOK_API_VERSION?.trim() || "v27.0"}`;
const id = () => process.env.INSTAGRAM_ACCOUNT_ID?.trim() ?? "";
const auth = () => ({ Authorization: `Bearer ${process.env.INSTAGRAM_TOKEN?.trim()}` });

export const instagramAttivo = () => Boolean(id() && process.env.INSTAGRAM_TOKEN?.trim());

type Err = { error?: { message?: string; code?: number } };
const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Controlla che il token funzioni e legge nome utente e follower dell'account. */
export async function instagramStato(): Promise<{ ok: boolean; utente?: string; follower?: number; errore?: string }> {
  if (!instagramAttivo()) return { ok: false, errore: "Mancano INSTAGRAM_ACCOUNT_ID e INSTAGRAM_TOKEN" };
  try {
    const r = await fetch(`${BASE()}/${id()}?fields=username,followers_count`, { headers: auth(), cache: "no-store", signal: AbortSignal.timeout(10000) });
    const j = (await r.json()) as { username?: string; followers_count?: number } & Err;
    if (!r.ok || j.error) return { ok: false, errore: j.error?.message ?? `Instagram ha risposto ${r.status}` };
    return { ok: true, utente: j.username, follower: j.followers_count };
  } catch (e) {
    return { ok: false, errore: (e as Error).message };
  }
}

/** Pubblica una foto con didascalia. L'immagine deve stare a un indirizzo https pubblico (JPEG consigliato). */
export async function instagramPubblica(p: { didascalia: string; immagineUrl: string }): Promise<{ ok: boolean; id?: string; errore?: string }> {
  if (!instagramAttivo()) return { ok: false, errore: "Instagram non è configurato" };
  try {
    const c = await fetch(`${BASE()}/${id()}/media`, {
      method: "POST",
      headers: { ...auth(), "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ image_url: p.immagineUrl, caption: p.didascalia.slice(0, 2200) }),
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    const cj = (await c.json()) as { id?: string } & Err;
    if (!c.ok || cj.error || !cj.id) return { ok: false, errore: cj.error?.message ?? `Instagram ha risposto ${c.status}` };
    // Aspetta che Instagram abbia scaricato l'immagine (di solito pochi secondi).
    for (let i = 0; i < 8; i++) {
      const s = await fetch(`${BASE()}/${cj.id}?fields=status_code`, { headers: auth(), cache: "no-store", signal: AbortSignal.timeout(8000) });
      const sj = (await s.json()) as { status_code?: string };
      if (sj.status_code === "FINISHED") break;
      if (sj.status_code === "ERROR" || sj.status_code === "EXPIRED") return { ok: false, errore: "Instagram non è riuscito a scaricare l'immagine: controlla che l'indirizzo sia pubblico e sia un JPEG" };
      await pausa(1500);
    }
    const m = await fetch(`${BASE()}/${id()}/media_publish`, {
      method: "POST",
      headers: { ...auth(), "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ creation_id: cj.id }),
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    const mj = (await m.json()) as { id?: string } & Err;
    if (!m.ok || mj.error) return { ok: false, errore: mj.error?.message ?? `Instagram ha risposto ${m.status}` };
    return { ok: true, id: mj.id };
  } catch (e) {
    return { ok: false, errore: (e as Error).message };
  }
}
