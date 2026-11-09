import { createSign } from "crypto";

export interface GscStats {
  clicks: number;
  impressions: number;
  ctr: number; // 0..1
  position: number;
}

export interface GscResult {
  /** Statistiche per URL normalizzato (vedi normUrl). */
  byUrl: Map<string, GscStats>;
  configured: boolean;
  note?: string;
  days: number;
}

export const GSC_DAYS = 90;

/** Normalizza un URL per confrontare WordPress e Search Console. */
export function normUrl(u: string): string {
  try {
    const x = new URL(u);
    return (x.hostname.replace(/^www\./, "") + x.pathname).replace(/\/+$/, "").toLowerCase();
  } catch {
    return u.replace(/\/+$/, "").toLowerCase();
  }
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

async function getAccessToken(email: string, privateKey: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(
    JSON.stringify({
      iss: email,
      scope: "https://www.googleapis.com/auth/webmasters.readonly",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const sign = createSign("RSA-SHA256");
  sign.update(`${header}.${claim}`);
  const signature = b64url(sign.sign(privateKey));

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claim}.${signature}`,
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`autenticazione Google fallita (${res.status})`);
  return ((await res.json()) as { access_token: string }).access_token;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Legge click, impressioni, CTR e posizione per pagina dagli ultimi GSC_DAYS giorni.
 * Variabili: GSC_SERVICE_ACCOUNT_JSON (contenuto del file JSON), GSC_SITE (es. sc-domain:cosmonet.info).
 */
export async function getGscStats(): Promise<GscResult> {
  const byUrl = new Map<string, GscStats>();
  const raw = process.env.GSC_SERVICE_ACCOUNT_JSON;
  const site = process.env.GSC_SITE;

  if (!raw || !site) {
    return {
      byUrl,
      configured: false,
      days: GSC_DAYS,
      note: "Search Console non è ancora collegato: mancano GSC_SERVICE_ACCOUNT_JSON e GSC_SITE.",
    };
  }

  try {
    let creds: { client_email: string; private_key: string };
    try {
      creds = JSON.parse(raw);
    } catch {
      throw new Error("GSC_SERVICE_ACCOUNT_JSON non è un JSON valido (incolla tutto il file, da { a })");
    }
    const token = await getAccessToken(creds.client_email, creds.private_key);

    // I dati di Search Console hanno 2-3 giorni di ritardo
    const end = new Date(Date.now() - 2 * 86400000);
    const start = new Date(end.getTime() - GSC_DAYS * 86400000);

    for (let startRow = 0; startRow < 100000; startRow += 25000) {
      const res = await fetch(
        `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            startDate: iso(start),
            endDate: iso(end),
            dimensions: ["page"],
            rowLimit: 25000,
            startRow,
          }),
          next: { revalidate: 3600 },
        },
      );
      if (!res.ok) {
        const hint =
          res.status === 403
            ? " Controlla di aver aggiunto l'email dell'account di servizio in Search Console."
            : "";
        throw new Error(`Search Console ha risposto con errore ${res.status}.${hint}`);
      }
      const rows =
        ((await res.json()) as {
          rows?: { keys: string[]; clicks: number; impressions: number; ctr: number; position: number }[];
        }).rows ?? [];
      for (const r of rows) {
        const k = normUrl(r.keys[0]);
        const prev = byUrl.get(k);
        // Più URL possono coincidere dopo la normalizzazione: sommo
        if (prev) {
          const imp = prev.impressions + r.impressions;
          byUrl.set(k, {
            clicks: prev.clicks + r.clicks,
            impressions: imp,
            ctr: imp ? (prev.clicks + r.clicks) / imp : 0,
            position: imp
              ? (prev.position * prev.impressions + r.position * r.impressions) / imp
              : 0,
          });
        } else {
          byUrl.set(k, {
            clicks: r.clicks,
            impressions: r.impressions,
            ctr: r.ctr,
            position: r.position,
          });
        }
      }
      if (rows.length < 25000) break;
    }
    return { byUrl, configured: true, days: GSC_DAYS };
  } catch (e) {
    return {
      byUrl,
      configured: false,
      days: GSC_DAYS,
      note: "Search Console: " + (e as Error).message,
    };
  }
}

/**
 * Potenziale di un articolo: impressioni che non sono diventate click,
 * ×1,5 se è in posizione 5-20 (vicino alla prima pagina). Più alto = più conviene rivederlo.
 * Attenzione: le ricerche "navigazionali" (il solo nome di un servizio) gonfiano il numero.
 */
export function opportunity(g?: GscStats): number {
  if (!g) return 0;
  const boost = g.position >= 5 && g.position <= 20 ? 1.5 : 1;
  return Math.round(g.impressions * (1 - g.ctr) * boost);
}

