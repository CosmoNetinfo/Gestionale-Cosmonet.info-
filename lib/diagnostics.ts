/* eslint-disable @typescript-eslint/no-unused-expressions -- uso dei ternari come istruzioni nei controlli di configurazione */
import tls from "node:tls";
import { getAccessToken, gscEndDate, inspectUrl, listSitemaps } from "./gsc";
import { loadArticles } from "./articles";
import { getMemoSummary } from "./memo";
import { runPagespeed } from "./pagespeed";

/**
 * Motore della pagina Debug: ogni controllo dice cosa ha provato, cosa è successo
 * e, se qualcosa non va, la causa probabile e come sistemarla.
 */
export type Esito = "ok" | "warn" | "fail" | "info";

export interface Check {
  gruppo: string;
  nome: string;
  esito: Esito;
  dettaglio: string;
  /** Cosa fare per risolvere (solo se warn/fail). */
  fix?: string;
  ms?: number;
}

type R = { esito: Esito; dettaglio: string; fix?: string };

const sig = (ms: number) => AbortSignal.timeout(ms);

function msg(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  if (/timeout|aborted/i.test(m) || (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")))
    return "nessuna risposta entro il tempo limite";
  return m;
}

async function run(gruppo: string, nome: string, fn: () => Promise<R> | R): Promise<Check> {
  const t0 = Date.now();
  try {
    const r = await fn();
    return { gruppo, nome, ...r, ms: Date.now() - t0 };
  } catch (e) {
    return {
      gruppo,
      nome,
      esito: "fail",
      dettaglio: msg(e),
      fix: "Errore inatteso nel controllo: usa «Copia report» e mandalo a Claude.",
      ms: Date.now() - t0,
    };
  }
}

const has = (k: string) => Boolean(process.env[k]?.trim());
const wpBase = () => process.env.WP_BASE_URL?.replace(/\/$/, "") ?? "";

/* ------------------------------------------------------------------ */
/* 1. Configurazione                                                   */
/* ------------------------------------------------------------------ */
const VERCEL_ENV_FIX =
  "Vercel → progetto cosmo-control → Settings → Environment Variables; dopo ogni modifica serve Deployments → Redeploy.";

function configChecks(): Check[] {
  const G = "Configurazione";
  const out: Check[] = [];
  const add = (nome: string, esito: Esito, dettaglio: string, fix?: string) => out.push({ gruppo: G, nome, esito, dettaglio, fix });

  has("APP_PASSWORD")
    ? add("APP_PASSWORD", "ok", "impostata")
    : add("APP_PASSWORD", "fail", "mancante: l'app in produzione resta chiusa", VERCEL_ENV_FIX);

  for (const k of ["WP_BASE_URL", "WP_USER", "WP_APP_PASSWORD"]) {
    has(k) ? add(k, "ok", "impostata") : add(k, "fail", "mancante: gli articoli sarebbero dimostrativi", VERCEL_ENV_FIX);
  }
  if (has("WP_BASE_URL") && !/^https?:\/\//.test(process.env.WP_BASE_URL!.trim()))
    add("WP_BASE_URL (formato)", "fail", "deve iniziare con https://", VERCEL_ENV_FIX);

  const raw = process.env.GSC_SERVICE_ACCOUNT_JSON;
  if (!raw?.trim()) add("GSC_SERVICE_ACCOUNT_JSON", "fail", "mancante", VERCEL_ENV_FIX);
  else {
    try {
      const j = JSON.parse(raw) as { client_email?: string; private_key?: string };
      if (!j.client_email || !j.private_key?.includes("PRIVATE KEY"))
        add("GSC_SERVICE_ACCOUNT_JSON", "fail", "JSON valido ma senza client_email o private_key", "Incolla l'intero file JSON della chiave dell'account di servizio, da { a }.");
      else add("GSC_SERVICE_ACCOUNT_JSON", "ok", `account ${j.client_email}`);
    } catch {
      add("GSC_SERVICE_ACCOUNT_JSON", "fail", "non è un JSON valido", "Incolla l'intero file JSON, da { a } (Mac italiano: { = Opzione+Maiusc+è, } = Opzione+Maiusc+*).");
    }
  }
  has("GSC_SITE")
    ? add("GSC_SITE", /^(sc-domain:|https?:\/\/)/.test(process.env.GSC_SITE!.trim()) ? "ok" : "fail", process.env.GSC_SITE!.trim(), "Deve essere sc-domain:cosmonet.info oppure un indirizzo completo https://…/")
    : add("GSC_SITE", "fail", "mancante", VERCEL_ENV_FIX);

  const su = process.env.SUPABASE_URL?.trim();
  su
    ? add("SUPABASE_URL", /^https:\/\/[a-z0-9]+\.supabase\.co\/?$/.test(su) ? "ok" : "warn", su, "Di solito è https://<progetto>.supabase.co")
    : add("SUPABASE_URL", "fail", "mancante", VERCEL_ENV_FIX);
  const sk = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!sk) add("SUPABASE_SECRET_KEY", "fail", "mancante", VERCEL_ENV_FIX);
  else if (sk.startsWith("sb_publishable_") || sk.startsWith("sb_anon"))
    add("SUPABASE_SECRET_KEY", "fail", "è la chiave PUBBLICA, serve quella segreta", "Supabase → Project Settings → API Keys → chiave «secret» (sb_secret_…).");
  else add("SUPABASE_SECRET_KEY", "ok", `impostata (${sk.length} caratteri)`);

  const mcp = process.env.MCP_TOKEN;
  !mcp
    ? add("MCP_TOKEN", "warn", "mancante: Claude non può leggere il gestionale", VERCEL_ENV_FIX)
    : mcp.length < 20
      ? add("MCP_TOKEN", "fail", `solo ${mcp.length} caratteri: ne servono almeno 20`, "Genera una stringa casuale lunga (32+ caratteri).")
      : add("MCP_TOKEN", "ok", `impostato (${mcp.length} caratteri)`);

  const cs = process.env.CRON_SECRET;
  !cs
    ? add("CRON_SECRET", "fail", "mancante: lo storico di Search Console non si aggiorna", VERCEL_ENV_FIX)
    : cs !== cs.trim()
      ? add("CRON_SECRET", "warn", "contiene spazi o a capo ai bordi (il codice li ignora)", "Meglio rimuoverli: riscrivi il valore su Vercel e fai Redeploy.")
      : add("CRON_SECRET", "ok", `impostato (${cs.length} caratteri)`);

  const ps = process.env.PAGESPEED_API_KEY?.trim();
  !ps
    ? add("PAGESPEED_API_KEY", "warn", "mancante: la pagina Velocità non funziona", VERCEL_ENV_FIX)
    : !ps.startsWith("AIza") || ps.length !== 39
      ? add("PAGESPEED_API_KEY", "warn", `formato insolito (${ps.length} caratteri, le chiavi Google ne hanno 39 e iniziano con AIza)`, "Controlla di aver copiato la chiave intera, senza spazi.")
      : add("PAGESPEED_API_KEY", "ok", "impostata (formato corretto)");

  has("COSMOMEMO_URL") && has("COSMOMEMO_READ_TOKEN")
    ? add("Cosmo Memo", "ok", "URL e token impostati")
    : add("Cosmo Memo", "info", "non collegato (facoltativo)");
  has("GITHUB_TOKEN") || has("GITHUB_USER")
    ? add("GitHub", "ok", has("GITHUB_TOKEN") ? "token impostato" : "solo utente (repository pubbliche)")
    : add("GitHub", "info", "non collegato (facoltativo)");
  const rd = process.env.REVIEW_DAYS;
  if (rd && !(Number(rd) > 0)) add("REVIEW_DAYS", "warn", `valore non numerico («${rd}»): uso 90`, "Metti un numero, per esempio 90.");
  has("DISCORD_INVITE") ? add("Discord", "ok", "invito impostato") : add("Discord", "info", "non impostato (facoltativo)");
  has("TELEGRAM_BOT_TOKEN") && has("TELEGRAM_CHAT_ID")
    ? add("Telegram", "ok", "token e chat impostati")
    : add("Telegram", "info", "non ancora collegato (bot da fare)");
  return out;
}

/* ------------------------------------------------------------------ */
/* 2. Supabase                                                         */
/* ------------------------------------------------------------------ */
function sbConf() {
  const url = process.env.SUPABASE_URL?.trim().replace(/\/$/, "");
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  return url && key ? { url, key } : null;
}
const sbH = (key: string, extra: Record<string, string> = {}) => ({
  apikey: key,
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
  ...extra,
});

async function sbProblem(res: Response, tabella: string): Promise<R> {
  const text = (await res.text().catch(() => "")).slice(0, 300);
  let code = "";
  try {
    code = String((JSON.parse(text) as { code?: string }).code ?? "");
  } catch {
    /* corpo non JSON */
  }
  if (res.status === 401)
    return { esito: "fail", dettaglio: "chiave rifiutata (401)", fix: "La SUPABASE_SECRET_KEY è sbagliata o di un altro progetto: Supabase → Project Settings → API Keys, copia la chiave «secret», aggiornala su Vercel e fai Redeploy." };
  if (res.status === 403 || code === "42501")
    return {
      esito: "fail",
      dettaglio: `permessi mancanti su ${tabella} (42501)`,
      fix: `In Supabase → SQL Editor esegui: GRANT select, insert, update, delete ON public.${tabella} TO service_role;`,
    };
  if (res.status === 404 || code === "PGRST205" || code === "42P01")
    return { esito: "fail", dettaglio: `tabella ${tabella} non trovata`, fix: `Crea la tabella ${tabella} in Supabase (SQL Editor): chiedi a Claude lo script.` };
  if (res.status >= 500)
    return { esito: "fail", dettaglio: `Supabase non risponde (${res.status})`, fix: "Il progetto potrebbe essere in pausa (piano gratuito, 7 giorni di inattività): apri Supabase e premi Restore." };
  return { esito: "fail", dettaglio: `errore ${res.status}: ${text.slice(0, 120)}`, fix: "Copia il report e mandalo a Claude." };
}

async function supabaseChecks(): Promise<Check[]> {
  const G = "Supabase";
  const c = sbConf();
  if (!c)
    return [{ gruppo: G, nome: "Connessione", esito: "fail", dettaglio: "SUPABASE_URL o SUPABASE_SECRET_KEY mancanti", fix: VERCEL_ENV_FIX }];

  return Promise.all([
    run(G, "Lettura revisioni (article_reviews)", async () => {
      const res = await fetch(`${c.url}/rest/v1/article_reviews?select=article_id&limit=1`, {
        headers: sbH(c.key, { Prefer: "count=exact" }),
        cache: "no-store",
        signal: sig(10000),
      });
      if (!res.ok) return sbProblem(res, "article_reviews");
      const n = res.headers.get("content-range")?.split("/")[1];
      return { esito: "ok", dettaglio: `leggibile, ${n ?? "?"} revisioni salvate` };
    }),
    run(G, "Scrittura revisioni (Segna rivisto)", async () => {
      const post = await fetch(`${c.url}/rest/v1/article_reviews?on_conflict=article_id`, {
        method: "POST",
        headers: sbH(c.key, { Prefer: "resolution=merge-duplicates,return=minimal" }),
        body: JSON.stringify({ article_id: -1, reviewed_at: new Date().toISOString() }),
        cache: "no-store",
        signal: sig(10000),
      });
      if (!post.ok) {
        const r = await sbProblem(post, "article_reviews");
        return r.dettaglio.startsWith("errore 4") && /23514|23502/.test(r.dettaglio)
          ? { esito: "ok", dettaglio: "scrittura consentita (riga di prova rifiutata da un vincolo, normale)" }
          : r;
      }
      const del = await fetch(`${c.url}/rest/v1/article_reviews?article_id=eq.-1`, {
        method: "DELETE",
        headers: sbH(c.key),
        cache: "no-store",
        signal: sig(10000),
      });
      return del.ok
        ? { esito: "ok", dettaglio: "scrittura e cancellazione di prova riuscite" }
        : { esito: "warn", dettaglio: "scrittura ok, ma non riesco a cancellare la riga di prova (id -1): innocuo", fix: "Facoltativo: GRANT delete ON public.article_reviews TO service_role;" };
    }),
    run(G, "Note per articolo (article_notes)", async () => {
      const res = await fetch(`${c.url}/rest/v1/article_notes?select=article_id&limit=1`, { headers: sbH(c.key), cache: "no-store", signal: sig(10000) });
      if (res.ok) return { esito: "ok", dettaglio: "tabella pronta" };
      const r = await sbProblem(res, "article_notes");
      return { ...r, esito: "warn" };
    }),
    run(G, "Storico Search Console (gsc_page_daily)", async () => {
      const res = await fetch(`${c.url}/rest/v1/gsc_page_daily?select=date&order=date.desc&limit=1`, {
        headers: sbH(c.key, { Prefer: "count=exact" }),
        cache: "no-store",
        signal: sig(15000),
      });
      if (!res.ok) return sbProblem(res, "gsc_page_daily");
      const total = res.headers.get("content-range")?.split("/")[1] ?? "?";
      const last = ((await res.json()) as { date: string }[])[0]?.date;
      if (!last) return { esito: "warn", dettaglio: "tabella vuota", fix: "Esegui il recupero dello storico (cron con ?days=480)." };
      const age = Math.floor((gscEndDate().getTime() - Date.parse(last)) / 86400000);
      if (age > 8)
        return { esito: "fail", dettaglio: `${total} righe, ultimo giorno ${last} (${age} giorni indietro)`, fix: "Il cron giornaliero non salva: controlla CRON_SECRET (stesso valore su Vercel) e i log di /api/cron/gsc-snapshot." };
      if (age > 3)
        return { esito: "warn", dettaglio: `${total} righe, ultimo giorno ${last} (${age} giorni indietro)`, fix: "Il cron di ieri potrebbe non essere partito: guarda Vercel → Settings → Cron Jobs." };
      return { esito: "ok", dettaglio: `${total} righe, ultimo giorno ${last}` };
    }),
  ]);
}

/* ------------------------------------------------------------------ */
/* 3. Search Console                                                   */
/* ------------------------------------------------------------------ */
async function gscChecks(): Promise<Check[]> {
  const G = "Search Console";
  const raw = process.env.GSC_SERVICE_ACCOUNT_JSON;
  const site = process.env.GSC_SITE?.trim();
  if (!raw || !site)
    return [{ gruppo: G, nome: "Connessione", esito: "fail", dettaglio: "GSC_SERVICE_ACCOUNT_JSON o GSC_SITE mancanti", fix: VERCEL_ENV_FIX }];

  let token = "";
  const auth = await run(G, "Accesso con l'account di servizio", async () => {
    const j = JSON.parse(raw) as { client_email: string; private_key: string };
    token = await getAccessToken(j.client_email, j.private_key);
    return { esito: "ok", dettaglio: "token Google ottenuto" };
  });
  if (auth.esito !== "ok") {
    auth.fix = "La chiave JSON è sbagliata, scaduta o l'orologio non torna. Crea una nuova chiave per l'account di servizio (Google Cloud → IAM → Account di servizio → Chiavi) e aggiorna GSC_SERVICE_ACCOUNT_JSON.";
    return [auth];
  }
  const H = { Authorization: `Bearer ${token}` };
  const S = encodeURIComponent(site);

  const rest = await Promise.all([
    run(G, "Permesso sulla proprietà", async () => {
      const res = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${S}`, { headers: H, cache: "no-store", signal: sig(10000) });
      if (res.status === 403 || res.status === 404)
        return { esito: "fail", dettaglio: `la proprietà ${site} non è accessibile (${res.status})`, fix: "In Search Console → Impostazioni → Utenti e autorizzazioni aggiungi l'email dell'account di servizio; controlla anche che GSC_SITE sia scritto uguale alla proprietà." };
      if (!res.ok) return { esito: "fail", dettaglio: `errore ${res.status}` };
      const level = ((await res.json()) as { permissionLevel?: string }).permissionLevel ?? "";
      if (level === "siteOwner" || level === "siteFullUser") return { esito: "ok", dettaglio: level === "siteOwner" ? "proprietario" : "utente con permesso Completo" };
      return { esito: "warn", dettaglio: `permesso «${level}»: sola lettura`, fix: "Per reinviare le sitemap serve il permesso Completo: Search Console → Impostazioni → Utenti e autorizzazioni → account di servizio → Cambia autorizzazione." };
    }),
    run(G, "Dati di ricerca (Search Analytics)", async () => {
      const end = gscEndDate();
      const start = new Date(end.getTime() - 6 * 86400000);
      const res = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${S}/searchAnalytics/query`, {
        method: "POST",
        headers: { ...H, "Content-Type": "application/json" },
        body: JSON.stringify({ startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10), dimensions: ["date"], rowLimit: 10 }),
        cache: "no-store",
        signal: sig(15000),
      });
      if (!res.ok) return { esito: "fail", dettaglio: `errore ${res.status}`, fix: res.status === 403 ? "Controlla il permesso dell'account di servizio in Search Console." : "Copia il report e mandalo a Claude." };
      const rows = ((await res.json()) as { rows?: { keys: string[] }[] }).rows ?? [];
      return rows.length
        ? { esito: "ok", dettaglio: `${rows.length} giorni di dati, ultimo ${rows[rows.length - 1].keys[0]}` }
        : { esito: "warn", dettaglio: "nessun dato negli ultimi 7 giorni", fix: "Normale solo se il sito è nuovo; altrimenti controlla la proprietà." };
    }),
    run(G, "Sitemap inviate", async () => {
      const { sitemaps, note } = await listSitemaps();
      if (note) return { esito: "fail", dettaglio: note, fix: "Controlla il permesso dell'account di servizio." };
      if (!sitemaps.length) return { esito: "warn", dettaglio: "nessuna sitemap inviata a Google", fix: "Pagina Indicizzazione → «Invia sitemap» (serve il permesso Completo)." };
      const errs = sitemaps.reduce((t, s) => t + s.errors, 0);
      return errs
        ? { esito: "warn", dettaglio: `${sitemaps.length} sitemap, ${errs} errori segnalati da Google`, fix: "Apri Search Console → Sitemap e leggi gli errori." }
        : { esito: "ok", dettaglio: `${sitemaps.length} sitemap, nessun errore` };
    }),
    run(G, "Ispezione URL (stato di indicizzazione)", async () => {
      const base = wpBase();
      if (!base) return { esito: "warn", dettaglio: "salto: manca WP_BASE_URL" };
      const r = await inspectUrl(base + "/", { token, site });
      return r.verdict === "ERROR"
        ? { esito: "fail", dettaglio: r.error ?? "errore", fix: "Verifica che la «Google Search Console API» sia abilitata nel progetto Google Cloud dell'account di servizio." }
        : { esito: "ok", dettaglio: `home: ${r.coverage || r.verdict}` };
    }),
  ]);
  return [auth, ...rest];
}

