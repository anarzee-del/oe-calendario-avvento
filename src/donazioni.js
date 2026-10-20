// Aiutanti del postino: offerte dei premi da parte della community e gestione dello staff.

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
const err = (status, messaggio) => json({ errore: messaggio }, status);
const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const intIn = (v, min, max) => { const n = Number(v); return Number.isInteger(n) && n >= min && n <= max ? n : null; };
const STATI = new Set(["offerta", "ricevuta", "rifiutata"]);
const MAX_OFFERTE_UTENTE = 20;
const STAFF = "lo staff di Our Elysion";

export function etichettaPremio(d) {
  if (!d) return "";
  if (d.tipo === "gil") return `${Number(d.gil || 0).toLocaleString("it-IT")} GIL`;
  return `${d.descrizione || ""}${d.quantita > 1 ? ` ×${d.quantita}` : ""}`;
}

// Come appare il donatore al pubblico
export function donatorePubblico(d) {
  if (!d) return null;
  let r;
  if (d.anonimo) r = { anonimo: true, nome: "un aiutante anonimo" };
  else if (d.user_id) r = { nome: d.u_nome || "un aiutante" };
  else r = { nome: d.donatore_nome || STAFF, staff: !d.donatore_nome };
  r.frase = r.staff ? "Offerto dallo staff di Our Elysion" : `Offerto da ${r.nome}`;
  return r;
}

// Premio assegnato a ciascun giorno (solo doni ricevuti)
export async function premiPerGiorno(env, year) {
  const { results } = await env.DB.prepare(
    `SELECT d.*, COALESCE(u.global_name, u.username) AS u_nome FROM donazioni d LEFT JOIN users u ON u.id = d.user_id
     WHERE d.edition=? AND d.stato='ricevuta' AND d.giorno IS NOT NULL`
  ).bind(year).all();
  const map = new Map();
  for (const d of results) map.set(d.giorno, d);
  return map;
}

export async function isAiutante(env, user, year) {
  if (!user) return false;
  const r = await env.DB.prepare("SELECT 1 FROM donazioni WHERE edition=? AND user_id=? AND stato='ricevuta' LIMIT 1").bind(year, user.id).first();
  return !!r;
}

function validaDono(b) {
  const tipo = b?.tipo === "gil" ? "gil" : "oggetto";
  if (tipo === "gil") {
    const gil = intIn(b.gil, 1, 999_999_999);
    if (!gil) return { errore: "Indica quanti GIL vuoi donare" };
    return { tipo, gil, descrizione: null, quantita: 1 };
  }
  const descrizione = str(b?.descrizione, 100);
  if (!descrizione) return { errore: "Scrivi cosa vuoi donare" };
  const quantita = intIn(b?.quantita ?? 1, 1, 999);
  if (!quantita) return { errore: "La quantità deve essere tra 1 e 999" };
  return { tipo, gil: null, descrizione, quantita };
}

