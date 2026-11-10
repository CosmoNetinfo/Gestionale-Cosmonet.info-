import { timingSafeEqual } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { loadArticles } from "@/lib/articles";
import { runDiagnostics } from "@/lib/diagnostics";
import { getComparison, getGscDaily, gscEndDate, gscRows, isoDate, normUrl } from "@/lib/gsc";
import { daysSince, isToReview } from "@/lib/review";
import { esc, sendTelegram, telegramConfigured } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: NextRequest, secret: string): boolean {
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return given.length === want.length && timingSafeEqual(given, want);
}

const n = (v: number) => v.toLocaleString("it-IT");
const pct = (cur: number, prev: number) => (prev ? `${cur >= prev ? "+" : ""}${Math.round(((cur - prev) / prev) * 100)}%` : "—");

async function weekly(): Promise<string> {
  const [{ articles }, daily, cmp] = await Promise.all([loadArticles(), getGscDaily(), getComparison()]);
  const d = daily.days;
  const cur = d.slice(-7);
  const prev = d.slice(-14, -7);
  const sum = (a: typeof d, k: "clicks" | "impressions") => a.reduce((s, x) => s + x[k], 0);
  const meta = new Map(articles.map((a) => [normUrl(a.url), a]));
  const all = Array.from(cmp.byUrl.entries())
    .map(([key, v]) => ({ key, ...v }))
    .filter((x) => meta.has(x.key));
  const cali = all
    .filter((x) => x.prev.clicks >= 10 && x.cur.clicks <= x.prev.clicks * 0.7)
    .sort((a, b) => b.prev.clicks - b.cur.clicks - (a.prev.clicks - a.cur.clicks))
    .slice(0, 5);
  const saliti = all
    .filter((x) => x.cur.clicks - x.prev.clicks >= 10 && x.cur.clicks >= x.prev.clicks * 1.5)
    .sort((a, b) => b.cur.clicks - b.prev.clicks - (a.cur.clicks - a.prev.clicks))
    .slice(0, 3);
  const nuovi = articles.filter((a) => a.status === "publish" && daysSince(a.date) <= 7).length;
  const programmati = articles.filter((a) => a.status === "future").length;
  const daRivedere = articles.filter(isToReview).length;

  const L = [
    "📊 <b>Riepilogo settimanale Cosmonet</b>",
    "",
    `Click: <b>${n(sum(cur, "clicks"))}</b> (${pct(sum(cur, "clicks"), sum(prev, "clicks"))})`,
    `Impressioni: <b>${n(sum(cur, "impressions"))}</b> (${pct(sum(cur, "impressions"), sum(prev, "impressions"))})`,
    `Nuovi articoli: ${nuovi} · programmati: ${programmati} · da rivedere: <b>${daRivedere}</b>`,
  ];
  if (cali.length) {
    L.push("", "🔻 <b>In calo</b> (28 giorni)");
    for (const x of cali) L.push(`• ${esc(meta.get(x.key)!.title)}: ${x.prev.clicks} → ${x.cur.clicks} click`);
  }
  if (saliti.length) {
    L.push("", "🔺 <b>In crescita</b>");
    for (const x of saliti) L.push(`• ${esc(meta.get(x.key)!.title)}: ${x.prev.clicks} → ${x.cur.clicks} click`);
  }
  return L.join("\n");
}

/**
 * Cali improvvisi: confronta gli ultimi 7 giorni con i 7 prima, oggi e ieri.
 * Segnala solo gli articoli che oggi superano la soglia e ieri no, così l'avviso non si ripete ogni giorno.
 */
async function anomalie(): Promise<string | null> {
  const D = 86400000;
  const end = gscEndDate();
  const win = async (shift: number) => {
    const e = new Date(end.getTime() - shift * D);
    const curS = new Date(e.getTime() - 6 * D);
    const prevE = new Date(curS.getTime() - D);
    const prevS = new Date(prevE.getTime() - 6 * D);
    const q = (s: Date, x: Date) => gscRows({ startDate: isoDate(s), endDate: isoDate(x), dimensions: ["page"] }, { maxPages: 2 });
    const [c, p] = await Promise.all([q(curS, e), q(prevS, prevE)]);
    const m = new Map<string, { cur: number; prev: number }>();
    for (const r of c.rows) m.set(normUrl(r.keys[0]), { cur: r.clicks, prev: 0 });
    for (const r of p.rows) {
      const k = normUrl(r.keys[0]);
      m.set(k, { cur: m.get(k)?.cur ?? 0, prev: r.clicks });
    }
    return m;
  };
  const [oggi, ieri, { articles }] = await Promise.all([win(0), win(1), loadArticles()]);
  const meta = new Map(articles.map((a) => [normUrl(a.url), a]));
  const cade = (v?: { cur: number; prev: number }) => !!v && v.prev >= 15 && v.cur <= v.prev * 0.4;
  const nuovi = Array.from(oggi.entries())
    .filter(([k, v]) => cade(v) && !cade(ieri.get(k)) && meta.has(k))
    .sort((a, b) => b[1].prev - b[1].cur - (a[1].prev - a[1].cur))
    .slice(0, 6);
  if (!nuovi.length) return null;
  return [
    "🚨 <b>Calo improvviso di click</b> (ultimi 7 giorni contro i 7 prima)",
    ...nuovi.map(([k, v]) => `• ${esc(meta.get(k)!.title)}: ${v.prev} → ${v.cur} click`),
    "",
    "Controlla se Google ha cambiato la posizione o se l'articolo ha un problema.",
  ].join("\n");
}

/**
 * Chiamato ogni giorno da Vercel (vercel.json) con Authorization: Bearer CRON_SECRET.
 * Lunedì: riepilogo settimanale. Ogni giorno: avviso solo se il Debug trova problemi.
 * Avviso ogni giorno anche per i cali improvvisi di click. Prova manuale: ?force=weekly, ?force=anomalie oppure ?force=debug.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return new NextResponse("Not found", { status: 404 });
  if (!authorized(req, secret)) return new NextResponse("Unauthorized", { status: 401 });
  if (!telegramConfigured()) return NextResponse.json({ ok: false, error: "Telegram non configurato" }, { status: 400 });

  const force = req.nextUrl.searchParams.get("force");
  const sent: string[] = [];
  const errors: string[] = [];

  if (force === "weekly" || (!force && new Date().getUTCDay() === 1)) {
    const r = await sendTelegram(await weekly());
    (r.ok ? sent : errors).push(r.ok ? "settimanale" : r.message);
  }
  if (force === "anomalie" || !force) {
    try {
      const text = await anomalie();
      if (text) {
        const r = await sendTelegram(text);
        (r.ok ? sent : errors).push(r.ok ? "anomalie" : r.message);
      }
    } catch (e) {
      errors.push("anomalie: " + (e as Error).message);
    }
  }
  if (force !== "weekly" && force !== "anomalie") {
    const diag = await runDiagnostics({ origin: null, full: false });
    const bad = diag.checks.filter((c) => c.esito === "fail");
    if (bad.length) {
      const text = ["⚠️ <b>Cosmo Control: ci sono problemi</b>", ...bad.slice(0, 8).map((c) => `• ${esc(c.gruppo)} · ${esc(c.nome)}: ${esc(c.dettaglio)}`)].join("\n");
      const r = await sendTelegram(text);
      (r.ok ? sent : errors).push(r.ok ? "problemi" : r.message);
    }
  }
  return NextResponse.json({ ok: errors.length === 0, inviati: sent, errori: errors });
}
