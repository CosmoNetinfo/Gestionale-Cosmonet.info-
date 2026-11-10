/**
 * PageSpeed Insights (Lighthouse + dati reali Chrome UX Report).
 * Variabile: PAGESPEED_API_KEY. Le risposte restano in cache 6 ore per risparmiare quota.
 */
export type Strategy = "mobile" | "desktop";

export type FieldMetric = { value: number; category: "FAST" | "AVERAGE" | "SLOW" | "" };

export type SpeedResult = {
  url: string;
  ok: boolean;
  error?: string;
  score?: number; // 0-100, Lighthouse (laboratorio)
  lab?: { lcp: number; cls: number; tbt: number; fcp: number };
  field?: { lcp?: FieldMetric; inp?: FieldMetric; cls?: FieldMetric }; // dati reali degli utenti
};

export function pagespeedConfigured(): boolean {
  return !!process.env.PAGESPEED_API_KEY;
}

type Audit = { numericValue?: number };
type Cat = { percentile?: number; category?: string };

function fm(c: Cat | undefined, div = 1): FieldMetric | undefined {
  if (!c || typeof c.percentile !== "number") return undefined;
  const category = (c.category === "FAST" || c.category === "AVERAGE" || c.category === "SLOW" ? c.category : "") as FieldMetric["category"];
  return { value: c.percentile / div, category };
}

export async function runPagespeed(url: string, strategy: Strategy): Promise<SpeedResult> {
  const key = process.env.PAGESPEED_API_KEY;
  if (!key) return { url, ok: false, error: "PAGESPEED_API_KEY non impostata" };
  const q = new URLSearchParams({ url, strategy, category: "performance", key });
  try {
    const res = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${q}`, {
      next: { revalidate: 21600 },
    });
    if (!res.ok) {
      const body = (await res.text().catch(() => "")).slice(0, 160).replace(/\s+/g, " ");
      return { url, ok: false, error: `Google ${res.status}: ${body}` };
    }
    const j = (await res.json()) as {
      lighthouseResult?: { categories?: { performance?: { score?: number } }; audits?: Record<string, Audit> };
      loadingExperience?: { metrics?: Record<string, Cat> };
    };
    const a = j.lighthouseResult?.audits ?? {};
    const m = j.loadingExperience?.metrics ?? {};
    return {
      url,
      ok: true,
      score: Math.round((j.lighthouseResult?.categories?.performance?.score ?? 0) * 100),
      lab: {
        lcp: (a["largest-contentful-paint"]?.numericValue ?? 0) / 1000,
        cls: a["cumulative-layout-shift"]?.numericValue ?? 0,
        tbt: a["total-blocking-time"]?.numericValue ?? 0,
        fcp: (a["first-contentful-paint"]?.numericValue ?? 0) / 1000,
      },
      field: {
        lcp: fm(m["LARGEST_CONTENTFUL_PAINT_MS"], 1000),
        inp: fm(m["INTERACTION_TO_NEXT_PAINT"]),
        cls: fm(m["CUMULATIVE_LAYOUT_SHIFT_SCORE"], 100),
      },
    };
  } catch (e) {
    return { url, ok: false, error: e instanceof Error ? e.message : "errore di rete" };
  }
}

/** Analizza più indirizzi, 3 alla volta. */
export async function runMany(urls: string[], strategy: Strategy): Promise<SpeedResult[]> {
  const out: SpeedResult[] = [];
  for (let i = 0; i < urls.length; i += 3) {
    out.push(...(await Promise.all(urls.slice(i, i + 3).map((u) => runPagespeed(u, strategy)))));
  }
  return out;
}
