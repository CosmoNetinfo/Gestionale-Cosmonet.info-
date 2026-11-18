/**
 * PageSpeed Insights (Lighthouse + dati reali Chrome UX Report).
 * Variabile: PAGESPEED_API_KEY. Le risposte riuscite restano in cache 6 ore per risparmiare quota.
 *
 * Restituisce tutto ciò che Google dà: i 4 punteggi (prestazioni, accessibilità, best practice, SEO),
 * le metriche di laboratorio, i dati reali degli utenti (per la pagina e per tutto il sito),
 * le opportunità/problemi con i risparmi stimati e le informazioni sul test.
 */
export type Strategy = "mobile" | "desktop";

export type FieldCategory = "FAST" | "AVERAGE" | "SLOW" | "";

export type FieldMetric = {
  value: number;
  category: FieldCategory;
  /** Quota di visite buone / da migliorare / scarse (0-100), se Google la fornisce. */
  dist?: { good: number; average: number; poor: number };
};

export type FieldSet = {
  /** Valutazione complessiva dei Core Web Vitals. */
  overall?: FieldCategory;
  lcp?: FieldMetric;
  inp?: FieldMetric;
  cls?: FieldMetric;
  fcp?: FieldMetric;
  ttfb?: FieldMetric;
};

export type CategoryId = "performance" | "accessibility" | "best-practices" | "seo";

export type LabMetric = {
  id: "fcp" | "lcp" | "tbt" | "cls" | "si";
  label: string;
  /** Valore grezzo (ms, tranne CLS che è un numero puro). */
  value: number;
  /** Testo già formattato da Google (es. «5,1 s»). */
  text: string;
  /** Punteggio 0-1 della metrica secondo Lighthouse. */
  score: number | null;
};

export type AuditItem = {
  id: string;
  title: string;
  /** Spiegazione breve di Google (può contenere markdown con link). */
  description: string;
  /** 0-1; null se non è un controllo con punteggio. */
  score: number | null;
  /** Testo di Google, es. «Risparmio stimato di 780 ms». */
  display?: string;
  savingsMs?: number;
  savingsBytes?: number;
  group?: string;
};

export type SpeedResult = {
  url: string;
  strategy?: Strategy;
  ok: boolean;
  error?: string;
  /** Punteggio di prestazioni 0-100 (Lighthouse, laboratorio). */
  score?: number;
  /** Tutti i punteggi 0-100. */
  scores?: Partial<Record<CategoryId, number>>;
  lab?: { lcp: number; cls: number; tbt: number; fcp: number; si?: number };
  labMetrics?: LabMetric[];
  /** Dati reali degli utenti per questa pagina. */
  field?: FieldSet;
  /** Dati reali degli utenti per tutto il sito (origine). */
  origin?: FieldSet;
  /** Controlli non superati, per categoria. */
  audits?: Partial<Record<CategoryId, AuditItem[]>>;
  /** Peso e numero di richieste della pagina. */
  resources?: { totalBytes?: number; requests?: number; byType?: { type: string; requests: number; bytes: number }[] };
  info?: {
    finalUrl?: string;
    fetchTime?: string;
    lighthouse?: string;
    device?: string;
    throttling?: string;
    reportUrl: string;
  };
};

export function pagespeedConfigured(): boolean {
  return !!process.env.PAGESPEED_API_KEY;
}

/* ------------------------------------------------------------------ */
/* Forma (parziale) della risposta di Google                           */
/* ------------------------------------------------------------------ */
type Audit = {
  id?: string;
  title?: string;
  description?: string;
  score?: number | null;
  scoreDisplayMode?: string;
  displayValue?: string;
  numericValue?: number;
  details?: {
    type?: string;
    overallSavingsMs?: number;
    overallSavingsBytes?: number;
    items?: { resourceType?: string; label?: string; requestCount?: number; transferSize?: number }[];
  };
  metricSavings?: Record<string, number>;
};
type Cat = { percentile?: number; category?: string; distributions?: { min?: number; max?: number; proportion?: number }[] };
type Loading = { metrics?: Record<string, Cat>; overall_category?: string };
type Psi = {
  id?: string;
  loadingExperience?: Loading;
  originLoadingExperience?: Loading;
  lighthouseResult?: {
    lighthouseVersion?: string;
    fetchTime?: string;
    finalDisplayedUrl?: string;
    finalUrl?: string;
    categories?: Record<string, { score?: number | null; auditRefs?: { id: string; weight?: number; group?: string }[] }>;
    audits?: Record<string, Audit>;
    configSettings?: { emulatedFormFactor?: string; formFactor?: string; throttlingMethod?: string };
    environment?: { networkUserAgent?: string; benchmarkIndex?: number };
    timing?: { total?: number };
  };
};

const asCat = (c?: string): FieldCategory => (c === "FAST" || c === "AVERAGE" || c === "SLOW" ? c : "");

