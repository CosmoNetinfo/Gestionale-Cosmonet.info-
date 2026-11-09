# Cosmo Control

Gestionale personale di Cosmonet.info. Uso solo personale, solo desktop.

## Stato

**Fase 1** completata: stile, barra laterale, Panoramica, Sito (articoli WordPress), Repository (GitHub), Impostazioni.
Senza chiavi l'app mostra dati di esempio con un avviso giallo.

Prossime fasi: Search Console e grafici (2), server MCP per Claude (3), Cosmo Memo (4), social (5).

## Avvio in locale

```bash
npm install
cp .env.example .env.local   # poi compila i valori
npm run dev
```

## Variabili d'ambiente

Vedi `.env.example`. Su Vercel vanno impostate **prima** del deploy, perché il middleware legge `APP_PASSWORD` in fase di build.

- `APP_PASSWORD`: password di accesso (obbligatoria in produzione)
- `WP_BASE_URL`, `WP_USER`, `WP_APP_PASSWORD`: WordPress con Application Password
- `GITHUB_TOKEN` (o `GITHUB_USER`): per le repository
- `REVIEW_DAYS`: giorni dopo i quali un articolo va rivisto (default 90)

## Stile

Tutti i colori sono in `app/tokens.css`.
