import { NextResponse, type NextRequest } from "next/server";
import { scanBatch } from "@/lib/linkcheck";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Un blocco di 25 articoli per volta; la pagina Link e immagini li chiama uno dopo l'altro. Protetta dalla password dell'app. */
export async function GET(req: NextRequest) {
  const p = Math.max(1, Number(req.nextUrl.searchParams.get("p")) || 1);
  try {
    return NextResponse.json(await scanBatch(p));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
