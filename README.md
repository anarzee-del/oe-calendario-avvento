# Calendario dell'Avvento · Our Elysion

Sito del calendario dell'Avvento della community italiana di FFXIV **Our Elysion**.
Indirizzo: **https://calendario-avvento.ourelysion.com**

## Come è fatto

- **Cloudflare Workers** (piano gratuito): pagine statiche in `public/`, API in `src/`.
- **D1** (database `oe-avvento`): edizioni, capitoli, immagini, utenti, sessioni. Lo schema si crea da solo alla prima richiesta (`src/db.js`).
- **Login con Discord** (`src/auth.js`): solo membri del server Our Elysion. Gli admin sono riconosciuti per ID Discord (`ADMIN_IDS` in `wrangler.jsonc`).
- Gli orari ragionano in ora italiana: le buste si aprono a mezzanotte e quelle future non vengono mai inviate al browser dei giocatori.

## Configurazione su Cloudflare (una volta sola)

1. Workers e Pages → Crea applicazione → **Importa un repository** → GitHub → questo repository. Nome del worker: `oe-avvento`. Comando di deploy: `npx wrangler deploy`.
2. Dopo il primo deploy: worker `oe-avvento` → Impostazioni → **Variabili e segreti** → Aggiungi → tipo **Segreto**, nome `DISCORD_CLIENT_SECRET`, valore = Client Secret dell'app Discord.
3. App Discord → OAuth2 → Redirects: `https://calendario-avvento.ourelysion.com/api/auth/callback`.

## Sviluppo in locale

```
npm install
printf 'DEV_LOGIN=1\nDISCORD_CLIENT_SECRET=finto\n' > .dev.vars
npx wrangler dev
```
Con `DEV_LOGIN=1` sono attivi gli accessi di prova `/api/auth/dev?as=admin` e `/api/auth/dev?as=player` (mai in produzione: `.dev.vars` non viene pubblicato).

## Regole di lavoro

- I contenuti (capitoli, immagini, testi, date) si modificano dall'**Area staff** del sito, non dal codice.
- Il codice si sviluppa su un ramo separato e va su `main` solo quando è pronto: ogni push su `main` pubblica il sito.
- A dicembre il codice resta congelato salvo emergenze.