function fm(c: Cat | undefined, div = 1): FieldMetric | undefined {
  if (!c || typeof c.percentile !== "number") return undefined;
  const d = c.distributions;
  const dist =
    d && d.length === 3
      ? {
          good: Math.round((d[0].proportion ?? 0) * 100),
          average: Math.round((d[1].proportion ?? 0) * 100),
          poor: Math.round((d[2].proportion ?? 0) * 100),
        }
      : undefined;
  return { value: c.percentile / div, category: asCat(c.category), dist };
}

function fieldSet(l: Loading | undefined): FieldSet | undefined {
  const m = l?.metrics;
  if (!m) return undefined;
  const s: FieldSet = {
    overall: asCat(l?.overall_category),
    lcp: fm(m["LARGEST_CONTENTFUL_PAINT_MS"], 1),
    inp: fm(m["INTERACTION_TO_NEXT_PAINT"]),
    cls: fm(m["CUMULATIVE_LAYOUT_SHIFT_SCORE"], 100),
    fcp: fm(m["FIRST_CONTENTFUL_PAINT_MS"]),
    ttfb: fm(m["EXPERIMENTAL_TIME_TO_FIRST_BYTE"]),
  };
  return s.lcp || s.inp || s.cls || s.fcp || s.ttfb ? s : undefined;
}

const CATEGORIES: CategoryId[] = ["performance", "accessibility", "best-practices", "seo"];
const METRIC_IDS: { id: LabMetric["id"]; audit: string; label: string }[] = [
  { id: "fcp", audit: "first-contentful-paint", label: "First Contentful Paint (FCP)" },
  { id: "lcp", audit: "largest-contentful-paint", label: "Largest Contentful Paint (LCP)" },
  { id: "tbt", audit: "total-blocking-time", label: "Total Blocking Time (TBT)" },
  { id: "cls", audit: "cumulative-layout-shift", label: "Cumulative Layout Shift (CLS)" },
  { id: "si", audit: "speed-index", label: "Speed Index" },
];
const METRIC_AUDITS = new Set(METRIC_IDS.map((m) => m.audit));

function savings(a: Audit): { ms?: number; bytes?: number } {
  const ms = a.details?.overallSavingsMs ?? (a.metricSavings ? Math.max(0, ...Object.values(a.metricSavings)) : undefined);
  const bytes = a.details?.overallSavingsBytes;
  return { ms: ms && ms > 0 ? ms : undefined, bytes: bytes && bytes > 0 ? bytes : undefined };
}

function parseAudits(j: Psi): Partial<Record<CategoryId, AuditItem[]>> {
  const lr = j.lighthouseResult;
  const out: Partial<Record<CategoryId, AuditItem[]>> = {};
  for (const cat of CATEGORIES) {
    const refs = lr?.categories?.[cat]?.auditRefs ?? [];
    const items: AuditItem[] = [];
    for (const ref of refs) {
      const a = lr?.audits?.[ref.id];
      if (!a || METRIC_AUDITS.has(ref.id)) continue;
      const mode = a.scoreDisplayMode;
      if (mode === "notApplicable" || mode === "manual" || mode === "error") continue;
      const sv = savings(a);
      const failing = typeof a.score === "number" && a.score < 0.9;
      // In prestazioni mostriamo anche le diagnostiche informative che hanno un valore (es. «Lavoro del thread principale 5,4 s»).
      const infoWithValue = cat === "performance" && mode === "informative" && !!a.displayValue && ref.group === "diagnostics";
      if (!failing && !infoWithValue) continue;
      items.push({
        id: ref.id,
        title: a.title ?? ref.id,
        description: (a.description ?? "").slice(0, 400),
        score: typeof a.score === "number" ? a.score : null,
        display: a.displayValue,
        savingsMs: sv.ms,
        savingsBytes: sv.bytes,
        group: ref.group,
      });
    }
    // i più utili prima: più risparmio in ms, poi in byte, poi punteggio più basso
    items.sort(
      (x, y) =>
        (y.savingsMs ?? 0) - (x.savingsMs ?? 0) ||
        (y.savingsBytes ?? 0) - (x.savingsBytes ?? 0) ||
        (x.score ?? 1) - (y.score ?? 1),
    );
    out[cat] = items;
  }
  return out;
}

function parseResources(a: Record<string, Audit> | undefined): SpeedResult["resources"] {
  const total = a?.["total-byte-weight"]?.numericValue;
  const summary = a?.["resource-summary"]?.details?.items ?? [];
  const byType = summary
    .filter((i) => i.resourceType && i.resourceType !== "total")
    .map((i) => ({ type: i.label ?? i.resourceType ?? "", requests: i.requestCount ?? 0, bytes: i.transferSize ?? 0 }))
    .sort((x, y) => y.bytes - x.bytes);
  const requests = summary.find((i) => i.resourceType === "total")?.requestCount;
  if (total === undefined && !byType.length) return undefined;
  return { totalBytes: total, requests, byType };
}

