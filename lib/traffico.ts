/** Traffico reale letto dai plugin del sito (solo quelli che espongono una REST API). */
export interface TrafficoPunto {
  date: string; // YYYY-MM-DD
  visitatori: number;
  visualizzazioni: number;
}

export interface TrafficoTotali {
  visitatori: number;
  visualizzazioni: number;
}

const DAY = 86400000;
const iso = (d: Date) => d.toISOString().slice(0, 10);

function auth() {
  const base = process.env.WP_BASE_URL?.replace(/\/$/, "");
  const user = process.env.WP_USER;
  const pass = process.env.WP_APP_PASSWORD;
  if (!base || !user || !pass) return null;
  return { base, headers: { Authorization: "Basic " + Buffer.from(`${user}:${pass}`).toString("base64") } };
}

const somma = (p: TrafficoPunto[]): TrafficoTotali => ({
  visitatori: p.reduce((s, x) => s + x.visitatori, 0),
  visualizzazioni: p.reduce((s, x) => s + x.visualizzazioni, 0),
});

/**
 * Koko Analytics: REST API nativa (/wp-json/koko-analytics/v1/stats).
 * Restituisce il periodo richiesto e quello precedente di pari durata.
 */
export async function getKoko(days: number): Promise<{
  configured: boolean;
  points: TrafficoPunto[];
  cur: TrafficoTotali;
  prev?: TrafficoTotali;
  note?: string;
}> {
  const vuoto = { points: [], cur: { visitatori: 0, visualizzazioni: 0 } };
  const a = auth();
  if (!a) return { configured: false, ...vuoto, note: "WordPress non è collegato (mancano WP_BASE_URL, WP_USER, WP_APP_PASSWORD)." };

  const end = new Date();
  const curStart = new Date(end.getTime() - (days - 1) * DAY);
  const prevEnd = new Date(curStart.getTime() - DAY);
  const prevStart = new Date(prevEnd.getTime() - (days - 1) * DAY);
  const chartDays = Math.max(days, 14);
  const chartStart = new Date(end.getTime() - (chartDays - 1) * DAY);
  const from = new Date(Math.min(chartStart.getTime(), prevStart.getTime()));

  try {
    const url = `${a.base}/wp-json/koko-analytics/v1/stats?start_date=${iso(from)}&end_date=${iso(end)}&group=day`;
    const res = await fetch(url, { headers: a.headers, next: { revalidate: 900 } });
    if (res.status === 401 || res.status === 403)
      return { configured: true, ...vuoto, note: `Koko Analytics ha rifiutato la richiesta (${res.status}).` };
    if (res.status === 404)
      return { configured: true, ...vuoto, note: "Koko Analytics non risponde (404): il plugin è attivo? L'hosting potrebbe bloccare la REST API." };
    if (!res.ok) return { configured: true, ...vuoto, note: `Koko Analytics ha risposto con errore ${res.status}.` };

    const raw = (await res.json()) as unknown;
    const arr: Record<string, unknown>[] = Array.isArray(raw)
      ? (raw as Record<string, unknown>[])
      : Array.isArray((raw as { chart?: unknown })?.chart)
        ? ((raw as { chart: Record<string, unknown>[] }).chart)
        : [];
    const all: TrafficoPunto[] = arr
      .map((r) => ({
        date: String(r.date ?? "").slice(0, 10),
        visitatori: Number(r.visitors ?? r.visitatori ?? 0),
        visualizzazioni: Number(r.pageviews ?? r.visualizzazioni ?? 0),
      }))
      .filter((p) => /^\d{4}-\d{2}-\d{2}$/.test(p.date))
      .sort((x, y) => x.date.localeCompare(y.date));
    if (all.length === 0)
      return { configured: true, ...vuoto, note: "Koko Analytics ha risposto ma senza dati nel periodo (o con un formato che non riconosco)." };

    const between = (x: Date, y: Date) => all.filter((p) => p.date >= iso(x) && p.date <= iso(y));
    return {
      configured: true,
      points: between(chartStart, end),
      cur: somma(between(curStart, end)),
      prev: somma(between(prevStart, prevEnd)),
    };
  } catch (e) {
    return { configured: true, ...vuoto, note: (e as Error).message };
  }
}
