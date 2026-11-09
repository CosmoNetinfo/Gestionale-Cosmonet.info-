import { getPageHistory, type HistoryDay } from "@/lib/history";

/** Storico salvato su Supabase, oppure nulla se non è disponibile. */
export async function getHistoryOrNone(url: string): Promise<HistoryDay[]> {
  try {
    return await getPageHistory(url);
  } catch {
    return [];
  }
}
