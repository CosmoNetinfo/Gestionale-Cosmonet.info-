import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { loadArticles } from "@/lib/articles";
import { getArticleContent } from "@/lib/wordpress";
import { getGscStats, getPageQueries, normUrl, opportunity } from "@/lib/gsc";
import { daysSince, daysSinceTouched, isToReview, reviewDays } from "@/lib/review";
import { markReviewed, supabaseConfigured } from "@/lib/supabase";
import { runDiagnostics } from "@/lib/diagnostics";
import { revisionImpact, segments, siteQueries } from "@/lib/insights";
import { getNote, saveNote } from "@/lib/notes";
import { getNews, getQueue, queueUpsert } from "@/lib/news";
import { scanBatch } from "@/lib/linkcheck";
import { STATO_LABEL } from "@/lib/types";
import type { Article } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ---------- protezione: il token è nell'indirizzo ----------
function tokenOk(given: string): boolean {
  const expected = process.env.MCP_TOKEN;
  if (!expected || expected.length < 20) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// ---------- strumenti ----------
const pct = (x: number) => Math.round(x * 1000) / 10;

async function snapshot() {
  const [{ articles, demo, note }, gsc] = await Promise.all([loadArticles(), getGscStats()]);
  const row = (a: Article) => {
    const g = gsc.configured ? gsc.byUrl.get(normUrl(a.url)) : undefined;
    return {
      id: a.id,
      titolo: a.title,
      url: a.url,
      stato: STATO_LABEL[a.status],
      categoria: a.category,
      pubblicato: a.date.slice(0, 10),
      giorni_da_pubblicazione: daysSince(a.date),
      giorni_dall_ultimo_intervento: daysSinceTouched(a),
      da_rivedere: isToReview(a),
      rivisto_il: a.reviewedAt?.slice(0, 10) ?? null,
      click: g?.clicks ?? (gsc.configured && a.status === "publish" ? 0 : null),
      impressioni: g?.impressions ?? (gsc.configured && a.status === "publish" ? 0 : null),
      ctr_percento: g ? pct(g.ctr) : null,
      posizione: g ? Math.round(g.position * 10) / 10 : null,
      potenziale: opportunity(g),
    };
  };
  return { articles, rows: articles.map(row), demo, note, gsc };
}

type Row = Awaited<ReturnType<typeof snapshot>>["rows"][number];

const TOOLS = [
  {
    name: "get_overview",
    description:
      "Panoramica di Cosmonet.info: numero di articoli per stato, quanti sono da rivedere, totale click e impressioni degli ultimi 90 giorni.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "list_articles",
    description:
      "Elenco articoli con date, giorni, click, impressioni, CTR, posizione e potenziale. Filtri opzionali. Ordine predefinito: più recenti.",
    inputSchema: {
      type: "object",
      properties: {
        stato: { type: "string", enum: ["publish", "future", "draft", "pending", "trash"] },
        da_rivedere: { type: "boolean", description: "Solo articoli da rivedere" },
        cerca: { type: "string", description: "Testo nel titolo, nella categoria o ID" },
        ordina_per: {
          type: "string",
          enum: ["data", "click", "impressioni", "ctr", "posizione", "potenziale", "giorni"],
        },
        limite: { type: "number", description: "Quanti articoli (predefinito 30, massimo 200)" },
      },
    },
  },
  {
    name: "articles_to_review",
    description:
      "Gli articoli da rivedere più promettenti, ordinati per potenziale (impressioni non diventate click, più peso se in posizione 5-20). Attenzione: le ricerche del solo nome di un servizio gonfiano il numero, quindi controlla le ricerche con get_article.",
    inputSchema: { type: "object", properties: { limite: { type: "number", description: "Predefinito 15" } } },
  },
  {
    name: "get_article",
    description:
      "Tutto su un articolo dato l'ID WordPress: dati, statistiche Search Console, le ricerche reali che lo portano (query, impressioni, click, posizione) e il testo. Serve per la ricerca approfondita e per proporre aggiornamenti. Non modifica nulla.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "number", description: "ID articolo WordPress" },
        con_testo: { type: "boolean", description: "Includi il testo dell'articolo (predefinito sì)" },
      },
      required: ["id"],
    },
  },
  {
    name: "mark_reviewed",
    description:
      "Segna un articolo come rivisto oggi: esce dalla lista 'da rivedere' per i prossimi 90 giorni. Da usare solo quando Dany conferma che l'articolo è stato aggiornato. Non modifica WordPress.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "number", description: "ID articolo WordPress" } },
      required: ["id"],
    },
  },
  {
    name: "site_queries",
    description: "Ricerche di Google degli ultimi 28 giorni (come la pagina Ricerche): le prime per click, quelle nuove, quelle sparite rispetto ai 28 giorni prima e quelle con molte impressioni senza click.",
    inputSchema: { type: "object", properties: { limite: { type: "number", description: "Quante ricerche top (default 40)" } } },
  },
  {
    name: "segments",
    description: "Click e impressioni degli ultimi 28 giorni per dispositivo, paese e categoria (come la pagina Segmenti), con il confronto sui 28 giorni prima.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "revision_impact",
    description: "Impatto delle revisioni: per ogni articolo ritoccato, click al giorno nei 28 giorni dopo contro i 28 prima (come la pagina Impatto revisioni).",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_note",
    description: "Legge la nota che Dany ha scritto su un articolo nel gestionale.",
    inputSchema: { type: "object", properties: { id: { type: "number", description: "ID articolo WordPress" } }, required: ["id"] },
  },
  {
    name: "save_note",
    description: "Salva (sostituisce) la nota di un articolo nel gestionale. Testo vuoto = cancella la nota. Non modifica WordPress.",
    inputSchema: { type: "object", properties: { id: { type: "number" }, nota: { type: "string" } }, required: ["id", "nota"] },
  },
  {
    name: "scan_links",
    description: "Controlla link e immagini di un blocco di 25 articoli pubblicati (pagina 1 = i più recenti; il totale è nel risultato): link rotti interni/esterni, immagini senza alt, link http.",
    inputSchema: { type: "object", properties: { pagina: { type: "number", description: "Numero del blocco, da 1" } } },
  },
  {
    name: "news_fresh",
    description: "Notizie recenti dai feed RSS del catalogo (42 fonti), senza doppioni, con l'indicazione di quelle su cui Dany ha già un articolo. Serve a scegliere cosa scrivere.",
    inputSchema: { type: "object", properties: { ore: { type: "number", description: "Finestra in ore (default 24, max 168)" }, categoria: { type: "string", description: "tech-it, linux, ai, gaming, selfhosted, tech-en" }, includi_gia_scritte: { type: "boolean" } } },
  },
  {
    name: "news_queue",
    description: "La coda «Da scrivere» del gestionale: notizie che Dany ha scelto. Con stato=tutte include anche scritte e scartate.",
    inputSchema: { type: "object", properties: { stato: { type: "string", description: "da_scrivere (default), scritto, scartato, tutte" } } },
  },
  {
    name: "news_queue_update",
    description: "Aggiunge una notizia alla coda o ne cambia lo stato (da_scrivere, scritto, scartato). Usa «scritto» dopo aver scritto l'articolo. Non modifica WordPress.",
    inputSchema: { type: "object", properties: { url: { type: "string" }, titolo: { type: "string" }, stato: { type: "string" }, nota: { type: "string" } }, required: ["url", "titolo"] },
  },
  {
    name: "run_diagnostics",
    description:
      "Esegue il controllo Debug del gestionale (variabili, Supabase, Search Console, WordPress, sito, cron, MCP) e restituisce problemi e avvisi con la causa e come sistemarli. Con completo=true misura anche PageSpeed.",
    inputSchema: { type: "object", properties: { completo: { type: "boolean", description: "Include PageSpeed (più lento)" } } },
  },
];

