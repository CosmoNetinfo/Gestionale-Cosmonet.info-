/**
 * Versioni compatte (senza interfaccia) di Ricerche, Segmenti e Impatto delle revisioni,
 * per il server MCP: Claude vede gli stessi dati che Dany vede nelle pagine.
 */
import { loadArticles } from "./articles";
import { getComparison, gscEndDate, gscRows, isoDate, normUrl, type GscRow } from "./gsc";
import { getPageHistory, historyInfo, type HistoryDay } from "./history";
import { daysSince } from "./review";

const D = 86400000;
type Q = { query: string; clicks: number; impressions: number; position: number };

function toQ(rows: GscRow[]): Map<string, Q> {
  const m = new Map<string, Q>();
  for (const r of rows) m.set(r.keys[0], { query: r.keys[0], clicks: r.clicks, impressions: r.impressions, position: Math.round(r.position * 10) / 10 });
  return m;
}

function windows() {
  const end = gscEndDate();
  const curStart = new Date(end.getTime() - 27 * D);
  const prevEnd = new Date(curStart.getTime() - D);
  const prevStart = new Date(prevEnd.getTime() - 27 * D);
  return { end, curStart, prevEnd, prevStart };
}

export async function siteQueries(limit = 40) {
  const w = windows();
  const q = (s: Date, e: Date) => gscRows({ startDate: isoDate(s), endDate: isoDate(e), dimensions: ["query"] }, { maxPages: 2, revalidate: 3600 });
  const [cur, prev] = await Promise.all([q(w.curStart, w.end), q(w.prevStart, w.prevEnd)]);
  const C = toQ(cur.rows);
  const P = toQ(prev.rows);
  const all = Array.from(C.values());
  return {
    periodo: `${isoDate(w.curStart)} → ${isoDate(w.end)} contro i 28 giorni prima`,
    ricerche_diverse: all.length,
    click: all.reduce((s, x) => s + x.clicks, 0),
    top_per_click: [...all].sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions).slice(0, limit),
    nuove: all.filter((x) => !P.has(x.query) && x.impressions >= 10).sort((a, b) => b.impressions - a.impressions).slice(0, 20),
    sparite: Array.from(P.values()).filter((x) => !C.has(x.query) && x.impressions >= 15).sort((a, b) => b.impressions - a.impressions).slice(0, 20),
    senza_click: all.filter((x) => x.clicks === 0 && x.impressions >= 50).sort((a, b) => b.impressions - a.impressions).slice(0, 20),
    nota: cur.note ?? prev.note ?? null,
  };
}

export async function segments() {
  const w = windows();
  const q = (dim: string, s: Date, e: Date) => gscRows({ startDate: isoDate(s), endDate: isoDate(e), dimensions: [dim] }, { maxPages: 1, revalidate: 3600 });
  const [dc, dp, cc, cp, cmp, { articles }] = await Promise.all([
    q("device", w.curStart, w.end),
    q("device", w.prevStart, w.prevEnd),
    q("country", w.curStart, w.end),
    q("country", w.prevStart, w.prevEnd),
    getComparison(),
    loadArticles(),
  ]);
  const agg = (cur: GscRow[], prev: GscRow[], top = 12) => {
    const p = new Map(prev.map((r) => [r.keys[0], r]));
    return [...cur]
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, top)
      .map((r) => ({ nome: r.keys[0], click: r.clicks, impressioni: r.impressions, click_periodo_prima: p.get(r.keys[0])?.clicks ?? 0 }));
  };
  const cat = new Map(articles.map((a) => [normUrl(a.url), a.category || "Senza categoria"]));
  const perCat = new Map<string, { click: number; click_prima: number; impressioni: number }>();
  cmp.byUrl.forEach((v, key) => {
    const c = cat.get(key);
    if (!c) return;
    const e = perCat.get(c) ?? { click: 0, click_prima: 0, impressioni: 0 };
    e.click += v.cur.clicks;
    e.click_prima += v.prev.clicks;
    e.impressioni += v.cur.impressions;
    perCat.set(c, e);
  });
  return {
    periodo: cmp.curLabel,
    dispositivi: agg(dc.rows, dp.rows),
    paesi: agg(cc.rows, cp.rows),
    categorie: Array.from(perCat.entries()).map(([nome, v]) => ({ nome, ...v })).sort((a, b) => b.click - a.click),
  };
}

const day = (iso: string) => Math.floor(Date.parse(iso.slice(0, 10)) / D);
function avg(h: HistoryDay[], from: number, to: number, k: "clicks" | "impressions") {
  const len = to - from + 1;
  if (len <= 0) return 0;
  let s = 0;
  for (const r of h) {
    const d = day(r.date);
    if (d >= from && d <= to) s += r[k];
  }
  return s / len;
}

export async function revisionImpact() {
  const [{ articles, demo }, info] = await Promise.all([loadArticles(), historyInfo()]);
  if (demo || !info?.last) return { errore: "Servono WordPress e lo storico di Search Console su Supabase" };
  const last = day(info.last);
  const cand = articles
    .filter((a) => a.status === "publish")
    .map((a) => {
      const rev = a.reviewedAt ? { d: a.reviewedAt, fonte: "revisione segnata" } : null;
      const mod = a.touched && day(a.touched) - day(a.date) >= 7 ? { d: a.touched, fonte: "modifica su WordPress" } : null;
      const ev = rev ?? mod;
      return ev ? { a, ev: day(ev.d), iso: ev.d.slice(0, 10), fonte: ev.fonte } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null && last - x.ev >= 14 && x.ev - day(x.a.date) >= 7 && daysSince(x.a.date) > 0)
    .sort((x, y) => y.ev - x.ev)
    .slice(0, 40);
  const hist: HistoryDay[][] = [];
  for (let i = 0; i < cand.length; i += 8) hist.push(...(await Promise.all(cand.slice(i, i + 8).map((c) => getPageHistory(c.a.url)))));
  const righe = cand.map((c, i) => {
    const end = Math.min(c.ev + 28, last);
    const before = avg(hist[i], c.ev - 28, c.ev - 1, "clicks");
    const after = avg(hist[i], c.ev + 1, end, "clicks");
    const giorni = end - c.ev;
    const poco = before * 28 < 5 && after * giorni < 5;
    return {
      id: c.a.id,
      titolo: c.a.title,
      intervento: c.iso,
      fonte: c.fonte,
      giorni_dopo: giorni,
      click_al_giorno_prima: Math.round(before * 10) / 10,
      click_al_giorno_dopo: Math.round(after * 10) / 10,
      variazione_percento: poco ? null : Math.round((before > 0 ? (after - before) / before : after > 0 ? 1 : 0) * 100),
    };
  });
  return { dati_fino_al: info.last, nota: "Indizio, non prova: non tiene conto di stagionalità e aggiornamenti di Google.", articoli: righe.filter((r) => r.giorni_dopo >= 14) };
}
