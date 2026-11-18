import { timingSafeEqual } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { articoliTop, avvisi, checkSpeed, checkUptime, saveRows, type MonitorRow } from "@/lib/monitor";
import { sendTelegram, telegramConfigured } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const maxDuration = 150;

function authorized(req: NextRequest, secret: string): boolean {
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return given.length === want.length && timingSafeEqual(given, want);
}

/**
 * Ogni giorno misura disponibilità e velocità (mobile e desktop) della home, salva lo storico
 * su Supabase e, se qualcosa peggiora, avvisa su Telegram. Prova senza salvare: ?dry=1
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return new NextResponse("Not found", { status: 404 });
  if (!authorized(req, secret)) return new NextResponse("Unauthorized", { status: 401 });

  const home = (process.env.WP_BASE_URL?.replace(/\/$/, "") ?? "https://www.cosmonet.info") + "/";
  const withSpeed = Boolean(process.env.PAGESPEED_API_KEY?.trim());
  const top = withSpeed ? await articoliTop(3).catch(() => [] as string[]) : [];
  const rows: MonitorRow[] = await Promise.all([
    checkUptime(home),
    ...(withSpeed ? [checkSpeed(home, "mobile"), checkSpeed(home, "desktop")] : []),
    ...top.map((u) => checkSpeed(u, "articolo")),
  ]);

  const dry = req.nextUrl.searchParams.get("dry") === "1";
  const salva = dry ? { ok: true as const, errore: undefined } : await saveRows(rows);
  const alerts = await avvisi(rows);
  let telegram = "non inviato";
  if (alerts.length && telegramConfigured() && !dry) {
    const r = await sendTelegram(["⚠️ <b>Monitor Cosmonet</b>", ...alerts].join("\n"));
    telegram = r.ok ? "inviato" : r.message;
  }
  return NextResponse.json({
    ok: salva.ok,
    errore: salva.errore,
    telegram,
    avvisi: alerts,
    misure: rows.map((r) => ({ kind: r.kind, url: r.url, score: r.score, lcp: r.lcp, tbt: r.tbt, http: r.http_status, ttfb_ms: r.ttfb_ms, cert_days: r.cert_days, errore: r.errore })),
  });
}