export async function handleDonazioni(req, env, url, user, ed, oggi) {
  const p = url.pathname, m = req.method;
  const isAdmin = user?.role === "admin";
  const aperte = !ed.donazioni_fino || oggi <= ed.donazioni_fino;
  let r;

  /* ----- pubblico ----- */
  if (p === "/api/aiutanti" && m === "GET") {
    const { results: nomi } = await env.DB.prepare(
      `SELECT DISTINCT CASE WHEN d.user_id IS NOT NULL THEN COALESCE(u.global_name, u.username) ELSE d.donatore_nome END AS nome
       FROM donazioni d LEFT JOIN users u ON u.id = d.user_id
       WHERE d.edition=? AND d.stato='ricevuta' AND d.anonimo=0 AND (d.user_id IS NOT NULL OR d.donatore_nome IS NOT NULL)
       ORDER BY nome COLLATE NOCASE`
    ).bind(ed.year).all();
    const anon = await env.DB.prepare(
      `SELECT COUNT(DISTINCT COALESCE(user_id, 'x' || id)) AS c FROM donazioni WHERE edition=? AND stato='ricevuta' AND anonimo=1`
    ).bind(ed.year).first();
    let mie = [];
    if (user) {
      ({ results: mie } = await env.DB.prepare(
        "SELECT id,tipo,descrizione,quantita,gil,anonimo,nota,stato,created_at FROM donazioni WHERE edition=? AND user_id=? ORDER BY id DESC"
      ).bind(ed.year, user.id).all());
      mie = mie.map((d) => ({ ...d, etichetta: etichettaPremio(d), anonimo: !!d.anonimo }));
    }
    return json({ aperte, fino: ed.donazioni_fino, intro: ed.aiutanti_intro || "", aiutanti: nomi.map((x) => x.nome).filter(Boolean), anonimi: anon?.c || 0, mie });
  }

  if (p === "/api/donazioni" && m === "POST") {
    if (!user) return err(401, "Accedi con Discord per offrire un premio");
    if (!aperte) return err(400, "Le offerte per questa edizione sono chiuse");
    const b = await req.json().catch(() => null);
    const v = validaDono(b);
    if (v.errore) return err(400, v.errore);
    const c = await env.DB.prepare("SELECT COUNT(*) AS c FROM donazioni WHERE edition=? AND user_id=?").bind(ed.year, user.id).first();
    if (c.c >= MAX_OFFERTE_UTENTE) return err(400, "Hai già registrato molte offerte: scrivi allo staff per aggiungerne altre");
    const now = Date.now();
    await env.DB.prepare(
      `INSERT INTO donazioni(edition,user_id,tipo,descrizione,quantita,gil,anonimo,nota,stato,created_at,updated_at)
       VALUES(?,?,?,?,?,?,?,?,'offerta',?,?)`
    ).bind(ed.year, user.id, v.tipo, v.descrizione, v.quantita, v.gil, b.anonimo ? 1 : 0, str(b.nota, 300), now, now).run();
    return json({ ok: true });
  }

  if ((r = p.match(/^\/api\/donazioni\/(\d+)$/)) && (m === "PUT" || m === "DELETE")) {
    if (!user) return err(401, "Accedi con Discord");
    const id = Number(r[1]);
    const d = await env.DB.prepare("SELECT * FROM donazioni WHERE id=? AND user_id=?").bind(id, user.id).first();
    if (!d) return err(404, "Offerta non trovata");
    if (m === "DELETE") {
      if (d.stato !== "offerta") return err(400, "Questo dono è già stato ricevuto: per toglierlo scrivi allo staff");
      await env.DB.prepare("DELETE FROM donazioni WHERE id=?").bind(id).run();
      return json({ ok: true });
    }
    const b = await req.json().catch(() => null);
    await env.DB.prepare("UPDATE donazioni SET anonimo=?, updated_at=? WHERE id=?").bind(b?.anonimo ? 1 : 0, Date.now(), id).run();
    return json({ ok: true });
  }

  /* ----- staff ----- */
  if (!p.startsWith("/api/admin/donazion")) return null;
  if (!isAdmin) return err(403, "Area riservata allo staff");

  if (p === "/api/admin/donazioni" && m === "GET") {
    const { results } = await env.DB.prepare(
      `SELECT d.*, COALESCE(u.global_name, u.username) AS u_nome, u.username AS u_username, u.pg AS u_pg, u.mondo AS u_mondo
       FROM donazioni d LEFT JOIN users u ON u.id = d.user_id WHERE d.edition=? ORDER BY d.id DESC`
    ).bind(ed.year).all();
    const { results: utenti } = await env.DB.prepare(
      "SELECT id, COALESCE(global_name, username) AS nome FROM users ORDER BY nome COLLATE NOCASE"
    ).all();
    return json({
      aperte, fino: ed.donazioni_fino,
      donazioni: results.map((d) => ({ ...d, anonimo: !!d.anonimo, etichetta: etichettaPremio(d), pubblico: donatorePubblico(d).frase })),
      utenti,
    });
  }

  if (p === "/api/admin/donazioni" && m === "POST") {
    const b = await req.json().catch(() => null);
    const v = validaDono(b);
    if (v.errore) return err(400, v.errore);
    let userId = null, nome = null;
    if (b.user_id) {
      const u = await env.DB.prepare("SELECT id FROM users WHERE id=?").bind(String(b.user_id)).first();
      if (!u) return err(400, "Utente non trovato");
      userId = u.id;
    } else nome = str(b.donatore_nome, 60) || null;
    const now = Date.now();
    await env.DB.prepare(
      `INSERT INTO donazioni(edition,user_id,donatore_nome,tipo,descrizione,quantita,gil,anonimo,nota,stato,created_at,updated_at,gestita_da)
       VALUES(?,?,?,?,?,?,?,?,?,'ricevuta',?,?,?)`
    ).bind(ed.year, userId, nome, v.tipo, v.descrizione, v.quantita, v.gil, b.anonimo ? 1 : 0, str(b.nota, 300), now, now, user.global_name || user.username).run();
    return json({ ok: true });
  }

  if ((r = p.match(/^\/api\/admin\/donazione\/(\d+)$/))) {
    const id = Number(r[1]);
    const d = await env.DB.prepare("SELECT * FROM donazioni WHERE id=? AND edition=?").bind(id, ed.year).first();
    if (!d) return err(404, "Dono non trovato");
    if (m === "DELETE") {
      await env.DB.prepare("DELETE FROM donazioni WHERE id=?").bind(id).run();
      return json({ ok: true });
    }
    if (m === "PUT") {
      const b = (await req.json().catch(() => null)) || {};
      const stato = STATI.has(b.stato) ? b.stato : d.stato;
      let giorno = "giorno" in b ? (b.giorno === null || b.giorno === "" ? null : intIn(b.giorno, 1, 31)) : d.giorno;
      if ("giorno" in b && b.giorno !== null && b.giorno !== "" && giorno === null) return err(400, "Giorno non valido");
      if (stato !== "ricevuta") giorno = null;
      let campi = { tipo: d.tipo, descrizione: d.descrizione, quantita: d.quantita, gil: d.gil };
      if ("descrizione" in b || "gil" in b || "tipo" in b) {
        const v = validaDono({ ...d, ...b });
        if (v.errore) return err(400, v.errore);
        campi = v;
      }
      const anonimo = "anonimo" in b ? (b.anonimo ? 1 : 0) : d.anonimo;
      const stmts = [];
      if (giorno !== null) {
        stmts.push(env.DB.prepare("UPDATE donazioni SET giorno=NULL WHERE edition=? AND giorno=? AND id<>?").bind(ed.year, giorno, id));
      }
      stmts.push(env.DB.prepare(
        "UPDATE donazioni SET stato=?, giorno=?, tipo=?, descrizione=?, quantita=?, gil=?, anonimo=?, updated_at=?, gestita_da=? WHERE id=?"
      ).bind(stato, giorno, campi.tipo, campi.descrizione, campi.quantita, campi.gil, anonimo, Date.now(), user.global_name || user.username, id));
      await env.DB.batch(stmts);
      return json({ ok: true });
    }
  }
  return err(404, "Non trovato");
}
