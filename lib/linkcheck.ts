/**
 * Controllo di link e immagini negli articoli pubblicati.
 * Legge l'HTML degli articoli da WordPress, raccoglie link e immagini e verifica che rispondano.
 * Variabili: WP_BASE_URL (sola lettura, l'API pubblica basta per gli articoli pubblicati).
 */
export interface Ref {
  articleId: number;
  title: string;
  /** Testo del link o descrizione dell'immagine */
  text: string;
}

export interface BrokenItem extends Ref {
  url: string;
  kind: "link" | "img";
  status: string;
  interno: boolean;
}

export interface NoAlt {
  articleId: number;
  title: string;
  src: string;
}

export interface BatchResult {
  pagina: number;
  pagine: number;
  articoliTotali: number;
  articoli: number;
  urlTotali: number;
  controllati: number;
  rotti: BrokenItem[];
  nonVerificabili: BrokenItem[];
  senzaAlt: NoAlt[];
  httpInterni: BrokenItem[];
}

const ENT: Record<string, string> = { "&amp;": "&", "&#038;": "&", "&quot;": '"', "&#039;": "'", "&lt;": "<", "&gt;": ">", "&nbsp;": " " };
const dec = (s: string) => s.replace(/&(amp|quot|lt|gt|nbsp|#038|#039);/g, (m) => ENT[m] ?? m);
const strip = (s: string) => dec(s.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();

interface Post {
  id: number;
  title?: { rendered?: string };
  content?: { rendered?: string };
}

async function loadPage(base: string, page: number, per: number): Promise<{ posts: Post[]; total: number; pages: number }> {
  const res = await fetch(`${base}/wp-json/wp/v2/posts?status=publish&per_page=${per}&page=${page}&_fields=id,title,content`, {
    cache: "no-store",
    signal: AbortSignal.timeout(25000),
  });
  if (res.status === 400) return { posts: [], total: 0, pages: 0 }; // pagina oltre l'ultima
  if (!res.ok) throw new Error(`WordPress ha risposto con errore ${res.status}`);
  return {
    posts: (await res.json()) as Post[],
    total: Number(res.headers.get("x-wp-total") ?? 0),
    pages: Number(res.headers.get("x-wp-totalpages") ?? 0),
  };
}

type Check = { status: string; ok: boolean; soft: boolean };

async function checkUrl(url: string): Promise<Check> {
  const headers = { "User-Agent": "Mozilla/5.0 (compatible; CosmoControl link check)", Accept: "*/*" };
  const go = async (method: "HEAD" | "GET") => fetch(url, { method, headers, redirect: "follow", signal: AbortSignal.timeout(8000), cache: "no-store" });
  try {
    let res = await go("HEAD");
    if (res.status === 405 || res.status === 501 || res.status === 403 || res.status === 400) res = await go("GET");
    const s = res.status;
    if (s < 400) return { status: String(s), ok: true, soft: false };
    // Questi codici di solito significano "non parlo con i robot", non "link rotto"
    if ([401, 403, 429, 451, 520, 521, 522, 523, 524, 525, 526, 999].includes(s)) return { status: String(s), ok: false, soft: true };
    return { status: String(s), ok: false, soft: false };
  } catch (e) {
    const m = e instanceof Error ? e.message : "";
    if (/timeout|aborted/i.test(m)) return { status: "nessuna risposta", ok: false, soft: true };
    return { status: "non raggiungibile", ok: false, soft: false };
  }
}

/** Controlla un blocco di articoli (i più recenti per primi). Pensato per stare nei 60 secondi di Vercel. */
export async function scanBatch(pagina: number, per = 25, budgetMs = 38000): Promise<BatchResult> {
  const t0 = Date.now();
  const base = process.env.WP_BASE_URL?.replace(/\/$/, "");
  if (!base) throw new Error("Manca WP_BASE_URL");
  const host = new URL(base).hostname.replace(/^www\./, "");
  const { posts, total, pages } = await loadPage(base, pagina, per);
  type Item = { url: string; kind: "link" | "img"; ref: Ref };
  const items: Item[] = [];
  const senzaAlt: NoAlt[] = [];
  for (const p of posts) {
    const html = p.content?.rendered ?? "";
    const title = strip(p.title?.rendered ?? "") || `Articolo ${p.id}`;
    for (const m of Array.from(html.matchAll(/<a\s[^>]*?href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi))) {
      const raw = dec(m[1].trim());
      if (/^(#|mailto:|tel:|javascript:|data:)/i.test(raw)) continue;
      let abs: string;
      try {
        abs = new URL(raw, base + "/").toString();
      } catch {
        continue;
      }
      if (!/^https?:/.test(abs)) continue;
      items.push({ url: abs.split("#")[0], kind: "link", ref: { articleId: p.id, title, text: strip(m[2]).slice(0, 80) || "(link su immagine)" } });
    }
    for (const m of Array.from(html.matchAll(/<img\b[^>]*>/gi))) {
      const tag = m[0];
      const src = /\bsrc\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
      if (!src || src.startsWith("data:")) continue;
      let abs: string;
      try {
        abs = new URL(dec(src), base + "/").toString();
      } catch {
        continue;
      }
      const alt = /\balt\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1];
      if (alt === undefined || alt.trim() === "") senzaAlt.push({ articleId: p.id, title, src: abs });
      items.push({ url: abs, kind: "img", ref: { articleId: p.id, title, text: (alt ?? "").slice(0, 80) || "(immagine)" } });
    }
  }

  const byUrl = new Map<string, Item[]>();
  for (const it of items) byUrl.set(it.url, [...(byUrl.get(it.url) ?? []), it]);
  const urls = Array.from(byUrl.keys());
  const results = new Map<string, Check>();

  // 24 richieste alla volta, entro il tempo disponibile
  let next = 0;
  const worker = async () => {
    while (next < urls.length && Date.now() - t0 < budgetMs) {
      const u = urls[next++];
      results.set(u, await checkUrl(u));
    }
  };
  await Promise.all(Array.from({ length: 24 }, worker));

  const rotti: BrokenItem[] = [];
  const nonVerificabili: BrokenItem[] = [];
  const httpInterni: BrokenItem[] = [];
  const isInt = (u: string) => new URL(u).hostname.replace(/^www\./, "") === host;
  byUrl.forEach((its, url) => {
    const r = results.get(url);
    for (const it of its) {
      const interno = isInt(url);
      const b: BrokenItem = { ...it.ref, url, kind: it.kind, status: r?.status ?? "", interno };
      if (url.startsWith("http://") && interno) httpInterni.push(b);
      if (!r || r.ok) continue;
      (r.soft ? nonVerificabili : rotti).push(b);
    }
  });

  return {
    pagina,
    pagine: pages,
    articoliTotali: total,
    articoli: posts.length,
    urlTotali: urls.length,
    controllati: results.size,
    rotti,
    nonVerificabili,
    senzaAlt,
    httpInterni,
  };
}