/* ------------------------------------------------------------------ */

/** Limite per una singola richiesta a Google: la pagina Velocità ha 60 s in tutto. */
const REQUEST_TIMEOUT_MS = 54000;

async function callGoogle(url: string, strategy: Strategy, key: string, timeoutMs: number, fresh: boolean) {
  const q = new URLSearchParams({ url, strategy, key, locale: "it" });
  for (const c of CATEGORIES) q.append("category", c);
  return fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${q}`, {
    ...(fresh ? { cache: "no-store" as const } : { next: { revalidate: 21600 } }),
    signal: AbortSignal.timeout(timeoutMs),
  });
}

/**
 * Analizza un indirizzo. `deadline` (ms assoluti) serve a non sforare il limite di Vercel:
 * se Google risponde con un errore momentaneo (429 o 5xx) si riprova una volta solo se resta tempo.
 */
export async function runPagespeed(url: string, strategy: Strategy, deadline?: number, fresh = false): Promise<SpeedResult> {
  const key = process.env.PAGESPEED_API_KEY?.trim();
  if (!key) return { url, strategy, ok: false, error: "PAGESPEED_API_KEY non impostata" };
  const end = deadline ?? Date.now() + 56000;
  const left = () => end - Date.now();
  try {
    let res = await callGoogle(url, strategy, key, Math.max(5000, Math.min(REQUEST_TIMEOUT_MS, left())), fresh);
    if ((res.status === 429 || res.status >= 500) && left() > 25000) {
      await new Promise((r) => setTimeout(r, 2000));
      res = await callGoogle(url, strategy, key, Math.max(5000, Math.min(REQUEST_TIMEOUT_MS, left())), fresh);
    }
    if (!res.ok) {
      const body = (await res.text().catch(() => "")).slice(0, 200).replace(/\s+/g, " ");
      const hint =
        res.status === 429
          ? " (quota di Google esaurita o troppe richieste insieme: riprova tra un minuto)"
          : res.status === 403
            ? " (la chiave non ha il permesso: controlla le restrizioni API della chiave)"
            : res.status === 400 && /api key|API_KEY/i.test(body)
              ? " (chiave non valida: ricontrolla PAGESPEED_API_KEY)"
              : "";
      return { url, strategy, ok: false, error: `Google ${res.status}${hint}: ${body}` };
    }
    const j = (await res.json()) as Psi;
    const lr = j.lighthouseResult;
    const a = lr?.audits ?? {};

    const scores: Partial<Record<CategoryId, number>> = {};
    for (const c of CATEGORIES) {
      const s = lr?.categories?.[c]?.score;
      if (typeof s === "number") scores[c] = Math.round(s * 100);
    }

    const labMetrics: LabMetric[] = METRIC_IDS.map((m) => ({
      id: m.id,
      label: m.label,
      value: a[m.audit]?.numericValue ?? 0,
      text: a[m.audit]?.displayValue ?? "",
      score: typeof a[m.audit]?.score === "number" ? (a[m.audit]!.score as number) : null,
    }));
    const v = (id: LabMetric["id"]) => labMetrics.find((m) => m.id === id)?.value ?? 0;

    return {
      url,
      strategy,
      ok: true,
      score: scores.performance ?? 0,
      scores,
      lab: { lcp: v("lcp") / 1000, cls: v("cls"), tbt: v("tbt"), fcp: v("fcp") / 1000, si: v("si") / 1000 },
      labMetrics,
      field: fieldSet(j.loadingExperience),
      origin: fieldSet(j.originLoadingExperience),
      audits: parseAudits(j),
      resources: parseResources(a),
      info: {
        finalUrl: lr?.finalDisplayedUrl ?? lr?.finalUrl,
        fetchTime: lr?.fetchTime,
        lighthouse: lr?.lighthouseVersion,
        device: lr?.configSettings?.formFactor ?? lr?.configSettings?.emulatedFormFactor,
        throttling: lr?.configSettings?.throttlingMethod,
        reportUrl: `https://pagespeed.web.dev/analysis?url=${encodeURIComponent(url)}&form_factor=${strategy}`,
      },
    };
  } catch (e) {
    const timeout = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
    return {
      url,
      strategy,
      ok: false,
      error: timeout
        ? "Google ha impiegato troppo tempo (oltre 50 secondi): riprova, la seconda volta di solito è più veloce"
        : e instanceof Error
          ? e.message
          : "errore di rete",
    };
  }
}

/**
 * Analizza più indirizzi insieme. Tutti partono nello stesso momento e condividono la stessa scadenza,
 * così la pagina resta sotto il limite di 60 secondi di Vercel; un indirizzo lento non blocca gli altri.
 */
export async function runMany(urls: string[], strategy: Strategy, fresh = false): Promise<SpeedResult[]> {
  const deadline = Date.now() + 56000;
  return Promise.all(urls.map((u) => runPagespeed(u, strategy, deadline, fresh)));
}
