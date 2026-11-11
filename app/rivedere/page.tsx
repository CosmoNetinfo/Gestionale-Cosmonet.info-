import Link from "next/link";
import { loadArticles } from "@/lib/articles";
import { supabaseConfigured } from "@/lib/supabase";
import { segnaRivisto } from "../sito/actions";
import { getGscStats, normUrl, opportunity } from "@/lib/gsc";
import { daysSince, daysSinceTouched, etaLeggibile, fasciaPerGiorni, isToReview, reviewDays, type Fascia } from "@/lib/review";
import { Badge, Card, DemoBanner, Kpi, PageHeader } from "@/components/ui";
import { CopyButton } from "@/components/CopyButton";

export const dynamic = "force-dynamic";

const FASCE: { key: "tutte" | Fascia; label: string }[] = [
  { key: "tutte", label: "Tutte" },
  { key: "critico", label: "Critici" },
  { key: "urgente", label: "Urgenti" },
  { key: "controllare", label: "Da controllare" },
];

const ORDINI: { key: string; label: string }[] = [
  { key: "prio", label: "Priorità" },
  { key: "giorni", label: "Più vecchi" },
  { key: "pot", label: "Potenziale" },
  { key: "click", label: "Click" },
];

export default async function Rivedere({
  searchParams,
}: {
  searchParams: { fascia?: string; cat?: string; sort?: string; q?: string };
}) {
  const [{ articles, demo, note }, gsc] = await Promise.all([loadArticles(), getGscStats()]);
  const soglia = reviewDays();
  const fascia = FASCE.some((f) => f.key === searchParams.fascia) ? (searchParams.fascia as string) : "tutte";
  const cat = searchParams.cat ?? "";
  const sort = ORDINI.some((o) => o.key === searchParams.sort) ? (searchParams.sort as string) : "prio";
  const q = (searchParams.q ?? "").trim().toLowerCase();

  const stats = (a: (typeof articles)[number]) => (gsc.configured ? gsc.byUrl.get(normUrl(a.url)) : undefined);

  // Tutti quelli da rivedere, con i dati calcolati una volta sola
  const tutti = articles.filter(isToReview).map((a) => {
    const giorni = daysSinceTouched(a);
    const g = stats(a);
    const pot = opportunity(g);
    return {
      a,
      giorni,
      g,
      pot,
      fascia: fasciaPerGiorni(giorni),
      // Priorità: potenziale in Search Console + peso dell'età oltre la soglia
      prio: pot + Math.max(0, giorni - soglia) * 3,
    };
  });

  const perFascia = (k: Fascia) => tutti.filter((r) => r.fascia.key === k).length;
  const potTotale = tutti.reduce((s, r) => s + r.pot, 0);
  const rivisti30 = articles.filter((a) => a.reviewedAt && daysSince(a.reviewedAt) <= 30).length;
  const pubblicati = articles.filter((a) => a.status === "publish").length;
  const categorie = Array.from(new Set(tutti.map((r) => r.a.category))).sort();

  let rows = tutti;
  if (fascia !== "tutte") rows = rows.filter((r) => r.fascia.key === fascia);
  if (cat) rows = rows.filter((r) => r.a.category === cat);
  if (q) rows = rows.filter((r) => r.a.title.toLowerCase().includes(q) || String(r.a.id) === q);
  const key: Record<string, (r: (typeof tutti)[number]) => number> = {
    prio: (r) => r.prio,
    giorni: (r) => r.giorni,
    pot: (r) => r.pot,
    click: (r) => r.g?.clicks ?? -1,
  };
  rows = [...rows].sort((x, y) => key[sort](y) - key[sort](x));

  const href = (over: Record<string, string>) => {
    const p = new URLSearchParams({ fascia, sort, ...(cat ? { cat } : {}), ...(q ? { q } : {}), ...over });
    for (const [k, v] of Array.from(p.entries())) if (!v || (k === "fascia" && v === "tutte")) p.delete(k);
    const s = p.toString();
    return "/rivedere" + (s ? "?" + s : "");
  };

  // Barra a fasce (larghezze proporzionali)
  const tot = Math.max(1, tutti.length);
  const barra: { key: Fascia; label: string; n: number; cls: string }[] = [
    { key: "controllare", label: `${soglia}–${soglia * 2} g`, n: perFascia("controllare"), cls: "bg-warn opacity-60" },
    { key: "urgente", label: `${soglia * 2}–${soglia * 4} g`, n: perFascia("urgente"), cls: "bg-warn" },
    { key: "critico", label: `oltre ${soglia * 4} g`, n: perFascia("critico"), cls: "bg-danger" },
  ];

  // Segnali leggibili a colpo d'occhio per ogni articolo
  const segnali = (r: (typeof tutti)[number]) => {
    const out: { t: string; tone: "danger" | "warn" | "info" }[] = [];
    if (!gsc.configured || !r.g) {
      out.push({ t: "Nessun dato Search Console", tone: "info" });
      return out;
    }
    if (r.g.clicks === 0 && r.g.impressions > 0) out.push({ t: "Impressioni ma zero click", tone: "danger" });
    else if (r.g.impressions >= 200 && r.g.ctr < 0.01) out.push({ t: "CTR sotto l'1%", tone: "warn" });
    if (r.g.position >= 5 && r.g.position <= 20) out.push({ t: "Vicino alla prima pagina", tone: "info" });
    if (r.g.position > 20) out.push({ t: "Oltre la 2ª pagina", tone: "warn" });
    return out;
  };

  return (
    <>
      <PageHeader
        title="Da rivedere"
        subtitle={`Articoli pubblicati non toccati da più di ${soglia} giorni, in ordine di priorità`}
      />

      {demo && note && <DemoBanner reason={note} />}
      {!gsc.configured && gsc.note && <DemoBanner title="Attenzione." reason={gsc.note} />}

      <div className="grid grid-cols-4 gap-5">
        <Kpi
          label="Da rivedere"
          value={tutti.length}
          tone={tutti.length > 0 ? "warn" : "ok"}
          hint={`su ${pubblicati} pubblicati (${Math.round((tutti.length / Math.max(1, pubblicati)) * 100)}%)`}
        />
        <Kpi label="Critici" value={perFascia("critico")} tone={perFascia("critico") > 0 ? "danger" : "ok"} hint={`fermi da oltre ${soglia * 4} giorni`} />
        <Kpi label="Urgenti" value={perFascia("urgente")} tone={perFascia("urgente") > 0 ? "warn" : "ok"} hint={`fermi da ${soglia * 2} a ${soglia * 4} giorni`} />
        <Kpi label="Rivisti ultimi 30 giorni" value={rivisti30} tone="ok" hint="registrati con «✓ Rivisto»" />
      </div>

      <Card className="mt-5">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-base font-semibold">Quanto sono vecchi</h2>
          <span className="text-xs text-muted">
            Potenziale totale: {potTotale.toLocaleString("it-IT")} impressioni non diventate click
          </span>
        </div>
        <div className="flex h-7 w-full overflow-hidden rounded-lg bg-canvas" role="img"
          aria-label={`Articoli da rivedere per età: ${barra.map((b) => `${b.n} ${b.label}`).join(", ")}`}>
          {barra.map((b) =>
            b.n > 0 ? (
              <Link key={b.key} href={href({ fascia: b.key })} title={`${b.n} articoli · ${b.label}`}
                className={`flex items-center justify-center text-xs font-semibold text-white ${b.cls}`}
                style={{ width: `${(b.n / tot) * 100}%` }}>
                {b.n}
              </Link>
            ) : null,
          )}
        </div>
        <div className="mt-2 flex gap-5 text-xs text-muted">
          {barra.map((b) => (
            <span key={b.key} className="flex items-center gap-1.5">
              <span className={`inline-block h-2.5 w-2.5 rounded-sm ${b.cls}`} />
              {b.label}
            </span>
          ))}
        </div>
      </Card>

      <div className="mb-4 mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {FASCE.map((f) => (
            <Link key={f.key} href={href({ fascia: f.key })}
              className={"rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors " +
                (fascia === f.key ? "border-primary bg-primary text-white" : "border-line bg-surface text-muted hover:text-ink")}>
              {f.label}{" "}
              <span className={fascia === f.key ? "text-white/80" : "text-muted"}>
                {f.key === "tutte" ? tutti.length : perFascia(f.key)}
              </span>
            </Link>
          ))}
        </div>
        <form action="/rivedere" className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="fascia" value={fascia === "tutte" ? "" : fascia} />
          <select name="cat" defaultValue={cat} className="rounded-lg border border-line bg-surface px-3 py-2 text-sm">
            <option value="">Tutte le categorie</option>
            {categorie.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select name="sort" defaultValue={sort} className="rounded-lg border border-line bg-surface px-3 py-2 text-sm">
            {ORDINI.map((o) => (
              <option key={o.key} value={o.key}>Ordina: {o.label}</option>
            ))}
          </select>
          <input name="q" defaultValue={q} placeholder="Cerca titolo o ID"
            className="w-52 rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-primary" />
          <button type="submit" className="rounded-lg border border-line px-3 py-2 text-sm font-medium text-muted hover:border-primary hover:text-primary">
            Applica
          </button>
        </form>
      </div>

      {rows.length === 0 ? (
        <Card className="py-12 text-center text-sm text-muted">
          {tutti.length === 0 ? "Nessun articolo da rivedere. Bel lavoro!" : "Nessun articolo con questi filtri."}
        </Card>
      ) : (
        <ul className="grid gap-3">
          {rows.map((r, i) => (
            <li key={r.a.id}>
              <Card className="flex items-center gap-4 !p-4" >
                <span className="h-14 w-1.5 shrink-0 rounded-full" style={{ background: r.fascia.color }} aria-hidden />
                <div className="w-8 shrink-0 text-center text-sm font-semibold text-muted" title="Posizione in classifica">
                  {i + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <Link href={`/sito/${r.a.id}`} className="block truncate text-[15px] font-semibold hover:text-primary" title={r.a.title}>
                    {r.a.title}
                  </Link>
                  <div className="mt-0.5 text-xs text-muted">
                    ID {r.a.id} · {r.a.category} · pubblicato il {new Date(r.a.date).toLocaleDateString("it-IT")}
                    {r.a.reviewedAt && ` · già rivisto il ${new Date(r.a.reviewedAt).toLocaleDateString("it-IT")}`}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {segnali(r).map((s) => (
                      <Badge key={s.t} tone={s.tone === "info" ? "info" : s.tone}>{s.t}</Badge>
                    ))}
                  </div>
                </div>
                <div className="w-44 shrink-0 text-right">
                  <Badge tone={r.fascia.tone}>
                    {r.fascia.key === "critico" ? "⚠ " : ""}
                    {r.fascia.label}
                  </Badge>
                  <div className="mt-1 text-xs text-muted">non toccato da {etaLeggibile(r.giorni)}</div>
                </div>
                <div className="w-40 shrink-0 text-right text-xs text-muted">
                  {r.g ? (
                    <>
                      <div><strong className="text-ink">{r.g.clicks}</strong> click · {r.g.impressions.toLocaleString("it-IT")} impr.</div>
                      <div>CTR {(r.g.ctr * 100).toFixed(1).replace(".", ",")}% · pos. {r.g.position.toFixed(1).replace(".", ",")}</div>
                      <div>potenziale <strong className="text-ink">{r.pot.toLocaleString("it-IT")}</strong></div>
                    </>
                  ) : (
                    <div>—</div>
                  )}
                </div>
                <div className="flex shrink-0 flex-col gap-1.5">
                  <CopyButton text={r.a.url} label="🔗 Copia link" />
                  <a href={`https://www.cosmonet.info/wp-admin/post.php?post=${r.a.id}&action=edit`} target="_blank" rel="noreferrer"
                    className="whitespace-nowrap rounded-md border border-line px-2.5 py-1 text-center text-xs font-medium text-muted hover:border-primary hover:text-primary">
                    Modifica ↗
                  </a>
                  {supabaseConfigured() && (
                    <form action={segnaRivisto}>
                      <input type="hidden" name="id" value={r.a.id} />
                      <button type="submit" title="Segna come rivisto oggi"
                        className="w-full whitespace-nowrap rounded-md border border-line px-2.5 py-1 text-xs font-medium text-muted hover:border-primary hover:text-primary">
                        ✓ Rivisto
                      </button>
                    </form>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-4 text-xs text-muted">
        Fasce: «Da controllare» da {soglia} giorni, «Urgente» da {soglia * 2}, «Critico» da {soglia * 4}. I giorni contano dall&apos;ultimo intervento vero
        (pubblicazione, ultima modifica o «✓ Rivisto»; le modifiche in blocco su più di 50 articoli nello stesso giorno sono ignorate).
        Priorità = potenziale in Search Console (impressioni non diventate click, ×1,5 in posizione 5-20) + 3 punti per ogni giorno oltre la soglia.
        Dati Search Console degli ultimi {gsc.days} giorni, con 2-3 giorni di ritardo.
      </p>
    </>
  );
}
