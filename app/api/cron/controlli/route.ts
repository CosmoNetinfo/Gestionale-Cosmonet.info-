import { timingSafeEqual } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { eseguiControlli } from "@/lib/controlli";

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
  return NextResponse.json(await eseguiControlli({ dry: req.nextUrl.searchParams.get("dry") === "1" }));
}
