/**
 * fetch con scadenza: se il server remoto (WordPress, Supabase, Google…) non risponde,
 * la richiesta si interrompe invece di bloccare la pagina fino al limite di Vercel.
 * Se il chiamante passa già un proprio `signal`, resta quello.
 */
export function tfetch(input: string | URL | Request, init: RequestInit = {}, ms = 15000): Promise<Response> {
  if (init.signal) return fetch(input, init);
  return fetch(input, { ...init, signal: AbortSignal.timeout(ms) });
}
