// Partecipazioni, estrazione equa di mezzanotte, albo e vincite.
import { editionDays, romeNow } from "./time.js";
import { assegnazioniPerGiorno, etichettaATesta, donatorePubblico } from "./donazioni.js";

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
const err = (status, messaggio) => json({ errore: messaggio }, status);
const nomeUtente = (u) => u.global_name || u.username || "?";

function randomInt(max) {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] % max;
}

// Scelta pesata: ogni candidato ha un numero di biglietti
function pesca(candidati) {
  const tot = candidati.reduce((s, c) => s + c.biglietti, 0);
  let x = randomInt(tot);
  for (const c of candidati) { if (x < c.biglietti) return c; x -= c.biglietti; }
  return candidati[candidati.length - 1];
}

/*
  Estrazione equa di un giorno:
  - un premio al giorno a persona;
  - nessuno supera il tetto di premi dell'edizione;
  - nessuno vince il premio che ha donato;
  - la precedenza va a chi ha vinto di meno finora; a parità si sorteggia,
    con più biglietti a chi ha risposto giusto alla sfida.
*/
export async function estrai(env, ed, n, da = "automatica") {
  const gia = await env.DB.prepare("SELECT 1 FROM estrazioni WHERE edition=? AND giorno=?").bind(ed.year, n).first();
  if (gia) return { gia: true };
  const day = await env.DB.prepare("SELECT tipo, giusta FROM days WHERE edition=? AND n=?").bind(ed.year, n).first() || {};
  const { results: part } = await env.DB.prepare(
    `SELECT p.user_id, p.risposta FROM partecipazioni p JOIN users u ON u.id = p.user_id
     WHERE p.edition=? AND p.giorno=? AND u.escluso=0`
  ).bind(ed.year, n).all();
  const { results: vinte } = await env.DB.prepare("SELECT user_id, COUNT(*) AS c FROM vincite WHERE edition=? GROUP BY user_id").bind(ed.year).all();
  const totali = new Map(vinte.map((v) => [v.user_id, v.c]));
  const assegn = (await assegnazioniPerGiorno(env, ed.year)).get(n) || [];
  const sfida = day.tipo === "sfida";
  const bigliettiDi = (p) => (sfida && day.giusta !== null && p.risposta === day.giusta ? Math.max(1, ed.biglietti_sfida || 3) : 1);

  const oggiVinto = new Set();
  const nuove = [];
  const log = [];
  for (const a of assegn) {
    for (let k = 0; k < a.vincitori; k++) {
      const eleggibili = part.filter((p) =>
        !oggiVinto.has(p.user_id) && (totali.get(p.user_id) || 0) < (ed.tetto || 5) && p.user_id !== a.user_id);
      if (!eleggibili.length) { log.push(`Nessun vincitore possibile per ${etichettaATesta(a, a.a_testa)}`); continue; }
      const minimo = Math.min(...eleggibili.map((p) => totali.get(p.user_id) || 0));
      const candidati = eleggibili.filter((p) => (totali.get(p.user_id) || 0) === minimo).map((p) => ({ ...p, biglietti: bigliettiDi(p) }));
      const w = pesca(candidati);
      oggiVinto.add(w.user_id);
      totali.set(w.user_id, (totali.get(w.user_id) || 0) + 1);
      nuove.push({ a, user_id: w.user_id });
      log.push(`${etichettaATesta(a, a.a_testa)}: estratto tra ${candidati.length} con ${minimo} premi già vinti`);
    }
  }
  const now = Date.now();
  const stmts = [
    // se un'altra estrazione dello stesso giorno è già partita, questa riga fa fallire tutto il blocco
    env.DB.prepare("INSERT INTO estrazioni(edition,giorno,eseguita_at,eseguita_da,partecipanti,log) VALUES(?,?,?,?,?,?)")
      .bind(ed.year, n, now, da, part.length, JSON.stringify(log)),
    ...nuove.map((v) => env.DB.prepare(
      "INSERT INTO vincite(edition,giorno,assegnazione_id,donazione_id,user_id,a_testa,created_at) VALUES(?,?,?,?,?,?,?)"
    ).bind(ed.year, n, v.a.a_id, v.a.id, v.user_id, v.a.a_testa, now)),
  ];
  try { await env.DB.batch(stmts); } catch (e) {
    const ora = await env.DB.prepare("SELECT 1 FROM estrazioni WHERE edition=? AND giorno=?").bind(ed.year, n).first();
    if (ora) return { gia: true };
    throw e;
  }
  return { ok: true, vincitori: nuove.length, partecipanti: part.length };
}

