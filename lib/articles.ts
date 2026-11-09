import { getArticles, type ArticlesResult } from "./wordpress";
import { getReviews } from "./supabase";

/** Articoli di WordPress con la data di revisione di Supabase (se collegato). */
export async function loadArticles(): Promise<ArticlesResult> {
  const [res, reviews] = await Promise.all([getArticles(), getReviews()]);
  if (!res.demo) {
    for (const a of res.articles) a.reviewedAt = reviews.get(a.id);
  }
  return res;
}
