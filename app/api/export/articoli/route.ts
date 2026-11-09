import { NextResponse, type NextRequest } from "next/server";
import { loadArticles } from "@/lib/articles";
import { getGscStats, normUrl, opportunity } from "@/lib/gsc";
import { daysSince, daysSinceTouched, isToReview } from "@/lib/review";

export const dynamic = "force-dynamic";

const esc = (v: string | number) => {
  const s = String(v);
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Esporta gli articoli in CSV (separatore ";" per Excel italiano). ?stato=publish|draft|future|rivedere|tutti */
export async function GET(req: NextRequest) {
  const stato = req.nextUrl.searchParams.get("stato") ?? "publish";
  const [{ articles }, gsc] = await Promise.all([loadArticles(), getGscStats()]);
  let rows = articles;
  if (stato === "rivedere") rows = rows.filter(isToReview);
  else if (stato !== "tutti") rows = rows.filter((a) => a.status === stato);

  const head = ["ID", "Titolo", "Categoria", "Stato", "Data", "Giorni", "Da rivedere", "Click", "Impressioni", "CTR %", "Posizione", "Potenziale", "Indirizzo"];
  const lines = [head.join(";")];
  for (const a of rows.sort((x, y) => y.date.localeCompare(x.date))) {
    const g = gsc.configured ? gsc.byUrl.get(normUrl(a.url)) : undefined;
    lines.push(
      [
        a.id,
        a.title,
        a.category,
        a.status,
        a.date.slice(0, 10),
        daysSince(a.date),
        isToReview(a) ? `sì (${daysSinceTouched(a)} g)` : "no",
        g?.clicks ?? "",
        g?.impressions ?? "",
        g ? (g.ctr * 100).toFixed(1).replace(".", ",") : "",
        g ? g.position.toFixed(1).replace(".", ",") : "",
        g ? opportunity(g) : "",
        a.url,
      ]
        .map(esc)
        .join(";"),
    );
  }
  // BOM per far leggere bene gli accenti a Excel
  const body = "﻿" + lines.join("\r\n");
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="articoli-${stato}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
