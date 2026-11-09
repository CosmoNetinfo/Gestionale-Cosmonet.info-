import { timingSafeEqual } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { gscEndDate, gscRows, isoDate, normUrl } from "@/lib/gsc";
import { saveSnapshot } from "@/lib/history";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(req: NextRequest, secret: string): boolean {
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return given.length === want.length && timingSafeEqual(given, want);
}

/**
 * Salva su Supabase i dati di Search Console per pagina e per giorno.
 * Vercel lo chiama ogni giorno (vercel.json) con Authorization: Bearer CRON_SECRET.
 * Parametri facoltativi per recuperare il passato: ?days=N (ultimi N giorni, max 480)
 * oppure ?from=AAAA-MM-GG&to=AAAA-MM-GG. Di default: ultimi 7 giorni (Google rivede i dati recenti).
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return new NextResponse("Not found", { status: 404 });
  if (!authorized(req, secret)) return new NextResponse("Unauthorized", { status: 401 });

  const p = req.nextUrl.searchParams;
  const end = gscEndDate();
  let startDate: string;
  let endDate = isoDate(end);
  const from = p.get("from");
  const to = p.get("to");
  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) {
    startDate = from;
    if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) endDate = to;
  } else {
    const days = Math.min(Math.max(Number(p.get("days")) || 7, 1), 480);
    startDate = isoDate(new Date(end.getTime() - (days - 1) * 86400000));
  }

  const { rows, note } = await gscRows(
    { startDate, endDate, dimensions: ["date", "page"] },
    { maxPages: 40 },
  );
  if (note && rows.length === 0) return NextResponse.json({ ok: false, error: note }, { status: 502 });

  // Più URL possono coincidere dopo la normalizzazione: sommo
  const merged = new Map<string, { date: string; page: string; clicks: number; impressions: number; pos: number }>();
  for (const r of rows) {
    const page = normUrl(r.keys[1]);
    const k = `${r.keys[0]}|${page}`;
    const e = merged.get(k);
    if (e) {
      const imp = e.impressions + r.impressions;
      e.pos = imp ? (e.pos * e.impressions + r.position * r.impressions) / imp : e.pos;
      e.clicks += r.clicks;
      e.impressions = imp;
    } else {
      merged.set(k, { date: r.keys[0], page, clicks: r.clicks, impressions: r.impressions, pos: r.position });
    }
  }
  try {
    const saved = await saveSnapshot(
      Array.from(merged.values()).map((m) => ({
        date: m.date,
        page: m.page,
        clicks: m.clicks,
        impressions: m.impressions,
        position: Math.round(m.pos * 10) / 10,
      })),
    );
    return NextResponse.json({ ok: true, from: startDate, to: endDate, righe: saved, partial: Boolean(note) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
