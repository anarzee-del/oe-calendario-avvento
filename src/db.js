// Schema del database e dati iniziali. Lo schema si crea da solo alla prima richiesta.

const SCHEMA_VERSION = 1;

const STATEMENTS = [
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
  if (version < SCHEMA_VERSION) {
    await env.DB.batch(STATEMENTS.map((s) => env.DB.prepare(s)));
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
  const cur = await env.DB.prepare("SELECT value FROM settings WHERE key='edizione_corrente'").first();
  const year = Number(cur.value);
  return env.DB.prepare("SELECT * FROM editions WHERE year=?").bind(year).first();
}