/* ------------------------------------------------------------------ */
/* 4. WordPress e dati degli articoli                                  */
/* ------------------------------------------------------------------ */
async function wordpressChecks(): Promise<Check[]> {
  const G = "WordPress";
  const base = wpBase();
  const user = process.env.WP_USER;
  const pass = process.env.WP_APP_PASSWORD;
  if (!base) return [{ gruppo: G, nome: "Connessione", esito: "fail", dettaglio: "WP_BASE_URL mancante", fix: VERCEL_ENV_FIX }];
  const H = user && pass ? { Authorization: "Basic " + Buffer.from(`${user}:${pass}`).toString("base64") } : undefined;

  return Promise.all([
    run(G, "API REST pubblica", async () => {
      const res = await fetch(`${base}/wp-json/`, { cache: "no-store", signal: sig(10000) });
      if (!res.ok) return { esito: "fail", dettaglio: `HTTP ${res.status}`, fix: "L'API REST di WordPress non risponde: un plugin di sicurezza o la cache potrebbero bloccarla." };
      const j = (await res.json()) as { name?: string };
      return { esito: "ok", dettaglio: `risponde (${j.name ?? "sito"})` };
    }),
    run(G, "Accesso con Application Password", async () => {
      if (!H) return { esito: "fail", dettaglio: "WP_USER o WP_APP_PASSWORD mancanti", fix: VERCEL_ENV_FIX };
      const res = await fetch(`${base}/wp-json/wp/v2/users/me?_fields=id,name`, { headers: H, cache: "no-store", signal: sig(10000) });
      if (res.status === 401 || res.status === 403)
        return { esito: "fail", dettaglio: `rifiutato (${res.status})`, fix: "Password applicazione sbagliata/revocata o utente senza permessi. In WordPress: Utenti → Profilo → Password per le applicazioni; poi aggiorna WP_APP_PASSWORD. Se è corretta, un plugin di sicurezza può bloccare l'header Authorization." };
      if (!res.ok) return { esito: "fail", dettaglio: `HTTP ${res.status}` };
      const j = (await res.json()) as { name?: string };
      return { esito: "ok", dettaglio: `autenticato come ${j.name ?? "utente"}` };
    }),
    run(G, "Modifica da qui (campi Yoast scrivibili)", async () => {
      if (!H) return { esito: "warn", dettaglio: "salto: mancano le credenziali WordPress" };
      const res = await fetch(`${base}/wp-json/wp/v2/posts?per_page=1&context=edit&_fields=id,meta`, { headers: H, cache: "no-store", signal: sig(10000) });
      if (!res.ok) return { esito: "warn", dettaglio: `HTTP ${res.status}` };
      const j = (await res.json()) as { meta?: Record<string, unknown> | unknown[] }[];
      const m = (Array.isArray(j[0]?.meta) ? {} : j[0]?.meta ?? {}) as Record<string, unknown>;
      const ok = ["_yoast_wpseo_title", "_yoast_wpseo_metadesc", "_yoast_wpseo_focuskw"].every((k) => k in m);
      return ok
        ? { esito: "ok", dettaglio: "i campi SEO di Yoast sono visibili: la pagina «Modifica SEO e stato» può leggerli e scriverli" }
        : { esito: "warn", dettaglio: "WordPress non espone i campi Yoast alla REST API: titolo, stato e data si modificano, i campi SEO no", fix: "Dimmelo: ti preparo il piccolo snippet da aggiungere al sito per esporli." };
    }),
    run(G, "Articoli + revisioni (pipeline completa)", async () => {
      const r = await loadArticles();
      if (r.demo) return { esito: "fail", dettaglio: "l'app sta mostrando dati dimostrativi", fix: r.note ?? "Controlla le variabili WordPress." };
      const pub = r.articles.filter((a) => a.status === "publish").length;
      const rev = r.articles.filter((a) => a.reviewedAt).length;
      return { esito: r.note ? "warn" : "ok", dettaglio: `${r.articles.length} articoli (${pub} pubblicati), ${rev} con revisione salvata${r.note ? ` — ${r.note}` : ""}`, fix: r.note ? "Leggi l'avviso qui sopra." : undefined };
    }),
  ]);
}

