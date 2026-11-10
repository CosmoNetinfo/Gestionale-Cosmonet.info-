import { timingSafeEqual } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { agendaAttiva, agendaCall, type AgendaTask } from "@/lib/agenda";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: NextRequest, secret: string): boolean {
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return given.length === want.length && timingSafeEqual(given, want);
}

// Attività fisse di Cosmo Agenda. quando: ogni giorno, un giorno della settimana (1=lun) o del mese.
type Regola = { titolo: string; kind: string; notes: string; quando: { ogni: "giorno" } | { settimana: number } | { mese: number }; priority?: "bassa" | "normale" | "alta" };

const REGOLE: Regola[] = [
  {
    titolo: "🤖 Notizie Zio Buddha Labs: schermatura articoli da scrivere",
    kind: "articolo",
    notes: "Ogni giorno, 365 giorni l'anno. Controllare le notizie (Zio Buddha Labs e pagina Da scrivere di Cosmo Control) e scegliere gli articoli da scrivere.",
    quando: { ogni: "giorno" },
  },
  {
    titolo: "🤖 Search Console: confronto settimanale impressioni e crescita",
    kind: "sito",
    notes: "Ogni lunedì. Confrontare impressioni, click e posizione con la settimana prima: il sito deve essere in crescita.",
    quando: { settimana: 1 },
    priority: "alta",
  },
  {
    titolo: "🤖 Controllo mensile del sito: manutenzione, link, salute",
    kind: "sito",
    notes: "Una volta al mese (prima se arriva un avviso). Controllo completo da Debug, scansione Link e immagini, Salute del sito, plugin e aggiornamenti.",
    quando: { mese: 1 },
    priority: "alta",
  },
  {
    titolo: "🤖 Search Console: indicizzazione delle pagine",
    kind: "sito",
    notes: "Una volta al mese. Vedere quali pagine non sono indicizzate e perché, reinviare la sitemap se serve.",
    quando: { mese: 2 },
  },
];

function scatta(r: Regola, oggi: string): boolean {
  const d = new Date(`${oggi}T12:00:00Z`);
  if ("ogni" in r.quando) return true;
  if ("settimana" in r.quando) return d.getUTCDay() === r.quando.settimana % 7;
  return d.getUTCDate() === r.quando.mese;
}

/** Vercel lo chiama ogni giorno (vercel.json): crea in Cosmo Agenda le attività fisse del giorno, senza duplicarle. */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return new NextResponse("Not found", { status: 404 });
  if (!authorized(req, secret)) return new NextResponse("Unauthorized", { status: 401 });
  if (!agendaAttiva()) return NextResponse.json({ ok: false, errore: "AGENDA_URL non configurata" });

  const oggi = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Rome" });
  const esistenti: AgendaTask[] = (await agendaCall("get_day", { date: oggi })).tasks ?? [];
  const creati: string[] = [];
  for (const r of REGOLE.filter((x) => scatta(x, oggi))) {
    if (esistenti.some((t) => t.title === r.titolo)) continue;
    await agendaCall("add_task", { title: r.titolo, date: oggi, kind: r.kind, project: "Cosmonet", priority: r.priority ?? "normale", notes: r.notes });
    creati.push(r.titolo);
  }
  return NextResponse.json({ ok: true, data: oggi, creati });
}
