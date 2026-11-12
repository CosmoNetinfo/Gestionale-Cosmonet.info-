// Pubblica un'immagine su Supabase Storage (bucket pubblico "social") e restituisce l'indirizzo https.
// Serve a Instagram, che scarica l'immagine da un indirizzo web invece di riceverla come file.

const BUCKET = "social";

function conf() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SECRET_KEY;
  return url && key ? { url, key } : null;
}

export async function caricaImmagine(file: File): Promise<{ ok: boolean; url?: string; errore?: string }> {
  const c = conf();
  if (!c) return { ok: false, errore: "Supabase non collegato" };
  const ext = file.type === "image/png" ? "png" : "jpg";
  const nome = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const invia = () =>
    fetch(`${c.url}/storage/v1/object/${BUCKET}/${nome}`, {
      method: "POST",
      headers: { apikey: c.key, Authorization: `Bearer ${c.key}`, "Content-Type": file.type, "x-upsert": "true" },
      body: bytes,
      cache: "no-store",
      signal: AbortSignal.timeout(25000),
    });
  try {
    let r = await invia();
    if (!r.ok) {
      const t = await r.text();
      // Primo utilizzo: il contenitore non esiste ancora, lo creo e riprovo.
      if (/bucket not found|not found/i.test(t)) {
        const b = await fetch(`${c.url}/storage/v1/bucket`, {
          method: "POST",
          headers: { apikey: c.key, Authorization: `Bearer ${c.key}`, "Content-Type": "application/json" },
          body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true, file_size_limit: 5242880, allowed_mime_types: ["image/jpeg", "image/png"] }),
          cache: "no-store",
          signal: AbortSignal.timeout(15000),
        });
        if (!b.ok) return { ok: false, errore: `Non riesco a creare il contenitore immagini (${b.status}): ${(await b.text()).slice(0, 150)}` };
        r = await invia();
        if (!r.ok) return { ok: false, errore: `Caricamento immagine fallito (${r.status}): ${(await r.text()).slice(0, 150)}` };
      } else {
        return { ok: false, errore: `Caricamento immagine fallito (${r.status}): ${t.slice(0, 150)}` };
      }
    }
    return { ok: true, url: `${c.url}/storage/v1/object/public/${BUCKET}/${nome}` };
  } catch (e) {
    return { ok: false, errore: (e as Error).message };
  }
}

/** Cancella un'immagine caricata da caricaImmagine (dato il suo indirizzo pubblico). */
export async function cancellaImmagine(url: string): Promise<void> {
  const c = conf();
  if (!c) return;
  const prefisso = `${c.url}/storage/v1/object/public/${BUCKET}/`;
  if (!url.startsWith(prefisso)) return;
  const nome = url.slice(prefisso.length);
  try {
    await fetch(`${c.url}/storage/v1/object/${BUCKET}/${nome}`, {
      method: "DELETE",
      headers: { apikey: c.key, Authorization: `Bearer ${c.key}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
  } catch {}
}

/** Rete di sicurezza: toglie le immagini rimaste per più di un giorno (per esempio se un post è andato in errore a metà). */
export async function pulisciVecchie(): Promise<void> {
  const c = conf();
  if (!c) return;
  try {
    const r = await fetch(`${c.url}/storage/v1/object/list/${BUCKET}`, {
      method: "POST",
      headers: { apikey: c.key, Authorization: `Bearer ${c.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ prefix: "", limit: 100, sortBy: { column: "created_at", order: "asc" } }),
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) return;
    const lista = (await r.json()) as { name: string; created_at?: string }[];
    const limite = Date.now() - 24 * 3600 * 1000;
    const vecchie = lista.filter((f) => f.created_at && new Date(f.created_at).getTime() < limite).map((f) => f.name);
    if (!vecchie.length) return;
    await fetch(`${c.url}/storage/v1/object/${BUCKET}`, {
      method: "DELETE",
      headers: { apikey: c.key, Authorization: `Bearer ${c.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ prefixes: vecchie }),
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
  } catch {}
}

/** Scarica un'immagine da un indirizzo https pubblico e la restituisce come File (JPEG o PNG, max 5 MB). */
export async function scaricaComeFile(url: string): Promise<{ ok: boolean; file?: File; errore?: string }> {
  if (!/^https:\/\//.test(url)) return { ok: false, errore: "L'indirizzo dell'immagine deve essere https" };
  try {
    const r = await fetch(url, { cache: "no-store", redirect: "follow", signal: AbortSignal.timeout(20000) });
    if (!r.ok) return { ok: false, errore: `Immagine non raggiungibile (${r.status})` };
    const tipo = (r.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (tipo !== "image/jpeg" && tipo !== "image/png") return { ok: false, errore: "L'immagine deve essere JPEG o PNG" };
    const bytes = new Uint8Array(await r.arrayBuffer());
    if (bytes.length === 0 || bytes.length > 5 * 1024 * 1024) return { ok: false, errore: "L'immagine è vuota o supera 5 MB" };
    const nome = `immagine.${tipo === "image/png" ? "png" : "jpg"}`;
    return { ok: true, file: new File([bytes], nome, { type: tipo }) };
  } catch (e) {
    return { ok: false, errore: (e as Error).message };
  }
}
