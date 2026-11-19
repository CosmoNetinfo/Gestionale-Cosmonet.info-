import tls from "node:tls";
import { tfetch } from "./http";
import { runPagespeed } from "./pagespeed";
import { loadArticles } from "./articles";
import { getGscStats, inspectMany, normUrl } from "./gsc";
import { scanBatch } from "./linkcheck";
import { daysSince } from "./review";
import { getPlugins } from "./plugins";

/**
 * Monitor del sito: salva su Supabase (tabella speed_history) velocità e disponibilità,
 * e confronta con i giorni precedenti per dare gli avvisi.
 */
export interface MonitorRow {
  id?: number;
  taken_at: string;
  kind: "mobile" | "desktop" | "uptime" | "articolo" | "controlli";
  url: string;
  score: number | null;
  lcp: number | null;
  fcp: number | null;
  cls: number | null;
  tbt: number | null;
  http_status: number | null;
  ttfb_ms: number | null;
  cert_days: number | null;
  errore: string | null;
}

function conf() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SECRET_KEY;
  return url && key ? { url, key } : null;
}
const hdr = (key: string, extra: Record<string, string> = {}) => ({
  apikey: key,
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
  ...extra,
});

export const MONITOR_SQL_HINT =
  "Manca la tabella speed_history: apri Supabase → SQL Editor e incolla il blocco «Monitor del sito» di supabase/schema.sql.";

export async function saveRows(rows: MonitorRow[]): Promise<{ ok: boolean; errore?: string }> {
  const c = conf();
  if (!c) return { ok: false, errore: "Supabase non collegato" };
  try {
    const r = await tfetch(`${c.url}/rest/v1/speed_history`, {
      method: "POST",
      headers: hdr(c.key, { Prefer: "return=minimal" }),
      body: JSON.stringify(rows),
      cache: "no-store",
    });
    if (r.ok) return { ok: true };
    const t = await r.text();
    return { ok: false, errore: /speed_history|PGRST205|does not exist/i.test(t) ? MONITOR_SQL_HINT : `Supabase ${r.status}: ${t.slice(0, 150)}` };
  } catch (e) {
    return { ok: false, errore: (e as Error).message };
  }
}

/** Ultime righe di un tipo, dalla più vecchia alla più recente. */
export async function loadHistory(kind: MonitorRow["kind"], limit = 60, url?: string): Promise<{ rows: MonitorRow[]; errore?: string }> {
  const c = conf();
  if (!c) return { rows: [], errore: "Supabase non collegato" };
  try {
    const r = await tfetch(`${c.url}/rest/v1/speed_history?kind=eq.${kind}${url ? `&url=eq.${encodeURIComponent(url)}` : ""}&order=taken_at.desc&limit=${limit}`, {
      headers: hdr(c.key),
      cache: "no-store",
    });
    if (!r.ok) {
      const t = await r.text();
      return { rows: [], errore: /speed_history|PGRST205|does not exist/i.test(t) ? MONITOR_SQL_HINT : `Supabase ${r.status}` };
    }
    const rows = (await r.json()) as MonitorRow[];
    return { rows: rows.reverse() };
  } catch (e) {
    return { rows: [], errore: (e as Error).message };
  }
}

function certDays(host: string): Promise<number | null> {
  return new Promise((resolve) => {
    try {
      const s = tls.connect({ host, port: 443, servername: host, timeout: 8000 }, () => {
        const exp = s.getPeerCertificate()?.valid_to;
        s.end();
        resolve(exp ? Math.floor((new Date(exp).getTime() - Date.now()) / 86400000) : null);
      });
      s.on("error", () => resolve(null));
      s.on("timeout", () => {
        s.destroy();
        resolve(null);
      });
    } catch {
      resolve(null);
    }
  });
}

/** Controllo veloce di disponibilità: stato HTTP, tempo di prima risposta, certificato. */
export async function checkUptime(home: string): Promise<MonitorRow> {
  const row: MonitorRow = { taken_at: new Date().toISOString(), kind: "uptime", url: home, score: null, lcp: null, fcp: null, cls: null, tbt: null, http_status: null, ttfb_ms: null, cert_days: null, errore: null };
  const t0 = Date.now();
  try {
    const r = await fetch(home, { cache: "no-store", redirect: "follow", signal: AbortSignal.timeout(20000), headers: { "User-Agent": "CosmoControl-Monitor/1.0" } });
    row.ttfb_ms = Date.now() - t0;
    row.http_status = r.status;
    await r.body?.cancel();
  } catch (e) {
    row.errore = (e as Error).name === "TimeoutError" ? "nessuna risposta entro 20 secondi" : (e as Error).message;
  }
  try {
    row.cert_days = await certDays(new URL(home).hostname);
  } catch {
    /* ignorato */
  }
  return row;
}

