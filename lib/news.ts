/**
 * "Da scrivere": legge i feed RSS del catalogo, toglie i doppioni, segnala le notizie su cui
 * hai già un articolo e gestisce la coda (tabella news_queue su Supabase).
 */
import { FEEDS, catLabel, type Feed } from "./feeds";
import { loadArticles } from "./articles";

export interface NewsItem {
  title: string;
  url: string;
  date: string | null;
  source: string;
  cat: string;
  lang: "it" | "en";
  snippet: string;
  /** Articolo tuo che sembra trattare già lo stesso argomento */
  simile?: { id: number; title: string; url: string };
  inCoda?: string;
}

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

const decode = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#8217;/g, "’")
    .replace(/&#8211;/g, "–")
    .replace(/\s+/g, " ")
    .trim();

async function fetchFeed(feed: Feed, perFeed: number): Promise<NewsItem[]> {
  try {
    const res = await fetch(feed.url, { headers: { "User-Agent": UA, Accept: "application/rss+xml, application/atom+xml, text/xml, */*" }, signal: AbortSignal.timeout(7000), cache: "no-store" });
    if (!res.ok) return [];
    const xml = await res.text();
    const re = /<item\b[^>]*>([\s\S]*?)<\/item>|<entry\b[^>]*>([\s\S]*?)<\/entry>/gi;
    const out: NewsItem[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(xml)) && out.length < perFeed) {
      const b = m[0];
      const title = decode(b.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
      let link = b.match(/<link[^>]*>\s*(?:<!\[CDATA\[)?\s*(https?:[^<\s]+)/i)?.[1];
      if (!link) link = b.match(/<link[^>]+href=["']([^"']+)["']/i)?.[1];
      if (!title || !link) continue;
      try {
        const u = new URL(link, feed.url);
        if (!["http:", "https:"].includes(u.protocol)) continue;
        link = u.href;
      } catch {
        continue;
      }
      const d = b.match(/<pubDate>([\s\S]*?)<\/pubDate>|<updated>([\s\S]*?)<\/updated>|<published>([\s\S]*?)<\/published>|<dc:date>([\s\S]*?)<\/dc:date>/i);
      const raw = (d?.[1] || d?.[2] || d?.[3] || d?.[4] || "").trim();
      const t = raw ? new Date(raw) : null;
      const sn = decode(b.match(/<description[^>]*>([\s\S]*?)<\/description>|<summary[^>]*>([\s\S]*?)<\/summary>/i)?.[1] ?? b.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i)?.[1] ?? "");
      out.push({
        title,
        url: link,
        date: t && !isNaN(t.getTime()) ? t.toISOString() : null,
        source: feed.name,
        cat: feed.cat,
        lang: feed.lang,
        snippet: sn.slice(0, 220),
      });
    }
    return out;
  } catch {
    return [];
  }
}

// ---------- confronto con i tuoi articoli ----------
const STOP = new Set(
  "il lo la i gli le un uno una di a da in con su per tra fra e ed o ma che come del dello della dei degli delle al allo alla ai agli alle dal dalla nel nella sul sulla non più the of and for with to in on a an is are your you from how what new its it this that by at as be can will".split(" "),
);
const tokens = (s: string) =>
  new Set(
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .split(" ")
      .filter((w) => w.length > 2 && !STOP.has(w) && w !== "2026" && w !== "2025" && w !== "guida"),
  );

function trovaSimile(t: Set<string>, pubblicati: { id: number; title: string; url: string; tk: Set<string> }[]) {
  let best: (typeof pubblicati)[number] | undefined;
  let bestScore = 0;
  for (const a of pubblicati) {
    let inter = 0;
    t.forEach((w) => a.tk.has(w) && inter++);
    const score = inter / Math.max(1, Math.min(t.size, a.tk.size));
    if (inter >= 3 && score > bestScore) {
      bestScore = score;
      best = a;
    }
  }
  return best && bestScore >= 0.6 ? { id: best.id, title: best.title, url: best.url } : undefined;
}

export interface NewsResult {
  items: NewsItem[];
  fonti: number;
  fontiVuote: string[];
  coda: QueueItem[];
  codaMancante?: string;
  categorie: { id: string; label: string }[];
  sorgente: "database" | "catalogo";
}

export async function getNews(opts: { ore: number; cat?: string; perFeed?: number }): Promise<NewsResult> {
  const src = await getSources();
  const feeds = src.feeds.filter((f) => !opts.cat || f.cat === opts.cat);
  const [risultati, art, coda] = await Promise.all([
    Promise.all(feeds.map((f) => fetchFeed(f, opts.perFeed ?? 8))),
    loadArticles().catch(() => ({ articles: [] as { id: number; title: string; url: string; status: string }[] })),
    getQueue(),
  ]);
  const pubblicati = art.articles
    .filter((a) => a.status === "publish")
    .map((a) => ({ id: a.id, title: a.title, url: a.url, tk: tokens(a.title) }));
  const limite = Date.now() - opts.ore * 3600000;
  const visti = new Set<string>();
  const inCoda = new Map(coda.items.map((q) => [q.url, q.stato]));
  const items: NewsItem[] = [];
  feeds.forEach((f, i) => {
    for (const n of risultati[i]) {
      if (n.date && new Date(n.date).getTime() < limite) continue;
      const k = n.url.replace(/[?#].*$/, "").replace(/\/$/, "").toLowerCase();
      if (visti.has(k)) continue;
      visti.add(k);
      n.simile = trovaSimile(tokens(n.title), pubblicati);
      n.inCoda = inCoda.get(n.url);
      items.push(n);
    }
  });
  items.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  return {
    items,
    fonti: feeds.length,
    fontiVuote: feeds.filter((_, i) => risultati[i].length === 0).map((f) => f.name),
    coda: coda.items,
    codaMancante: coda.missing,
    categorie: Array.from(new Set(src.feeds.map((f) => f.cat))).map((id) => ({ id, label: catLabel(id) })),
    sorgente: src.origine,
  };
}

// ---------- coda su Supabase ----------
export interface QueueItem {
  url: string;
  title: string;
  source: string;
  cat: string;
  stato: "da_scrivere" | "scritto" | "scartato";
  note: string | null;
  added_at: string;
}

function conf() {
  const url = process.env.SUPABASE_URL?.trim().replace(/\/$/, "");
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  return url && key ? { url, key } : null;
}
const hdr = (key: string, extra: Record<string, string> = {}) => ({ apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...extra });

export async function getQueue(): Promise<{ items: QueueItem[]; missing?: string }> {
  const c = conf();
  if (!c) return { items: [], missing: "Supabase non collegato" };
  try {
    const res = await fetch(`${c.url}/rest/v1/news_queue?select=*&order=added_at.desc&limit=500`, { headers: hdr(c.key), cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!res.ok) return { items: [], missing: res.status === 404 ? "tabella news_queue non creata (vedi supabase/schema.sql)" : `errore ${res.status}` };
    return { items: (await res.json()) as QueueItem[] };
  } catch (e) {
    return { items: [], missing: (e as Error).message };
  }
}

export async function queueUpsert(it: { url: string; title: string; source?: string; cat?: string; stato?: QueueItem["stato"]; note?: string | null }): Promise<void> {
  const c = conf();
  if (!c) throw new Error("Supabase non collegato");
  const res = await fetch(`${c.url}/rest/v1/news_queue?on_conflict=url`, {
    method: "POST",
    headers: hdr(c.key, { Prefer: "resolution=merge-duplicates,return=minimal" }),
    body: JSON.stringify({ stato: "da_scrivere", source: "", cat: "", ...it }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
}

export async function queueRemove(url: string): Promise<void> {
  const c = conf();
  if (!c) throw new Error("Supabase non collegato");
  const res = await fetch(`${c.url}/rest/v1/news_queue?url=eq.${encodeURIComponent(url)}`, { method: "DELETE", headers: hdr(c.key), cache: "no-store" });
  if (!res.ok) throw new Error(`Supabase ${res.status}`);
}

/** File Markdown da passare a Claude: le notizie in coda con fonte e link. */
export function codaMarkdown(items: QueueItem[]): string {
  const da = items.filter((q) => q.stato === "da_scrivere");
  const righe = da.map((q) => `- [${q.title}](${q.url}) — ${q.source}${q.note ? `\n  Nota: ${q.note}` : ""}`);
  return `# Notizie da scrivere (${da.length})\n\n${righe.join("\n") || "_nessuna_"}\n`;
}

// ---------- fonti (catalogo di default oppure quelle importate da OPML) ----------
export async function getSources(): Promise<{ feeds: Feed[]; origine: "database" | "catalogo"; missing?: string }> {
  const c = conf();
  if (!c) return { feeds: FEEDS, origine: "catalogo" };
  try {
    const res = await fetch(`${c.url}/rest/v1/news_sources?select=url,name,cat,lang&order=cat.asc,name.asc&limit=1000`, { headers: hdr(c.key), cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!res.ok) return { feeds: FEEDS, origine: "catalogo", missing: res.status === 404 ? "tabella news_sources non creata" : `errore ${res.status}` };
    const rows = (await res.json()) as Feed[];
    return rows.length ? { feeds: rows, origine: "database" } : { feeds: FEEDS, origine: "catalogo" };
  } catch (e) {
    return { feeds: FEEDS, origine: "catalogo", missing: (e as Error).message };
  }
}

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "altro";

const attr = (tag: string, name: string) => {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i"));
  return (m?.[2] ?? m?.[3] ?? "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").trim();
};

/** Legge un file OPML: le cartelle diventano categorie, gli outline con xmlUrl diventano fonti. */
export function parseOpml(xml: string): Feed[] {
  const out: Feed[] = [];
  const pila: string[] = [];
  const re = /<outline\b[^>]*?(\/?)>|<\/outline>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const tag = m[0];
    if (tag.startsWith("</")) {
      pila.pop();
      continue;
    }
    const selfClosed = m[1] === "/";
    const xmlUrl = attr(tag, "xmlUrl");
    const nome = attr(tag, "title") || attr(tag, "text");
    if (xmlUrl) {
      try {
        const u = new URL(xmlUrl);
        if (!["http:", "https:"].includes(u.protocol)) throw new Error();
        out.push({ url: u.href, name: nome || u.hostname, cat: slug(pila[pila.length - 1] ?? "altro"), lang: u.hostname.endsWith(".it") ? "it" : "en" });
      } catch {
        /* indirizzo non valido: salto */
      }
      if (!selfClosed) pila.push(pila[pila.length - 1] ?? "altro");
    } else if (!selfClosed) {
      pila.push(nome || "altro");
    }
  }
  const visti = new Set<string>();
  return out.filter((f) => !visti.has(f.url) && visti.add(f.url));
}

export async function importaFonti(feeds: Feed[], sostituisci: boolean): Promise<number> {
  const c = conf();
  if (!c) throw new Error("Supabase non collegato");
  if (sostituisci) {
    const del = await fetch(`${c.url}/rest/v1/news_sources?url=neq.`, { method: "DELETE", headers: hdr(c.key), cache: "no-store" });
    if (!del.ok) throw new Error(`Supabase ${del.status}: tabella news_sources creata? (vedi supabase/schema.sql)`);
  }
  const res = await fetch(`${c.url}/rest/v1/news_sources?on_conflict=url`, {
    method: "POST",
    headers: hdr(c.key, { Prefer: "resolution=merge-duplicates,return=minimal" }),
    body: JSON.stringify(feeds),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
  return feeds.length;
}

export async function ripristinaCatalogo(): Promise<void> {
  const c = conf();
  if (!c) throw new Error("Supabase non collegato");
  await fetch(`${c.url}/rest/v1/news_sources?url=neq.`, { method: "DELETE", headers: hdr(c.key), cache: "no-store" });
}
