// Schema del database e dati iniziali. Lo schema si crea da solo alla prima richiesta.

const SCHEMA_VERSION = 7;

// Ogni versione contiene solo le modifiche rispetto alla precedente.
const V1 = [
  `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)`,
  `CREATE TABLE IF NOT EXISTS users (
     id TEXT PRIMARY KEY, username TEXT, global_name TEXT, avatar TEXT,
     role TEXT NOT NULL DEFAULT 'giocatore',
     pg TEXT, dc TEXT, mondo TEXT,
     escluso INTEGER NOT NULL DEFAULT 0,
     created_at INTEGER, last_login INTEGER)`,
  `CREATE TABLE IF NOT EXISTS sessions (
     token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS oauth_states (state TEXT PRIMARY KEY, expires INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS editions (
     year INTEGER PRIMARY KEY,
     inizio TEXT NOT NULL, fine TEXT NOT NULL,
     consegna_da TEXT, consegna_a TEXT,
     titolo TEXT, sottotitolo TEXT, intro TEXT,
     come_funziona TEXT, regolamento TEXT,
     tappe TEXT,
     stato TEXT NOT NULL DEFAULT 'attiva')`,
  `CREATE TABLE IF NOT EXISTS days (
     edition INTEGER NOT NULL, n INTEGER NOT NULL,
     tipo TEXT NOT NULL DEFAULT 'sorteggio',
     etichetta TEXT, titolo TEXT, testo TEXT,
     fuoco TEXT NOT NULL DEFAULT 'centro',
     domanda TEXT, risposte TEXT, giusta INTEGER,
     premio TEXT, stato_capitolo TEXT NOT NULL DEFAULT 'manca',
     img_ver INTEGER NOT NULL DEFAULT 0,
     updated_at INTEGER, updated_by TEXT,
     PRIMARY KEY (edition, n))`,
  `CREATE TABLE IF NOT EXISTS images (
     edition INTEGER NOT NULL, n INTEGER NOT NULL, kind TEXT NOT NULL,
     mime TEXT NOT NULL, data BLOB NOT NULL,
     PRIMARY KEY (edition, n, kind))`,
];

const V2 = [
  `CREATE TABLE IF NOT EXISTS donazioni (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     edition INTEGER NOT NULL,
     user_id TEXT,
     donatore_nome TEXT,
     tipo TEXT NOT NULL DEFAULT 'oggetto',
     descrizione TEXT,
     quantita INTEGER NOT NULL DEFAULT 1,
     gil INTEGER,
     anonimo INTEGER NOT NULL DEFAULT 0,
     nota TEXT,
     stato TEXT NOT NULL DEFAULT 'offerta',
     giorno INTEGER,
     created_at INTEGER, updated_at INTEGER, gestita_da TEXT)`,
  `CREATE INDEX IF NOT EXISTS donazioni_ed ON donazioni(edition, stato)`,
  `ALTER TABLE days ADD COLUMN premio_id INTEGER`,
  `ALTER TABLE editions ADD COLUMN donazioni_fino TEXT`,
  `ALTER TABLE editions ADD COLUMN aiutanti_intro TEXT`,
  `UPDATE editions SET donazioni_fino = printf('%d-11-30', year) WHERE donazioni_fino IS NULL`,
  `UPDATE editions SET aiutanti_intro = 'Vuoi aiutare il postino a riempire la sua sacca? Offri un premio per il calendario: un oggetto in gioco oppure dei GIL.

Compila il modulo qui sotto, poi consegna il dono in gioco a uno degli admin, Altea Skysinger o Iname Naname (entrambi sul mondo Ragnarok, data center Chaos), entro la scadenza indicata. Quando lo riceviamo, la tua offerta risulterà "Ricevuta".

A dicembre, sotto il premio del giorno, comparirà il tuo nome, oppure "un aiutante anonimo" se preferisci. Sul tuo profilo comparirà il segno di Aiutante. È Natale: il grazie è tutto per te.' WHERE aiutanti_intro IS NULL`,
];

