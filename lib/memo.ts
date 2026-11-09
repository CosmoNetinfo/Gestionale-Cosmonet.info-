/**
 * Lettura di Cosmo Memo in SOLA LETTURA.
 * Richiede che Cosmo Memo esponga GET /api/read-only/summary protetto da un token
 * (vedi docs/brief-cosmomemo-api.md). Variabili: COSMOMEMO_URL, COSMOMEMO_READ_TOKEN.
 */
export interface MemoPage {
  id: string;
  title: string;
  kind: "note" | "idea" | "project";
  status: "draft" | "active" | "done" | "archived";
  parent_id: string | null;
  updated: number; // millisecondi Unix
}

export interface MemoTask {
  id: string;
  title: string;
  status: "Da iniziare" | "In corso" | "Completato";
  priority: "Alta" | "Media" | "Bassa" | null;
  project_id: string | null;
  due: string | null;
}

export interface MemoSummary {
  generated_at: number;
  pages: MemoPage[];
  tasks: MemoTask[];
  memories_count: number;
}

export interface MemoResult {
  summary: MemoSummary | null;
  url: string | null;
  note?: string;
}

export async function getMemoSummary(): Promise<MemoResult> {
  const url = process.env.COSMOMEMO_URL?.replace(/\/$/, "") ?? null;
  const token = process.env.COSMOMEMO_READ_TOKEN;
  if (!url || !token) {
    return {
      summary: null,
      url,
      note: "Cosmo Memo non è ancora collegato: mancano COSMOMEMO_URL e COSMOMEMO_READ_TOKEN.",
    };
  }
  try {
    const res = await fetch(`${url}/api/read-only/summary`, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 120 },
    });
    if (res.status === 404) {
      return {
        summary: null,
        url,
        note: "Cosmo Memo non ha ancora l'accesso in sola lettura (risposta 404): va aggiunto con le istruzioni in docs/brief-cosmomemo-api.md.",
      };
    }
    if (res.status === 401 || res.status === 403) {
      return { summary: null, url, note: "Cosmo Memo ha rifiutato il token: controlla COSMOMEMO_READ_TOKEN." };
    }
    if (!res.ok) return { summary: null, url, note: `Cosmo Memo ha risposto con errore ${res.status}.` };
    const data = (await res.json()) as MemoSummary;
    if (!Array.isArray(data.pages) || !Array.isArray(data.tasks)) {
      return { summary: null, url, note: "Risposta di Cosmo Memo in un formato inatteso." };
    }
    return { summary: data, url };
  } catch (e) {
    return { summary: null, url, note: "Non riesco a raggiungere Cosmo Memo: " + (e as Error).message };
  }
}
