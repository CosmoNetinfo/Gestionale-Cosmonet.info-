import { normUrl } from "./gsc";

/**
 * Storico di Search Console salvato su Supabase (tabella gsc_page_daily).
 * Variabili: SUPABASE_URL, SUPABASE_SECRET_KEY.
 */
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

export interface HistoryDay {
  date: string;
  clicks: number;
  impressions: number;
  position: number;
}

export interface SnapshotRow {
  date: string;
  page: string;
  clicks: number;
  impressions: number;
  position: number;
}

/** Salva (o aggiorna) le righe in blocchi, 4 richieste alla volta. */
export async function saveSnapshot(rows: SnapshotRow[]): Promise<number> {
  const c = conf();
  if (!c) throw new Error("Supabase non è collegato");
  const BATCH = 2000;
  const batches: SnapshotRow[][] = [];
  for (let i = 0; i < rows.length; i += BATCH) batches.push(rows.slice(i, i + BATCH));
  let saved = 0;
  for (let i = 0; i < batches.length; i += 4) {
    const group = batches.slice(i, i + 4);
    const results = await Promise.all(
      group.map((b) =>
        fetch(`${c.url}/rest/v1/gsc_page_daily?on_conflict=date,page`, {
          method: "POST",
          headers: hdr(c.key, { Prefer: "resolution=merge-duplicates,return=minimal" }),
          body: JSON.stringify(b),
          cache: "no-store",
        }),
      ),
    );
    results.forEach((res, j) => {
      if (!res.ok) throw new Error(`Supabase ha risposto con errore ${res.status}`);
      saved += group[j].length;
    });
  }
  return saved;
}

/** Storico giornaliero di un articolo; vuoto se Supabase non è collegato o la tabella non esiste. */
export async function getPageHistory(pageUrl: string): Promise<HistoryDay[]> {
  const c = conf();
  if (!c) return [];
  try {
    const page = normUrl(pageUrl);
    const res = await fetch(
      `${c.url}/rest/v1/gsc_page_daily?select=date,clicks,impressions,position&page=eq.${encodeURIComponent(page)}&order=date.asc&limit=1000`,
      { headers: hdr(c.key), cache: "no-store" },
    );
    if (!res.ok) return [];
    return (await res.json()) as HistoryDay[];
  } catch {
    return [];
  }
}

/** Numero di giorni e prima/ultima data presenti nello storico (per la pagina Impostazioni). */
export async function historyInfo(): Promise<{ first?: string; last?: string } | null> {
  const c = conf();
  if (!c) return null;
  try {
    const get = async (order: string) => {
      const res = await fetch(`${c.url}/rest/v1/gsc_page_daily?select=date&order=date.${order}&limit=1`, {
        headers: hdr(c.key),
        cache: "no-store",
      });
      if (!res.ok) throw new Error("x");
      return ((await res.json()) as { date: string }[])[0]?.date;
    };
    return { first: await get("asc"), last: await get("desc") };
  } catch {
    return null;
  }
}
