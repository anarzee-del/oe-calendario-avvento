// Calendario dell'Avvento di Our Elysion — worker principale (API)
import { ensureSchema, currentEdition } from "./db.js";
import { handleAuth, currentUser } from "./auth.js";
import { romeNow, editionDays, dayState, weekday, isIsoDate } from "./time.js";
import { handleDonazioni, assegnazioniPerGiorno, inPalio, isAiutante } from "./donazioni.js";
import { handleGioco, estraiArretrati, giorniEstratti, contaLettere, premiEstratti } from "./gioco.js";
import { handleExtra } from "./extra.js";

const JSONH = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: JSONH });
const err = (status, messaggio) => json({ errore: messaggio }, status);

const MAX_FULL = 1_500_000; // byte, immagine del capitolo
const MAX_THUMB = 200_000; // byte, francobollo
const FUOCHI = new Set(["sinistra", "centro", "destra"]);

export default {
  // Estrazione automatica: il cron gira alle 22:00 e alle 23:00 UTC, cioè sempre a mezzanotte italiana
  // (ora solare o legale); la funzione estrae tutti i giorni già chiusi e non ancora estratti.
  async scheduled(event, env, ctx) {
    await ensureSchema(env);
    const ed = await currentEdition(env);
    const res = await estraiArretrati(env, ed);
    if (res.length) console.log("Estrazioni eseguite", JSON.stringify(res));
  },

  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    try {
      await ensureSchema(env);
      if (url.pathname.startsWith("/api/auth/")) return await handleAuth(req, env, url);

      // Protezione base contro richieste da altri siti sulle operazioni che modificano dati
      if (req.method !== "GET" && req.method !== "HEAD") {
        const origin = req.headers.get("Origin");
        if (origin && origin !== url.origin && env.DEV_LOGIN !== "1") return err(403, "Richiesta non consentita");
      }
      const user = await currentUser(req, env);
      return await route(req, env, url, user, ctx);
    } catch (e) {
      console.error(e);
      return err(500, "Errore interno, riprova tra poco");
    }
  },
};

/* ---------- utilità ---------- */

// "Oggi" in ora italiana. Gli admin possono simulare un'altra data per l'anteprima.
function today(url, user, env) {
  const sim = url.searchParams.get("simula");
  if ((user?.role === "admin" || env?.DEV_LOGIN === "1") && isIsoDate(sim)) return sim;
  return romeNow().date;
}

// Data vera (in sviluppo locale si può simulare anche questa, per provare partecipazioni ed estrazioni)
function oggiReale(url, env) {
  const sim = url.searchParams.get("simula");
  return env.DEV_LOGIN === "1" && isIsoDate(sim) ? sim : romeNow().date;
}

function publicEdition(ed) {
  return {
    anno: ed.year, inizio: ed.inizio, fine: ed.fine, consegna_da: ed.consegna_da, consegna_a: ed.consegna_a,
    titolo: ed.titolo, sottotitolo: ed.sottotitolo, intro: ed.intro, marchio: ed.marchio || "",
    come_funziona: ed.come_funziona, regolamento: ed.regolamento,
    tappe: JSON.parse(ed.tappe || "[]"),
    donazioni_fino: ed.donazioni_fino, aiutanti_intro: ed.aiutanti_intro || "",
    tetto: ed.tetto, biglietti_sfida: ed.biglietti_sfida, biscotti_partecipazione: ed.biscotti_partecipazione,
  };
}

