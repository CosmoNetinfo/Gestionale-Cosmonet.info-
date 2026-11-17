export interface WpPlugin {
  plugin: string;
  name: string;
  version: string;
  status: string; // active | inactive | network-active
  author: string;
  description: string;
}

export interface WpSnippet {
  id: number;
  name: string;
  active: boolean;
  scope: string;
}

const strip = (s: string) => s.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&#8211;/g, "-").trim();

function auth() {
  const base = process.env.WP_BASE_URL?.replace(/\/$/, "");
  const user = process.env.WP_USER;
  const pass = process.env.WP_APP_PASSWORD;
  if (!base || !user || !pass) return null;
  return { base, headers: { Authorization: "Basic " + Buffer.from(`${user}:${pass}`).toString("base64") } };
}

/** Elenco dei plugin installati (REST API di WordPress: serve un utente amministratore). */
export async function getPlugins(): Promise<{ plugins: WpPlugin[]; note?: string }> {
  const a = auth();
  if (!a) return { plugins: [], note: "WordPress non è collegato: mancano WP_BASE_URL, WP_USER e WP_APP_PASSWORD." };
  try {
    const res = await fetch(`${a.base}/wp-json/wp/v2/plugins?per_page=100`, { headers: a.headers, next: { revalidate: 600 } });
    if (res.status === 401 || res.status === 403) {
      return { plugins: [], note: `WordPress ha rifiutato la richiesta (${res.status}). L'utente della password applicazione deve essere amministratore.` };
    }
    if (res.status === 404) {
      return { plugins: [], note: "Il sito non espone l'elenco dei plugin (errore 404): l'hosting o un plugin di sicurezza potrebbe bloccare la REST API." };
    }
    if (!res.ok) return { plugins: [], note: `WordPress ha risposto con errore ${res.status}.` };
    const data = (await res.json()) as {
      plugin: string;
      name: string;
      version: string;
      status: string;
      author?: string;
      description?: { raw?: string; rendered?: string };
    }[];
    return {
      plugins: data
        .map((p) => ({
          plugin: p.plugin,
          name: strip(p.name),
          version: p.version,
          status: p.status,
          author: strip(p.author ?? ""),
          description: strip(p.description?.raw ?? p.description?.rendered ?? ""),
        }))
        .sort((x, y) => x.name.localeCompare(y.name)),
    };
  } catch (e) {
    return { plugins: [], note: (e as Error).message };
  }
}

/** Snippet di codice, se è installato il plugin Code Snippets (ha una propria REST API). */
export async function getSnippets(): Promise<{ snippets: WpSnippet[]; note?: string }> {
  const a = auth();
  if (!a) return { snippets: [] };
  try {
    const res = await fetch(`${a.base}/wp-json/code-snippets/v1/snippets`, { headers: a.headers, next: { revalidate: 600 } });
    if (res.status === 404) {
      return { snippets: [], note: "Nessun elenco di snippet: il plugin Code Snippets non è installato (o non espone la REST API). Gli snippet PHP messi a mano in functions.php o in altri plugin non sono leggibili da fuori." };
    }
    if (!res.ok) return { snippets: [], note: `Snippet: errore ${res.status}.` };
    const data = (await res.json()) as { id: number; name: string; active: boolean; scope?: string }[];
    return { snippets: data.map((s) => ({ id: s.id, name: s.name || "(senza nome)", active: s.active, scope: s.scope ?? "" })) };
  } catch (e) {
    return { snippets: [], note: (e as Error).message };
  }
}

/** Plugin che di solito misurano visite e traffico. */
export const STATISTICHE = /jetpack|statist|analytics|site ?kit|matomo|burst|koko|visitor|traffic|stats|pageview/i;
