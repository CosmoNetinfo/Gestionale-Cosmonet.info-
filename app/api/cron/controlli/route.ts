import { timingSafeEqual } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import {
  controlloCampione,
  controlloDominio,
  controlloHome,
  controlloIndicizzazione,
  controlloLink,
  controlloMonitorAttivo,
  controlloPlugin,
  controlloPubblicazione,
  controlloSeoBase,
  saveRows,
} from "@/lib/monitor";
import { esc, sendTelegram, telegramConfigured } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function authorized(req: NextRequest, secret: string): boolean {
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return given.length === want.length && timingSafeEqual(given, want);
}

/**
 * Ogni giorno: robots.txt e sitemap, home, campione di pagine, indicizzazione, link rotti (a rotazione), pubblicazione,
 * plugin da aggiornare, scadenza del dominio e stato del monitor. Salva il risultato per la pagina Stato 360.
 * Avvisa su Telegram solo se trova qualcosa. Prova senza inviare: ?dry=1
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return new NextResponse("Not found", { status: 404 });
  if (!authorized(req, secret)) return new NextResponse("Unauthorized", { status: 401 });

  const base = process.env.WP_BASE_URL?.replace(/\/$/, "") ?? "https://www.cosmonet.info";
  const errori: string[] = [];
  const run = async (nome: string, fn: () => Promise<string[]>) => {
    try {
      return await fn();
    } catch (e) {
      errori.push(`${nome}: ${(e as Error).message}`);
      return [];
    }
  };
  const gruppi = await Promise.all([
    run("seo", () => controlloSeoBase(base)),
    run("home", () => controlloHome(base)),
    run("campione", () => controlloCampione(base)),
    run("indicizzazione", controlloIndicizzazione),
    run("link", controlloLink),
    run("pubblicazione", controlloPubblicazione),
    run("plugin", controlloPlugin),
    run("dominio", () => controlloDominio(base)),
    run("monitor", controlloMonitorAttivo),
  ]);
  const avvisi = gruppi.flat();
  const dry = req.nextUrl.searchParams.get("dry") === "1";
  if (!dry) {
    await saveRows([
      { taken_at: new Date().toISOString(), kind: "controlli", url: base + "/", score: avvisi.length, lcp: null, fcp: null, cls: null, tbt: null, http_status: null, ttfb_ms: null, cert_days: null, errore: avvisi.length ? avvisi.join("\n").slice(0, 4000) : null },
    ]).catch(() => null);
  }
  let telegram = "non inviato";
  if (avvisi.length && telegramConfigured() && !dry) {
    const r = await sendTelegram(["🔍 <b>Controlli Cosmonet</b>", ...avvisi.map(esc)].join("\n"));
    telegram = r.ok ? "inviato" : r.message;
  }
  return NextResponse.json({ ok: errori.length === 0, errori, telegram, avvisi });
}