export interface PageQuery extends GscStats {
  query: string;
}

/** Le ricerche che portano a un articolo (ultimi GSC_DAYS giorni), ordinate per impressioni. */
export async function getPageQueries(pageUrl: string, limit = 25): Promise<{ queries: PageQuery[]; note?: string }> {
  const raw = process.env.GSC_SERVICE_ACCOUNT_JSON;
  const site = process.env.GSC_SITE;
  if (!raw || !site) return { queries: [], note: "Search Console non collegato" };
  try {
    const creds = JSON.parse(raw) as { client_email: string; private_key: string };
    const token = await getAccessToken(creds.client_email, creds.private_key);
    const end = new Date(Date.now() - 2 * 86400000);
    const start = new Date(end.getTime() - GSC_DAYS * 86400000);
    const path = new URL(pageUrl).pathname;
    const res = await fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: iso(start),
          endDate: iso(end),
          dimensions: ["query"],
          dimensionFilterGroups: [
            { filters: [{ dimension: "page", operator: "contains", expression: path }] },
          ],
          rowLimit: limit,
        }),
        cache: "no-store",
      },
    );
    if (!res.ok) return { queries: [], note: `Search Console errore ${res.status}` };
    const rows =
      ((await res.json()) as {
        rows?: { keys: string[]; clicks: number; impressions: number; ctr: number; position: number }[];
      }).rows ?? [];
    return {
      queries: rows.map((r) => ({
        query: r.keys[0],
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: r.ctr,
        position: r.position,
      })),
    };
  } catch (e) {
    return { queries: [], note: (e as Error).message };
  }
}

export interface GscDay {
  date: string; // YYYY-MM-DD
  clicks: number;
  impressions: number;
}

/** Click e impressioni di tutto il sito, giorno per giorno, ultimi GSC_DAYS giorni. */
export async function getGscDaily(): Promise<{ days: GscDay[]; note?: string }> {
  const raw = process.env.GSC_SERVICE_ACCOUNT_JSON;
  const site = process.env.GSC_SITE;
  if (!raw || !site) return { days: [], note: "Search Console non collegato" };
  try {
    const creds = JSON.parse(raw) as { client_email: string; private_key: string };
    const token = await getAccessToken(creds.client_email, creds.private_key);
    const end = new Date(Date.now() - 2 * 86400000);
    const start = new Date(end.getTime() - GSC_DAYS * 86400000);
    const res = await fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: iso(start),
          endDate: iso(end),
          dimensions: ["date"],
          rowLimit: 200,
        }),
        next: { revalidate: 3600 },
      },
    );
    if (!res.ok) return { days: [], note: `Search Console errore ${res.status}` };
    const rows = ((await res.json()) as { rows?: { keys: string[]; clicks: number; impressions: number }[] }).rows ?? [];
    return {
      days: rows
        .map((r) => ({ date: r.keys[0], clicks: r.clicks, impressions: r.impressions }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    };
  } catch (e) {
    return { days: [], note: (e as Error).message };
  }
}

/* ------------------------------------------------------------------ */
/* Interrogazioni aggiuntive (scheda articolo, avvisi, storico)        */
/* ------------------------------------------------------------------ */

export interface GscRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

