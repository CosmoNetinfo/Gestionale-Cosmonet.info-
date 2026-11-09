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

/**
 * Giorni dall'ultimo intervento vero sull'articolo: la data più recente tra pubblicazione,
 * ultima modifica "vera" (senza modifiche in blocco) e revisione segnata nel gestionale.
 */
export function daysSinceTouched(a: Article): number {
  const ts = [a.date, a.touched ?? a.modified, a.reviewedAt]
    .map((d) => (d ? new Date(d).getTime() : 0))
    .filter((t) => !Number.isNaN(t));
  return daysSince(new Date(Math.max(0, ...ts)).toISOString());
}

/** Regola: articolo pubblicato non toccato da più di `reviewDays()` giorni. */
export function isToReview(a: Article): boolean {
  return a.status === "publish" && daysSinceTouched(a) > reviewDays();
}
