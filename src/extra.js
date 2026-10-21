// Messaggi per Tullio, partecipanti, backup ed edizioni.
import { addDays, editionDays } from "./time.js";

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
const err = (status, messaggio) => json({ errore: messaggio }, status);
const MAX_MSG = 500;

// I messaggi si scrivono dal primo giorno del calendario fino al penultimo (la Vigilia);
// l'ultimo giorno Tullio li consegna alla community.
export function finestraMessaggi(ed) {
  return { da: ed.inizio, fino: addDays(ed.fine, -1), pubblici_dal: ed.fine };
}

export async function handleExtra(req, env, url, user, ed, oggi) {
  const p = url.pathname, m = req.method;
  const isAdmin = user?.role === "admin";
  const f = finestraMessaggi(ed);
  let r;

  /* ----- messaggi per Tullio: giocatori ----- */
  if (p === "/api/messaggi" && m === "GET") {
    const aperti = oggi >= f.da && oggi <= f.fino;
    const pubblici = oggi >= f.pubblici_dal || isAdmin;
    let mio = null;
    if (user) mio = await env.DB.prepare("SELECT testo, stato, updated_at FROM messaggi WHERE edition=? AND user_id=?").bind(ed.year, user.id).first();
    let posta = [];
    if (pubblici) {
      ({ results: posta } = await env.DB.prepare(
        `SELECT m.testo, COALESCE(u.global_name, u.username) AS nome FROM messaggi m JOIN users u ON u.id = m.user_id
         WHERE m.edition=? AND m.stato='ok' ORDER BY m.created_at`
      ).bind(ed.year).all());
    }
    return json({ ...f, aperti, pubblicata: oggi >= f.pubblici_dal, mio, posta });
  }

  if (p === "/api/messaggi" && m === "PUT") {
    if (!user) return err(401, "Accedi con Discord per scrivere a Tullio");
    if (user.escluso) return err(403, "Il tuo account è stato escluso dall'evento");
    if (!(oggi >= f.da && oggi <= f.fino)) return err(400, "I messaggi per Tullio si possono scrivere dal primo giorno del calendario fino alla Vigilia");
    const b = await req.json().catch(() => null);
    const testo = typeof b?.testo === "string" ? b.testo.trim().slice(0, MAX_MSG) : "";
    if (testo.length < 3) return err(400, "Il messaggio è vuoto");
    const now = Date.now();
    // ogni modifica torna in attesa di approvazione
    await env.DB.prepare(
      `INSERT INTO messaggi(edition,user_id,testo,stato,created_at,updated_at) VALUES(?,?,?,'attesa',?,?)
       ON CONFLICT(edition,user_id) DO UPDATE SET testo=excluded.testo, stato='attesa', updated_at=excluded.updated_at, moderato_da=NULL`
    ).bind(ed.year, user.id, testo, now, now).run();
    return json({ ok: true });
  }

  if (p === "/api/messaggi" && m === "DELETE") {
    if (!user) return err(401, "Accedi con Discord");
    await env.DB.prepare("DELETE FROM messaggi WHERE edition=? AND user_id=?").bind(ed.year, user.id).run();
    return json({ ok: true });
  }

  /* ----- staff ----- */
  if (!p.startsWith("/api/admin/extra/")) return null;
  if (!isAdmin) return err(403, "Area riservata allo staff");
  const chi = user.global_name || user.username;

  if (p === "/api/admin/extra/messaggi" && m === "GET") {
    const { results } = await env.DB.prepare(
      `SELECT m.user_id, m.testo, m.stato, m.updated_at, m.moderato_da, COALESCE(u.global_name, u.username) AS nome, u.username
       FROM messaggi m JOIN users u ON u.id = m.user_id WHERE m.edition=? ORDER BY m.updated_at DESC`
    ).bind(ed.year).all();
    return json({ ...f, messaggi: results });
  }
  if ((r = p.match(/^\/api\/admin\/extra\/messaggio\/(\d+)$/)) && m === "PUT") {
    const b = await req.json().catch(() => null);
    const stato = ["attesa", "ok", "no"].includes(b?.stato) ? b.stato : null;
    if (!stato) return err(400, "Stato non valido");
    await env.DB.prepare("UPDATE messaggi SET stato=?, moderato_da=? WHERE edition=? AND user_id=?").bind(stato, chi, ed.year, r[1]).run();
    return json({ ok: true });
  }

  // Partecipanti: tutti gli iscritti con le loro statistiche
  if (p === "/api/admin/extra/partecipanti" && m === "GET") {
    const { results } = await env.DB.prepare(
      `SELECT u.id, COALESCE(u.global_name, u.username) AS nome, u.username, u.pg, u.dc, u.mondo, u.escluso, u.created_at, u.last_login,
         (SELECT COUNT(*) FROM partecipazioni p WHERE p.edition=? AND p.user_id=u.id) AS partecipazioni,
         (SELECT COUNT(*) FROM vincite v WHERE v.edition=? AND v.user_id=u.id) AS vincite,
         (SELECT COUNT(*) FROM donazioni d WHERE d.edition=? AND d.user_id=u.id AND d.stato='ricevuta') AS doni
       FROM users u ORDER BY nome COLLATE NOCASE`
    ).bind(ed.year, ed.year, ed.year).all();
    const admin = new Set(String(env.ADMIN_IDS || "").split(",").map((s) => s.trim()));
    return json({ partecipanti: results.map((x) => ({ ...x, escluso: !!x.escluso, staff: admin.has(x.id) })) });
  }
  if ((r = p.match(/^\/api\/admin\/extra\/partecipante\/(\d+)$/)) && m === "PUT") {
    const b = await req.json().catch(() => null);
    const admin = new Set(String(env.ADMIN_IDS || "").split(",").map((s) => s.trim()));
    if (admin.has(r[1])) return err(400, "Non si può escludere un admin");
    await env.DB.prepare("UPDATE users SET escluso=? WHERE id=?").bind(b?.escluso ? 1 : 0, r[1]).run();
    return json({ ok: true });
  }

  // Backup completo (tranne le immagini, che restano nel database)
  if (p === "/api/admin/extra/backup" && m === "GET") {
    const tabelle = ["settings", "editions", "days", "users", "donazioni", "assegnazioni", "partecipazioni", "vincite", "estrazioni", "biscotti_fatti", "messaggi"];
    const out = { creato: new Date().toISOString(), creato_da: chi, edizione_corrente: ed.year, tabelle: {} };
    for (const t of tabelle) out.tabelle[t] = (await env.DB.prepare(`SELECT * FROM ${t}`).all()).results;
    return new Response(JSON.stringify(out, null, 1), {
      headers: {
        "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="oe-avvento-backup-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  }

  // Edizioni: elenco e creazione della nuova
  if (p === "/api/admin/extra/edizioni" && m === "GET") {
    const { results } = await env.DB.prepare(
      `SELECT e.year, e.inizio, e.fine, e.titolo,
         (SELECT COUNT(*) FROM partecipazioni p WHERE p.edition=e.year) AS partecipazioni,
         (SELECT COUNT(*) FROM vincite v WHERE v.edition=e.year) AS vincite,
         (SELECT COUNT(*) FROM vincite v WHERE v.edition=e.year AND v.consegnato=0) AS da_consegnare
       FROM editions e ORDER BY e.year DESC`
    ).all();
    return json({ corrente: ed.year, oggi, edizioni: results });
  }
  if (p === "/api/admin/extra/edizioni" && m === "POST") {
    const nuovo = ed.year + 1;
    if (oggi <= ed.fine) return err(400, `L'edizione ${ed.year} è ancora in corso: si può aprire la nuova dopo il ${ed.fine}`);
    const esiste = await env.DB.prepare("SELECT 1 FROM editions WHERE year=?").bind(nuovo).first();
    const stmts = [];
    if (!esiste) {
      // copia testi, regole e struttura, spostando le date di un anno
      const sposta = (d) => (d ? `${Number(d.slice(0, 4)) + 1}${d.slice(4)}` : d);
      stmts.push(env.DB.prepare(
        `INSERT INTO editions(year,inizio,fine,consegna_da,consegna_a,titolo,sottotitolo,intro,come_funziona,regolamento,tappe,donazioni_fino,aiutanti_intro,tetto,biglietti_sfida,biscotti_partecipazione,marchio)
         SELECT ?,?,?,?,?,titolo,?,intro,come_funziona,regolamento,tappe,?,aiutanti_intro,tetto,biglietti_sfida,biscotti_partecipazione,marchio FROM editions WHERE year=?`
      ).bind(nuovo, sposta(ed.inizio), sposta(ed.fine), sposta(ed.consegna_da), sposta(ed.consegna_a),
        (ed.sottotitolo || "").replace(String(ed.year), String(nuovo)), sposta(ed.donazioni_fino), ed.year));
      stmts.push(env.DB.prepare(
        `INSERT INTO days(edition,n,tipo,etichetta,titolo) SELECT ?, n, tipo, etichetta, 'Capitolo ' || n FROM days WHERE edition=?`
      ).bind(nuovo, ed.year));
    }
    stmts.push(env.DB.prepare("UPDATE editions SET stato='archiviata' WHERE year=?").bind(ed.year));
    stmts.push(env.DB.prepare("UPDATE settings SET value=? WHERE key='edizione_corrente'").bind(String(nuovo)));
    await env.DB.batch(stmts);
    return json({ ok: true, anno: nuovo });
  }

  return err(404, "Non trovato");
}

export { editionDays };
