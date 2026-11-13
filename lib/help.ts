/** Guida per pagina: cosa fa, cosa puoi fare, un consiglio. Mostrata dal pulsante «? Aiuto». */
export interface Guida {
  titolo: string;
  cosa: string;
  azioni: string[];
  consiglio?: string;
}

const G: Record<string, Guida> = {
  "/": {
    titolo: "Panoramica",
    cosa: "Il quadro generale del sito: quanti articoli ci sono, quanti vanno rivisti e come stanno andando click e impressioni.",
    azioni: [
      "Controlla i 4 numeri in alto: pubblicati, programmati, bozze e da rivedere.",
      "Guarda «Richiede attenzione»: sono gli articoli da rivedere con più potenziale.",
      "Premi «Aggiorna» se i numeri non coincidono con WordPress.",
    ],
    consiglio: "Parti da «Prossimo da rivedere»: ti porta all'articolo che conviene sistemare per primo.",
  },
  "/rivedere": {
    titolo: "Da rivedere",
    cosa: "Gli articoli pubblicati non toccati da molto tempo, in ordine di priorità, con fasce di urgenza.",
    azioni: [
      "Clicca sulla barra colorata per filtrare per età (da controllare, urgenti, critici).",
      "Usa «Modifica ↗» per aprire l'articolo in WordPress.",
      "Quando hai finito premi «✓ Rivisto»: l'articolo esce dalla lista per 90 giorni.",
    ],
    consiglio: "Inizia dai critici con molte impressioni: sono quelli dove un aggiornamento rende di più.",
  },
  "/sito": {
    titolo: "Sito",
    cosa: "L'elenco di tutti gli articoli con stato, età, revisione e dati di Search Console.",
    azioni: [
      "Filtra per stato (pubblicati, bozze, da rivedere…) con i pulsanti in alto.",
      "Clicca sulle intestazioni delle colonne per ordinare.",
      "Cerca per titolo, ID o categoria; «Esporta CSV» scarica l'elenco per Excel.",
      "Clicca un titolo per aprire la scheda dell'articolo.",
    ],
  },
  "/repository": {
    titolo: "Repository",
    cosa: "Le repository GitHub dei tuoi progetti.",
    azioni: ["Vedi quali sono pubbliche o private.", "Apri una repository su GitHub dal suo nome."],
  },
  "/grafici": {
    titolo: "Grafici",
    cosa: "L'andamento di click e impressioni da Search Console negli ultimi 90 giorni.",
    azioni: ["Cerca picchi e cali.", "Confronta i periodi per capire se una revisione ha funzionato."],
    consiglio: "I dati di Google hanno 2-3 giorni di ritardo: non allarmarti se gli ultimi giorni sembrano bassi.",
  },
  "/avvisi": {
    titolo: "Avvisi",
    cosa: "Cali e crescite degli ultimi 28 giorni e articoli che si fanno concorrenza tra loro.",
    azioni: ["Guarda prima i cali: sono gli articoli da controllare.", "Se due articoli competono per la stessa ricerca, valuta di unirli o differenziarli."],
  },
  "/da-scrivere": {
    titolo: "Da scrivere",
    cosa: "Notizie dai tuoi feed RSS, senza quelle su cui hai già un articolo.",
    azioni: ["Scorri le notizie fresche e scegli quelle da trattare.", "Gestisci le fonti dalla pagina «Fonti RSS»."],
    consiglio: "Per una notizia importante, scrivila in giornata: salta la coda.",
  },
  "/agenda": {
    titolo: "Agenda",
    cosa: "Le cose da fare oggi, divise tra te e Claude (da Cosmo Agenda).",
    azioni: ["Controlla le attività del giorno.", "Apri Cosmo Agenda col pulsante in alto per modificarle."],
  },
  "/pubblica": {
    titolo: "Pubblica",
    cosa: "Un solo testo da pubblicare su Facebook, Instagram e Discord, con lo storico di quanto già pubblicato.",
    azioni: ["Scrivi il testo una volta e scegli i canali.", "Controlla lo storico per non ripetere post."],
    consiglio: "LinkedIn si pubblica a mano, con il link nel primo commento.",
  },
  "/facebook": {
    titolo: "Facebook",
    cosa: "Pubblica o programma un post sulla pagina Cosmonet.Info.",
    azioni: ["Scrivi il testo, aggiungi il link e scegli se pubblicare ora o programmare."],
  },
  "/discord": {
    titolo: "Discord",
    cosa: "Pubblica sul server Discord di Cosmonet (nel forum ogni post diventa un thread).",
    azioni: ["Scrivi il messaggio e pubblica.", "I lettori possono rispondere nel thread."],
  },
  "/opportunita": {
    titolo: "Opportunità",
    cosa: "Parole chiave vicine alla prima pagina e link interni consigliati.",
    azioni: ["Scegli una parola chiave in posizione 5-20 e rafforza l'articolo.", "Aggiungi i link interni suggeriti per spingerlo."],
  },
  "/report": {
    titolo: "Report settimanale",
    cosa: "Gli ultimi 7 giorni contro i 7 precedenti.",
    azioni: ["Leggi il riepilogo a inizio settimana.", "Annota gli articoli che salgono o scendono."],
  },
  "/ricerche": {
    titolo: "Ricerche",
    cosa: "Cosa cercano le persone per arrivare al sito (ultimi 28 giorni contro i 28 precedenti).",
    azioni: ["Trova ricerche nuove su cui scrivere.", "Guarda quelle con tante impressioni e pochi click: il titolo va migliorato."],
  },
  "/segmenti": {
    titolo: "Segmenti",
    cosa: "Come va per categoria, paese e dispositivo.",
    azioni: ["Capisci quali categorie crescono.", "Controlla se il mobile va peggio del desktop."],
  },
  "/impatto": {
    titolo: "Impatto delle revisioni",
    cosa: "Dopo aver ritoccato un articolo, i click sono saliti?",
    azioni: ["Confronta i click prima e dopo ogni «✓ Rivisto».", "Ripeti il tipo di intervento che funziona."],
    consiglio: "Servono almeno 28 giorni dopo la revisione per giudicare.",
  },
  "/salute": {
    titolo: "Salute del sito",
    cosa: "Controlli automatici sugli articoli per trovare cosa sistemare.",
    azioni: ["Parti dai problemi più gravi.", "Correggi e premi «Aggiorna» per verificare."],
  },
  "/link": {
    titolo: "Link e immagini",
    cosa: "Trova link che non funzionano e immagini senza testo alternativo.",
    azioni: ["Avvia la scansione.", "Correggi i link rotti dall'articolo in WordPress."],
  },
  "/archivio": {
    titolo: "Archivio",
    cosa: "Quanto spazio usa il database e quali file temporanei ci sono dentro.",
    azioni: ["Controlla lo spazio usato.", "Elimina i file temporanei solo dopo la conferma richiesta."],
  },
  "/stato": {
    titolo: "Stato servizi",
    cosa: "Il sito è online? Certificato, sitemap, API.",
    azioni: ["Controlla se tutto è verde.", "Se qualcosa è rosso, apri Debug per i dettagli."],
  },
  "/debug": {
    titolo: "Debug",
    cosa: "Controllo di tutto il gestionale: collegamenti, chiavi e dati.",
    azioni: ["Leggi gli errori in cima.", "Usalo quando una pagina mostra «Dati dimostrativi»."],
  },
  "/indicizzazione": {
    titolo: "Indicizzazione",
    cosa: "Gli ultimi articoli pubblicati, secondo Google: indicizzati o no.",
    azioni: ["Controlla che gli articoli nuovi siano indicizzati.", "Se non lo sono dopo qualche giorno, chiedi l'indicizzazione da Search Console."],
  },
  "/coda": {
    titolo: "Coda di pubblicazione",
    cosa: "Cosa è programmato, cosa è in bozza e quali giorni sono vuoti.",
    azioni: ["Riempi i giorni vuoti.", "Controlla le bozze ferme."],
  },
  "/velocita": {
    titolo: "Velocità",
    cosa: "PageSpeed e Core Web Vitals della home e dei 4 articoli che portano più click.",
    azioni: ["Guarda i punteggi per mobile.", "Intervieni su immagini pesanti o plugin lenti."],
  },
  "/memo": {
    titolo: "Cosmo Memo",
    cosa: "La tua memoria esterna: pagine, idee e progetti.",
    azioni: ["Apri Cosmo Memo dal pulsante in alto.", "Qui è in sola lettura."],
  },
  "/messaggi": {
    titolo: "Messaggi dal sito",
    cosa: "I messaggi che i lettori inviano dal modulo Contatti del sito.",
    azioni: ["Leggi i nuovi messaggi.", "Per rispondere usa la mail del mittente: clic sull'indirizzo."],
  },
  "/posta": {
    titolo: "Posta",
    cosa: "La tua casella email di Cosmonet, in sola lettura: aprire un messaggio non lo segna come letto.",
    azioni: ["Clicca un messaggio per leggerlo.", "Per rispondere usa la webmail."],
  },
  "/canali": {
    titolo: "Canali",
    cosa: "Le community di Cosmonet.",
    azioni: ["Apri i canali con un clic."],
  },
  "/impostazioni": {
    titolo: "Impostazioni",
    cosa: "Collegamenti e regole del gestionale, per esempio la soglia di revisione.",
    azioni: ["Controlla quali servizi sono collegati.", "Le soglie si cambiano su Vercel (REVIEW_DAYS)."],
  },
};