// Estrae tutti i giorni già chiusi e non ancora estratti (usato dal cron e come rete di sicurezza)
export async function estraiArretrati(env, ed, oggiReale = romeNow().date) {
  const { results } = await env.DB.prepare("SELECT giorno FROM estrazioni WHERE edition=?").bind(ed.year).all();
  const fatti = new Set(results.map((r) => r.giorno));
  const out = [];
  for (const d of editionDays(ed)) {
    if (d.data < oggiReale && !fatti.has(d.n)) out.push({ n: d.n, ...(await estrai(env, ed, d.n)) });
  }
  return out;
}

export async function giorniEstratti(env, year) {
  const { results } = await env.DB.prepare("SELECT giorno FROM estrazioni WHERE edition=?").bind(year).all();
  return new Set(results.map((r) => r.giorno));
}

export async function contaLettere(env, year) {
  const r = await env.DB.prepare("SELECT COUNT(*) AS c FROM partecipazioni WHERE edition=?").bind(year).first();
  return r?.c || 0;
}

// Premi di un giorno estratto, con immagine, dettagli e vincitori
export async function premiEstratti(env, year, n) {
  const assegn = (await assegnazioniPerGiorno(env, year)).get(n) || [];
  const { results: vinc } = await env.DB.prepare(
    `SELECT v.assegnazione_id, v.user_id, COALESCE(u.global_name, u.username) AS nome FROM vincite v JOIN users u ON u.id = v.user_id
     WHERE v.edition=? AND v.giorno=? ORDER BY v.id`
  ).bind(year, n).all();
  return assegn.map((a) => ({
    id: a.a_id,
    etichetta: etichettaATesta(a, a.a_testa),
    categoria: a.categoria || (a.tipo === "gil" ? "GIL" : "Premio"),
    dettagli: a.dettagli || "",
    immagine: a.img_ver ? `/api/img/premio/${a.id}?v=${a.img_ver}` : null,
    offerto: donatorePubblico(a).frase,
    posti: a.vincitori,
    vincitori: vinc.filter((v) => v.assegnazione_id === a.a_id).map((v) => ({ id: v.user_id, nome: v.nome })),
  }));
}

/* ---------- API ---------- */