/** Interroga Search Console con paginazione (25.000 righe per pagina). */
export async function gscRows(
  body: Record<string, unknown>,
  opts: { maxPages?: number; revalidate?: number } = {},
): Promise<{ rows: GscRow[]; note?: string }> {
  const raw = process.env.GSC_SERVICE_ACCOUNT_JSON;
  const site = process.env.GSC_SITE;
  if (!raw || !site) return { rows: [], note: "Search Console non collegato" };
  try {
    const creds = JSON.parse(raw) as { client_email: string; private_key: string };
    const token = await getAccessToken(creds.client_email, creds.private_key);
    const rows: GscRow[] = [];
    const maxPages = opts.maxPages ?? 4;
    for (let p = 0; p < maxPages; p++) {
      const res = await fetch(
        `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ ...body, rowLimit: 25000, startRow: p * 25000 }),
          ...(opts.revalidate ? { next: { revalidate: opts.revalidate } } : { cache: "no-store" as const }),
        },
      );
      if (!res.ok) return { rows, note: `Search Console errore ${res.status}` };
      const part = ((await res.json()) as { rows?: GscRow[] }).rows ?? [];
      rows.push(...part);
      if (part.length < 25000) break;
    }
    return { rows };
  } catch (e) {
    return { rows: [], note: (e as Error).message };
  }
}

/** Ultimo giorno disponibile in Search Console (i dati hanno 2 giorni di ritardo). */
export function gscEndDate(): Date {
  return new Date(Date.now() - 2 * 86400000);
}

export const isoDate = iso;

export interface GscPageDay {
  date: string;
  clicks: number;
  impressions: number;
  position: number;
}

/** Andamento giornaliero di un solo articolo (ultimi GSC_DAYS giorni). */
export async function getPageDaily(pageUrl: string): Promise<{ days: GscPageDay[]; note?: string }> {
  const end = gscEndDate();
  const start = new Date(end.getTime() - GSC_DAYS * 86400000);
  let path = "";
  try {
    path = new URL(pageUrl).pathname;
  } catch {
    return { days: [] };
  }
  const { rows, note } = await gscRows(
    {
      startDate: iso(start),
      endDate: iso(end),
      dimensions: ["date", "page"],
      dimensionFilterGroups: [{ filters: [{ dimension: "page", operator: "contains", expression: path }] }],
    },
    { maxPages: 1 },
  );
  const target = normUrl(pageUrl);
  const byDate = new Map<string, GscPageDay>();
  for (const r of rows) {
    if (normUrl(r.keys[1]) !== target) continue;
    const d = byDate.get(r.keys[0]);
    if (d) {
      const imp = d.impressions + r.impressions;
      d.position = imp ? (d.position * d.impressions + r.position * r.impressions) / imp : d.position;
      d.clicks += r.clicks;
      d.impressions = imp;
    } else {
      byDate.set(r.keys[0], {
        date: r.keys[0],
        clicks: r.clicks,
        impressions: r.impressions,
        position: r.position,
      });
    }
  }
  return { days: Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date)), note };
}

export interface PeriodStats {
  clicks: number;
  impressions: number;
  position: number;
}

/** Ultimi 28 giorni contro i 28 precedenti, per pagina (chiave: URL normalizzato). */
export async function getComparison(): Promise<{
  byUrl: Map<string, { cur: PeriodStats; prev: PeriodStats }>;
  curLabel: string;
  prevLabel: string;
  note?: string;
}> {
  const end = gscEndDate();
  const curStart = new Date(end.getTime() - 27 * 86400000);
  const prevEnd = new Date(curStart.getTime() - 86400000);
  const prevStart = new Date(prevEnd.getTime() - 27 * 86400000);
  const q = (s: Date, e: Date) =>
    gscRows({ startDate: iso(s), endDate: iso(e), dimensions: ["page"] }, { revalidate: 3600 });
  const [cur, prev] = await Promise.all([q(curStart, end), q(prevStart, prevEnd)]);
  const byUrl = new Map<string, { cur: PeriodStats; prev: PeriodStats }>();
  const empty = (): PeriodStats => ({ clicks: 0, impressions: 0, position: 0 });
  const add = (url: string, which: "cur" | "prev", r: GscRow) => {
    const k = normUrl(url);
    const e = byUrl.get(k) ?? { cur: empty(), prev: empty() };
    const t = e[which];
    const imp = t.impressions + r.impressions;
    t.position = imp ? (t.position * t.impressions + r.position * r.impressions) / imp : 0;
    t.clicks += r.clicks;
    t.impressions = imp;
    byUrl.set(k, e);
  };
  for (const r of cur.rows) add(r.keys[0], "cur", r);
  for (const r of prev.rows) add(r.keys[0], "prev", r);
  const fmt = (s: Date, e: Date) => `${iso(s).slice(8, 10)}/${iso(s).slice(5, 7)} – ${iso(e).slice(8, 10)}/${iso(e).slice(5, 7)}`;
  return {
    byUrl,
    curLabel: fmt(curStart, end),
    prevLabel: fmt(prevStart, prevEnd),
    note: cur.note ?? prev.note,
  };
}

export interface QueryPage {
  query: string;
  page: string;
  clicks: number;
  impressions: number;
  position: number;
}

/** Coppie ricerca-pagina degli ultimi GSC_DAYS giorni, per scoprire articoli in concorrenza tra loro. */
export async function getQueryPages(): Promise<{ rows: QueryPage[]; note?: string }> {
  const end = gscEndDate();
  const start = new Date(end.getTime() - GSC_DAYS * 86400000);
  const { rows, note } = await gscRows(
    { startDate: iso(start), endDate: iso(end), dimensions: ["query", "page"] },
    { maxPages: 4, revalidate: 3600 },
  );
  return {
    rows: rows.map((r) => ({
      query: r.keys[0],
      page: r.keys[1],
      clicks: r.clicks,
      impressions: r.impressions,
      position: r.position,
    })),
    note,
  };
}
