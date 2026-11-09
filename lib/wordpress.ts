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
    let totalPages = 1;
    for (let page = 1; page <= totalPages && page <= 60; page++) {
      const res = await fetch(
        `${base}/wp-json/wp/v2/posts?status=publish,future,draft,pending,trash` +
          `&per_page=30&page=${page}&_fields=id,title,slug,link,status,date,modified,categories`,
        { headers, next: { revalidate: 300 } },
      );
      if (!res.ok) {
        if (page === 1) {
          return {
            articles: demoArticles,
            demo: true,
            note: `WordPress ha risposto con errore ${res.status}. Controlla utente e Application Password.`,
          };
        }
        break;
      }
      totalPages = Number(res.headers.get("x-wp-totalpages")) || 1;
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