/* ------------------------------------------------------------------ */
/* 5. Sito pubblico                                                    */
/* ------------------------------------------------------------------ */
function certDays(host: string): Promise<number | null> {
  return new Promise((resolve) => {
    const s = tls.connect({ host, port: 443, servername: host, timeout: 8000 }, () => {
      const c = s.getPeerCertificate();
      s.end();
      resolve(c?.valid_to ? Math.round((new Date(c.valid_to).getTime() - Date.now()) / 86400000) : null);
    });
    s.on("error", () => resolve(null));
    s.on("timeout", () => {
      s.destroy();
      resolve(null);
    });
  });
}

async function siteChecks(): Promise<Check[]> {
  const G = "Sito pubblico";
  const base = wpBase();
  if (!base) return [];
  const get = async (path: string) => {
    const t0 = Date.now();
    const res = await fetch(base + path, { cache: "no-store", signal: sig(10000) });
    return { res, ms: Date.now() - t0 };
  };
  return Promise.all([
    run(G, "Home", async () => {
      const { res, ms } = await get("/");
      return res.ok
        ? { esito: ms > 3000 ? "warn" : "ok", dettaglio: `HTTP ${res.status} in ${ms} ms`, fix: ms > 3000 ? "Risposta lenta: guarda la pagina Velocità." : undefined }
        : { esito: "fail", dettaglio: `HTTP ${res.status}`, fix: "Il sito non risponde correttamente: controlla l'hosting." };
    }),
    run(G, "Sitemap", async () => {
      for (const p of ["/sitemap_index.xml", "/wp-sitemap.xml"]) {
        const { res } = await get(p);
        if (res.ok) return { esito: "ok", dettaglio: `trovata (${p})` };
      }
      return { esito: "fail", dettaglio: "nessuna sitemap trovata", fix: "Controlla il plugin SEO (Yoast) o la sitemap nativa di WordPress." };
    }),
    run(G, "Certificato HTTPS", async () => {
      const d = await certDays(new URL(base).hostname);
      return d === null
        ? { esito: "warn", dettaglio: "non leggibile" }
        : d < 14
          ? { esito: "fail", dettaglio: `scade tra ${d} giorni`, fix: "Rinnova il certificato dall'hosting." }
          : { esito: "ok", dettaglio: `valido ancora ${d} giorni` };
    }),
  ]);
}