const num = (v: unknown, def: number, max: number) =>
  Math.max(1, Math.min(max, Number.isFinite(Number(v)) && v !== undefined ? Number(v) : def));

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case "get_overview": {
      const { articles, rows, demo, note, gsc } = await snapshot();
      const per: Record<string, number> = {};
      for (const a of articles) per[STATO_LABEL[a.status]] = (per[STATO_LABEL[a.status]] ?? 0) + 1;
      const pub = rows.filter((r) => r.stato === STATO_LABEL.publish);
      return {
        dati_dimostrativi: demo,
        avviso: note ?? (gsc.configured ? null : gsc.note),
        articoli_per_stato: per,
        da_rivedere: rows.filter((r) => r.da_rivedere).length,
        soglia_revisione_giorni: reviewDays(),
        search_console_ultimi_giorni: gsc.days,
        click_totali: pub.reduce((s, r) => s + (r.click ?? 0), 0),
        impressioni_totali: pub.reduce((s, r) => s + (r.impressioni ?? 0), 0),
        revisioni_salvabili: supabaseConfigured(),
      };
    }
    case "site_queries":
      return siteQueries(num(args.limite, 40, 100));
    case "segments":
      return segments();
    case "revision_impact":
      return revisionImpact();
    case "get_note": {
      const id = Number(args.id);
      if (!Number.isInteger(id) || id <= 0) throw new Error("id non valido");
      const r = await getNote(id);
      return r.missing ? { nota: null, non_disponibile: r.missing } : { nota: r.note?.note ?? null, aggiornata: r.note?.updated_at ?? null };
    }
    case "save_note": {
      const id = Number(args.id);
      if (!Number.isInteger(id) || id <= 0) throw new Error("id non valido");
      await saveNote(id, String(args.nota ?? ""));
      return { ok: true };
    }
    case "news_fresh": {
      const r = await getNews({ ore: num(args.ore, 24, 168), cat: typeof args.categoria === "string" ? args.categoria : undefined, perFeed: 6 });
      const lista = r.items.filter((n) => args.includi_gia_scritte === true || !n.simile);
      return {
        totale: r.items.length,
        mostrate: lista.length,
        fonti_senza_risposta: r.fontiVuote,
        notizie: lista.slice(0, 80).map((n) => ({ titolo: n.title, url: n.url, fonte: n.source, data: n.date, lingua: n.lang, categoria: n.cat, gia_scritta: n.simile ?? null, in_coda: n.inCoda ?? null, anteprima: n.snippet })),
      };
    }
    case "news_queue": {
      const q = await getQueue();
      const st = typeof args.stato === "string" ? args.stato : "da_scrivere";
      return q.missing ? { non_disponibile: q.missing } : { voci: q.items.filter((i) => st === "tutte" || i.stato === st) };
    }
    case "news_queue_update": {
      const stato = typeof args.stato === "string" ? args.stato : "da_scrivere";
      if (!["da_scrivere", "scritto", "scartato"].includes(stato)) throw new Error("stato non valido");
      await queueUpsert({ url: String(args.url), title: String(args.titolo), stato: stato as "da_scrivere", note: typeof args.nota === "string" ? args.nota : undefined });
      return { ok: true };
    }
    case "scan_links":
      return scanBatch(num(args.pagina, 1, 200));
    case "run_diagnostics": {
      const r = await runDiagnostics({ origin: null, full: args.completo === true });
      const all = r.checks.filter((c) => c.gruppo !== "Pagine dell'app");
      return {
        generato: r.generato,
        ok: all.filter((c) => c.esito === "ok").length,
        problemi: all.filter((c) => c.esito === "fail"),
        avvisi: all.filter((c) => c.esito === "warn"),
        nota: "Le pagine interne si controllano solo dalla pagina Debug (controllo completo).",
      };
    }
    case "list_articles": {
      const { rows } = await snapshot();
      let out: Row[] = rows;
      if (typeof args.stato === "string") out = out.filter((r) => r.stato === STATO_LABEL[args.stato as Article["status"]]);
      if (args.da_rivedere === true) out = out.filter((r) => r.da_rivedere);
      if (typeof args.cerca === "string" && args.cerca.trim()) {
        const q = args.cerca.trim().toLowerCase();
        out = out.filter((r) => r.titolo.toLowerCase().includes(q) || String(r.id) === q || r.categoria.toLowerCase().includes(q));
      }
      const keys: Record<string, (r: Row) => number> = {
        data: (r) => new Date(r.pubblicato).getTime(),
        giorni: (r) => -r.giorni_da_pubblicazione,
        click: (r) => r.click ?? -1,
        impressioni: (r) => r.impressioni ?? -1,
        ctr: (r) => r.ctr_percento ?? -1,
        posizione: (r) => -(r.posizione ?? 9999),
        potenziale: (r) => r.potenziale,
      };
      const k = keys[String(args.ordina_per ?? "data")] ?? keys.data;
      out = [...out].sort((a, b) => k(b) - k(a));
      return { totale_trovati: out.length, articoli: out.slice(0, num(args.limite, 30, 200)) };
    }
    case "articles_to_review": {
      const { rows } = await snapshot();
      const out = rows.filter((r) => r.da_rivedere).sort((a, b) => b.potenziale - a.potenziale);
      return { totale_da_rivedere: out.length, piu_promettenti: out.slice(0, num(args.limite, 15, 100)) };
    }
    case "get_article": {
      const id = Number(args.id);
      if (!Number.isInteger(id) || id <= 0) throw new Error("ID non valido");
      const { rows } = await snapshot();
      const r = rows.find((x) => x.id === id);
      if (!r) throw new Error(`Articolo ${id} non trovato`);
      const [content, q] = await Promise.all([
        args.con_testo === false ? Promise.resolve(null) : getArticleContent(id),
        getPageQueries(r.url, 30),
      ]);
      const text = content?.text ?? null;
      return {
        articolo: r,
        ricerche_che_lo_portano: q.queries.map((x) => ({
          ricerca: x.query,
          impressioni: x.impressions,
          click: x.clicks,
          ctr_percento: pct(x.ctr),
          posizione: Math.round(x.position * 10) / 10,
        })),
        avviso_ricerche: q.note ?? null,
        parole: text ? text.split(/\s+/).filter(Boolean).length : null,
        testo: text ? (text.length > 20000 ? text.slice(0, 20000) + "\n[…testo tagliato]" : text) : null,
      };
    }
    case "mark_reviewed": {
      const id = Number(args.id);
      if (!Number.isInteger(id) || id <= 0) throw new Error("ID non valido");
      await markReviewed(id);
      return { ok: true, id, rivisto_il: new Date().toISOString().slice(0, 10) };
    }
    default:
      throw new Error(`Strumento sconosciuto: ${name}`);
  }
}

