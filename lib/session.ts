import { createHmac, timingSafeEqual } from "crypto";

/**
 * Sessione di accesso: un cookie firmato con la password dell'app.
 * Formato: <scadenza in ms>.<firma HMAC-SHA256 esadecimale>. Se cambi APP_PASSWORD le sessioni esistenti decadono.
 * (Il middleware, che gira su Edge, ricalcola la stessa firma con Web Crypto.)
 */
export const SESSION_COOKIE = "cc_session";
export const SESSION_DAYS = 30;

const chiave = (password: string) => `cosmo-control-session:${password}`;

export function creaSessione(password: string): { valore: string; maxAge: number } {
  const exp = Date.now() + SESSION_DAYS * 86400000;
  const firma = createHmac("sha256", chiave(password)).update(String(exp)).digest("hex");
  return { valore: `${exp}.${firma}`, maxAge: SESSION_DAYS * 86400 };
}

export function passwordGiusta(data: string, password: string): boolean {
  const a = Buffer.from(data);
  const b = Buffer.from(password);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Indirizzo interno sicuro dove andare dopo l'accesso (mai verso altri siti). */
export function destinazione(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\") || next.startsWith("/login") || next.startsWith("/api/")) return "/";
  return next;
}