/* ------------------------------------------------------------------ */
/* 6. Altre integrazioni                                               */
/* ------------------------------------------------------------------ */
async function otherChecks(): Promise<Check[]> {
  const G = "Altre integrazioni";
  const list: Promise<Check>[] = [];
  const gh = process.env.GITHUB_TOKEN?.trim();
  const ghUser = process.env.GITHUB_USER?.trim();
  if (gh || ghUser)
    list.push(
      run(G, "GitHub", async () => {
        const res = await fetch(gh ? "https://api.github.com/user" : `https://api.github.com/users/${ghUser}`, {
          headers: { Accept: "application/vnd.github+json", "User-Agent": "cosmo-control", ...(gh ? { Authorization: `Bearer ${gh}` } : {}) },
          cache: "no-store",
          signal: sig(10000),
        });
        if (res.status === 401) return { esito: "fail", dettaglio: "token rifiutato (401)", fix: "Il GITHUB_TOKEN è scaduto o revocato: creane uno nuovo (sola lettura) e aggiornalo su Vercel." };
        if (res.status === 403 || res.status === 429) return { esito: "warn", dettaglio: `limite di richieste raggiunto (${res.status})`, fix: "Riprova tra un po'." };
        if (!res.ok) return { esito: "fail", dettaglio: `HTTP ${res.status}` };
        const rest = res.headers.get("x-ratelimit-remaining");
        return { esito: "ok", dettaglio: `risponde${rest ? `, ${rest} richieste rimaste` : ""}` };
      }),
    );
  if (has("COSMOMEMO_URL") && has("COSMOMEMO_READ_TOKEN"))
    list.push(
      run(G, "Cosmo Memo", async () => {
        const r = await getMemoSummary();
        return r.summary
          ? { esito: "ok", dettaglio: `${r.summary.pages.length} pagine, ${r.summary.tasks.length} attività` }
          : { esito: "fail", dettaglio: r.note ?? "nessuna risposta", fix: "Controlla COSMOMEMO_READ_TOKEN e l'indirizzo di Cosmo Memo." };
      }),
    );
  const tg = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (tg)
    list.push(
      run(G, "Telegram bot", async () => {
        const res = await fetch(`https://api.telegram.org/bot${tg}/getMe`, { cache: "no-store", signal: sig(10000) });
        return res.ok
          ? { esito: "ok", dettaglio: "il bot risponde" }
          : { esito: "fail", dettaglio: `errore ${res.status}`, fix: "TELEGRAM_BOT_TOKEN errato: rigeneralo con @BotFather." };
      }),
    );
  return Promise.all(list);
}

