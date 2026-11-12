// Prova generale: un mini calendario di pochi giorni, separato da quello vero.
// Si salva come un'edizione a parte (anno 9000 + anno vero, es. 9026, con prova = 1) e diventa
// l'edizione corrente finché lo staff non preme "Termina la prova": allora si torna all'edizione vera
// e tutti i dati della prova vengono cancellati. I profili delle persone restano.
import { addDays } from "./time.js";

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
const err = (status, messaggio) => json({ errore: messaggio }, status);
const isIso = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

// tabelle con i dati di un'edizione (premio_img va tolta prima di donazioni)
const TABELLE = ["days", "images", "assegnazioni", "partecipazioni", "vincite", "estrazioni", "biscotti_fatti", "messaggi", "annunci", "donazioni"];

function capitoliProva(giorni) {
  const out = [];
  for (let n = 1; n <= giorni; n++) {
    const sfida = n === 2;
    out.push({
      n, tipo: sfida ? "sfida" : "sorteggio", etichetta: sfida ? "Sfida di prova" : "",
      titolo: `Capitolo di prova ${n}`,
      testo: `Questo è un capitolo finto, scritto solo per la prova generale. Non anticipa niente della storia vera.\n\nLeggi fino in fondo, poi partecipa alla busta: domani, dopo l'estrazione di mezzanotte, scoprirai se hai vinto il premio di prova.`,
      domanda: sfida ? "Domanda di prova: di che colore è il francobollo dell'Aiutante di Tullio?" : null,
      risposte: sfida ? JSON.stringify(["Blu", "Dorato", "Verde", "Viola"]) : null,
      giusta: sfida ? 1 : null,
    });
  }
  return out;
}