function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id, nome: u.global_name || u.username, username: u.username, ruolo: u.role,
    avatar: u.avatar ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=64` : null,
    pg: u.pg || "", dc: u.dc || "", mondo: u.mondo || "",
  };
}

async function readJson(req) {
  try { return await req.json(); } catch { return null; }
}

const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/* ---------- router ---------- */

async function route(req, env, url, user, ctx) {
  const p = url.pathname;
  const m = req.method;
  const ed = await currentEdition(env);
  const isAdmin = user?.role === "admin";

  if (p === "/api/stato" && m === "GET") return stato(env, url, user, ed, ctx);

  const dr = await handleDonazioni(req, env, url, user, ed, today(url, user, env));
  if (dr) return dr;
  const gr = await handleGioco(req, env, url, user, ed, user?.role === "admin" ? oggiReale(url, env) : today(url, user, env), oggiReale(url, env));
  if (gr) return gr;
  const xr = await handleExtra(req, env, url, user, ed, user?.role === "admin" ? oggiReale(url, env) : today(url, user, env));
  if (xr) return xr;

  let r;
  if ((r = p.match(/^\/api\/giorno\/(\d{1,2})$/)) && m === "GET") return giorno(env, url, user, ed, Number(r[1]));
  if ((r = p.match(/^\/api\/img\/(\d{1,2})\/(full|thumb)$/)) && m === "GET") return immagine(env, url, user, ed, Number(r[1]), r[2]);

  if (p === "/api/profilo" && m === "PUT") {
    if (!user) return err(401, "Accedi con Discord");
    const b = await readJson(req);
    const pg = str(b?.pg, 40), dc = str(b?.dc, 10), mondo = str(b?.mondo, 20);
    if (!pg) return err(400, "Scrivi il nome del personaggio");
    if (!["Light", "Chaos"].includes(dc)) return err(400, "Scegli il data center");
    await env.DB.prepare("UPDATE users SET pg=?, dc=?, mondo=? WHERE id=?").bind(pg, dc, mondo, user.id).run();
    return json({ ok: true });
  }

  // ----- area staff -----
  if (p.startsWith("/api/admin/")) {
    if (!isAdmin) return err(403, "Area riservata allo staff");

    if (p === "/api/admin/giorni" && m === "GET") {
      const { results } = await env.DB.prepare(
        "SELECT edition,n,tipo,etichetta,titolo,testo,fuoco,domanda,risposte,giusta,stato_capitolo,img_ver,updated_at,updated_by FROM days WHERE edition=? ORDER BY n"
      ).bind(ed.year).all();
      const days = editionDays(ed);
      const premi = await assegnazioniPerGiorno(env, ed.year);
      return json({
        giorni: days.map((d) => {
          const row = results.find((x) => x.n === d.n) || { n: d.n };
          return { ...row, data: d.data, wd: weekday(d.data), risposte: JSON.parse(row.risposte || "[]"), in_palio: inPalio(premi.get(d.n)) };
        }),
      });
    }

    if ((r = p.match(/^\/api\/admin\/giorno\/(\d{1,2})$/)) && m === "PUT") {
      const n = Number(r[1]);
      if (n < 1 || n > editionDays(ed).length) return err(404, "Giorno inesistente");
      const b = await readJson(req);
      if (!b) return err(400, "Dati non validi");
      const tipo = b.tipo === "sfida" ? "sfida" : "sorteggio";
      const risposte = Array.isArray(b.risposte) ? b.risposte.slice(0, 6).map((x) => str(x, 200)) : [];
      const giusta = Number.isInteger(b.giusta) && b.giusta >= 0 && b.giusta < risposte.length ? b.giusta : null;
      if (tipo === "sfida" && b.stato_capitolo === "pronto") {
        if (!str(b.domanda, 300) || risposte.filter(Boolean).length < 2 || giusta === null)
          return err(400, "Per un giorno di sfida servono la domanda, almeno due risposte e quella giusta");
      }
      await env.DB.prepare(
        `INSERT INTO days(edition,n,tipo,etichetta,titolo,testo,fuoco,domanda,risposte,giusta,stato_capitolo,updated_at,updated_by)
         VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)
         ON CONFLICT(edition,n) DO UPDATE SET tipo=excluded.tipo, etichetta=excluded.etichetta, titolo=excluded.titolo,
           testo=excluded.testo, fuoco=excluded.fuoco, domanda=excluded.domanda, risposte=excluded.risposte,
           giusta=excluded.giusta, stato_capitolo=excluded.stato_capitolo,
           updated_at=excluded.updated_at, updated_by=excluded.updated_by`
      ).bind(
        ed.year, n, tipo, str(b.etichetta, 24), str(b.titolo, 120), str(b.testo, 20000),
        FUOCHI.has(b.fuoco) ? b.fuoco : "centro",
        str(b.domanda, 300), JSON.stringify(risposte), giusta,
        ["manca", "bozza", "pronto"].includes(b.stato_capitolo) ? b.stato_capitolo : "bozza",
        Date.now(), user.global_name || user.username
      ).run();
      return json({ ok: true });
    }

    if ((r = p.match(/^\/api\/admin\/giorno\/(\d{1,2})\/immagine$/))) {
      const n = Number(r[1]);
      if (m === "DELETE") {
        await env.DB.batch([
          env.DB.prepare("DELETE FROM images WHERE edition=? AND n=?").bind(ed.year, n),
          env.DB.prepare("UPDATE days SET img_ver=0 WHERE edition=? AND n=?").bind(ed.year, n),
        ]);
        return json({ ok: true });
      }
      if (m === "PUT") {
        const form = await req.formData().catch(() => null);
        if (!form) return err(400, "Caricamento non valido");
        const full = form.get("full"), thumb = form.get("thumb");
        const ok = (f, max) => f && typeof f.arrayBuffer === "function" && /^image\/(webp|jpeg|png)$/.test(f.type) && f.size > 0 && f.size <= max;
        if (!ok(thumb, MAX_THUMB)) return err(400, "Francobollo non valido");
        if (full && !ok(full, MAX_FULL)) return err(400, "Immagine troppo pesante: massimo 1,5 MB");
        const stmts = [];
        if (full) stmts.push(env.DB.prepare(
          "INSERT INTO images(edition,n,kind,mime,data) VALUES(?,?,?,?,?) ON CONFLICT(edition,n,kind) DO UPDATE SET mime=excluded.mime, data=excluded.data"
        ).bind(ed.year, n, "full", full.type, await full.arrayBuffer()));
        stmts.push(env.DB.prepare(
          "INSERT INTO images(edition,n,kind,mime,data) VALUES(?,?,?,?,?) ON CONFLICT(edition,n,kind) DO UPDATE SET mime=excluded.mime, data=excluded.data"
        ).bind(ed.year, n, "thumb", thumb.type, await thumb.arrayBuffer()));
        stmts.push(env.DB.prepare("UPDATE days SET img_ver=img_ver+1, updated_at=? WHERE edition=? AND n=?").bind(Date.now(), ed.year, n));
        await env.DB.batch(stmts);
        const v = await env.DB.prepare("SELECT img_ver FROM days WHERE edition=? AND n=?").bind(ed.year, n).first();
        return json({ ok: true, img_ver: v?.img_ver || 0 });
      }
    }

    if (p === "/api/admin/edizione" && m === "PUT") {
      const b = await readJson(req);
      if (!b) return err(400, "Dati non validi");
      const dates = ["inizio", "fine", "consegna_da", "consegna_a"];
      for (const k of dates) if (!isIsoDate(b[k])) return err(400, "Controlla le date");
      if (!isIsoDate(b.donazioni_fino)) return err(400, "Controlla la scadenza delle offerte");
      if (b.fine < b.inizio) return err(400, "La fine deve venire dopo l'inizio");
      const count = Math.round((new Date(b.fine) - new Date(b.inizio)) / 86400000) + 1;
      if (count > 31) return err(400, "Il calendario può durare al massimo 31 giorni");
      if (b.consegna_a < b.consegna_da) return err(400, "Controlla le date di consegna");
      const tetto = Math.max(1, Math.min(25, Number(b.tetto) | 0 || ed.tetto || 5));
      const biglietti = Math.max(1, Math.min(10, Number(b.biglietti_sfida) | 0 || ed.biglietti_sfida || 3));
      const biscotti = Math.max(0, Math.min(10000, Number.isFinite(Number(b.biscotti_partecipazione)) ? Number(b.biscotti_partecipazione) | 0 : ed.biscotti_partecipazione));
      const tappe = Array.isArray(b.tappe)
        ? b.tappe.slice(0, 5).map((t) => ({ s: Math.max(1, Math.min(100000, Number(t.s) | 0)), b: Math.max(0, Math.min(100000, Number(t.b) | 0)) }))
          .sort((a, c) => a.s - c.s)
        : [];
      const stmts = [env.DB.prepare(
        `UPDATE editions SET inizio=?, fine=?, consegna_da=?, consegna_a=?, titolo=?, sottotitolo=?, marchio=?, intro=?,
         come_funziona=?, regolamento=?, tappe=?, donazioni_fino=?, aiutanti_intro=?,
         tetto=?, biglietti_sfida=?, biscotti_partecipazione=? WHERE year=?`
      ).bind(b.inizio, b.fine, b.consegna_da, b.consegna_a, str(b.titolo, 80), str(b.sottotitolo, 120), str(b.marchio, 40),
        str(b.intro, 600), str(b.come_funziona, 4000), str(b.regolamento, 12000), JSON.stringify(tappe),
        b.donazioni_fino, str(b.aiutanti_intro, 3000), tetto, biglietti, biscotti, ed.year)];
      for (let n = 1; n <= count; n++) {
        stmts.push(env.DB.prepare("INSERT OR IGNORE INTO days(edition,n,titolo) VALUES(?,?,?)").bind(ed.year, n, `Capitolo ${n}`));
      }
      await env.DB.batch(stmts);
      return json({ ok: true });
    }
  }

  return err(404, "Non trovato");
}

/* ---------- pubblico ---------- */

async function stato(env, url, user, ed, ctx) {
  const oggi = today(url, user, env);
  // Rete di sicurezza: se il cron di mezzanotte non fosse partito, l'estrazione parte alla prima visita
  const reale = oggiReale(url, env);
  if (reale > ed.inizio && ctx?.waitUntil) {
    const fatti = await giorniEstratti(env, ed.year);
    if (editionDays(ed).some((d) => d.data < reale && !fatti.has(d.n))) ctx.waitUntil(estraiArretrati(env, ed, reale).catch((e) => console.error(e)));
  }
  let miei = new Set();
  if (user) {
    const { results } = await env.DB.prepare("SELECT giorno FROM partecipazioni WHERE edition=? AND user_id=?").bind(ed.year, user.id).all();
    miei = new Set(results.map((x) => x.giorno));
  }
  const isAdmin = user?.role === "admin";
  const days = editionDays(ed);
  const prima = oggi < ed.inizio;
  const dopo = oggi > ed.fine;
  const { results } = await env.DB.prepare(
    "SELECT n,tipo,etichetta,titolo,fuoco,img_ver,stato_capitolo FROM days WHERE edition=?"
  ).bind(ed.year).all();

  // Prima dell'apertura i giocatori vedono solo la pagina d'attesa
  const chiuso = prima && !isAdmin;
  const giorni = chiuso ? [] : days.map((d) => {
    const row = results.find((x) => x.n === d.n) || {};
    const st = dayState(d.data, oggi);
    const visibile = st !== "sigillata" || isAdmin;
    const out = { n: d.n, data: d.data, wd: weekday(d.data), stato: st, tipo: row.tipo || "sorteggio", etichetta: row.etichetta || "", partecipato: miei.has(d.n) };
    if (visibile) {
      out.titolo = row.titolo || "";
      out.fuoco = row.fuoco || "centro";
      if (row.img_ver) out.francobollo = `/api/img/${d.n}/thumb?v=${row.img_ver}`;
      if (isAdmin) out.stato_capitolo = row.stato_capitolo;
    }
    return out;
  });

  return json({
    utente: user ? { ...publicUser(user), aiutante: await isAiutante(env, user, ed.year) } : null,
    edizione: publicEdition(ed),
    oggi, prima, dopo, chiuso,
    simulata: isAdmin && oggi !== romeNow().date,
    giorni,
    lettere: await contaLettere(env, ed.year),
    ha_albo: !!(await env.DB.prepare("SELECT 1 FROM estrazioni LIMIT 1").first()),
  });
}

async function giorno(env, url, user, ed, n) {
  const days = editionDays(ed);
  const d = days[n - 1];
  if (!d) return err(404, "Casella inesistente");
  const isAdmin = user?.role === "admin";
  const oggi = today(url, user, env);
  const st = dayState(d.data, oggi);
  if ((st === "sigillata" || oggi < ed.inizio) && !isAdmin) return err(403, "Questa busta è ancora sigillata");
  const row = await env.DB.prepare(
    "SELECT n,tipo,etichetta,titolo,testo,fuoco,domanda,risposte,giusta,img_ver FROM days WHERE edition=? AND n=?"
  ).bind(ed.year, n).first() || { n };
  const out = {
    n, data: d.data, wd: weekday(d.data), stato: st,
    tipo: row.tipo || "sorteggio", etichetta: row.etichetta || "", titolo: row.titolo || "", testo: row.testo || "",
    fuoco: row.fuoco || "centro",
    immagine: row.img_ver ? `/api/img/${n}/full?v=${row.img_ver}` : null,
  };
  out.in_palio = inPalio((await assegnazioniPerGiorno(env, ed.year)).get(n));
  out.estratta = (await giorniEstratti(env, ed.year)).has(n);
  if (out.estratta) out.premi = await premiEstratti(env, ed.year, n);
  if (user) {
    const mia = await env.DB.prepare("SELECT risposta FROM partecipazioni WHERE edition=? AND giorno=? AND user_id=?").bind(ed.year, n, user.id).first();
    out.mia = mia ? { partecipato: true, risposta: mia.risposta } : { partecipato: false };
  }
  if (out.tipo === "sfida") {
    out.domanda = row.domanda || "";
    out.risposte = JSON.parse(row.risposte || "[]");
    // La risposta giusta si rivela solo a casella chiusa (o allo staff)
    if (st === "passata" || isAdmin) out.giusta = row.giusta;
  }
  return json(out);
}

async function immagine(env, url, user, ed, n, kind) {
  const d = editionDays(ed)[n - 1];
  if (!d) return new Response("Not found", { status: 404 });
  const isAdmin = user?.role === "admin";
  const aperta = romeNow().date >= d.data;
  if (!aperta && !isAdmin) return new Response("Forbidden", { status: 403 });
  const img = await env.DB.prepare("SELECT mime,data FROM images WHERE edition=? AND n=? AND kind=?").bind(ed.year, n, kind).first();
  if (!img) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(img.data), {
    headers: {
      "Content-Type": img.mime,
      // Le immagini delle buste già aperte si possono tenere in cache; quelle future (anteprima staff) no
      "Cache-Control": aperta ? "public, max-age=604800, immutable" : "private, no-store",
    },
  });
}
