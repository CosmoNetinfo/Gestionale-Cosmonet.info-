/**
 * Posta in SOLA LETTURA via IMAP (nessun messaggio viene segnato come letto, spostato o cancellato).
 * Variabili (solo lato server, mai nel codice):
 *  - MAIL_IMAP_HOST, MAIL_IMAP_PORT (default 993, SSL)
 *  - MAIL_USER (indirizzo completo), MAIL_PASSWORD
 * Si mostra solo il testo semplice: l'HTML dei messaggi non viene mai interpretato.
 */
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";

export interface MailRiga {
  uid: number;
  da: string;
  oggetto: string;
  data: string | null;
  nonLetta: boolean;
}

function conf() {
  const host = process.env.MAIL_IMAP_HOST?.trim();
  const user = process.env.MAIL_USER?.trim();
  const pass = process.env.MAIL_PASSWORD;
  const port = Number(process.env.MAIL_IMAP_PORT || 993);
  return host && user && pass ? { host, user, pass, port } : null;
}

export const postaAttiva = () => conf() !== null;
export const indirizzoPosta = () => process.env.MAIL_USER?.trim() ?? "";

function client() {
  const c = conf()!;
  return new ImapFlow({
    host: c.host,
    port: c.port,
    secure: c.port === 993,
    auth: { user: c.user, pass: c.pass },
    logger: false,
    socketTimeout: 20000,
    greetingTimeout: 10000,
  });
}

/** Percorso della cartella: INBOX oppure «Posta inviata» (cercata per uso speciale o per nome). */
async function percorso(cl: ImapFlow, inviata: boolean): Promise<string | null> {
  if (!inviata) return "INBOX";
  const cartelle = await cl.list();
  const f = cartelle.find((x) => x.specialUse === "\\Sent") ?? cartelle.find((x) => /^(sent|posta inviata|inviata|inviati)/i.test(x.name));
  return f ? f.path : null;
}

const msg = (e: unknown) => (e instanceof Error ? e.message : "Errore di connessione");

export async function elencaPosta(quante = 40, inviata = false): Promise<{ ok: boolean; righe: MailRiga[]; totale: number; errore?: string }> {
  if (!conf()) return { ok: false, righe: [], totale: 0, errore: "Non collegato" };
  const cl = client();
  try {
    await cl.connect();
    const cartella = await percorso(cl, inviata);
    if (!cartella) return { ok: false, righe: [], totale: 0, errore: "Cartella «Posta inviata» non trovata (nessuna risposta inviata da qui?)" };
    const lock = await cl.getMailboxLock(cartella, { readOnly: true });
    try {
      const totale = (cl.mailbox && typeof cl.mailbox === "object" ? cl.mailbox.exists : 0) ?? 0;
      const righe: MailRiga[] = [];
      if (totale > 0) {
        const da = Math.max(1, totale - quante + 1);
        for await (const m of cl.fetch(`${da}:*`, { uid: true, envelope: true, flags: true })) {
          const f = inviata ? m.envelope?.to?.[0] : m.envelope?.from?.[0];
          righe.push({
            uid: m.uid,
            da: f ? (f.name ? `${f.name} <${f.address ?? ""}>` : f.address ?? "") : "",
            oggetto: m.envelope?.subject ?? "(senza oggetto)",
            data: m.envelope?.date ? new Date(m.envelope.date).toISOString() : null,
            nonLetta: !m.flags?.has("\\Seen"),
          });
        }
      }
      righe.sort((a, b) => b.uid - a.uid);
      return { ok: true, righe, totale };
    } finally {
      lock.release();
    }
  } catch (e) {
    return { ok: false, righe: [], totale: 0, errore: msg(e) };
  } finally {
    await cl.logout().catch(() => undefined);
  }
}

export interface MailDettaglio {
  da: string;
  a: string;
  oggetto: string;
  data: string | null;
  testo: string;
  allegati: string[];
  rispondiA?: string;
  idMessaggio?: string;
}

export async function leggiMail(uid: number, inviata = false): Promise<{ ok: boolean; mail?: MailDettaglio; errore?: string }> {
  if (!conf()) return { ok: false, errore: "Non collegato" };
  const cl = client();
  try {
    await cl.connect();
    const cartella = await percorso(cl, inviata);
    if (!cartella) return { ok: false, errore: "Cartella «Posta inviata» non trovata" };
    const lock = await cl.getMailboxLock(cartella, { readOnly: true });
    try {
      const scarico = await cl.download(String(uid), undefined, { uid: true, maxBytes: 2_000_000 });
      if (!scarico || !scarico.content) return { ok: false, errore: "Messaggio non trovato" };
      const parti: Buffer[] = [];
      for await (const pezzo of scarico.content) parti.push(Buffer.from(pezzo));
      const p = await simpleParser(Buffer.concat(parti));
      const testo = (p.text ?? "").trim() || "(Questo messaggio non ha testo semplice: aprilo nella webmail.)";
      return {
        ok: true,
        mail: {
          da: p.from?.text ?? "",
          a: Array.isArray(p.to) ? p.to.map((x) => x.text).join(", ") : p.to?.text ?? "",
          oggetto: p.subject ?? "(senza oggetto)",
          data: p.date ? p.date.toISOString() : null,
          testo: testo.slice(0, 20000),
          rispondiA: (p.replyTo?.value?.[0]?.address ?? p.from?.value?.[0]?.address ?? "").trim() || undefined,
          idMessaggio: p.messageId ?? undefined,
          allegati: (p.attachments ?? []).map((a) => `${a.filename ?? "allegato"} (${Math.round(a.size / 1024)} KB)`),
        },
      };
    } finally {
      lock.release();
    }
  } catch (e) {
    return { ok: false, errore: msg(e) };
  } finally {
    await cl.logout().catch(() => undefined);
  }
}
