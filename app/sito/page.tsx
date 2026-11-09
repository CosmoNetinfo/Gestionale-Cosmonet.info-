import type React from "react";
import Link from "next/link";
import { loadArticles } from "@/lib/articles";
import { supabaseConfigured } from "@/lib/supabase";
import { segnaRivisto } from "./actions";
import { getGscStats, normUrl } from "@/lib/gsc";
import { daysSince, daysSinceTouched, isToReview, reviewDays } from "@/lib/review";
import { STATO_LABEL, type Stato } from "@/lib/types";
import { Badge, Card, DemoBanner, PageHeader } from "@/components/ui";

const FILTRI: { key: string; label: string }[] = [
  { key: "tutti", label: "Tutti" },
  { key: "publish", label: "Pubblicati" },
  { key: "future", label: "Programmati" },
  { key: "draft", label: "Bozze" },
  { key: "pending", label: "In revisione" },
  { key: "trash", label: "Cestinati" },
  { key: "rivedere", label: "Da rivedere" },
];

const statoTone: Record<Stato, "ok" | "info" | "neutral" | "warn" | "danger"> = {
  publish: "ok",
  future: "info",
  draft: "neutral",
  pending: "warn",
  trash: "danger",
};

export default async function Sito({
  searchParams,
}: {
  searchParams: { stato?: string; q?: string; sort?: string; dir?: string };
}) {
  const [{ articles, demo, note }, gsc] = await Promise.all([loadArticles(), getGscStats()]);
  const filtro = searchParams.stato ?? "publish";
  const q = (searchParams.q ?? "").trim().toLowerCase();

  const counts: Record<string, number> = {
    tutti: articles.length,
    rivedere: articles.filter(isToReview).length,
  };
  for (const a of articles) counts[a.status] = (counts[a.status] ?? 0) + 1;

  let rows = articles;
  if (filtro === "rivedere") rows = rows.filter(isToReview);
  else if (filtro !== "tutti") rows = rows.filter((a) => a.status === filtro);
  if (q) {
    rows = rows.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        String(a.id) === q ||
        a.category.toLowerCase().includes(q),
    );
  }
  const stats = (a: (typeof articles)[number]) =>
    gsc.configured ? gsc.byUrl.get(normUrl(a.url)) : undefined;
  // Potenziale: impressioni che non sono diventate click. Più alto = più vale la pena rivedere.
  // Se l'articolo è in posizione 5-20 (vicino alla prima pagina) conta di più.
  const potenziale = (a: (typeof articles)[number]) => {
    const g = stats(a);
    if (!g) return 0;
    const boost = g.position >= 5 && g.position <= 20 ? 1.5 : 1;
    return Math.round(g.impressions * (1 - g.ctr) * boost);
  };
  const sort = searchParams.sort ?? (filtro === "rivedere" ? "prio" : "date");
  const dir = searchParams.dir === "asc" ? "asc" : "desc";
  const keyOf: Record<string, (a: (typeof articles)[number]) => number> = {
    date: (a) => new Date(a.date).getTime(),
    days: (a) => new Date(a.date).getTime(),
    id: (a) => a.id,
    click: (a) => stats(a)?.clicks ?? -1,
    impr: (a) => stats(a)?.impressions ?? -1,
    ctr: (a) => stats(a)?.ctr ?? -1,
    pos: (a) => stats(a)?.position ?? 9999,
    prio: potenziale,
  };
  const key = keyOf[sort] ?? keyOf.date;
  // "Giorni" è l'inverso della data
  const mult = (dir === "desc" ? 1 : -1) * (sort === "days" ? -1 : 1);
  rows = [...rows].sort((a, b) => (key(b) - key(a)) * mult);

  const sortHref = (k: string) => {
    const nextDir = sort === k && dir === "desc" ? "asc" : "desc";
    return `/sito?stato=${filtro}${q ? `&q=${encodeURIComponent(q)}` : ""}&sort=${k}&dir=${nextDir}`;
  };
  const Th = ({ k, children, right }: { k: string; children: React.ReactNode; right?: boolean }) => (
    <th className={"px-4 py-3 font-medium " + (right ? "text-right" : "")}>
      <Link href={sortHref(k)} className="hover:text-ink">
        {children}
        {sort === k ? (dir === "desc" ? " ↓" : " ↑") : ""}
      </Link>
    </th>
  );

  return (
    <>
      <PageHeader
        title="Sito"
        subtitle="Tutti gli articoli di Cosmonet.info"
      />

      {demo && note && <DemoBanner reason={note} />}
      {!gsc.configured && gsc.note && <DemoBanner title="Attenzione." reason={gsc.note} />}

      <div className="mb-4 flex items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {FILTRI.map((f) => (
            <Link
              key={f.key}
              href={`/sito?stato=${f.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              className={
                "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors " +
                (filtro === f.key
                  ? "border-primary bg-primary text-white"
                  : "border-line bg-surface text-muted hover:text-ink")
              }
            >
              {f.label}{" "}
              <span className={filtro === f.key ? "text-white/80" : "text-muted"}>
                {counts[f.key] ?? 0}
              </span>
            </Link>
          ))}
        </div>

        <form action="/sito" className="flex gap-2">
          <input type="hidden" name="stato" value={filtro} />
          <input type="hidden" name="sort" value={sort} />
          <input type="hidden" name="dir" value={dir} />
          <input
            name="q"
            defaultValue={q}
            placeholder="Cerca titolo, ID o categoria"
            className="w-72 rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </form>
      </div>

      <Card className="overflow-hidden p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-canvas text-xs uppercase tracking-wide text-muted">
            <tr>
              <Th k="id">ID</Th>
              <th className="px-4 py-3 font-medium">Titolo</th>
              <th className="px-4 py-3 font-medium">Categoria</th>
              <Th k="date">Data</Th>
              <Th k="days">Giorni</Th>
              <th className="px-4 py-3 font-medium">Stato</th>
              <th className="px-4 py-3 font-medium">Revisione</th>
              <Th k="click" right>Click</Th>
              <Th k="impr" right>Impr.</Th>
              <Th k="ctr" right>CTR</Th>
              <Th k="pos" right>Pos.</Th>
              <Th k="prio" right>Potenziale</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.length === 0 && (
              <tr>
                <td colSpan={12} className="px-4 py-10 text-center text-muted">
                  Nessun articolo con questo filtro.
                </td>
              </tr>
            )}
            {rows.map((a) => (
              <tr key={a.id} className="hover:bg-canvas/60">
                <td className="px-4 py-3 text-muted">{a.id}</td>
                <td className="max-w-md px-4 py-3">
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noreferrer"
                    className="line-clamp-1 font-medium hover:text-primary"
                  >
                    {a.title}
                  </a>
                </td>
                <td className="px-4 py-3 text-muted">{a.category}</td>
                <td className="whitespace-nowrap px-4 py-3 text-muted">
                  {new Date(a.date).toLocaleDateString("it-IT")}
                </td>
                <td className="px-4 py-3 text-muted">
                  {a.status === "future" ? "—" : daysSince(a.date)}
                </td>
                <td className="px-4 py-3">
                  <Badge tone={statoTone[a.status]}>{STATO_LABEL[a.status]}</Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {isToReview(a) ? (
                      <Badge tone="warn">Da rivedere · {daysSinceTouched(a)} g</Badge>
                    ) : a.reviewedAt ? (
                      <Badge tone="ok">Rivisto il {new Date(a.reviewedAt).toLocaleDateString("it-IT")}</Badge>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                    {isToReview(a) && supabaseConfigured() && (
                      <form action={segnaRivisto}>
                        <input type="hidden" name="id" value={a.id} />
                        <button
                          type="submit"
                          title="Segna come rivisto oggi"
                          className="whitespace-nowrap rounded-md border border-line px-2 py-0.5 text-xs text-muted hover:border-primary hover:text-primary"
                        >
                          ✓ Rivisto
                        </button>
                      </form>
                    )}
                  </div>
                </td>
                {(() => {
                  const g = gsc.configured ? gsc.byUrl.get(normUrl(a.url)) : undefined;
                  const dash = <span className="text-muted">—</span>;
                  const zero = gsc.configured && a.status === "publish";
                  return (
                    <>
                      <td className="px-4 py-3 text-right">{g ? g.clicks : zero ? 0 : dash}</td>
                      <td className="px-4 py-3 text-right">{g ? g.impressions : zero ? 0 : dash}</td>
                      <td className="px-4 py-3 text-right text-muted">
                        {g ? (g.ctr * 100).toFixed(1).replace(".", ",") + "%" : dash}
                      </td>
                      <td className="px-4 py-3 text-right text-muted">
                        {g ? g.position.toFixed(1).replace(".", ",") : dash}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {potenziale(a) > 0 ? potenziale(a) : <span className="font-normal text-muted">—</span>}
                      </td>
                    </>
                  );
                })()}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <p className="mt-4 text-xs text-muted">
        “Da rivedere”: articolo pubblicato non toccato da più di {reviewDays()} giorni
        (si conta dalla data più recente tra pubblicazione, ultima modifica vera e revisione segnata qui; le modifiche in blocco su più di 20 articoli nello stesso giorno vengono ignorate).
        Click, impressioni, CTR e posizione: ultimi {gsc.days} giorni da Search Console (dati con 2-3 giorni di ritardo).
        Potenziale: impressioni non diventate click, ×1,5 se l&apos;articolo è in posizione 5-20. Più è alto, più conviene rivederlo. Clicca sulle intestazioni per ordinare.
      </p>
    </>
  );
}