/* ------------------------------------------------------------------ */
/* 7. Cron, MCP e informazioni di distribuzione                        */
/* ------------------------------------------------------------------ */
async function appChecks(origin: string | null): Promise<Check[]> {
  const G = "App e distribuzione";
  const list: Promise<Check>[] = [];
  if (origin) {
    list.push(
      run(G, "Cron protetto da CRON_SECRET", async () => {
        const res = await fetch(`${origin}/api/cron/gsc-snapshot`, { cache: "no-store", signal: sig(10000), redirect: "manual" });
        if (res.status === 401) return { esito: "ok", dettaglio: "senza chiave risponde 401 (protetto)" };
        if (res.status === 404) return { esito: "fail", dettaglio: "risponde 404: CRON_SECRET non è visibile in questo deploy", fix: "Imposta CRON_SECRET su Vercel e fai Redeploy." };
        return { esito: "fail", dettaglio: `risposta inattesa ${res.status}`, fix: res.status === 200 ? "ATTENZIONE: il cron risponde senza chiave. Copia il report e mandalo a Claude." : "Copia il report e mandalo a Claude." };
      }),
    );
    const mcp = process.env.MCP_TOKEN;
    if (mcp && mcp.length >= 20)
      list.push(
        run(G, "Server MCP (Claude)", async () => {
          const res = await fetch(`${origin}/api/mcp/${mcp}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
            cache: "no-store",
            signal: sig(10000),
          });
          if (!res.ok) return { esito: "fail", dettaglio: `HTTP ${res.status}`, fix: "Il server MCP non risponde: controlla MCP_TOKEN e il deploy." };
          const n = ((await res.json()) as { result?: { tools?: unknown[] } }).result?.tools?.length ?? 0;
          return { esito: "ok", dettaglio: `risponde, ${n} strumenti disponibili` };
        }),
      );
  }
  const e = process.env;
  list.push(
    Promise.resolve<Check>({
      gruppo: G,
      nome: "Versione in uso",
      esito: "info",
      dettaglio: `${e.VERCEL_ENV ?? "locale"} · ${(e.VERCEL_GIT_COMMIT_SHA ?? "?").slice(0, 7)} · ramo ${e.VERCEL_GIT_COMMIT_REF ?? "?"} · Node ${process.version} · regione ${e.VERCEL_REGION ?? "?"}`,
    }),
  );
  if (e.VERCEL_GIT_COMMIT_MESSAGE)
    list.push(Promise.resolve<Check>({ gruppo: G, nome: "Ultimo commit", esito: "info", dettaglio: e.VERCEL_GIT_COMMIT_MESSAGE.split("\n")[0].slice(0, 140) }));
  return Promise.all(list);
}

/* ------------------------------------------------------------------ */
/* 8. Controllo completo: ogni pagina + PageSpeed                      */
/* ------------------------------------------------------------------ */
const ROUTES = [
  "/",
  "/sito",
  "/repository",
  "/grafici",
  "/avvisi",
  "/opportunita",
  "/report",
  "/ricerche",
  "/link",
  "/segmenti",
  "/impatto",
  "/salute",
  "/stato",
  "/indicizzazione",
  "/coda",
  "/memo",
  "/canali",
  "/impostazioni",
  "/api/export/articoli",
];

async function pageChecks(origin: string | null): Promise<Check[]> {
  const G = "Pagine dell'app";
  if (!origin) return [{ gruppo: G, nome: "Pagine", esito: "warn", dettaglio: "indirizzo dell'app non noto: salto" }];
  const headers: Record<string, string> = {};
  if (process.env.APP_PASSWORD) headers.Authorization = "Basic " + Buffer.from(`x:${process.env.APP_PASSWORD}`).toString("base64");

  const routes = [...ROUTES];
  try {
    const first = (await loadArticles()).articles.find((a) => a.status === "publish");
    if (first) routes.splice(2, 0, `/sito/${first.id}`);
  } catch {
    /* la pipeline articoli è già controllata altrove */
  }

  const one = (path: string) =>
    run(G, path, async () => {
      const t0 = Date.now();
      const res = await fetch(origin + path, { headers, cache: "no-store", signal: sig(40000), redirect: "manual" });
      const ms = Date.now() - t0;
      if (res.status >= 500)
        return { esito: "fail", dettaglio: `errore del server (${res.status}) dopo ${ms} ms`, fix: "Questa pagina si rompe sul server: Vercel → Logs, filtra per questo percorso (oppure chiedi a Claude, che li legge)." };
      if (res.status === 401) return { esito: "warn", dettaglio: "401: non riesco ad autenticarmi da solo", fix: "Controlla APP_PASSWORD." };
      if (!res.ok) return { esito: "fail", dettaglio: `HTTP ${res.status}`, fix: "Pagina non trovata o rediretta." };
      const body = path.startsWith("/api/") ? "" : await res.text();
      const demo = /Dati dimostrativi\./.test(body);
      if (demo) return { esito: "warn", dettaglio: `si apre (${ms} ms) ma mostra dati dimostrativi`, fix: "Una fonte dati non è collegata: guarda i gruppi sopra." };
      if (ms > 8000) return { esito: "warn", dettaglio: `si apre ma è lenta (${(ms / 1000).toFixed(1)} s)`, fix: "Rischia il limite di 60 secondi di Vercel: dimmelo e la alleggerisco." };
      return { esito: "ok", dettaglio: `si apre in ${ms} ms` };
    });

  const out: Check[] = [];
  for (let i = 0; i < routes.length; i += 4) out.push(...(await Promise.all(routes.slice(i, i + 4).map(one))));
  out.push({
    gruppo: G,
    nome: "Errori nel browser",
    esito: "info",
    dettaglio: "questo controllo non vede gli errori che avvengono solo nel browser (es. «client-side exception»): se compaiono, la schermata di errore mostra il messaggio da copiare.",
  });
  return out;
}

async function speedCheck(): Promise<Check[]> {
  const G = "Velocità";
  const base = wpBase();
  return [
    await run(G, "PageSpeed Insights (home, mobile)", async () => {
      if (!has("PAGESPEED_API_KEY")) return { esito: "fail", dettaglio: "chiave mancante", fix: VERCEL_ENV_FIX };
      if (!base) return { esito: "warn", dettaglio: "manca WP_BASE_URL" };
      const r = await runPagespeed(base + "/", "mobile");
      if (!r.ok)
        return {
          esito: "fail",
          dettaglio: r.error ?? "errore",
          fix: /403|bloccat|blocked/i.test(r.error ?? "")
            ? "La chiave Google è limitata all'API sbagliata: Google Cloud → Credenziali → la chiave → Restrizioni API → solo «PageSpeed Insights API» → Salva (attendi fino a 5 minuti)."
            : "Riprova tra poco; se resta, copia il report e mandalo a Claude.",
        };
      return { esito: "ok", dettaglio: `punteggio mobile ${r.score ?? "?"}/100` };
    }),
  ];
}

/* ------------------------------------------------------------------ */

export interface DiagnosticsResult {
  checks: Check[];
  durataMs: number;
  generato: string;
  completo: boolean;
}

export async function runDiagnostics(opts: { origin: string | null; full: boolean }): Promise<DiagnosticsResult> {
  const t0 = Date.now();
  const groups = await Promise.all([
    Promise.resolve(configChecks()),
    supabaseChecks(),
    gscChecks(),
    wordpressChecks(),
    siteChecks(),
    otherChecks(),
    appChecks(opts.origin),
    ...(opts.full ? [speedCheck(), pageChecks(opts.origin)] : []),
  ]);
  return {
    checks: groups.flat(),
    durataMs: Date.now() - t0,
    generato: new Date().toISOString(),
    completo: opts.full,
  };
}

export function reportText(r: DiagnosticsResult): string {
  const tag: Record<Esito, string> = { ok: "OK", warn: "ATTENZIONE", fail: "PROBLEMA", info: "INFO" };
  const lines = [`Report Debug Cosmo Control — ${new Date(r.generato).toLocaleString("it-IT", { timeZone: "Europe/Rome" })} ora italiana (${r.completo ? "completo" : "rapido"}, ${(r.durataMs / 1000).toFixed(1)} s)`, ""];
  let g = "";
  for (const c of r.checks) {
    if (c.gruppo !== g) {
      g = c.gruppo;
      lines.push(`## ${g}`);
    }
    lines.push(`[${tag[c.esito]}] ${c.nome}: ${c.dettaglio}${c.fix && c.esito !== "ok" ? `  → ${c.fix}` : ""}`);
  }
  return lines.join("\n");
}
