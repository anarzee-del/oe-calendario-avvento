// Aiutanti del postino: offerte dei premi, categorie, immagini e assegnazione ai giorni.

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
const err = (status, messaggio) => json({ errore: messaggio }, status);
const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const intIn = (v, min, max) => { const n = Number(v); return Number.isInteger(n) && n >= min && n <= max ? n : null; };
const STATI = new Set(["offerta", "accettata", "ricevuta", "rifiutata"]);
const MAX_OFFERTE_UTENTE = 20;
const MIN_GIL_OFFERTA = 100_000; // minimo per le offerte della community (lo staff non ha limiti)
const STAFF = "lo staff di Our Elysion";
const MAX_IMG = 600_000;

export const CATEGORIE = ["GIL", "Minion", "Mount", "Orchestrion roll", "Dye", "Glamour", "Fashion Accessories", "Emoticon"];

// Totale disponibile di un dono: GIL per i GIL, copie per gli oggetti
export const totaleDono = (d) => (d.tipo === "gil" ? Number(d.gil || 0) : Number(d.quantita || 0));

export function etichettaPremio(d) {
  if (!d) return "";
  if (d.tipo === "gil") return `${Number(d.gil || 0).toLocaleString("it-IT")} GIL`;
  return `${d.descrizione || ""}${d.quantita > 1 ? ` ×${d.quantita}` : ""}`;
}