// v3: categorie e immagini dei premi, assegnazioni multiple, partecipazioni, vincite, estrazioni, regole
const V3 = [
  `ALTER TABLE donazioni ADD COLUMN categoria TEXT`,
  `ALTER TABLE donazioni ADD COLUMN dettagli TEXT`,
  `ALTER TABLE donazioni ADD COLUMN img_ver INTEGER NOT NULL DEFAULT 0`,
  `UPDATE donazioni SET categoria='GIL' WHERE tipo='gil'`,
  `CREATE TABLE IF NOT EXISTS assegnazioni (
     id INTEGER PRIMARY KEY AUTOINCREMENT, edition INTEGER NOT NULL, giorno INTEGER NOT NULL,
     donazione_id INTEGER NOT NULL, vincitori INTEGER NOT NULL DEFAULT 1, a_testa INTEGER NOT NULL DEFAULT 1,
     created_at INTEGER)`,
  `CREATE INDEX IF NOT EXISTS assegnazioni_giorno ON assegnazioni(edition, giorno)`,
  `INSERT INTO assegnazioni(edition,giorno,donazione_id,vincitori,a_testa,created_at)
     SELECT edition, giorno, id, 1, CASE WHEN tipo='gil' THEN gil ELSE quantita END, updated_at
     FROM donazioni WHERE giorno IS NOT NULL AND stato='ricevuta'`,
  `UPDATE donazioni SET giorno=NULL`,
  `CREATE TABLE IF NOT EXISTS premio_img (donazione_id INTEGER PRIMARY KEY, mime TEXT NOT NULL, data BLOB NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS partecipazioni (
     edition INTEGER NOT NULL, giorno INTEGER NOT NULL, user_id TEXT NOT NULL,
     risposta INTEGER, created_at INTEGER, PRIMARY KEY (edition, giorno, user_id))`,
  `CREATE INDEX IF NOT EXISTS partecipazioni_user ON partecipazioni(edition, user_id)`,
  `CREATE TABLE IF NOT EXISTS vincite (
     id INTEGER PRIMARY KEY AUTOINCREMENT, edition INTEGER NOT NULL, giorno INTEGER NOT NULL,
     assegnazione_id INTEGER NOT NULL, donazione_id INTEGER NOT NULL, user_id TEXT NOT NULL,
     a_testa INTEGER NOT NULL DEFAULT 1,
     consegnato INTEGER NOT NULL DEFAULT 0, consegnato_at INTEGER, consegnato_da TEXT, nota TEXT,
     created_at INTEGER)`,
  `CREATE INDEX IF NOT EXISTS vincite_user ON vincite(edition, user_id)`,
  `CREATE INDEX IF NOT EXISTS vincite_giorno ON vincite(edition, giorno)`,
  `CREATE TABLE IF NOT EXISTS estrazioni (
     edition INTEGER NOT NULL, giorno INTEGER NOT NULL, eseguita_at INTEGER, eseguita_da TEXT,
     partecipanti INTEGER, log TEXT, PRIMARY KEY (edition, giorno))`,
  `ALTER TABLE editions ADD COLUMN tetto INTEGER NOT NULL DEFAULT 5`,
  `ALTER TABLE editions ADD COLUMN biglietti_sfida INTEGER NOT NULL DEFAULT 3`,
  `ALTER TABLE editions ADD COLUMN biscotti_partecipazione INTEGER NOT NULL DEFAULT 20`,
  `UPDATE editions SET donazioni_fino='2026-11-27' WHERE year=2026 AND donazioni_fino='2026-11-30'`,
];

// v4: Biscotti già accreditati su Mee6; nome in gioco di Ignus nel testo Aiutanti
const V4 = [
  `CREATE TABLE IF NOT EXISTS biscotti_fatti (edition INTEGER NOT NULL, user_id TEXT NOT NULL, fatto_at INTEGER, fatto_da TEXT, PRIMARY KEY (edition, user_id))`,
  `UPDATE editions SET aiutanti_intro = REPLACE(aiutanti_intro, 'Altea Skysinger o Ignus', 'Altea Skysinger o Iname Naname')`,
];

// v5: mondo degli admin nel testo Aiutanti; note sulle consegne
const V5 = [
  `UPDATE editions SET aiutanti_intro = REPLACE(aiutanti_intro, 'a uno degli admin (Altea Skysinger o Iname Naname)', 'a uno degli admin, Altea Skysinger o Iname Naname (entrambi sul mondo Ragnarok, data center Chaos),')`,
];

// v6: scritta accanto al logo modificabile
const V6 = [
  `ALTER TABLE editions ADD COLUMN marchio TEXT`,
  `UPDATE editions SET marchio = 'Calendario dell''Avvento' WHERE marchio IS NULL`,
];

// v7: messaggi per Tullio
const V7 = [
  `CREATE TABLE IF NOT EXISTS messaggi (
     edition INTEGER NOT NULL, user_id TEXT NOT NULL, testo TEXT NOT NULL,
     stato TEXT NOT NULL DEFAULT 'attesa', created_at INTEGER, updated_at INTEGER, moderato_da TEXT,
     PRIMARY KEY (edition, user_id))`,
];

const MIGRATIONS = { 1: V1, 2: V2, 3: V3, 4: V4, 5: V5, 6: V6, 7: V7 };