export async function checkSpeed(home: string, kind: "mobile" | "desktop" | "articolo"): Promise<MonitorRow> {
  const base = { taken_at: new Date().toISOString(), kind, url: home, http_status: null, ttfb_ms: null, cert_days: null };
  const r = await runPagespeed(home, kind === "desktop" ? "desktop" : "mobile", Date.now() + 100000);
  if (!r.ok) return { ...base, score: null, lcp: null, fcp: null, cls: null, tbt: null, errore: r.error ?? "errore PageSpeed" };
  return { ...base, score: r.score ?? null, lcp: r.lab?.lcp ?? null, fcp: r.lab?.fcp ?? null, cls: r.lab?.cls ?? null, tbt: r.lab?.tbt ?? null, errore: null };
}

/** Avvisi: confronta le misure di oggi con la media dei giorni precedenti. */
export async function avvisi(nuove: MonitorRow[]): Promise<string[]> {
  const out: string[] = [];
  const up = nuove.find((r) => r.kind === "uptime");
  if (up) {
    if (up.errore || (up.http_status ?? 0) >= 400) out.push(`🔴 <b>Il sito non risponde bene</b>: ${up.errore ?? "stato HTTP " + up.http_status}`);
    else if ((up.ttfb_ms ?? 0) > 3000) out.push(`🐢 Risposta lenta: la home ha impiegato ${(up.ttfb_ms! / 1000).toFixed(1)} s`);
    if (up.cert_days !== null && up.cert_days <= 14) out.push(`🔐 Il certificato HTTPS scade tra ${up.cert_days} giorni`);
  }
  for (const n of nuove.filter((r) => r.kind !== "uptime" && r.score !== null)) {
    const { rows } = await loadHistory(n.kind, 8, n.url);
    const prev = rows.filter((r) => r.score !== null && r.taken_at < n.taken_at).slice(-7);
    if (prev.length >= 3) {
      const media = prev.reduce((s, r) => s + (r.score ?? 0), 0) / prev.length;
      if (n.score! <= media - 12) out.push(`📉 Velocità ${n.kind === "articolo" ? n.url : n.kind}: punteggio ${n.score} (media recente ${Math.round(media)})`);
    }
  }
  return out;
}

/** I 3 articoli che portano più click (da misurare ogni giorno). */
export async function articoliTop(n = 3): Promise<string[]> {
  const [{ articles }, gsc] = await Promise.all([loadArticles(), getGscStats()]);
  if (!gsc.configured) return [];
  return articles
    .filter((a) => a.status === "publish")
    .map((a) => ({ a, clicks: gsc.byUrl.get(normUrl(a.url))?.clicks ?? 0 }))
    .sort((x, y) => y.clicks - x.clicks)
    .slice(0, n)
    .map((x) => x.a.url);
}

