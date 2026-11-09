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
}

export const STATO_LABEL: Record<Stato, string> = {
  publish: "Pubblicato",
  future: "Programmato",
  draft: "Bozza",
  pending: "In revisione",
  trash: "Cestinato",
};