export async function handleGioco(req, env, url, user, ed, oggi, oggiRealeData) {
  const p = url.pathname, m = req.method;
  const isAdmin = user?.role === "admin";
  let r;

  // Partecipazione al giorno corrente
  if ((r = p.match(/^\/api\/partecipa\/(\d{1,2})$/)) && m === "POST") {
    const n = Number(r[1]);
    if (!user) return err(401, "Accedi con Discord per partecipare");
    if (isAdmin) return err(400, "Lo staff organizza il calendario e non partecipa alle estrazioni");
    if (user.escluso) return err(403, "Il tuo account è stato escluso dall'evento: scrivi allo staff");
    if (!user.pg || !user.dc) return err(400, "Prima completa il profilo con il personaggio a cui consegnare i premi");
    const d = editionDays(ed)[n - 1];
    if (!d || d.data !== oggi) return err(400, "Si può partecipare solo alla busta di oggi, fino alle 23:59");
    const day = await env.DB.prepare("SELECT tipo, risposte FROM days WHERE edition=? AND n=?").bind(ed.year, n).first() || {};
    let risposta = null;
    if (day.tipo === "sfida") {
      const b = await req.json().catch(() => null);
      const ris = JSON.parse(day.risposte || "[]");
      risposta = Number.isInteger(b?.risposta) && b.risposta >= 0 && b.risposta < ris.length && ris[b.risposta] ? b.risposta : null;
      if (risposta === null) return err(400, "Scegli una risposta");
    }
    const res = await env.DB.prepare(
      "INSERT OR IGNORE INTO partecipazioni(edition,giorno,user_id,risposta,created_at) VALUES(?,?,?,?,?)"
    ).bind(ed.year, n, user.id, risposta, Date.now()).run();
    if (!res.meta?.changes) return err(400, "Hai già partecipato a questa busta");
    return json({ ok: true, lettere: await contaLettere(env, ed.year) });
  }

  // Albo dei vincitori
  if (p === "/api/albo" && m === "GET") {
    const { results: anni } = await env.DB.prepare("SELECT DISTINCT edition FROM estrazioni ORDER BY edition DESC").all();
    const richiesto = Number(url.searchParams.get("anno"));
    const e = richiesto && richiesto !== ed.year
      ? await env.DB.prepare("SELECT * FROM editions WHERE year=?").bind(richiesto).first()
      : ed;
    if (!e) return err(404, "Edizione non trovata");
    const estratti = [...(await giorniEstratti(env, e.year))].sort((a, b) => a - b);
    const giorni = [];
    for (const n of estratti) giorni.push({ n, data: editionDays(e)[n - 1]?.data, premi: await premiEstratti(env, e.year, n) });
    return json({ anno: e.year, anni: [...new Set([ed.year, ...anni.map((x) => x.edition)])].sort((a, b) => b - a), giorni });
  }

  // Il mio dicembre: partecipazioni e vincite
  if (p === "/api/mio" && m === "GET") {
    if (!user) return err(401, "Accedi con Discord");
    const { results: part } = await env.DB.prepare("SELECT giorno FROM partecipazioni WHERE edition=? AND user_id=? ORDER BY giorno").bind(ed.year, user.id).all();
    const { results: vinc } = await env.DB.prepare(
      `SELECT v.giorno, v.a_testa, v.consegnato, v.consegnato_at, d.tipo, d.descrizione, d.categoria, d.img_ver, d.id AS did
       FROM vincite v JOIN donazioni d ON d.id = v.donazione_id WHERE v.edition=? AND v.user_id=? ORDER BY v.giorno`
    ).bind(ed.year, user.id).all();
    return json({
      partecipazioni: part.map((x) => x.giorno),
      biscotti_partecipazione: ed.biscotti_partecipazione,
      vincite: vinc.map((v) => ({
        giorno: v.giorno, etichetta: etichettaATesta(v, v.a_testa), categoria: v.categoria || (v.tipo === "gil" ? "GIL" : "Premio"),
        immagine: v.img_ver ? `/api/img/premio/${v.did}?v=${v.img_ver}` : null, consegnato: v.consegnato === 1, non_ritirato: v.consegnato === 2,
      })),
    });
  }

  /* ----- staff ----- */
  if (!p.startsWith("/api/admin/estrazion")) return null;
  if (!isAdmin) return err(403, "Area riservata allo staff");
  const chi = user.global_name || user.username;
  const oggiReale = oggiRealeData || romeNow().date;

  if (p === "/api/admin/estrazioni" && m === "GET") {
    const assegn = await assegnazioniPerGiorno(env, ed.year);
    const { results: estr } = await env.DB.prepare("SELECT * FROM estrazioni WHERE edition=?").bind(ed.year).all();
    const { results: conti } = await env.DB.prepare("SELECT giorno, COUNT(*) AS c FROM partecipazioni WHERE edition=? GROUP BY giorno").bind(ed.year).all();
    const out = [];
    for (const d of editionDays(ed)) {
      const e = estr.find((x) => x.giorno === d.n);
      const posti = (assegn.get(d.n) || []).reduce((s, a) => s + a.vincitori, 0);
      out.push({
        n: d.n, data: d.data, posti,
        partecipanti: conti.find((x) => x.giorno === d.n)?.c || 0,
        stato: e ? "estratta" : d.data < oggiReale ? "da_estrarre" : d.data === oggiReale ? "in_corso" : "futura",
        eseguita_at: e?.eseguita_at || null, eseguita_da: e?.eseguita_da || null,
        log: e ? JSON.parse(e.log || "[]") : [],
        premi: e ? await premiEstratti(env, ed.year, d.n) : [],
      });
    }
    const { results: classifica } = await env.DB.prepare(
      `SELECT u.id, COALESCE(u.global_name, u.username) AS nome, COUNT(v.id) AS vinti
       FROM vincite v JOIN users u ON u.id = v.user_id WHERE v.edition=? GROUP BY u.id ORDER BY vinti DESC, nome`
    ).bind(ed.year).all();
    return json({ oggi: oggiReale, tetto: ed.tetto, giorni: out, classifica });
  }

  // Consegne di gennaio: tutte le vincite con il personaggio a cui consegnarle
  if (p === "/api/admin/estrazioni/consegne" && m === "GET") {
    const { results } = await env.DB.prepare(
      `SELECT v.id, v.giorno, v.a_testa, v.consegnato, v.consegnato_at, v.consegnato_da, v.nota,
         d.tipo, d.descrizione, d.categoria,
         u.id AS user_id, COALESCE(u.global_name, u.username) AS nome, u.username, u.pg, u.dc, u.mondo
       FROM vincite v JOIN donazioni d ON d.id = v.donazione_id JOIN users u ON u.id = v.user_id
       WHERE v.edition=? ORDER BY u.dc, u.mondo, u.pg COLLATE NOCASE, v.giorno`
    ).bind(ed.year).all();
    return json({
      consegna_da: ed.consegna_da, consegna_a: ed.consegna_a,
      vincite: results.map((v) => ({ ...v, etichetta: etichettaATesta(v, v.a_testa), gil: v.tipo === "gil" ? v.a_testa : 0 })),
    });
  }
  if ((r = p.match(/^\/api\/admin\/estrazioni\/vincita\/(\d+)$/)) && m === "PUT") {
    const b = (await req.json().catch(() => null)) || {};
    const v = await env.DB.prepare("SELECT * FROM vincite WHERE id=? AND edition=?").bind(Number(r[1]), ed.year).first();
    if (!v) return err(404, "Vincita non trovata");
    const stato = [0, 1, 2].includes(b.consegnato) ? b.consegnato : v.consegnato;
    const nota = "nota" in b ? (typeof b.nota === "string" ? b.nota.trim().slice(0, 200) : "") : v.nota;
    const cambiato = stato !== v.consegnato;
    await env.DB.prepare("UPDATE vincite SET consegnato=?, consegnato_at=?, consegnato_da=?, nota=? WHERE id=?")
      .bind(stato, cambiato ? (stato ? Date.now() : null) : v.consegnato_at, cambiato ? (stato ? chi : null) : v.consegnato_da, nota, v.id).run();
    return json({ ok: true });
  }

  // Biscotti di Tullio da accreditare a mano su Mee6
  if (p === "/api/admin/estrazioni/biscotti" && m === "GET") {
    const tappe = JSON.parse(ed.tappe || "[]");
    const lettere = await contaLettere(env, ed.year);
    const bonus = tappe.filter((t) => lettere >= t.s).reduce((s, t) => s + (t.b || 0), 0);
    const { results } = await env.DB.prepare(
      `SELECT u.id, COALESCE(u.global_name, u.username) AS nome, u.username,
         COUNT(p.giorno) AS partecipazioni,
         (SELECT COUNT(DISTINCT v.giorno) FROM vincite v WHERE v.edition=p.edition AND v.user_id=u.id) AS giorni_vinti,
         (SELECT fatto_at FROM biscotti_fatti b WHERE b.edition=p.edition AND b.user_id=u.id) AS fatto_at
       FROM partecipazioni p JOIN users u ON u.id = p.user_id
       WHERE p.edition=? GROUP BY u.id ORDER BY nome COLLATE NOCASE`
    ).bind(ed.year).all();
    const lista = results.map((x) => {
      const consolazione = Math.max(0, x.partecipazioni - x.giorni_vinti) * (ed.biscotti_partecipazione || 0);
      return { ...x, consolazione, bonus, totale: consolazione + bonus, fatto: !!x.fatto_at };
    });
    return json({ lettere, bonus, per_partecipazione: ed.biscotti_partecipazione, lista });
  }
  if ((r = p.match(/^\/api\/admin\/estrazioni\/biscotti\/(\d+)$/)) && m === "PUT") {
    const b = await req.json().catch(() => null);
    if (b?.fatto) await env.DB.prepare("INSERT OR REPLACE INTO biscotti_fatti(edition,user_id,fatto_at,fatto_da) VALUES(?,?,?,?)").bind(ed.year, r[1], Date.now(), chi).run();
    else await env.DB.prepare("DELETE FROM biscotti_fatti WHERE edition=? AND user_id=?").bind(ed.year, r[1]).run();
    return json({ ok: true });
  }

  if ((r = p.match(/^\/api\/admin\/estrazione\/(\d{1,2})(\/ripeti)?$/)) && m === "POST") {
    const n = Number(r[1]);
    const d = editionDays(ed)[n - 1];
    if (!d) return err(404, "Giorno inesistente");
    if (!(d.data < oggiReale)) return err(400, "Si può estrarre solo una busta già chiusa (dopo la mezzanotte)");
    if (r[2]) {
      const consegnati = await env.DB.prepare("SELECT 1 FROM vincite WHERE edition=? AND giorno=? AND consegnato=1 LIMIT 1").bind(ed.year, n).first();
      if (consegnati) return err(400, "Alcuni premi di questo giorno risultano già consegnati: non si può ripetere l'estrazione");
      await env.DB.batch([
        env.DB.prepare("DELETE FROM vincite WHERE edition=? AND giorno=?").bind(ed.year, n),
        env.DB.prepare("DELETE FROM estrazioni WHERE edition=? AND giorno=?").bind(ed.year, n),
      ]);
    }
    const res = await estrai(env, ed, n, chi);
    if (res.gia) return err(400, "Questo giorno è già stato estratto");
    return json(res);
  }

  return err(404, "Non trovato");
}
