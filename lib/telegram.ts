/**
 * Bot Telegram (solo invio). Variabili: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID.
 */
export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function telegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim() && process.env.TELEGRAM_CHAT_ID?.trim());
}

/** Invia un messaggio (HTML semplice: <b>, <i>, <a href>). */
export async function sendTelegram(text: string): Promise<{ ok: boolean; message: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chat = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!token) return { ok: false, message: "Manca TELEGRAM_BOT_TOKEN" };
  if (!chat) return { ok: false, message: "Manca TELEGRAM_CHAT_ID" };
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chat, text: text.slice(0, 4000), parse_mode: "HTML", disable_web_page_preview: true }),
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) return { ok: true, message: "Messaggio inviato" };
    const j = (await res.json().catch(() => ({}))) as { description?: string };
    return { ok: false, message: `Telegram: ${j.description ?? res.status}` };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

/** Trova la chat a cui il bot ha ricevuto l'ultimo messaggio (serve per scoprire TELEGRAM_CHAT_ID). */
export async function detectChat(): Promise<{ id?: string; name?: string; note?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) return { note: "Manca TELEGRAM_BOT_TOKEN" };
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates`, { cache: "no-store", signal: AbortSignal.timeout(10000) });
    if (!res.ok) return { note: res.status === 401 ? "Token non valido: ricontrolla TELEGRAM_BOT_TOKEN" : `Telegram errore ${res.status}` };
    const list =
      ((await res.json()) as { result?: { message?: { chat?: { id: number; first_name?: string; title?: string } } }[] }).result ?? [];
    const chat = [...list].reverse().find((u) => u.message?.chat)?.message?.chat;
    if (!chat) return { note: "Nessun messaggio ricevuto: apri il bot in Telegram, premi Avvia e scrivi «ciao», poi ricarica." };
    return { id: String(chat.id), name: chat.first_name ?? chat.title };
  } catch (e) {
    return { note: (e as Error).message };
  }
}
