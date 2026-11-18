import { timingSafeEqual } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { controlloIndicizzazione, controlloLink, controlloSeoBase } from "@/lib/monitor";
import { esc, sendTelegram, telegramConfigured } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

function authorized(req: NextRequest, secret: string): boolean {
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return given.length === want.length && timingSafeEqual(given, want);
}

/**
 * Ogni giorno: robots.txt e sitemap, articoli nuovi non indicizzati, link rotti (un blocco di articoli a rotazione).
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
  const [seo, indic, link] = await Promise.all([
    run("seo", () => controlloSeoBase(base)),
    run("indicizzazione", controlloIndicizzazione),
    run("link", controlloLink),
  ]);
  const avvisi = [...seo, ...indic, ...link];
  let telegram = "non inviato";
  if (avvisi.length && telegramConfigured() && req.nextUrl.searchParams.get("dry") !== "1") {
    const r = await sendTelegram(["🔍 <b>Controlli Cosmonet</b>", ...avvisi.map(esc)].join("\n"));
    telegram = r.ok ? "inviato" : r.message;
  }
  return NextResponse.json({ ok: errori.length === 0, errori, telegram, avvisi });
}