/** Trova la guida più specifica per un percorso. */
export function guidaPer(pathname: string): Guida {
  if (G[pathname]) return G[pathname];
  if (/^\/sito\/\d+\/modifica/.test(pathname))
    return {
      titolo: "Modifica articolo",
      cosa: "Cambi titolo, SEO e stato dell'articolo. Le modifiche partono solo dopo la tua conferma.",
      azioni: ["Controlla titolo SEO e meta description.", "Conferma per salvare su WordPress."],
    };
  if (/^\/sito\/\d+/.test(pathname))
    return {
      titolo: "Scheda articolo",
      cosa: "Tutto su un articolo: ricerche che lo portano, andamento, note e stato di revisione.",
      azioni: ["Guarda le ricerche e migliora titolo e testo.", "Salva una nota su cosa hai in mente.", "Premi «✓ Rivisto» a lavoro finito."],
    };
  if (pathname.startsWith("/da-scrivere/fonti"))
    return { titolo: "Fonti RSS", cosa: "Le fonti da cui arrivano le notizie.", azioni: ["Controlla l'elenco.", "Importa o aggiorna le fonti."] };
  if (pathname.startsWith("/facebook/attivita"))
    return { titolo: "Commenti Facebook", cosa: "Ultimi post con reazioni, commenti e risposte.", azioni: ["Rispondi ai commenti nuovi.", "Guarda quali post funzionano."] };
  const base = "/" + pathname.split("/")[1];
  if (G[base]) return G[base];
  return { titolo: "Cosmo Control", cosa: "Gestionale personale di Cosmonet.info.", azioni: ["Usa la barra laterale o ⌘K per spostarti."] };
}
