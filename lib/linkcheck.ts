import { loadArticles } from "./articles";
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
  link?: string;
  title?: { rendered?: string };
  content?: { rendered?: string };
}

async function loadPage(base: string, page: number, per: number): Promise<{ posts: Post[]; total: number; pages: number }> {
  let res: Response | undefined;
  // Se WordPress risponde 429 (troppe richieste) aspetta un po' e riprova, senza sforare i 60 secondi di Vercel
  for (let attempt = 0; attempt < 3; attempt++) {
    res = await fetch(`${base}/wp-json/wp/v2/posts?status=publish&per_page=${per}&page=${page}&_fields=id,link,title,content`, {
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    if (res.status !== 429) break;
    const wait = Math.min(Number(res.headers.get("retry-after")) || 3 * (attempt + 1), 8);
    await new Promise((r) => setTimeout(r, wait * 1000));
  }
  if (!res) throw new Error("nessuna risposta da WordPress");
  if (res.status === 400) return { posts: [], total: 0, pages: 0 }; // pagina oltre l'ultima
  if (!res.ok) throw new Error(`WordPress ha risposto con errore ${res.status}`);
  return {
    posts: (await res.json()) as Post[],
    total: Number(res.headers.get("x-wp-total") ?? 0),
    pages: Number(res.headers.get("x-wp-totalpages") ?? 0),
  };
}

type Check = { status: string; ok: boolean; soft: boolean };

const BROWSER = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "it-IT,it;q=0.9,en;q=0.8",
};

async function checkUrl(url: string, interno = false): Promise<Check> {
  const go = async (method: "HEAD" | "GET") => fetch(url, { method, headers: BROWSER, redirect: "follow", signal: AbortSignal.timeout(8000), cache: "no-store" });
  try {
    let res = await go("HEAD");
    // Molti siti rispondono male a HEAD o ai robot: riprovo con GET, che somiglia di più a un browser
    if ([400, 403, 404, 405, 410, 501].includes(res.status)) res = await go("GET");
    // Il mio stesso sito può rispondere "troppe richieste": aspetto e riprovo una volta
    if (res.status === 429 && interno) {
      await new Promise((r) => setTimeout(r, 2500));
      res = await go("GET");
    }
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
  // Indirizzi dei miei articoli pubblicati: un link interno verso uno di questi è sicuramente buono, senza chiedere nulla al sito
  const noti = new Set<string>();
  try {
    for (const a of (await loadArticles()).articles) if (a.status === "publish") noti.add(a.url.replace(/\/$/, "").toLowerCase());
  } catch {
    /* se non riesco, controllo tutto con richieste */
  }
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
      const pulito = abs.split("#")[0];
      // Link dell'articolo a se stesso (indici con ancore): non serve controllarlo
      if (p.link && pulito.replace(/\/$/, "") === p.link.replace(/\/$/, "")) continue;
      items.push({ url: pulito, kind: "link", ref: { articleId: p.id, title, text: strip(m[2]).slice(0, 80) || "(link su immagine)" } });
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
      const interno = new URL(u).hostname.replace(/^www\./, "") === host;
      if (interno && noti.has(u.replace(/\/$/, "").toLowerCase())) {
        results.set(u, { status: "200", ok: true, soft: false });
        continue;
      }
      results.set(u, await checkUrl(u, interno));
    }
  };
  await Promise.all(Array.from({ length: 24 }, worker));

  const rotti: BrokenItem[] = [];
  const nonVerificabili: BrokenItem[] = [];
  const httpInterni: BrokenItem[] = [];
  const isInt = (u: string) => new URL(u).hostname.replace(/^www\./, "") === host;
  byUrl.forEach((its, url) => {
    const r = results.get(url);
    const visti = new Set<string>();
    for (const it of its) {
      const chiave = it.ref.articleId + "|" + it.kind;
      if (visti.has(chiave)) continue; // lo stesso indirizzo ripetuto nello stesso articolo si segnala una volta
      visti.add(chiave);
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
