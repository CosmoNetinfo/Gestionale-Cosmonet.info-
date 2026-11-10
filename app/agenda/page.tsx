import { agendaAttiva, agendaTasks, AGENDA_SITO, type AgendaTask } from "@/lib/agenda";
import { Badge, Card, Kpi, PageHeader } from "@/components/ui";
import { fatto } from "./actions";

export const dynamic = "force-dynamic";

const oggiRoma = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Rome" });
const piu = (d: string, n: number) => {
  const x = new Date(`${d}T12:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};
const chi = (t: AgendaTask) => (t.title.includes("🤖") ? "claude" : t.title.includes("👤") ? "dany" : "da-smistare");
const bello = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "short" });

function Riga({ t }: { t: AgendaTask }) {
  return (
    <li className="flex items-center gap-3 py-2.5 text-sm">
      <form action={fatto}>
        <input type="hidden" name="id" value={t.id} />
        <button title="Segna fatto" className="h-5 w-5 rounded-full border border-line hover:border-primary hover:bg-primary-soft" />
      </form>
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{t.title}</div>
        <div className="text-xs text-muted">
          {bello(t.date)}
          {t.time ? ` · ${t.time.slice(0, 5)}` : ""} · {t.kind}
          {t.project ? ` · ${t.project}` : ""}
        </div>
      </div>
      {t.priority === "alta" && <Badge tone="warn">alta</Badge>}
      {!!t.postponed_count && <Badge tone="neutral">rimandata {t.postponed_count}×</Badge>}
    </li>
  );
}

export default async function Agenda() {
  const link = (
    <a href={AGENDA_SITO} target="_blank" rel="noreferrer" className="rounded-md border border-line px-3 py-1.5 text-sm text-muted hover:border-primary hover:text-primary">
      Apri Cosmo Agenda ↗
    </a>
  );
  if (!agendaAttiva())
    return (
      <>
        <PageHeader title="Agenda" subtitle="Le tue cose da fare, da Cosmo Agenda" right={link} />
        <Card>Per vedere l&apos;agenda qui serve la variabile AGENDA_URL su Vercel (progetto cosmo-control), poi un nuovo deploy.</Card>
      </>
    );

  const oggi = oggiRoma();
  let tasks: AgendaTask[] = [];
  let errore = "";
  try {
    tasks = await agendaTasks(piu(oggi, -30), piu(oggi, 7));
  } catch (e) {
    errore = (e as Error).message;
  }
  const arretrate = tasks.filter((t) => t.date < oggi);
  const di_oggi = tasks.filter((t) => t.date === oggi);
  const prossimi = tasks.filter((t) => t.date > oggi);
  const per = (x: string) => [...arretrate, ...di_oggi].filter((t) => chi(t) === x);

  const blocco = (titolo: string, lista: AgendaTask[]) => (
    <Card>
      <h2 className="mb-1 text-base font-semibold">
        {titolo} ({lista.length})
      </h2>
      {lista.length ? <ul className="divide-y divide-line">{lista.map((t) => <Riga key={t.id} t={t} />)}</ul> : <p className="text-sm text-muted">Niente.</p>}
    </Card>
  );

  return (
    <>
      <PageHeader title="Agenda" subtitle="Cosa c'è da fare oggi, diviso tra te e Claude" right={link} />
      {errore && <div className="mb-5 rounded-card border border-warn/30 bg-warn-soft px-4 py-3 text-sm text-warn">Cosmo Agenda non risponde: {errore}</div>}
      <div className="grid grid-cols-4 gap-5">
        <Kpi label="Oggi" value={di_oggi.length} />
        <Kpi label="Arretrate" value={arretrate.length} tone={arretrate.length ? "warn" : "default"} />
        <Kpi label="Prossimi 7 giorni" value={prossimi.length} />
        <Kpi label="Da smistare" value={per("da-smistare").length} hint="senza 🤖 o 👤" />
      </div>
      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
        {blocco("👤 Le fai tu", per("dany"))}
        {blocco("🤖 Le fa Claude", per("claude"))}
      </div>
      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
        {blocco("Da smistare", per("da-smistare"))}
        {blocco("Prossimi giorni", prossimi)}
      </div>
    </>
  );
}