/** true se il gruppo «User-agent: *» contiene «Disallow: /» (tutto il sito). */
function bloccaTutto(txt: string): boolean {
  let tuttiGliAgenti = false;
  let inIntestazione = false;
  for (const riga of txt.split(/\r?\n/)) {
    const l = riga.replace(/#.*/, "").trim();
    if (!l) continue;
    const m = l.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const k = m[1].toLowerCase();
    if (k === "user-agent") {
      if (!inIntestazione) tuttiGliAgenti = false;
      if (m[2].trim() === "*") tuttiGliAgenti = true;
      inIntestazione = true;
    } else {
      inIntestazione = false;
      if (k === "disallow" && tuttiGliAgenti && m[2].trim() === "/") return true;
    }
  }
  return false;
}

/** robots.txt e sitemap: se spariscono o bloccano tutto, Google smette di vedere il sito. */
export async function controlloSeoBase(base: string): Promise<string[]> {
  const out: string[] = [];
  const get = async (path: string) => {
    try {
      const r = await tfetch(base + path, { cache: "no-store", redirect: "follow" }, 12000);
      return { status: r.status, text: r.ok ? await r.text() : "" };
    } catch {
      return { status: 0, text: "" };
    }
  };
  const [robots, s1, s2] = await Promise.all([get("/robots.txt"), get("/sitemap_index.xml"), get("/wp-sitemap.xml")]);
  if (robots.status !== 200) out.push(`🤖 robots.txt non raggiungibile (stato ${robots.status || "nessuna risposta"})`);
  else if (bloccaTutto(robots.text)) out.push("🚫 Il robots.txt blocca tutto il sito ai motori di ricerca: controlla subito «Visibilità sui motori» in WordPress");
  if (s1.status !== 200 && s2.status !== 200) out.push("🗺️ La sitemap non risponde (né sitemap_index.xml né wp-sitemap.xml)");
  return out;
}

/** Articoli pubblicati da 4-21 giorni che Google non ha ancora indicizzato. */
export async function controlloIndicizzazione(): Promise<string[]> {
  const { articles } = await loadArticles();
  const recenti = articles
    .filter((a) => a.status === "publish" && daysSince(a.date) >= 4 && daysSince(a.date) <= 21)
    .slice(0, 8);
  if (!recenti.length) return [];
  const st = await inspectMany(recenti.map((a) => a.url));
  const out: string[] = [];
  for (const a of recenti) {
    const i = st.get(a.url);
    if (!i || i.error) continue;
    if (i.verdict !== "PASS") out.push(`🔎 Non indicizzato dopo ${daysSince(a.date)} giorni: ${a.title} (${i.coverage || i.verdict})`);
  }
  return out;
}

/** Controlla un blocco di articoli al giorno, a rotazione: in pochi giorni passa tutto il sito. */
export async function controlloLink(): Promise<string[]> {
  const giorno = Math.floor(Date.now() / 86400000);
  const prima = await scanBatch(1, 25, 12000).catch(() => null);
  if (!prima) return [];
  const pagina = (giorno % Math.max(1, prima.pagine)) + 1;
  const r = pagina === 1 ? prima : await scanBatch(pagina, 25, 30000);
  const out: string[] = [];
  for (const b of r.rotti) out.push(`⛓ «${b.title}» (ID ${b.articleId}): ${b.url} → ${b.status}`);
  if (out.length) out.push(`ℹ️ Scansione a rotazione: blocco ${pagina} di ${r.pagine} (25 articoli al giorno, ${r.controllati} link controllati)`);
  return out;
}

const UA = { "User-Agent": "CosmoControl-Monitor/1.0" };
const noindex = (html: string, header: string | null) =>
  /noindex/i.test(header ?? "") || /<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(html);

/** Scadenza del dominio (RDAP): avvisa 45 giorni prima. */
export async function controlloDominio(base: string): Promise<string[]> {
  const dominio = new URL(base).hostname.replace(/^www\./, "");
  const r = await tfetch(`https://rdap.org/domain/${dominio}`, { cache: "no-store", redirect: "follow", headers: { Accept: "application/rdap+json" } }, 12000).catch(() => null);
  if (!r || !r.ok) return []; // non verificabile: nessun falso allarme
  const j = (await r.json().catch(() => null)) as { events?: { eventAction: string; eventDate: string }[] } | null;
  const exp = j?.events?.find((e) => e.eventAction === "expiration")?.eventDate;
  if (!exp) return [];
  const giorni = Math.floor((new Date(exp).getTime() - Date.now()) / 86400000);
  return giorni <= 45 ? [`🌐 Il dominio ${dominio} scade tra ${giorni} giorni (${new Date(exp).toLocaleDateString("it-IT")}): rinnovalo`] : [];
}

/** Home: reindirizzamento a HTTPS, nessun noindex per errore, titolo e canonical presenti. */
export async function controlloHome(base: string): Promise<string[]> {
  const out: string[] = [];
  const [page, http] = await Promise.all([
    tfetch(base + "/", { cache: "no-store", headers: UA }, 15000).catch(() => null),
    tfetch(base.replace(/^https:/, "http:") + "/", { cache: "no-store", redirect: "manual", headers: UA }, 10000).catch(() => null),
  ]);
  if (page?.ok) {
    const html = await page.text();
    if (noindex(html, page.headers.get("x-robots-tag"))) out.push("🚫 La home ha «noindex»: Google non la mostrerebbe. Controlla Impostazioni → Lettura e il plugin SEO");
    if (!/<title>[^<]{3,}<\/title>/i.test(html)) out.push("📝 La home non ha un titolo (tag title)");
    if (!/<link[^>]+rel=["']canonical["']/i.test(html)) out.push("📝 La home non ha il link canonical");
    if (/<(?:img|script|link)[^>]+(?:src|href)=["']http:\/\/(?!www\.w3\.org)/i.test(html)) out.push("🔓 La home carica risorse non sicure (http): il lucchetto del browser può sparire");
  }
  if (http && http.status < 300) out.push("🔓 La versione http:// del sito non rimanda a https://");
  return out;
}

/** Pubblicazione: articoli programmati e non usciti, lunghi periodi senza nuovi articoli. */
export async function controlloPubblicazione(): Promise<string[]> {
  const { articles, demo } = await loadArticles();
  if (demo) return [];
  const out: string[] = [];
  const persi = articles.filter((a) => a.status === "future" && new Date(a.date).getTime() < Date.now() - 45 * 60000);
  for (const a of persi.slice(0, 4)) out.push(`🕒 Programmato e non pubblicato: «${a.title}» (doveva uscire il ${new Date(a.date).toLocaleString("it-IT")})`);
  const pub = articles.filter((a) => a.status === "publish").sort((x, y) => y.date.localeCompare(x.date));
  if (pub[0] && daysSince(pub[0].date) >= 4) out.push(`✍️ Nessun nuovo articolo da ${daysSince(pub[0].date)} giorni`);
  return out;
}

/** Plugin attivi con una versione più nuova su wordpress.org (i plugin a pagamento o personali non si possono verificare). */
export async function controlloPlugin(): Promise<string[]> {
  const { plugins } = await getPlugins();
  const attivi = plugins.filter((p) => p.status !== "inactive");
  const vecchi: string[] = [];
  await Promise.all(
    attivi.map(async (p) => {
      const slug = p.plugin.split("/")[0];
      const r = await tfetch(`https://api.wordpress.org/plugins/info/1.0/${slug}.json`, { cache: "no-store" }, 10000).catch(() => null);
      if (!r?.ok) return;
      const v = ((await r.json().catch(() => null)) as { version?: string } | null)?.version;
      if (!v || !p.version) return;
      const num = (x: string) => x.split(/[.-]/).map((n) => parseInt(n, 10) || 0);
      const a = num(v);
      const b = num(p.version);
      for (let i = 0; i < Math.max(a.length, b.length); i++) {
        if ((a[i] ?? 0) !== (b[i] ?? 0)) {
          if ((a[i] ?? 0) > (b[i] ?? 0)) vecchi.push(`${p.name} ${p.version} → ${v}`);
          break;
        }
      }
    }),
  );
  if (!vecchi.length) return [];
  return [`🔌 ${vecchi.length} plugin da aggiornare: ${vecchi.slice(0, 8).join(", ")}${vecchi.length > 8 ? "…" : ""}`];
}

/** Un campione di pagine della sitemap: devono rispondere 200 e non avere noindex. */
export async function controlloCampione(base: string): Promise<string[]> {
  const leggi = async (u: string) => {
    const r = await tfetch(u, { cache: "no-store", headers: UA }, 12000).catch(() => null);
    return r?.ok ? await r.text() : "";
  };
  const locs = (x: string) => Array.from(x.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g), (m) => m[1]);
  let idx = locs(await leggi(base + "/sitemap_index.xml"));
  if (!idx.length) idx = locs(await leggi(base + "/wp-sitemap.xml"));
  const post = idx.find((u) => /post-sitemap|posts-post/i.test(u)) ?? idx[0];
  if (!post) return [];
  const urls = locs(await leggi(post)).filter((u) => !/\.(jpe?g|png|webp|gif)$/i.test(u));
  if (!urls.length) return [];
  const campione = urls.sort(() => Math.random() - 0.5).slice(0, 8);
  const out: string[] = [];
  await Promise.all(
    campione.map(async (u) => {
      const r = await tfetch(u, { cache: "no-store", headers: UA }, 15000).catch(() => null);
      if (!r) return void out.push(`📄 Pagina senza risposta: ${u}`);
      if (r.status >= 400) return void out.push(`📄 Pagina della sitemap con errore ${r.status}: ${u}`);
      if (noindex(await r.text(), r.headers.get("x-robots-tag"))) out.push(`🚫 Pagina della sitemap con noindex: ${u}`);
    }),
  );
  return out;
}

/** Il monitor giornaliero ha girato di recente? */
export async function controlloMonitorAttivo(): Promise<string[]> {
  const { rows, errore } = await loadHistory("uptime", 1);
  if (errore) return [];
  const u = rows[0];
  if (!u) return ["📡 Il monitor giornaliero non ha ancora salvato nessuna misura"];
  const ore = (Date.now() - new Date(u.taken_at).getTime()) / 3600000;
  return ore > 36 ? [`📡 Il monitor giornaliero non gira da ${Math.round(ore / 24)} giorni: controlla i Cron Jobs su Vercel`] : [];
}