// Cosa riceve ciascun vincitore di un'assegnazione
export function etichettaATesta(d, aTesta) {
  if (d.tipo === "gil") return `${Number(aTesta || 0).toLocaleString("it-IT")} GIL`;
  return `${d.descrizione || "Premio"}${aTesta > 1 ? ` ×${aTesta}` : ""}`;
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

// Assegnazioni (premi in palio) dell'edizione, raggruppate per giorno
export async function assegnazioniPerGiorno(env, year) {
  const { results } = await env.DB.prepare(
    `SELECT d.*, a.id AS a_id, a.giorno AS giorno, a.vincitori, a.a_testa, COALESCE(NULLIF(u.pg,''), u.global_name, u.username) AS u_nome
     FROM assegnazioni a JOIN donazioni d ON d.id = a.donazione_id LEFT JOIN users u ON u.id = d.user_id
     WHERE a.edition=? ORDER BY a.giorno, a.id`
  ).bind(year).all();
  const map = new Map();
  for (const r of results) { if (!map.has(r.giorno)) map.set(r.giorno, []); map.get(r.giorno).push(r); }
  return map;
}

// Riassunto per categorie, da mostrare prima dell'estrazione: "Mount ×5"
export function inPalio(assegnazioni = []) {
  const m = new Map();
  for (const a of assegnazioni) {
    const c = a.categoria || (a.tipo === "gil" ? "GIL" : "Premio");
    m.set(c, (m.get(c) || 0) + a.vincitori);
  }
  return [...m.entries()].map(([categoria, vincitori]) => ({ categoria, vincitori }));
}

export async function isAiutante(env, user, year) {
  if (!user) return false;
  const r = await env.DB.prepare("SELECT 1 FROM donazioni WHERE edition=? AND user_id=? AND stato='ricevuta' LIMIT 1").bind(year, user.id).first();
  return !!r;
}

function validaDono(b) {
  const categoria = CATEGORIE.includes(b?.categoria) ? b.categoria : (b?.tipo === "gil" ? "GIL" : null);
  if (!categoria) return { errore: "Scegli la categoria del premio" };
  if (categoria === "GIL") {
    const gil = intIn(b.gil, 1, 999_999_999);
    if (!gil) return { errore: "Indica quanti GIL vuoi donare" };
    return { tipo: "gil", categoria, gil, descrizione: null, quantita: 1 };
  }
  const descrizione = str(b?.descrizione, 100);
  if (!descrizione) return { errore: "Scrivi il nome dell'oggetto" };
  const quantita = intIn(b?.quantita ?? 1, 1, 999);
  if (!quantita) return { errore: "La quantità deve essere tra 1 e 999" };
  return { tipo: "oggetto", categoria, gil: null, descrizione, quantita };
}

async function giorniEstratti(env, year) {
  const { results } = await env.DB.prepare("SELECT giorno FROM estrazioni WHERE edition=?").bind(year).all();
  return new Set(results.map((r) => r.giorno));
}

export async function handleDonazioni(req, env, url, user, ed, oggi) {
  const p = url.pathname, m = req.method;
  const isAdmin = user?.role === "admin";
  const aperte = !ed.donazioni_fino || oggi <= ed.donazioni_fino;
  let r;

  /* ----- pubblico ----- */
  if (p === "/api/aiutanti" && m === "GET") {
    const { results: nomi } = await env.DB.prepare(
      `SELECT DISTINCT CASE WHEN d.user_id IS NOT NULL THEN COALESCE(NULLIF(u.pg,''), u.global_name, u.username) ELSE d.donatore_nome END AS nome
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
        "SELECT id,tipo,categoria,descrizione,quantita,gil,anonimo,nota,stato,created_at FROM donazioni WHERE edition=? AND user_id=? ORDER BY id DESC"
      ).bind(ed.year, user.id).all());
      mie = mie.map((d) => ({ ...d, etichetta: etichettaPremio(d), anonimo: !!d.anonimo }));
    }
    return json({ aperte, fino: ed.donazioni_fino, intro: ed.aiutanti_intro || "", categorie: CATEGORIE, aiutanti: nomi.map((x) => x.nome).filter(Boolean), anonimi: anon?.c || 0, mie });
  }

  if (p === "/api/donazioni" && m === "POST") {
    if (!user) return err(401, "Accedi con Discord per offrire un premio");
    if (!aperte) return err(400, "Le offerte per questa edizione sono chiuse");
    const b = await req.json().catch(() => null);
    const v = validaDono(b);
    if (v.errore) return err(400, v.errore);
    if (v.tipo === "gil" && v.gil < MIN_GIL_OFFERTA) return err(400, `L'offerta minima in GIL è di ${MIN_GIL_OFFERTA.toLocaleString("it-IT")} GIL`);
    const c = await env.DB.prepare("SELECT COUNT(*) AS c FROM donazioni WHERE edition=? AND user_id=?").bind(ed.year, user.id).first();
    if (c.c >= MAX_OFFERTE_UTENTE) return err(400, "Hai già registrato molte offerte: scrivi allo staff per aggiungerne altre");
    const now = Date.now();
    await env.DB.prepare(
      `INSERT INTO donazioni(edition,user_id,tipo,categoria,descrizione,quantita,gil,anonimo,nota,stato,created_at,updated_at)
       VALUES(?,?,?,?,?,?,?,?,?,'offerta',?,?)`
    ).bind(ed.year, user.id, v.tipo, v.categoria, v.descrizione, v.quantita, v.gil, b.anonimo ? 1 : 0, "", now, now).run();
    return json({ ok: true });
  }

  if ((r = p.match(/^\/api\/donazioni\/(\d+)$/)) && (m === "PUT" || m === "DELETE")) {
    if (!user) return err(401, "Accedi con Discord");
    const id = Number(r[1]);
    const d = await env.DB.prepare("SELECT * FROM donazioni WHERE id=? AND user_id=?").bind(id, user.id).first();
    if (!d) return err(404, "Offerta non trovata");
    if (m === "DELETE") {
      if (d.stato !== "offerta" && d.stato !== "accettata") return err(400, "Questo dono è già stato ricevuto: per toglierlo scrivi allo staff");
      await env.DB.prepare("DELETE FROM donazioni WHERE id=?").bind(id).run();
      return json({ ok: true });
    }
    const b = await req.json().catch(() => null);
    await env.DB.prepare("UPDATE donazioni SET anonimo=?, updated_at=? WHERE id=?").bind(b?.anonimo ? 1 : 0, Date.now(), id).run();
    return json({ ok: true });
  }

  // Immagine del premio: visibile allo staff, e a tutti dopo l'estrazione del giorno
  if ((r = p.match(/^\/api\/img\/premio\/(\d+)$/)) && m === "GET") {
    const id = Number(r[1]);
    if (!isAdmin) {
      const vis = await env.DB.prepare("SELECT 1 FROM vincite WHERE donazione_id=? LIMIT 1").bind(id).first();
      if (!vis) return new Response("Forbidden", { status: 403 });
    }
    // copia in cache per versione dell'immagine (il permesso è già controllato sopra)
    const chiave = new Request(`https://cache.oe-avvento/premio/${id}/${url.searchParams.get("v") || "0"}`);
    let res = await caches.default.match(chiave);
    if (!res) {
      const img = await env.DB.prepare("SELECT mime,data FROM premio_img WHERE donazione_id=?").bind(id).first();
      if (!img) return new Response("Not found", { status: 404 });
      res = new Response(img.data instanceof ArrayBuffer ? img.data : new Uint8Array(img.data), { headers: { "Content-Type": img.mime, "Cache-Control": "public, max-age=31536000, immutable" } });
      await caches.default.put(chiave, res.clone());
    }
    return new Response(res.body, { headers: { "Content-Type": res.headers.get("Content-Type"), "Cache-Control": isAdmin ? "private, no-store" : "public, max-age=604800, immutable" } });
  }

  /* ----- staff ----- */
  if (!p.startsWith("/api/admin/donazion") && !p.startsWith("/api/admin/assegnazion")) return null;
  if (!isAdmin) return err(403, "Area riservata allo staff");
  const chi = user.global_name || user.username;

  if (p === "/api/admin/donazioni" && m === "GET") {
    const { results } = await env.DB.prepare(
      `SELECT d.*, COALESCE(NULLIF(u.pg,''), u.global_name, u.username) AS u_nome, u.username AS u_username, u.pg AS u_pg, u.mondo AS u_mondo
       FROM donazioni d LEFT JOIN users u ON u.id = d.user_id WHERE d.edition=? ORDER BY d.id DESC`
    ).bind(ed.year).all();
    const { results: ass } = await env.DB.prepare("SELECT * FROM assegnazioni WHERE edition=? ORDER BY giorno, id").bind(ed.year).all();
    const { results: utenti } = await env.DB.prepare(
      "SELECT id, COALESCE(NULLIF(pg,''), global_name, username) AS nome FROM users ORDER BY nome COLLATE NOCASE"
    ).all();
    const estratti = await giorniEstratti(env, ed.year);
    return json({
      aperte, fino: ed.donazioni_fino, categorie: CATEGORIE,
      donazioni: results.map((d) => {
        const mie = ass.filter((a) => a.donazione_id === d.id).map((a) => ({ ...a, etichetta: etichettaATesta(d, a.a_testa), estratto: estratti.has(a.giorno) }));
        const usati = mie.reduce((s, a) => s + a.vincitori * a.a_testa, 0);
        return { ...d, anonimo: !!d.anonimo, etichetta: etichettaPremio(d), pubblico: donatorePubblico(d).frase, assegnazioni: mie, totale: totaleDono(d), usati };
      }),
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
      `INSERT INTO donazioni(edition,user_id,donatore_nome,tipo,categoria,descrizione,quantita,gil,anonimo,nota,stato,created_at,updated_at,gestita_da)
       VALUES(?,?,?,?,?,?,?,?,?,?,'ricevuta',?,?,?)`
    ).bind(ed.year, userId, nome, v.tipo, v.categoria, v.descrizione, v.quantita, v.gil, b.anonimo ? 1 : 0, str(b.nota, 300), now, now, chi).run();
    return json({ ok: true });
  }

  if ((r = p.match(/^\/api\/admin\/assegnazione\/(\d+)$/)) && m === "DELETE") {
    const a = await env.DB.prepare("SELECT * FROM assegnazioni WHERE id=? AND edition=?").bind(Number(r[1]), ed.year).first();
    if (!a) return err(404, "Assegnazione non trovata");
    if ((await giorniEstratti(env, ed.year)).has(a.giorno)) return err(400, "Il giorno è già stato estratto: ripeti l'estrazione dalla sezione Estrazioni se serve");
    await env.DB.prepare("DELETE FROM assegnazioni WHERE id=?").bind(a.id).run();
    return json({ ok: true });
  }

  if ((r = p.match(/^\/api\/admin\/donazione\/(\d+)(\/(assegna|immagine))?$/))) {
    const id = Number(r[1]), sub = r[3];
    const d = await env.DB.prepare("SELECT * FROM donazioni WHERE id=? AND edition=?").bind(id, ed.year).first();
    if (!d) return err(404, "Dono non trovato");
    const { results: ass } = await env.DB.prepare("SELECT * FROM assegnazioni WHERE donazione_id=?").bind(id).all();

    if (sub === "assegna" && m === "POST") {
      if (d.stato !== "ricevuta") return err(400, "Si possono assegnare solo i doni ricevuti");
      const b = (await req.json().catch(() => null)) || {};
      const giorno = intIn(b.giorno, 1, 31), vincitori = intIn(b.vincitori, 1, 50), aTesta = intIn(b.a_testa, 1, 999_999_999);
      if (!giorno || !vincitori || !aTesta) return err(400, "Indica giorno, numero di vincitori e quanto riceve ciascuno");
      if ((await giorniEstratti(env, ed.year)).has(giorno)) return err(400, "Quel giorno è già stato estratto");
      const usati = ass.reduce((s, a) => s + a.vincitori * a.a_testa, 0);
      const resto = totaleDono(d) - usati;
      if (vincitori * aTesta > resto) {
        return err(400, d.tipo === "gil"
          ? `Restano ${resto.toLocaleString("it-IT")} GIL da assegnare per questo dono`
          : `Restano ${resto} copie da assegnare per questo dono`);
      }
      await env.DB.prepare("INSERT INTO assegnazioni(edition,giorno,donazione_id,vincitori,a_testa,created_at) VALUES(?,?,?,?,?,?)")
        .bind(ed.year, giorno, id, vincitori, aTesta, Date.now()).run();
      return json({ ok: true });
    }

    if (sub === "immagine") {
      if (m === "DELETE") {
        await env.DB.batch([
          env.DB.prepare("DELETE FROM premio_img WHERE donazione_id=?").bind(id),
          env.DB.prepare("UPDATE donazioni SET img_ver=0 WHERE id=?").bind(id),
        ]);
        return json({ ok: true });
      }
      if (m === "PUT") {
        const form = await req.formData().catch(() => null);
        const f = form?.get("img");
        if (!f || typeof f.arrayBuffer !== "function" || !/^image\/(webp|jpeg|png)$/.test(f.type) || f.size > MAX_IMG) return err(400, "Immagine non valida o troppo pesante");
        await env.DB.batch([
          env.DB.prepare("INSERT INTO premio_img(donazione_id,mime,data) VALUES(?,?,?) ON CONFLICT(donazione_id) DO UPDATE SET mime=excluded.mime, data=excluded.data")
            .bind(id, f.type, await f.arrayBuffer()),
          env.DB.prepare("UPDATE donazioni SET img_ver=img_ver+1 WHERE id=?").bind(id),
        ]);
        return json({ ok: true });
      }
    }

    if (!sub && m === "DELETE") {
      const vinto = await env.DB.prepare("SELECT 1 FROM vincite WHERE donazione_id=? LIMIT 1").bind(id).first();
      if (vinto) return err(400, "Questo dono è già stato vinto: non si può eliminare");
      await env.DB.batch([
        env.DB.prepare("DELETE FROM assegnazioni WHERE donazione_id=?").bind(id),
        env.DB.prepare("DELETE FROM premio_img WHERE donazione_id=?").bind(id),
        env.DB.prepare("DELETE FROM donazioni WHERE id=?").bind(id),
      ]);
      return json({ ok: true });
    }

    if (!sub && m === "PUT") {
      const b = (await req.json().catch(() => null)) || {};
      const stato = STATI.has(b.stato) ? b.stato : d.stato;
      if (stato !== "ricevuta" && ass.length) return err(400, "Prima togli il dono dai giorni a cui è assegnato");
      let campi = { tipo: d.tipo, categoria: d.categoria, descrizione: d.descrizione, quantita: d.quantita, gil: d.gil };
      if (["descrizione", "gil", "categoria", "quantita"].some((k) => k in b)) {
        const v = validaDono({ ...d, ...b });
        if (v.errore) return err(400, v.errore);
        const usati = ass.reduce((s, a) => s + a.vincitori * a.a_testa, 0);
        if (totaleDono(v) < usati) return err(400, "La nuova quantità è minore di quella già assegnata ai giorni");
        if (ass.length && v.tipo !== d.tipo) return err(400, "Prima togli il dono dai giorni a cui è assegnato");
        campi = v;
      }
      const anonimo = "anonimo" in b ? (b.anonimo ? 1 : 0) : d.anonimo;
      const dettagli = "dettagli" in b ? str(b.dettagli, 600) : d.dettagli;
      await env.DB.prepare(
        "UPDATE donazioni SET stato=?, tipo=?, categoria=?, descrizione=?, quantita=?, gil=?, anonimo=?, dettagli=?, updated_at=?, gestita_da=? WHERE id=?"
      ).bind(stato, campi.tipo, campi.categoria, campi.descrizione, campi.quantita, campi.gil, anonimo, dettagli, Date.now(), chi, id).run();
      return json({ ok: true });
    }
  }
  return err(404, "Non trovato");
}
