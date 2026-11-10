import { NextResponse } from "next/server";
import { loadArticles } from "@/lib/articles";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Elenco leggero di articoli per la ricerca rapida (Cmd+K). Protetta dalla password dell'app. */
export async function GET() {
  const { articles } = await loadArticles();
  return NextResponse.json(
    articles.filter((a) => a.status !== "trash").map((a) => ({ id: a.id, t: a.title, c: a.category, s: a.status })),
    { headers: { "Cache-Control": "private, max-age=300" } },
  );
}
