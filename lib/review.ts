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

export type Fascia = "controllare" | "urgente" | "critico";

export interface FasciaInfo {
  key: Fascia;
  label: string;
  tone: "warn" | "danger";
  /** Colore del bordo/barra (variabili del tema). */
  color: string;
}

/** Fascia di urgenza in base ai giorni: da soglia a 2×, da 2× a 4×, oltre 4× (con soglia 90: 90/180/360). */
export function fasciaPerGiorni(giorni: number): FasciaInfo {
  const soglia = reviewDays();
  if (giorni > soglia * 4) return { key: "critico", label: "Critico", tone: "danger", color: "var(--danger)" };
  if (giorni > soglia * 2) return { key: "urgente", label: "Urgente", tone: "danger", color: "var(--warn)" };
  return { key: "controllare", label: "Da controllare", tone: "warn", color: "var(--warn)" };
}

/** Testo leggibile per i giorni: "412 giorni (1 anno e 1 mese)". */
export function etaLeggibile(giorni: number): string {
  if (giorni < 60) return `${giorni} giorni`;
  const mesi = Math.floor(giorni / 30.4);
  if (mesi < 12) return `${giorni} giorni (${mesi} mesi)`;
  const anni = Math.floor(mesi / 12);
  const resto = mesi % 12;
  return `${giorni} giorni (${anni} ${anni === 1 ? "anno" : "anni"}${resto ? ` e ${resto} ${resto === 1 ? "mese" : "mesi"}` : ""})`;
}
