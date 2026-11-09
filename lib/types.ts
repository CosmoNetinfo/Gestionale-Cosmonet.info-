export type Stato = "publish" | "future" | "draft" | "pending" | "trash";

export interface Article {
  id: number;
  title: string;
  slug: string;
  url: string;
  status: Stato;
  category: string;
  /** Data di pubblicazione (ISO, ora del sito) */
  date: string;
  /** Data ultima modifica (ISO, ora del sito) */
  modified: string;
  /** Ultima modifica "vera": ignora le modifiche in blocco (stessa data su molti articoli). */
  touched?: string;
  /** Data in cui l'hai segnato come rivisto dal gestionale (Supabase). */
  reviewedAt?: string;
}

export const STATO_LABEL: Record<Stato, string> = {
  publish: "Pubblicato",
  future: "Programmato",
  draft: "Bozza",
  pending: "In revisione",
  trash: "Cestinato",
};