const COME_FUNZIONA_2026 = `Ogni giorno alle 00:00 si apre una busta con un nuovo capitolo della storia.

Nei giorni normali partecipi all'estrazione con un clic. Domeniche e feste hanno una sfida: rispondi giusto e ottieni più biglietti.

A mezzanotte la busta si chiude e il sito estrae il vincitore. Chi non vince riceve comunque i Biscotti di Tullio.

Ogni partecipazione è una lettera ritrovata. Ai traguardi della community, tutti i partecipanti ricevono Biscotti extra.

I premi si consegnano in gioco dal 2 al 15 gennaio, su Light e Chaos.`;

const REGOLAMENTO_2026 = `# Chi può partecipare
I membri del server Discord di Our Elysion, accedendo con il proprio account. Un account per persona.

# Orari
Ogni busta si apre alle 00:01 e si chiude alle 23:59 dello stesso giorno, ora italiana. L'estrazione avviene in automatico alle 00:00.

# Sorteggi e sfide
Nei giorni normali basta un clic per partecipare. Nei giorni di sfida si risponde a una domanda: la risposta giusta vale più biglietti. Le risposte giuste si scoprono dopo l'estrazione.

# Limite di vincite
Ogni persona può vincere un numero limitato di premi in tutto il calendario. Chi ha raggiunto il limite continua a partecipare per i Biscotti e per il traguardo della community.

# Consegna dei premi
Dal 2 al 15 gennaio, in gioco, sul mondo indicato nel profilo (Light o Chaos). Chi non risulta raggiungibile entro il 15 gennaio perde il premio, che torna nel montepremi.

# Correttezza
Account multipli o tentativi di aggirare il sito portano all'esclusione dall'evento.`;

const SFIDE_2026 = { 1: "Apertura", 6: "S. Nicola", 8: "Immacolata", 13: "S. Lucia", 20: "", 24: "Vigilia", 25: "Natale" };

let ready = false;

export async function ensureSchema(env) {
  if (ready) return;
  const row = await env.DB.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='settings'"
  ).first();
  let version = 0;
  if (row) {
    const v = await env.DB.prepare("SELECT value FROM settings WHERE key='schema_version'").first();
    version = v ? Number(v.value) : 0;
  }
  if (version < 1) {
    await env.DB.batch(V1.map((s) => env.DB.prepare(s)));
    await seed(env);
    version = 1;
  }
  for (let v = version + 1; v <= SCHEMA_VERSION; v++) {
    try {
      await env.DB.batch(MIGRATIONS[v].map((s) => env.DB.prepare(s)));
    } catch (e) {
      // Un'altra richiesta potrebbe aver già applicato la stessa migrazione
      const cur = await env.DB.prepare("SELECT value FROM settings WHERE key='schema_version'").first();
      if (!cur || Number(cur.value) < v) throw e;
    }
  }
  if (version < SCHEMA_VERSION) {
    await env.DB.prepare(
      "INSERT INTO settings(key,value) VALUES('schema_version',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value"
    ).bind(String(SCHEMA_VERSION)).run();
  }
  await seed(env);
  ready = true;
}

async function seed(env) {
  const cur = await env.DB.prepare("SELECT value FROM settings WHERE key='edizione_corrente'").first();
  if (cur) return;
  const year = 2026;
  const tappe = JSON.stringify([{ s: 100, b: 50 }, { s: 200, b: 100 }, { s: 300, b: 200 }]);
  const stmts = [
    env.DB.prepare(
      `INSERT OR IGNORE INTO editions(year,inizio,fine,consegna_da,consegna_a,titolo,sottotitolo,intro,come_funziona,regolamento,tappe)
       VALUES(?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(
      year, "2026-12-01", "2026-12-25", "2027-01-02", "2027-01-15",
      "Le lettere perdute",
      "1 – 25 dicembre · una lettera al giorno",
      "Una tempesta di neve su Ishgard ha sparso la posta di un moogle per tutta Eorzea. Ogni giorno si apre una busta: leggi il capitolo, partecipa e aiuta a ritrovare le lettere.",
      COME_FUNZIONA_2026, REGOLAMENTO_2026, tappe
    ),
  ];
  for (let n = 1; n <= 25; n++) {
    const sfida = n in SFIDE_2026;
    stmts.push(
      env.DB.prepare(
        "INSERT OR IGNORE INTO days(edition,n,tipo,etichetta,titolo) VALUES(?,?,?,?,?)"
      ).bind(year, n, sfida ? "sfida" : "sorteggio", sfida ? SFIDE_2026[n] : "", `Capitolo ${n}`)
    );
  }
  stmts.push(env.DB.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES('edizione_corrente',?)").bind(String(year)));
  await env.DB.batch(stmts);
}

export async function currentEdition(env) {
  // una sola richiesta al database
  return env.DB.prepare(
    "SELECT * FROM editions WHERE year = (SELECT CAST(value AS INTEGER) FROM settings WHERE key='edizione_corrente')"
  ).first();
}
