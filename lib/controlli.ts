import {
  controlloCampione,
  controlloDominio,
  controlloHome,
  controlloIndicizzazione,
  controlloLink,
  controlloMonitorAttivo,
  controlloPlugin,
  controlloPubblicazione,
  controlloSeoBase,
  saveRows,
} from "@/lib/monitor";
import { esc, sendTelegramLong, telegramConfigured } from "@/lib/telegram";

/**
 * I controlli giornalieri del sito e il report su Telegram.
 * Usata dal cron delle 6:15 e dal pulsante «Rimanda il report» in Stato 360.
 * opz.sempre: invia il report anche se non ci sono segnalazioni. opz.dry: prova senza inviare né salvare.
 */
export async function eseguiControlli(opz: { dry?: boolean; sempre?: boolean; nonSalvare?: boolean } = {}) {
  const base = process.env.WP_BASE_URL?.replace(/\/$/, "") ?? "https://www.cosmonet.info";
  const errori: string[] = [];
  const run = async (nome: string, fn: () => Promise<string[]>) => {
    try {
      return await fn();
    } catch (e) {
      errori.push(`${nome}: ${(e as Error).message}`);
      return [];
    }
  };
  const sezioni: { titolo: string; aiuto: string; fn: () => Promise<string[]> }[] = [
    { titolo: "Visibilità su Google (robots.txt e sitemap)", aiuto: "Controlla «Visibilità sui motori» in WordPress e il plugin SEO.", fn: () => controlloSeoBase(base) },
    { titolo: "Home page", aiuto: "Apri la home e il plugin SEO: titolo, canonical, https.", fn: () => controlloHome(base) },
    { titolo: "Campione di pagine del sito", aiuto: "Apri le pagine indicate e guarda lo stato e il noindex.", fn: () => controlloCampione(base) },
    { titolo: "Indicizzazione degli articoli recenti", aiuto: "Dopo 4-21 giorni: in Search Console usa «Controllo URL» e «Richiedi indicizzazione».", fn: controlloIndicizzazione },
    { titolo: "Link rotti negli articoli", aiuto: "Dimmi «sistema i link rotti» e li correggo sulle fonti ufficiali: quelli che non trovo li tolgo.", fn: controlloLink },
    { titolo: "Pubblicazione", aiuto: "Riprogramma l'articolo o pubblicalo a mano da WordPress.", fn: controlloPubblicazione },
    { titolo: "Plugin da aggiornare", aiuto: "Aggiornali dalla bacheca di WordPress (Plugin → Aggiornamenti), meglio dopo un backup.", fn: controlloPlugin },
    { titolo: "Scadenza del dominio", aiuto: "Rinnova il dominio dal pannello del registrar.", fn: () => controlloDominio(base) },
    { titolo: "Monitor (velocità e disponibilità)", aiuto: "Apri la pagina Stato 360 di Cosmo Control per i dettagli.", fn: controlloMonitorAttivo },
  ];
  const nomi = ["seo", "home", "campione", "indicizzazione", "link", "pubblicazione", "plugin", "dominio", "monitor"];
  const risultati = await Promise.all(sezioni.map((x, i) => run(nomi[i], x.fn)));
  const avvisi = risultati.flat();
  const dry = opz.dry === true;
  if (!dry && !opz.nonSalvare) {
    await saveRows([
      { taken_at: new Date().toISOString(), kind: "controlli", url: base + "/", score: avvisi.length, lcp: null, fcp: null, cls: null, tbt: null, http_status: null, ttfb_ms: null, cert_days: null, errore: avvisi.length ? avvisi.join("\n").slice(0, 4000) : null },
    ]).catch(() => null);
  }
  let telegram = "non inviato";
  if ((avvisi.length || opz.sempre) && telegramConfigured() && !dry) {
    const quando = new Date().toLocaleString("it-IT", { timeZone: "Europe/Rome", dateStyle: "full", timeStyle: "short" });
    const conProblemi = sezioni.filter((_, i) => risultati[i].some((r) => !r.startsWith("ℹ️")));
    const righe: string[] = [
      "📋 <b>REPORT DEI CONTROLLI DEL SITO — Cosmonet.info</b>",
      `<i>Report automatico di Cosmo Control · ${esc(quando)}</i>`,
      "",
      avvisi.length ? `<b>Esito:</b> ${avvisi.filter((r) => !r.startsWith("ℹ️")).length} segnalazioni in ${conProblemi.length} controlli su ${sezioni.length}. Gli altri ${sezioni.length - conProblemi.length} controlli sono in regola ✅` : `<b>Esito:</b> nessuna segnalazione, tutti i ${sezioni.length} controlli sono in regola ✅`,
    ];
    sezioni.forEach((x, i) => {
      const r = risultati[i];
      if (!r.length) return;
      righe.push("", `<b>${esc(x.titolo)}</b>`, ...r.map(esc), `<i>Cosa fare: ${esc(x.aiuto)}</i>`);
    });
    const ok = sezioni.filter((_, i) => !risultati[i].length).map((x) => x.titolo);
    if (ok.length) righe.push("", "✅ <b>In regola:</b> " + esc(ok.join(", ")));
    if (errori.length) righe.push("", "⚠️ <b>Controlli non riusciti:</b> " + esc(errori.join(" · ")));
    righe.push("", '🔗 <a href="https://cosmo-control.vercel.app/stato-360">Apri Stato 360 in Cosmo Control</a>');
    const r = await sendTelegramLong(righe.join("\n"));
    telegram = r.ok ? `inviato (${r.parti} ${r.parti === 1 ? "messaggio" : "messaggi"})` : r.message;
  }
  return { ok: errori.length === 0, errori, telegram, avvisi };
}
