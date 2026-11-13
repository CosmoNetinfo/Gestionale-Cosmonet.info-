/**
 * Invio risposte via SMTP dalla casella MAIL_USER. Parte SOLO da un clic esplicito di Dany in Cosmo Control.
 * Variabili: le stesse della posta (MAIL_USER, MAIL_PASSWORD). Facoltative: MAIL_SMTP_HOST (default = MAIL_IMAP_HOST), MAIL_SMTP_PORT (default 465).
 * Dopo l'invio, una copia viene salvata (se possibile) nella cartella «Posta inviata».
 */
import nodemailer from "nodemailer";
import MailComposer from "nodemailer/lib/mail-composer";
import { ImapFlow } from "imapflow";

const EMAIL = /^[^\s@<>",;]+@[^\s@<>",;]+\.[^\s@<>",;]+$/;

function conf() {
  const user = process.env.MAIL_USER?.trim();
  const pass = process.env.MAIL_PASSWORD;
  const host = (process.env.MAIL_SMTP_HOST || process.env.MAIL_IMAP_HOST)?.trim();
  const port = Number(process.env.MAIL_SMTP_PORT || 465);
  return user && pass && host ? { user, pass, host, port } : null;
}

export const invioAttivo = () => conf() !== null;

export interface Risposta {
  a: string;
  oggetto: string;
  testo: string;
  inRispostaA?: string;
}

export async function inviaRisposta(r: Risposta): Promise<{ ok: boolean; errore?: string; copiaSalvata?: boolean }> {
  const c = conf();
  if (!c) return { ok: false, errore: "Posta non collegata" };
  const a = r.a.trim();
  const oggetto = r.oggetto.replace(/[\r\n]+/g, " ").trim().slice(0, 200);
  const testo = r.testo.trim();
  if (!EMAIL.test(a)) return { ok: false, errore: "Indirizzo del destinatario non valido" };
  if (!oggetto) return { ok: false, errore: "Manca l'oggetto" };
  if (!testo) return { ok: false, errore: "Il messaggio è vuoto" };
  if (testo.length > 20000) return { ok: false, errore: "Messaggio troppo lungo" };

  const mail = {
    from: `Daniele Spalletti <${c.user}>`,
    to: a,
    subject: oggetto,
    text: testo,
    ...(r.inRispostaA && /^<[^\s<>]+>$/.test(r.inRispostaA) ? { inReplyTo: r.inRispostaA, references: r.inRispostaA } : {}),
  };

  try {
    const t = nodemailer.createTransport({
      host: c.host,
      port: c.port,
      secure: c.port === 465,
      auth: { user: c.user, pass: c.pass },
      connectionTimeout: 10000,
      socketTimeout: 20000,
    });
    await t.sendMail(mail);
  } catch (e) {
    return { ok: false, errore: e instanceof Error ? e.message : "Invio non riuscito" };
  }

  // Copia in «Posta inviata» (best effort: l'invio è già andato a buon fine)
  let copiaSalvata = false;
  const imapHost = process.env.MAIL_IMAP_HOST?.trim();
  if (imapHost) {
    const cl = new ImapFlow({
      host: imapHost,
      port: Number(process.env.MAIL_IMAP_PORT || 993),
      secure: Number(process.env.MAIL_IMAP_PORT || 993) === 993,
      auth: { user: c.user, pass: c.pass },
      logger: false,
      socketTimeout: 20000,
      greetingTimeout: 10000,
    });
    try {
      await cl.connect();
      const cartelle = await cl.list();
      const sent = cartelle.find((f) => f.specialUse === "\\Sent") ?? cartelle.find((f) => /^(sent|posta inviata|inviata|inviati)/i.test(f.name));
      if (sent) {
        const raw = await new MailComposer(mail).compile().build();
        await cl.append(sent.path, raw, ["\\Seen"]);
        copiaSalvata = true;
      }
    } catch {
      /* ignorato */
    } finally {
      await cl.logout().catch(() => undefined);
    }
  }
  return { ok: true, copiaSalvata };
}
