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
