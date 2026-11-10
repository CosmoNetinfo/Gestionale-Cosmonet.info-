/** Note per articolo salvate su Supabase (tabella article_notes). Variabili: SUPABASE_URL, SUPABASE_SECRET_KEY. */
function conf() {
  const url = process.env.SUPABASE_URL?.trim().replace(/\/$/, "");
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  return url && key ? { url, key } : null;
}
const hdr = (key: string, extra: Record<string, string> = {}) => ({
  apikey: key,
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
  ...extra,
});

export interface Note {
  note: string;
  updated_at: string;
}

/** Nota di un articolo; `missing` = la tabella non esiste ancora o mancano i permessi. */
export async function getNote(articleId: number): Promise<{ note?: Note; missing?: string }> {
  const c = conf();
  if (!c) return { missing: "Supabase non collegato" };
  try {
    const res = await fetch(`${c.url}/rest/v1/article_notes?select=note,updated_at&article_id=eq.${articleId}&limit=1`, {
      headers: hdr(c.key),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { missing: res.status === 404 ? "tabella article_notes non creata" : `errore ${res.status}` };
    return { note: ((await res.json()) as Note[])[0] };
  } catch (e) {
    return { missing: (e as Error).message };
  }
}

export async function saveNote(articleId: number, note: string): Promise<void> {
  const c = conf();
  if (!c) throw new Error("Supabase non collegato");
  if (!note.trim()) {
    const del = await fetch(`${c.url}/rest/v1/article_notes?article_id=eq.${articleId}`, { method: "DELETE", headers: hdr(c.key), cache: "no-store" });
    if (!del.ok) throw new Error(`Supabase ${del.status}: ${(await del.text().catch(() => "")).slice(0, 200)}`);
    return;
  }
  const res = await fetch(`${c.url}/rest/v1/article_notes?on_conflict=article_id`, {
    method: "POST",
    headers: hdr(c.key, { Prefer: "resolution=merge-duplicates,return=minimal" }),
    body: JSON.stringify({ article_id: articleId, note: note.slice(0, 4000), updated_at: new Date().toISOString() }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
}
