/**
 * Modifica di titolo, SEO (Yoast), stato e data di un articolo, via REST API di WordPress.
 * Dopo ogni salvataggio rilegge l'articolo e confronta: se WordPress ha ignorato un campo
 * (succede ai campi Yoast se non sono esposti alla REST API) lo segnala invece di dire "fatto".
 */
export type StatoModificabile = "publish" | "future" | "draft" | "pending";

export interface Modificabile {
  titolo: string;
  seo: string;
  meta: string;
  kw: string;
  stato: string;
  /** "YYYY-MM-DDTHH:mm" (ora del sito) */
  data: string;
}
export type Campo = keyof Modificabile;
export const CAMPI: Campo[] = ["titolo", "seo", "meta", "kw", "stato", "data"];
export const ETICHETTE: Record<Campo, string> = {
  titolo: "Titolo",
  seo: "Titolo SEO",
  meta: "Meta description",
  kw: "Parola chiave",
  stato: "Stato",
  data: "Data di pubblicazione",
};
const META_KEY = { seo: "_yoast_wpseo_title", meta: "_yoast_wpseo_metadesc", kw: "_yoast_wpseo_focuskw" } as const;

function cfg() {
  const base = process.env.WP_BASE_URL?.replace(/\/$/, "");
  const user = process.env.WP_USER;
  const pass = process.env.WP_APP_PASSWORD;
  if (!base || !user || !pass) return null;
  return { base, headers: { Authorization: "Basic " + Buffer.from(`${user}:${pass}`).toString("base64") } };
}

interface WpEdit {
  title?: { raw?: string };
  status?: string;
  date?: string;
  meta?: Record<string, unknown> | unknown[];
}

export async function leggi(id: number): Promise<{ ok: true; dati: Modificabile; yoast: boolean } | { ok: false; errore: string }> {
  const c = cfg();
  if (!c) return { ok: false, errore: "WordPress non è collegato (WP_BASE_URL, WP_USER, WP_APP_PASSWORD)." };
  try {
    const res = await fetch(`${c.base}/wp-json/wp/v2/posts/${id}?context=edit&_fields=id,title,status,date,meta`, {
      headers: c.headers,
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return { ok: false, errore: `WordPress ha risposto ${res.status}.` };
    const j = (await res.json()) as WpEdit;
    const m = (Array.isArray(j.meta) ? {} : j.meta ?? {}) as Record<string, unknown>;
    const yoast = META_KEY.seo in m || META_KEY.meta in m || META_KEY.kw in m;
    return {
      ok: true,
      yoast,
      dati: {
        titolo: j.title?.raw ?? "",
        seo: String(m[META_KEY.seo] ?? ""),
        meta: String(m[META_KEY.meta] ?? ""),
        kw: String(m[META_KEY.kw] ?? ""),
        stato: j.status ?? "",
        data: (j.date ?? "").slice(0, 16),
      },
    };
  } catch (e) {
    return { ok: false, errore: "Non raggiungo WordPress: " + (e instanceof Error ? e.message : String(e)) };
  }
}

export function cambiamenti(prima: Modificabile, dopo: Partial<Modificabile>): Partial<Modificabile> {
  const out: Partial<Modificabile> = {};
  for (const k of CAMPI) {
    const v = dopo[k];
    if (v === undefined) continue;
    if (v.trim() !== prima[k].trim()) out[k] = v.trim();
  }
  return out;
}

export function avvisi(d: Modificabile): string[] {
  const a: string[] = [];
  if (d.seo.length > 60) a.push(`Il titolo SEO è di ${d.seo.length} caratteri: Google lo taglia oltre i 60 circa.`);
  if (d.meta.length > 160) a.push(`La meta description è di ${d.meta.length} caratteri: Google la taglia oltre i 160 circa.`);
  if (d.meta && d.meta.length < 70) a.push("La meta description è molto corta (sotto i 70 caratteri).");
  if (!d.titolo.trim()) a.push("Il titolo è vuoto.");
  if (d.stato === "future" && Date.parse(d.data) <= Date.now()) a.push("Stato «programmato» con una data già passata: WordPress lo pubblicherebbe subito.");
  if (d.stato === "publish" && Date.parse(d.data) > Date.now() + 60000) a.push("Stato «pubblicato» con data futura: WordPress lo metterà come programmato.");
  return a;
}

export async function salva(
  id: number,
  patch: Partial<Modificabile>,
): Promise<{ ok: true } | { ok: false; errore: string }> {
  const c = cfg();
  if (!c) return { ok: false, errore: "WordPress non è collegato." };
  const body: Record<string, unknown> = {};
  if (patch.titolo !== undefined) body.title = patch.titolo;
  if (patch.stato !== undefined) body.status = patch.stato;
  if (patch.data !== undefined) body.date = patch.data.length === 16 ? patch.data + ":00" : patch.data;
  const meta: Record<string, string> = {};
  if (patch.seo !== undefined) meta[META_KEY.seo] = patch.seo;
  if (patch.meta !== undefined) meta[META_KEY.meta] = patch.meta;
  if (patch.kw !== undefined) meta[META_KEY.kw] = patch.kw;
  if (Object.keys(meta).length) body.meta = meta;
  if (!Object.keys(body).length) return { ok: false, errore: "Non c'è nulla da cambiare." };

  try {
    const res = await fetch(`${c.base}/wp-json/wp/v2/posts/${id}`, {
      method: "POST",
      headers: { ...c.headers, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) {
      const t = (await res.text()).slice(0, 200);
      return { ok: false, errore: `WordPress ha rifiutato la modifica (${res.status}). ${t}` };
    }
  } catch (e) {
    return { ok: false, errore: "Non raggiungo WordPress: " + (e instanceof Error ? e.message : String(e)) };
  }

  // Verifica: rilegge e confronta
  const dopo = await leggi(id);
  if (!dopo.ok) return { ok: false, errore: "Salvato, ma non riesco a verificarlo: " + dopo.errore };
  const mancano: string[] = [];
  for (const k of CAMPI) {
    const v = patch[k];
    if (v === undefined) continue;
    if (dopo.dati[k].trim() !== v.trim()) mancano.push(ETICHETTE[k]);
  }
  if (mancano.length)
    return {
      ok: false,
      errore: `WordPress non ha applicato: ${mancano.join(", ")}. Se sono i campi SEO, Yoast non li espone alla REST API (serve registrarli nel sito); gli altri campi potrebbero essere stati salvati.`,
    };
  return { ok: true };
}
