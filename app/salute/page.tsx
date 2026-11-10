import Link from "next/link";
import { loadArticles } from "@/lib/articles";
import { getGscStats, normUrl } from "@/lib/gsc";
import { daysSince } from "@/lib/review";
import type { Article } from "@/lib/types";
import { Badge, Card, DemoBanner, Kpi, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

function Lista({ titolo, nota, items, tone }: { titolo: string; nota: string; items: { a: Article; info?: string }[]; tone: "warn" | "danger" | "neutral" }) {
  return (
    <Card className="mt-5">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-base font-semibold">{titolo}</h2>
        <Badge tone={items.length ? tone : "ok"}>{items.length ? items.length : "tutto a posto"}</Badge>
      </div>
      <p className="mb-3 text-xs text-muted">{nota}</p>
      {items.length > 0 && (
        <ul className="divide-y divide-line text-sm">
          {items.slice(0, 15).map(({ a, info }) => (
            <li key={a.id} className="flex items-center justify-between gap-4 py-2">
              <Link href={`/sito/${a.id}`} className="line-clamp-1 hover:text-primary">{a.title}</Link>
              {info && <span className="shrink-0 text-xs text-muted">{info}</span>}
            </li>
          ))}
          {items.length > 15 && <li className="py-2 text-xs text-muted">… e altri {items.length - 15}</li>}
        </ul>
      )}
    </Card>
  );
}

export default async function Salute() {
  const [{ articles, demo }, gsc] = await Promise.all([loadArticles(), getGscStats()]);
  const pub = articles.filter((a) => a.status === "publish");

  const lunghi = pub.filter((a) => a.title.length > 65).map((a) => ({ a, info: `${a.title.length} caratteri` }));
  const corti = pub.filter((a) => a.title.length < 25).map((a) => ({ a, info: `${a.title.length} caratteri` }));

  const perTitolo = new Map<string, Article[]>();
  for (const a of pub) {
    const k = a.title.trim().toLowerCase();
    perTitolo.set(k, [...(perTitolo.get(k) ?? []), a]);
  }
  const doppi = Array.from(perTitolo.values()).filter((l) => l.length > 1).flat().map((a) => ({ a, info: "titolo uguale ad altri" }));

  const senzaCat = pub
    .filter((a) => !a.category || /senza categoria|uncategorized/i.test(a.category))
    .map((a) => ({ a, info: a.category || "nessuna" }));

  const bozzeVecchie = articles
    .filter((a) => (a.status === "draft" || a.status === "pending") && daysSince(a.modified) > 30)
    .map((a) => ({ a, info: `ferma da ${daysSince(a.modified)} g` }));

  const invisibili = gsc.configured
    ? pub
        .filter((a) => daysSince(a.date) > 30)
        .map((a) => ({ a, imp: gsc.byUrl.get(normUrl(a.url))?.impressions ?? 0 }))
        .filter((x) => x.imp < 10)
        .sort((x, y) => x.imp - y.imp)
        .map(({ a, imp }) => ({ a, info: `${imp} impressioni in ${gsc.days} g · ${daysSince(a.date)} g dalla pubblicazione` }))
    : [];

  const problemi = lunghi.length + corti.length + doppi.length + senzaCat.length + bozzeVecchie.length + invisibili.length;

  return (
    <>
      <PageHeader title="Salute del sito" subtitle="Controlli automatici sugli articoli, per trovare cosa sistemare" />
      {demo && <DemoBanner reason="Collega WordPress per controllare gli articoli veri." />}
      {!gsc.configured && gsc.note && <DemoBanner title="Attenzione." reason={gsc.note} />}

      <div className="grid grid-cols-3 gap-5">
        <Kpi label="Articoli pubblicati" value={pub.length.toLocaleString("it-IT")} />
        <Kpi label="Segnalazioni" value={problemi} tone={problemi ? "warn" : "ok"} hint="somma dei controlli sotto" />
        <Kpi label="Quasi invisibili" value={invisibili.length} hint="oltre 30 giorni e meno di 10 impressioni" tone={invisibili.length ? "warn" : "ok"} />
      </div>

      <Lista tone="danger" titolo="Quasi invisibili su Google" nota="Pubblicati da più di 30 giorni ma con pochissime impressioni: controlla l'indicizzazione, il titolo e se vale la pena rivederli." items={invisibili} />
      <Lista tone="warn" titolo="Titoli troppo lunghi" nota="Oltre 65 caratteri: Google li taglia nei risultati (controlla anche il titolo SEO di Yoast)." items={lunghi} />
      <Lista tone="warn" titolo="Titoli troppo corti" nota="Sotto 25 caratteri: spesso poco descrittivi." items={corti} />
      <Lista tone="warn" titolo="Titoli uguali" nota="Due articoli con lo stesso titolo si fanno concorrenza." items={doppi} />
      <Lista tone="warn" titolo="Senza categoria" nota="Articoli senza una categoria vera." items={senzaCat} />
      <Lista tone="neutral" titolo="Bozze ferme" nota="Bozze o articoli in revisione non toccati da più di 30 giorni." items={bozzeVecchie} />
    </>
  );
}
