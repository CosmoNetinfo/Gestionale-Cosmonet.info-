import { NextResponse, type NextRequest } from "next/server";
import { loadArticles } from "@/lib/articles";
import { getGscStats, normUrl, opportunity } from "@/lib/gsc";
import { daysSinceTouched, isToReview } from "@/lib/review";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Apre la scheda dell'articolo da rivedere con più potenziale (impressioni non diventate click). */
export async function GET(req: NextRequest) {
  const [{ articles }, gsc] = await Promise.all([loadArticles(), getGscStats()]);
  const pot = (id: string) => (gsc.configured ? opportunity(gsc.byUrl.get(normUrl(id))) : 0);
  const best = articles
    .filter(isToReview)
    .sort((a, b) => pot(b.url) - pot(a.url) || daysSinceTouched(b) - daysSinceTouched(a))[0];
  return NextResponse.redirect(new URL(best ? `/sito/${best.id}` : "/sito", req.url));
}