export async function handleProva(req, env, url, user, ed, oggi) {
  const p = url.pathname, m = req.method;
  if (!p.startsWith("/api/admin/prova")) return null;
  if (user?.role !== "admin") return err(403, "Area riservata allo staff");
  const chi = user.global_name || user.username;

  if (p === "/api/admin/prova" && m === "GET") {
    const base = await env.DB.prepare("SELECT value FROM settings WHERE key='edizione_base'").first();
    return json({ in_corso: !!ed.prova, inizio: ed.prova ? ed.inizio : null, fine: ed.prova ? ed.fine : null, base: Number(base?.value) || null, oggi });
  }

  // Avvia: crea l'edizione di prova copiando i testi da quella vera
  if (p === "/api/admin/prova" && m === "POST") {
    if (ed.prova) return err(400, "La prova generale è già in corso");
    const b = await req.json().catch(() => ({}));
    const inizio = isIso(b?.inizio) ? b.inizio : addDays(oggi, 1);
    const giorni = Math.max(1, Math.min(7, Number(b?.giorni) | 0 || 3));
    const fine = addDays(inizio, giorni - 1);
    if (inizio < oggi) return err(400, "La prova deve iniziare da oggi in poi");
    if (fine >= ed.inizio) return err(400, `La prova deve finire prima dell'apertura del calendario vero (${ed.inizio})`);
    const anno = 9000 + (ed.year % 1000);
    const tappe = JSON.stringify([{ s: 5, b: 10 }, { s: 10, b: 20 }, { s: 15, b: 30 }]);
    const stmts = [];
    // se è rimasto qualcosa di una prova precedente, si toglie
    stmts.push(env.DB.prepare("DELETE FROM premio_img WHERE donazione_id IN (SELECT id FROM donazioni WHERE edition=?)").bind(anno));
    for (const t of TABELLE) stmts.push(env.DB.prepare(`DELETE FROM ${t} WHERE edition=?`).bind(anno));
    stmts.push(env.DB.prepare("DELETE FROM editions WHERE year=?").bind(anno));
    stmts.push(env.DB.prepare(
      `INSERT INTO editions(year,inizio,fine,consegna_da,consegna_a,titolo,sottotitolo,intro,come_funziona,regolamento,tappe,
         donazioni_da,donazioni_fino,aiutanti_intro,tetto,biglietti_sfida,biscotti_partecipazione,marchio,bonus_modo,prova,posta_testi)
       SELECT ?,?,?,consegna_da,consegna_a,'Prova generale',?,?,come_funziona,regolamento,?,
         ?,?,aiutanti_intro,tetto,biglietti_sfida,biscotti_partecipazione,marchio,'dopo',1,posta_testi FROM editions WHERE year=?`
    ).bind(anno, inizio, fine, `${giorni} buste di prova · dal ${inizio.slice(8)}/${inizio.slice(5, 7)} al ${fine.slice(8)}/${fine.slice(5, 7)}`,
      "Questa è la prova generale del calendario: le buste, i premi e le vincite sono finti e verranno cancellati alla fine. Grazie per l'aiuto!",
      tappe, addDays(inizio, -1), addDays(inizio, -1), ed.year));
    for (const c of capitoliProva(giorni)) {
      stmts.push(env.DB.prepare(
        "INSERT INTO days(edition,n,tipo,etichetta,titolo,testo,domanda,risposte,giusta,stato_capitolo,updated_at,updated_by) VALUES(?,?,?,?,?,?,?,?,?,'pronto',?,?)"
      ).bind(anno, c.n, c.tipo, c.etichetta, c.titolo, c.testo, c.domanda, c.risposte, c.giusta, Date.now(), chi));
    }
    stmts.push(env.DB.prepare(
      "INSERT INTO days(edition,n,tipo,titolo,testo,stato_capitolo) VALUES(?,0,'bonus','Capitolo bonus di prova',?,'pronto')"
    ).bind(anno, "Se leggi questo, il capitolo bonus si è aperto correttamente al traguardo delle lettere. Bravi!"));
    // premio finto: 3 vincitori al giorno
    const now = Date.now();
    stmts.push(env.DB.prepare(
      `INSERT INTO donazioni(edition,user_id,tipo,descrizione,quantita,anonimo,stato,categoria,dettagli,created_at,updated_at,gestita_da)
       VALUES(?,?,'oggetto','Premio di prova',?,0,'ricevuta','Minion','Un premio finto: serve solo a provare l''estrazione. Non verrà consegnato.',?,?,?)`
    ).bind(anno, user.id, giorni * 3, now, now, chi));
    for (let n = 1; n <= giorni; n++) {
      stmts.push(env.DB.prepare(
        "INSERT INTO assegnazioni(edition,giorno,donazione_id,vincitori,a_testa,created_at) SELECT ?,?,id,3,1,? FROM donazioni WHERE edition=? ORDER BY id DESC LIMIT 1"
      ).bind(anno, n, now, anno));
    }
    stmts.push(env.DB.prepare("INSERT INTO settings(key,value) VALUES('edizione_base',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(String(ed.year)));
    stmts.push(env.DB.prepare("UPDATE settings SET value=? WHERE key='edizione_corrente'").bind(String(anno)));
    await env.DB.batch(stmts);
    return json({ ok: true, anno, inizio, fine });
  }

  // Termina: si torna all'edizione vera e si cancella tutto quello della prova
  if (p === "/api/admin/prova/termina" && m === "POST") {
    if (!ed.prova) return err(400, "Non c'è nessuna prova in corso");
    const base = await env.DB.prepare("SELECT value FROM settings WHERE key='edizione_base'").first();
    const vera = Number(base?.value) || ed.year - 9000 + 2000;
    const esiste = await env.DB.prepare("SELECT 1 FROM editions WHERE year=?").bind(vera).first();
    if (!esiste) return err(500, "Non trovo l'edizione vera: scrivi a Claude prima di continuare");
    const stmts = [env.DB.prepare("UPDATE settings SET value=? WHERE key='edizione_corrente'").bind(String(vera))];
    stmts.push(env.DB.prepare("DELETE FROM premio_img WHERE donazione_id IN (SELECT id FROM donazioni WHERE edition=?)").bind(ed.year));
    for (const t of TABELLE) stmts.push(env.DB.prepare(`DELETE FROM ${t} WHERE edition=?`).bind(ed.year));
    stmts.push(env.DB.prepare("DELETE FROM editions WHERE year=?").bind(ed.year));
    await env.DB.batch(stmts);
    return json({ ok: true, anno: vera });
  }

  return err(404, "Non trovato");
}
