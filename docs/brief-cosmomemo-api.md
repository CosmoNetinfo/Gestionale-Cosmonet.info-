# Brief per GPT: accesso in sola lettura a Cosmo Memo

Repository: `CosmoNetinfo/CosmoMemo`. Prima di scrivere codice leggi `AGENTS.md` e la guida in
`node_modules/next/dist/docs/`: questa versione di Next.js ha differenze rispetto a quella che conosci.

## Obiettivo
Il gestionale personale "Cosmo Control" (cosmo-control.vercel.app) deve mostrare un riepilogo di Cosmo Memo
(progetti, attività aperte, pagine recenti). Cosmo Memo oggi accetta solo la sessione del proprietario o OAuth per
Claude, quindi serve **un solo endpoint nuovo, in sola lettura, protetto da un token**.

## Cosa aggiungere
`GET /api/read-only/summary`

- Autenticazione: header `Authorization: Bearer <token>`. Il token è nella nuova variabile server
  `COSMOMEMO_READ_TOKEN` (almeno 32 caratteri casuali, mai `NEXT_PUBLIC_`).
- Confronto del token a tempo costante (`crypto.timingSafeEqual`, dopo aver verificato la stessa lunghezza).
- Token mancante o errato: risposta **401**, senza dettagli. Variabile non impostata: l'endpoint risponde **404**
  (come se non esistesse).
- Solo metodo GET. Nessuna scrittura, nessun effetto collaterale, niente `Set-Cookie`.
- Limite ai tentativi falliti, come già fatto per il login.
- Non toccare né OAuth né la sessione esistenti.

## Cosa restituire (solo metadati: mai il contenuto delle pagine, mai il testo dei ricordi)
```json
{
  "generated_at": 1794255559827,
  "pages": [
    { "id": "…", "title": "…", "kind": "note|idea|project",
      "status": "draft|active|done|archived", "parent_id": "…|null", "updated": 1794255559827 }
  ],
  "tasks": [
    { "id": "…", "title": "…", "status": "Da iniziare|In corso|Completato",
      "priority": "Alta|Media|Bassa|null", "project_id": "…|null", "due": "YYYY-MM-DD|null" }
  ],
  "memories_count": 0
}
```
- `pages`: solo pagine **fuori dal cestino**, al massimo 500, dalla più recente.
- `tasks`: tutte le attività non completate e le ultime 50 completate.
- `memories_count`: solo il numero dei ricordi. I ricordi possono contenere dati personali e non vanno esposti.
- Intestazione `Cache-Control: no-store`.

## Verifiche richieste
1. Senza header → 401. Token sbagliato → 401. Con la variabile non impostata → 404.
2. Con il token giusto: la risposta rispetta la forma qui sopra e non contiene blocchi, contenuti o testi dei ricordi.
3. Nessun test esistente si rompe (`npm test`, `npm run typecheck`, `npm run build`).
4. Aggiungi un test per i tre casi di autenticazione.

## Dopo il deploy (lo fa Dany)
Su Vercel, nel progetto di **Cosmo Control**, aggiungere `COSMOMEMO_URL` (per esempio `https://cosmo-memo.vercel.app`)
e `COSMOMEMO_READ_TOKEN` (lo stesso valore messo in Cosmo Memo) e fare Redeploy. Poi la pagina "Cosmo Memo" del gestionale
mostra i dati.
