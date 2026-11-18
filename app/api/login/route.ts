import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, creaSessione, destinazione, passwordGiusta } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Riceve il modulo della pagina di accesso. Dopo un errore aspetta un attimo, per rallentare chi prova password a caso. */
export async function POST(req: NextRequest) {
  const password = process.env.APP_PASSWORD;
  const form = await req.formData().catch(() => null);
  const dato = String(form?.get("password") ?? "");
  const next = destinazione(String(form?.get("next") ?? ""));
  const vai = (path: string) => NextResponse.redirect(new URL(path, req.url), 303);

  if (!password) return new NextResponse("APP_PASSWORD non configurata.", { status: 503 });
  if (!dato || !passwordGiusta(dato, password)) {
    await new Promise((r) => setTimeout(r, 1200));
    return vai(`/login?errore=1${next !== "/" ? `&next=${encodeURIComponent(next)}` : ""}`);
  }
  const s = creaSessione(password);
  const res = vai(next);
  res.cookies.set(SESSION_COOKIE, s.valore, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: s.maxAge,
  });
  return res;
}
