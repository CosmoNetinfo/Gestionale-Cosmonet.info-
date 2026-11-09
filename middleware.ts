import { NextResponse, type NextRequest } from "next/server";

/**
 * Protezione semplice per uso personale: password in APP_PASSWORD (qualsiasi nome utente).
 * In produzione, senza APP_PASSWORD l'app resta chiusa.
 * In sviluppo, senza APP_PASSWORD è aperta.
 */
export function middleware(req: NextRequest) {
  const password = process.env.APP_PASSWORD;

  if (!password) {
    if (process.env.NODE_ENV === "production") {
      return new NextResponse("APP_PASSWORD non configurata.", { status: 503 });
    }
    return NextResponse.next();
  }

  const header = req.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    try {
      const decoded = atob(header.slice(6));
      const given = decoded.slice(decoded.indexOf(":") + 1);
      if (given === password) return NextResponse.next();
    } catch {
      /* credenziali malformate: si ricade sulla richiesta di accesso */
    }
  }

  return new NextResponse("Accesso richiesto.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Cosmo Control"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
