// Stato dello spazio su Supabase: database, tabelle e immagini temporanee.
function conf() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SECRET_KEY;
  return url && key ? { url, key } : null;
}
const hdr = (key: string) => ({ apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" });

export type StatoDb = { dbBytes: number; storageBytes: number; tabelle: { nome: string; bytes: number; righe: number }[] };
export type FileArchivio = { nome: string; bytes: number; creato?: string; url: string };

export async function statoDb(): Promise<{ stato?: StatoDb; errore?: string; manca?: boolean }> {
  const c = conf();
  if (!c) return { errore: "Supabase non collegato" };
  try {
    const r = await fetch(`${c.url}/rest/v1/rpc/cosmo_db_stato`, { method: "POST", headers: hdr(c.key), body: "{}", cache: "no-store", signal: AbortSignal.timeout(10000) });
    if (r.status === 404) return { manca: true };
    if (!r.ok) return { errore: `Supabase ha risposto ${r.status}: ${(await r.text()).slice(0, 150)}` };
    const j = (await r.json()) as { db_bytes: number; storage_bytes: number; tabelle: { nome: string; bytes: number; righe: number }[] };
    return { stato: { dbBytes: Number(j.db_bytes), storageBytes: Number(j.storage_bytes), tabelle: j.tabelle.map((t) => ({ ...t, bytes: Number(t.bytes), righe: Number(t.righe) })) } };
  } catch (e) {
    return { errore: (e as Error).message };
  }
}

/** File nel contenitore delle immagini temporanee ("social"). */
export async function elencoImmagini(): Promise<{ file: FileArchivio[]; errore?: string }> {
  const c = conf();
  if (!c) return { file: [], errore: "Supabase non collegato" };
  try {
    const r = await fetch(`${c.url}/storage/v1/object/list/social`, {
      method: "POST",
      headers: hdr(c.key),
      body: JSON.stringify({ prefix: "", limit: 200, sortBy: { column: "created_at", order: "desc" } }),
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (r.status === 404 || r.status === 400) return { file: [] }; // contenitore non ancora creato
    if (!r.ok) return { file: [], errore: `Storage ha risposto ${r.status}` };
    const l = (await r.json()) as { name: string; created_at?: string; metadata?: { size?: number } }[];
    return { file: l.filter((f) => f.name && f.metadata).map((f) => ({ nome: f.name, bytes: Number(f.metadata?.size ?? 0), creato: f.created_at, url: `${c.url}/storage/v1/object/public/social/${f.name}` })) };
  } catch (e) {
    return { file: [], errore: (e as Error).message };
  }
}

export async function eliminaImmagini(nomi: string[]): Promise<boolean> {
  const c = conf();
  if (!c || !nomi.length) return false;
  try {
    const r = await fetch(`${c.url}/storage/v1/object/social`, { method: "DELETE", headers: hdr(c.key), body: JSON.stringify({ prefixes: nomi }), cache: "no-store", signal: AbortSignal.timeout(15000) });
    return r.ok;
  } catch {
    return false;
  }
}
