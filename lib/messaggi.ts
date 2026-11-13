/**
 * Messaggi del modulo contatti del sito (plugin "CosmoContact + Supabase").
 * Sono su un progetto Supabase DIVERSO da quello del gestionale, quindi servono variabili proprie:
 *  - CONTACT_SUPABASE_URL: indirizzo del progetto del plugin contatti
 *  - CONTACT_SUPABASE_KEY: chiave segreta (service role) di quel progetto, solo lato server
 *  - CONTACT_TABLE: nome tabella (default "contacts")
 * Non conosco le colonne esatte: leggo tutto e cerco i campi più probabili.
 */
export interface Messaggio {
  id: string;
  nome: string;
  email: string;
  oggetto: string;
  testo: string;
  data: string | null;
  letto: boolean | null;
  campi: Record<string, unknown>;
}

function conf() {
  const url = process.env.CONTACT_SUPABASE_URL?.trim().replace(/\/$/, "");
  const key = process.env.CONTACT_SUPABASE_KEY?.trim();
  const table = process.env.CONTACT_TABLE?.trim() || "contacts";
  return url && key ? { url, key, table } : null;
}

export const messaggiAttivi = () => conf() !== null;

const prendi = (r: Record<string, unknown>, chiavi: string[]): string => {
  for (const k of chiavi) {
    const v = r[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
};

export async function leggiMessaggi(limite = 100): Promise<{ ok: boolean; messaggi: Messaggio[]; errore?: string }> {
  const c = conf();
  if (!c) return { ok: false, messaggi: [], errore: "Non collegato" };
  try {
    const res = await fetch(`${c.url}/rest/v1/${encodeURIComponent(c.table)}?select=*&order=created_at.desc&limit=${limite}`, {
      headers: { apikey: c.key, Authorization: `Bearer ${c.key}` },
      cache: "no-store",
    });
    if (!res.ok) {
      const corpo = (await res.text().catch(() => "")).slice(0, 200);
      return { ok: false, messaggi: [], errore: `Supabase ${res.status}: ${corpo}` };
    }
    const righe = (await res.json()) as Record<string, unknown>[];
    const messaggi = righe.map((r, i): Messaggio => {
      const letto = ["read", "letto", "is_read", "seen"].map((k) => r[k]).find((v) => typeof v === "boolean");
      return {
        id: String(r.id ?? i),
        nome: prendi(r, ["name", "nome", "full_name", "author"]),
        email: prendi(r, ["email", "mail", "e_mail"]),
        oggetto: prendi(r, ["subject", "oggetto", "title"]),
        testo: prendi(r, ["message", "messaggio", "body", "text", "content"]),
        data: prendi(r, ["created_at", "date", "data", "timestamp"]) || null,
        letto: typeof letto === "boolean" ? letto : null,
        campi: r,
      };
    });
    return { ok: true, messaggi };
  } catch (e) {
    return { ok: false, messaggi: [], errore: e instanceof Error ? e.message : "Errore di rete" };
  }
}
