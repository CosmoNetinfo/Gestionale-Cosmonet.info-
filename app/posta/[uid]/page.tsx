import Link from "next/link";
import { leggiMail, postaAttiva } from "@/lib/posta";
import { Card, PageHeader } from "@/components/ui";
import { Rispondi } from "@/components/Rispondi";
import { AzioniMail } from "@/components/AzioniMail";

export const dynamic = "force-dynamic";

export default async function Mail({ params, searchParams }: { params: { uid: string }; searchParams: { c?: string } }) {
  const uid = Number(params.uid);
  const inviata = searchParams.c === "inviata";
  const r = postaAttiva() && Number.isInteger(uid) && uid > 0 ? await leggiMail(uid, inviata) : { ok: false, errore: "Messaggio non valido o posta non collegata" };
  const rispondiA = r.mail && !inviata ? (r.mail.rispondiA ?? "") : "";
  return (
    <>
      <PageHeader title={r.mail?.oggetto ?? "Messaggio"} right={<Link href={inviata ? "/posta?c=inviata" : "/posta"} className="text-sm text-primary hover:underline">← Posta</Link>} />
      {!r.ok && <Card className="border-danger/30 bg-danger-soft">Non riesco ad aprire il messaggio: {r.errore}</Card>}
      {r.mail && (
        <Card>
          <div className="space-y-1 text-sm">
            <div><span className="text-muted">Da:</span> {r.mail.da}</div>
            <div><span className="text-muted">A:</span> {r.mail.a}</div>
            {r.mail.data && (
              <div>
                <span className="text-muted">Data:</span>{" "}
                {new Date(r.mail.data).toLocaleString("it-IT", { timeZone: "Europe/Rome", dateStyle: "long", timeStyle: "short" })}
              </div>
            )}
            {r.mail.allegati.length > 0 && (
              <div><span className="text-muted">Allegati (non scaricabili qui):</span> {r.mail.allegati.join(", ")}</div>
            )}
          </div>
          <hr className="my-4 border-line" />
          <p className="whitespace-pre-wrap break-words text-sm">{r.mail.testo}</p>
          <AzioniMail uid={uid} inviata={inviata} nonLetta={r.mail.nonLetta ?? false} />
          {rispondiA && <Rispondi a={rispondiA} oggetto={r.mail.oggetto} citazione={r.mail.testo.slice(0, 3000)} inRispostaA={r.mail.idMessaggio} />}
          <p className="mt-6 text-xs text-muted">Si vede solo il testo semplice. Link e immagini del messaggio originale non vengono caricati.</p>
        </Card>
      )}
    </>
  );
}
