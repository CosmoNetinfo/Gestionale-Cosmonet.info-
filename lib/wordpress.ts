import type { Article, Stato } from "./types";
import { demoArticles } from "./demo";

export interface ArticlesResult {
  articles: Article[];
  demo: boolean;
  /** Messaggio da mostrare all'utente se qualcosa non va. */
  note?: string;
}

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#039;": "'",
  "&nbsp;": " ",
};

function decodeEntities(s: string): string {
  return s
    .replace(/&(amp|lt|gt|quot|nbsp|#039);/g, (m) => ENTITIES[m] ?? m)
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

interface WpPost {
  id: number;
  title?: { rendered?: string };
  slug: string;
  link: string;
  status: string;
  date: string;
  modified: string;
  categories?: number[];
}

/**
 * Legge gli articoli dalla REST API standard di WordPress.
 * Serve un'Application Password (Utenti → Profilo) per vedere bozze, programmati e cestinati.
 * Variabili: WP_BASE_URL, WP_USER, WP_APP_PASSWORD.
 */
export async function getArticles(): Promise<ArticlesResult> {
  const base = process.env.WP_BASE_URL?.replace(/\/$/, "");
  const user = process.env.WP_USER;
  const pass = process.env.WP_APP_PASSWORD;

  if (!base || !user || !pass) {
    return {
      articles: demoArticles,
      demo: true,
      note: "WordPress non è ancora collegato: mancano WP_BASE_URL, WP_USER e WP_APP_PASSWORD.",
    };
  }

  const headers = {
    Authorization: "Basic " + Buffer.from(`${user}:${pass}`).toString("base64"),
  };

  try {
    // Mappa id categoria → nome
    const catRes = await fetch(
      `${base}/wp-json/wp/v2/categories?per_page=100&_fields=id,name`,
      { headers, next: { revalidate: 3600 } },
    );
    const cats = new Map<number, string>();
    if (catRes.ok) {
      for (const c of (await catRes.json()) as { id: number; name: string }[]) {
        cats.set(c.id, decodeEntities(c.name));
      }
    }

    const articles: Article[] = [];
    const fetchPage = (page: number) =>
      fetch(
        `${base}/wp-json/wp/v2/posts?status=publish,future,draft,pending,trash` +
          `&per_page=100&page=${page}&_fields=id,title,slug,link,status,date,modified,categories`,
        { headers, next: { revalidate: 300 } },
      );
    const collect = async (res: Response) => {
      for (const p of (await res.json()) as WpPost[]) {
        articles.push({
          id: p.id,
          title: decodeEntities(p.title?.rendered ?? "(senza titolo)"),
          slug: p.slug,
          url: p.link,
          status: p.status as Stato,
          category: cats.get(p.categories?.[0] ?? -1) ?? "—",
          date: p.date,
          modified: p.modified,
        });
      }
    };

    // Prima pagina: serve per sapere quante pagine ci sono in tutto
    const first = await fetchPage(1);
    if (!first.ok) {
      return {
        articles: demoArticles,
        demo: true,
        note: `WordPress ha risposto con errore ${first.status}. Controlla utente e Application Password.`,
      };
    }
    const totalPages = Math.min(Number(first.headers.get("x-wp-totalpages")) || 1, 60);
    await collect(first);

    // Le altre pagine in parallelo, a gruppi di 6 per non sovraccaricare il sito
    for (let start = 2; start <= totalPages; start += 6) {
      const batch = Array.from(
        { length: Math.min(6, totalPages - start + 1) },
        (_, i) => fetchPage(start + i),
      );
      for (const res of await Promise.all(batch)) {
        if (res.ok) await collect(res);
      }
    }
    // Modifiche in blocco: se più di BULK articoli hanno la stessa data di modifica (giorno),
    // quella data non dice nulla sul lavoro fatto sul singolo articolo.
    const BULK = 50;
    const perDay = new Map<string, number>();
    for (const a of articles) {
      const d = a.modified.slice(0, 10);
      perDay.set(d, (perDay.get(d) ?? 0) + 1);
    }
    for (const a of articles) {
      a.touched = (perDay.get(a.modified.slice(0, 10)) ?? 0) > BULK ? a.date : a.modified;
    }
    return { articles, demo: false };
  } catch (e) {
    return {
      articles: demoArticles,
      demo: true,
      note: "Non riesco a raggiungere WordPress: " + (e as Error).message,
    };
  }
}

/** Testo (senza HTML) di un singolo articolo, per la ricerca approfondita. */
export async function getArticleContent(
  id: number,
): Promise<{ title: string; url: string; status: string; text: string } | null> {
  const base = process.env.WP_BASE_URL?.replace(/\/$/, "");
  const user = process.env.WP_USER;
  const pass = process.env.WP_APP_PASSWORD;
  if (!base || !user || !pass) return null;
  const res = await fetch(
    `${base}/wp-json/wp/v2/posts/${id}?context=edit&_fields=id,title,link,status,content`,
    {
      headers: { Authorization: "Basic " + Buffer.from(`${user}:${pass}`).toString("base64") },
      cache: "no-store",
    },
  );
  if (!res.ok) return null;
  const p = (await res.json()) as {
    title?: { raw?: string; rendered?: string };
    link: string;
    status: string;
    content?: { raw?: string; rendered?: string };
  };
  const html = p.content?.rendered ?? p.content?.raw ?? "";
  const text = decodeEntities(
    html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
      .replace(/<\/(p|h[1-6]|li|tr|div)>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  );
  return {
    title: decodeEntities(p.title?.raw ?? p.title?.rendered ?? ""),
    url: p.link,
    status: p.status,
    text,
  };
}
