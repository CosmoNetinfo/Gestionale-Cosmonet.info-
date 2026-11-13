import Link from "next/link";
import { elencaPosta, indirizzoPosta, postaAttiva } from "@/lib/posta";
import { Badge, Card, Kpi, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

const quando = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("it-IT", { timeZone: "Europe/Rome", dateStyle: "short", timeStyle: "short" }) : "";

export default async function Posta() {
  const attiva = postaAttiva();
  const r = attiva ? await elencaPosta() : { ok: false, righe: [], totale: 0, errore: "Non collegato" };
  const nonLette = r.righe.filter((x) => x.nonLetta).length;

  return (
    <>
      <PageHeader title="Posta" subtitle={attiva ? `Casella ${indirizzoPosta()} (sola lettura)` : "La tua casella email di Cosmonet"} />
      {!attiva && (
        <Card className="border-warn/30 bg-warn-soft">
          <p className="text-sm font-medium">Da collegare.</p>
          <p className="mt-1 text-sm text-muted">
            Su Vercel aggiungi <code>MAIL_IMAP_HOST</code> (il server IMAP del tuo provider di posta),{" "}
            <code>MAIL_USER</code> (l&apos;indirizzo completo) e <code>MAIL_PASSWORD</code>; <code>MAIL_IMAP_PORT</code> è
            facoltativa (default 993). Poi nuovo deploy. La password resta solo su Vercel.
          </p>
        </Card>
      )}
      {attiva && !r.ok && <Card className="border-danger/30 bg-danger-soft">Non riesco a leggere la posta: {r.errore}</Card>}
      {r.ok && (
        <>
          <div className="grid grid-cols-3 gap-5">
            <Kpi label="In arrivo" value={r.totale} hint="messaggi totali" />
            <Kpi label="Non letti" value={nonLette} hint={`tra gli ultimi ${r.righe.length}`} />
          </div>
          <Card className="mt-5 divide-y divide-line !p-0">
            {r.righe.length === 0 && <div className="p-5 text-sm text-muted">Nessun messaggio.</div>}
            {r.righe.map((m) => (
              <Link key={m.uid} href={`/posta/${m.uid}`} className="flex items-center gap-4 px-5 py-3 hover:bg-bg">
                <div className="w-56 shrink-0 truncate text-sm">{m.nonLetta ? <b>{m.da}</b> : m.da}</div>
                <div className="min-w-0 flex-1 truncate text-sm">{m.nonLetta ? <b>{m.oggetto}</b> : m.oggetto}</div>
                {m.nonLetta && <Badge tone="warn">Nuova</Badge>}
                <div className="w-32 shrink-0 text-right text-xs text-muted">{quando(m.data)}</div>
              </Link>
            ))}
          </Card>
          <p className="mt-6 text-xs text-muted">
            Aprire un messaggio qui non lo segna come letto e non cambia nulla nella casella. Per rispondere usa la webmail.
          </p>
        </>
      )}
    </>
  );
}