// ---------- protocollo MCP (JSON-RPC su HTTP, senza stato) ----------
interface RpcReq {
  jsonrpc: "2.0";
  id?: number | string | null;
  method: string;
  params?: Record<string, unknown>;
}

async function handle(msg: RpcReq): Promise<object | null> {
  const isNotification = msg.id === undefined || msg.id === null;
  const ok = (result: unknown) => ({ jsonrpc: "2.0", id: msg.id, result });
  const fail = (code: number, message: string) => ({ jsonrpc: "2.0", id: msg.id ?? null, error: { code, message } });

  switch (msg.method) {
    case "initialize":
      return ok({
        protocolVersion: (msg.params?.protocolVersion as string) ?? "2025-03-26",
        capabilities: { tools: {} },
        serverInfo: { name: "cosmo-control", version: "1.0.0" },
        instructions:
          "Gestionale personale di Cosmonet.info. Usa get_article per la ricerca approfondita (testo + ricerche reali). Non modificare WordPress: proponi le modifiche a Dany.",
      });
    case "ping":
      return ok({});
    case "tools/list":
      return ok({ tools: TOOLS });
    case "tools/call": {
      const name = String(msg.params?.name ?? "");
      try {
        const data = await callTool(name, (msg.params?.arguments as Record<string, unknown>) ?? {});
        return ok({ content: [{ type: "text", text: JSON.stringify(data) }] });
      } catch (e) {
        return ok({ isError: true, content: [{ type: "text", text: (e as Error).message }] });
      }
    }
    default:
      return isNotification ? null : fail(-32601, `Metodo non supportato: ${msg.method}`);
  }
}

export async function POST(req: Request, { params }: { params: { token: string } }) {
  if (!tokenOk(params.token)) return new NextResponse("Non autorizzato", { status: 401 });
  let body: RpcReq | RpcReq[];
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "JSON non valido" } }, { status: 400 });
  }
  if (Array.isArray(body)) {
    const out = (await Promise.all(body.map(handle))).filter(Boolean);
    return out.length ? NextResponse.json(out) : new NextResponse(null, { status: 202 });
  }
  const out = await handle(body);
  return out ? NextResponse.json(out) : new NextResponse(null, { status: 202 });
}

export async function GET() {
  return new NextResponse("Questo è un server MCP: usa POST.", { status: 405, headers: { Allow: "POST" } });
}
