import type { Article } from "./types";

/** Soglia di revisione in giorni (variabile REVIEW_DAYS, default 90). */
export function reviewDays(): number {
  const n = Number(process.env.REVIEW_DAYS);
  return Number.isFinite(n) && n > 0 ? n : 90;
}

export function daysSince(iso: string, now: Date = new Date()): number {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((now.getTime() - t) / 86_400_000));
}

/** Giorni dall'ultima volta che l'articolo è stato toccato (pubblicazione o modifica). */
export function daysSinceTouched(a: Article): number {
  const published = new Date(a.date).getTime();
  const modified = new Date(a.modified).getTime();
  const last = Math.max(
    Number.isNaN(published) ? 0 : published,
    Number.isNaN(modified) ? 0 : modified,
  );
  return daysSince(new Date(last).toISOString());
}

/** Regola della fase 1: articolo pubblicato non toccato da più di `reviewDays()` giorni. */
export function isToReview(a: Article): boolean {
  return a.status === "publish" && daysSinceTouched(a) > reviewDays();
}
