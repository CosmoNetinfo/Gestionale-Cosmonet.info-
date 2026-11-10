/**
 * Accesso minimo a Supabase via REST (nessuna dipendenza).
 * Variabili: SUPABASE_URL, SUPABASE_SECRET_KEY (chiave segreta, solo lato server).
 */
function conf() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SECRET_KEY;
  return url && key ? { url, key } : null;
}

export function supabaseConfigured(): boolean {
  return conf() !== null;
}

function headers(key: string, extra: Record<string, string> = {}) {
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...extra };
}

/** id articolo → data revisione (ISO). Vuota se Supabase non è collegato o in caso di errore. */
export async function getReviews(): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  const c = conf();
  if (!c) return out;
  try {
    const res = await fetch(`${c.url}/rest/v1/article_reviews?select=article_id,reviewed_at&limit=5000`, {
      headers: headers(c.key),
      cache: "no-store",
    });
    if (!res.ok) return out;
    for (const r of (await res.json()) as { article_id: number; reviewed_at: string }[]) {
      out.set(r.article_id, r.reviewed_at);
    }
  } catch {
    /* ignoro: la pagina resta utilizzabile */
  }
  return out;
}

export async function markReviewed(articleId: number): Promise<void> {
  const c = conf();
  if (!c) throw new Error("Supabase non è collegato");
  const res = await fetch(`${c.url}/rest/v1/article_reviews?on_conflict=article_id`, {
    method: "POST",
    headers: headers(c.key, { Prefer: "resolution=merge-duplicates,return=minimal" }),
    body: JSON.stringify({ article_id: articleId, reviewed_at: new Date().toISOString() }),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = (await res.text().catch(() => "")).slice(0, 200);
    throw new Error(`Supabase ${res.status}: ${body}`);
  }
}
