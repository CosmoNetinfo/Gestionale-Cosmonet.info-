import { NextResponse, type NextRequest } from "next/server";

/**
 * Protezione per uso personale: pagina di accesso /login con password in APP_PASSWORD.
 * Dopo l'accesso resta un cookie firmato (30 giorni). Per strumenti esterni resta valido anche l'accesso Basic (qualsiasi nome utente).
 * In produzione, senza APP_PASSWORD l'app resta chiusa. In sviluppo, senza APP_PASSWORD è aperta.
 */

/** Confronto a tempo costante (l'Edge runtime non ha crypto.timingSafeEqual). */
function uguali(a: string, b: string): boolean {
  const n = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < n; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

const hex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");

/** Stessa firma creata in lib/session.ts (HMAC-SHA256 della scadenza). */
async function sessioneValida(valore: string | undefined, password: string): Promise<boolean> {
  if (!valore) return false;
  const [exp, firma] = valore.split(".");
  if (!exp || !firma || !/^\d+$/.test(exp) || Number(exp) < Date.now()) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(`cosmo-control-session:${password}`), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const atteso = hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(exp)));
  return uguali(firma, atteso);
}

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  // Il server MCP si protegge da solo con MCP_TOKEN (nell'indirizzo): Claude non può inserire la password.
  if (path.startsWith("/api/mcp/")) return NextResponse.next();
  // Il cron di Vercel si protegge da solo con CRON_SECRET (Authorization: Bearer ...).
  if (path.startsWith("/api/cron/")) return NextResponse.next();
  // Pagina di accesso e relative richieste.
  if (path === "/login" || path === "/api/login" || path === "/api/logout") return NextResponse.next();

  const password = process.env.APP_PASSWORD;

  if (!password) {
    if (process.env.NODE_ENV === "production") {
      return new NextResponse("APP_PASSWORD non configurata.", { status: 503 });
    }
    return NextResponse.next();
  }

  if (await sessioneValida(req.cookies.get("cc_session")?.value, password)) return NextResponse.next();

  const header = req.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    try {
      const decoded = atob(header.slice(6));
      const given = decoded.slice(decoded.indexOf(":") + 1);
      if (uguali(given, password)) return NextResponse.next();
    } catch {
      /* credenziali malformate: si ricade sulla pagina di accesso */
    }
  }

  // Le richieste di dati (API) ricevono un errore; le pagine vengono mandate all'accesso.
  if (path.startsWith("/api/")) return new NextResponse("Accesso richiesto.", { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  if (path !== "/") url.searchParams.set("next", path + req.nextUrl.search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|apple-icon.png|icon.svg).*)"],
};
