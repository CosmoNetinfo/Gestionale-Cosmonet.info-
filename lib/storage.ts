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
