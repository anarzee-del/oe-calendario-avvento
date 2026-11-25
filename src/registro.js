// Registro attività: chi ha fatto cosa sul sito. Si scrivono solo le azioni che cambiano qualcosa
// (accessi, partecipazioni, profilo, offerte, modifiche dello staff), mai le semplici visite.
// La scrittura avviene dopo la risposta (ctx.waitUntil), quindi non rallenta il sito.
// Le righe più vecchie di 90 giorni si cancellano da sole a mezzanotte.

import { romeNow } from "./time.js";

export const GIORNI_REGISTRO = 90;

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

const giorno = (n) => (Number(n) === 0 ? "capitolo bonus" : `giorno ${Number(n)}`);
const sino = (v) => (v ? "sì" : "no");
const STATI_DONO = { offerta: "in attesa", accettata: "accettata", ricevuta: "ricevuta", rifiutata: "non accolta" };
const STATI_MSG = { ok: "approvato", no: "nascosto", attesa: "rimesso in attesa" };
const CONSEGNA = ["da consegnare", "consegnato", "non ritirato"];
const nomeDono = (b) => (b?.categoria === "GIL" || b?.tipo === "gil" ? `${Number(b?.gil || 0).toLocaleString("it-IT")} GIL` : `${b?.descrizione || "oggetto"}${b?.quantita > 1 ? ` ×${b.quantita}` : ""}${b?.categoria ? ` (${b.categoria})` : ""}`);

// [metodo, percorso, descrizione]. "u" nella descrizione = nome della persona indicata dall'ID nel percorso.
const REGOLE = [
  ["POST", /^\/api\/partecipa\/(\d+)$/, (r, b) => `Ha partecipato alla busta del ${giorno(r[1])}${b && "risposta" in b ? ` (sfida: risposta n. ${Number(b.risposta) + 1})` : ""}`],
  ["PUT", /^\/api\/profilo$/, (r, b) => `Ha salvato il profilo: ${b?.pg || "?"} · ${b?.mondo || "?"} (${b?.dc || "?"})${typeof b?.free_trial === "boolean" ? ` · free trial: ${sino(b.free_trial)}` : ""}`],
  ["PUT", /^\/api\/profilo\/free-trial$/, (r, b) => `Ha risposto alla domanda sulla free trial: ${sino(b?.free_trial)}`],
  ["PUT", /^\/api\/messaggi$/, () => "Ha scritto o modificato il suo messaggio per Tullio"],
  ["DELETE", /^\/api\/messaggi$/, () => "Ha cancellato il suo messaggio per Tullio"],
  ["POST", /^\/api\/donazioni$/, (r, b) => `Ha offerto un premio: ${nomeDono(b)}${b?.anonimo ? " (anonimo)" : ""}`],
  ["PUT", /^\/api\/donazioni\/(\d+)$/, (r) => `Ha modificato la sua offerta n. ${r[1]}`],
  ["DELETE", /^\/api\/donazioni\/(\d+)$/, (r) => `Ha ritirato la sua offerta n. ${r[1]}`],
  // staff
  ["PUT", /^\/api\/admin\/giorno\/(\d+)$/, (r, b) => `Ha salvato il ${giorno(r[1])}${b?.titolo ? ` «${String(b.titolo).slice(0, 60)}»` : ""}${b?.stato_capitolo ? ` (stato: ${b.stato_capitolo.replace("_", " ")})` : ""}`],
  ["PUT", /^\/api\/admin\/giorno\/(\d+)\/immagine$/, (r) => `Ha caricato l'immagine del ${giorno(r[1])}`],
  ["DELETE", /^\/api\/admin\/giorno\/(\d+)\/immagine$/, (r) => `Ha tolto l'immagine del ${giorno(r[1])}`],
  ["PUT", /^\/api\/admin\/giorno\/0\/video$/, () => "Ha caricato il video del capitolo bonus"],
  ["DELETE", /^\/api\/admin\/giorno\/0\/video$/, () => "Ha tolto il video del capitolo bonus"],
  ["PUT", /^\/api\/admin\/bonus$/, (r, b) => `Ha cambiato le impostazioni del capitolo bonus${b?.forzato === true ? " (aperto subito per tutti)" : b?.forzato === false ? " (tolta l'apertura forzata)" : ""}`],
  ["PUT", /^\/api\/admin\/edizione$/, () => "Ha salvato Testi, date e regole"],
  ["PUT", /^\/api\/admin\/invito$/, () => "Ha cambiato il link d'invito al server Discord"],
  ["POST", /^\/api\/admin\/donazioni$/, (r, b) => `Ha aggiunto un dono dello staff: ${nomeDono(b)}`],
  ["PUT", /^\/api\/admin\/donazione\/(\d+)$/, (r, b) => `Ha modificato il dono n. ${r[1]}${b?.stato ? ` (stato: ${STATI_DONO[b.stato] || b.stato})` : ""}`],
  ["DELETE", /^\/api\/admin\/donazione\/(\d+)$/, (r) => `Ha eliminato il dono n. ${r[1]}`],
  ["POST", /^\/api\/admin\/donazione\/(\d+)\/assegna$/, (r, b) => `Ha assegnato il dono n. ${r[1]} al ${giorno(b?.giorno)} (${b?.vincitori || "?"} vincitori)`],
  ["PUT", /^\/api\/admin\/donazione\/(\d+)\/immagine$/, (r) => `Ha caricato l'immagine del dono n. ${r[1]}`],
  ["DELETE", /^\/api\/admin\/donazione\/(\d+)\/immagine$/, (r) => `Ha tolto l'immagine del dono n. ${r[1]}`],
  ["DELETE", /^\/api\/admin\/assegnazione\/(\d+)$/, () => "Ha tolto un premio da un giorno"],
  ["PUT", /^\/api\/admin\/estrazioni\/vincita\/(\d+)$/, (r, b) => `Ha aggiornato una consegna${[0, 1, 2].includes(b?.consegnato) ? `: ${CONSEGNA[b.consegnato]}` : ""}`],
  ["POST", /^\/api\/admin\/estrazioni\/vincita\/(\d+)\/riestrai$/, () => "Ha riestratto un premio (rinuncia del vincitore)"],
  ["PUT", /^\/api\/admin\/estrazioni\/biscotti\/(\d+)$/, (r, b) => `Ha segnato i Biscotti di u come ${b?.fatto ? "accreditati" : "da accreditare"}`],
  ["POST", /^\/api\/admin\/estrazione\/(\d+)$/, (r) => `Ha avviato l'estrazione del ${giorno(r[1])}`],
  ["POST", /^\/api\/admin\/estrazione\/(\d+)\/ripeti$/, (r) => `Ha ripetuto l'estrazione del ${giorno(r[1])}`],
  ["PUT", /^\/api\/admin\/extra\/messaggio\/(\d+)$/, (r, b) => `Ha ${STATI_MSG[b?.stato] || "moderato"} il messaggio per Tullio di u`],
  ["PUT", /^\/api\/admin\/extra\/partecipante\/(\d+)$/, (r, b) => {
    const c = [];
    if (b && "escluso" in b) c.push(b.escluso ? "ha escluso u" : "ha riammesso u");
    if (b && "tester" in b) c.push(b.tester ? "ha reso u account di prova" : "ha rimesso u giocatore normale");
    if (b && "free_trial" in b) c.push(b.free_trial ? "ha segnato u in free trial" : "ha tolto u dalla free trial");
    const t = c.join(", ") || "ha modificato u";
    return t[0].toUpperCase() + t.slice(1);
  }],
  ["POST", /^\/api\/admin\/extra\/edizioni$/, () => "Ha aperto una nuova edizione"],
  ["PUT", /^\/api\/admin\/annunci$/, (r, b) => `Ha ${b?.attivi ? "acceso" : "spento"} gli annunci su Discord`],
  ["PUT", /^\/api\/admin\/annunci\/testi$/, (r, b) => `Ha ${b?.predefinito ? "ripristinato" : "modificato"} il testo dell'annuncio «${b?.k || "?"}»`],
  ["POST", /^\/api\/admin\/annunci\/anteprima$/, (r, b) => `Ha inviato su Discord un'anteprima dell'annuncio «${b?.k || "?"}»`],
  ["POST", /^\/api\/admin\/annunci\/prova$/, () => "Ha inviato su Discord un messaggio di prova"],
  ["POST", /^\/api\/admin\/prova$/, () => "Ha avviato la prova generale"],
  ["POST", /^\/api\/admin\/prova\/termina$/, () => "Ha terminato la prova generale"],
];

const SALTA = /^\/api\/(auth\/|admin\/registro)/;
// per non leggere file grandi: immagini e video non si aprono
const leggibile = (req) => (req.headers.get("Content-Type") || "").includes("application/json") && Number(req.headers.get("Content-Length") || 0) < 20000;

export const nomeUtente = (u) => (u ? `${u.pg || u.global_name || u.username}${u.username ? ` (@${u.username})` : ""}` : "");
const ruoloDi = (u) => (!u ? "" : u.role === "admin" ? "staff" : u.tester ? "prova" : "giocatore");

export async function scrivi(env, { user = null, chi = "", ruolo = "", azione }) {
  await env.DB.prepare("INSERT INTO registro(ts,user_id,chi,ruolo,azione) VALUES(?,?,?,?,?)")
    .bind(Date.now(), user?.id || null, chi || nomeUtente(user) || "—", ruolo || ruoloDi(user), String(azione).slice(0, 400)).run();
}

// Prima della risposta: si copia il corpo della richiesta (solo JSON piccolo), perché il gestore lo consuma
export async function preparaRegistro(req, url) {
  if (req.method === "GET" || req.method === "HEAD" || SALTA.test(url.pathname) || !url.pathname.startsWith("/api/")) return null;
  let body = null;
  if (leggibile(req)) body = await req.clone().json().catch(() => null);
  return { metodo: req.method, path: url.pathname, body };
}

// Tentativi dei giocatori che il sito ha rifiutato: si registrano con il motivo (utile se qualcuno dice "ho partecipato ma non risulto")
const TENTATIVI = [
  [/^\/api\/partecipa\/(\d+)$/, (r) => `partecipare alla busta del ${giorno(r[1])}`],
  [/^\/api\/profilo/, () => "salvare il profilo"],
  [/^\/api\/messaggi$/, () => "scrivere il messaggio per Tullio"],
  [/^\/api\/donazioni/, () => "offrire un premio"],
];

// Dopo la risposta: se l'azione è riuscita si scrive la riga; se un giocatore è stato fermato, si scrive il motivo
export async function registra(env, prep, user, res) {
  if (!prep || !res) return;
  if (res.status >= 400) {
    const t = user && TENTATIVI.find(([re]) => re.test(prep.path));
    if (!t) return;
    const motivo = (await res.clone().json().catch(() => null))?.errore || `errore ${res.status}`;
    await scrivi(env, { user, azione: `Tentativo non riuscito di ${t[1](prep.path.match(t[0]))}: «${motivo}»` });
    return;
  }
  const regola = REGOLE.find(([m, re]) => m === prep.metodo && re.test(prep.path));
  let azione;
  if (regola) {
    const r = prep.path.match(regola[1]);
    azione = regola[2](r, prep.body);
    if (/\bu\b/.test(azione) && r[1]) {
      const x = await env.DB.prepare("SELECT pg, global_name, username FROM users WHERE id=?").bind(r[1]).first().catch(() => null);
      azione = azione.replace(/\bu\b/g, x ? (x.pg || x.global_name || x.username) : `utente ${r[1]}`);
    }
  } else {
    azione = `${prep.metodo} ${prep.path}`;
  }
  await scrivi(env, { user, azione });
}

// Apertura di una busta: una riga sola per persona, busta e giorno (non a ogni visita)
export async function registraApertura(env, user, n) {
  if (!user || user.role === "admin") return;
  const azione = `Ha aperto la busta del ${giorno(n)}`;
  const mezzanotte = Date.parse(`${romeNow().date}T00:00:00+01:00`); // inizio della giornata italiana
  await env.DB.prepare(
    `INSERT INTO registro(ts,user_id,chi,ruolo,azione) SELECT ?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM registro WHERE user_id=? AND azione=? AND ts>=?)`
  ).bind(Date.now(), user.id, nomeUtente(user), ruoloDi(user), azione, user.id, azione, mezzanotte).run();
}

export async function puliziaRegistro(env) {
  await env.DB.prepare("DELETE FROM registro WHERE ts < ?").bind(Date.now() - GIORNI_REGISTRO * 86400000).run();
}

// Area staff: GET /api/admin/registro?prima=<id>&chi=staff|giocatori&q=testo
export async function handleRegistro(req, env, url, user) {
  if (url.pathname !== "/api/admin/registro" || req.method !== "GET") return null;
  if (user?.role !== "admin") return json({ errore: "Area riservata allo staff" }, 403);
  const prima = Number(url.searchParams.get("prima")) || 0;
  const chi = url.searchParams.get("chi");
  const q = (url.searchParams.get("q") || "").trim().slice(0, 60);
  const where = [], args = [];
  if (prima) { where.push("id < ?"); args.push(prima); }
  if (chi === "staff") where.push("ruolo = 'staff'");
  if (chi === "giocatori") where.push("ruolo IN ('giocatore','prova')");
  if (chi === "sistema") where.push("ruolo = 'sistema'");
  if (q) { where.push("(chi LIKE ? OR azione LIKE ?)"); args.push(`%${q}%`, `%${q}%`); }
  const { results } = await env.DB.prepare(
    `SELECT id, ts, chi, ruolo, azione FROM registro ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY id DESC LIMIT 101`
  ).bind(...args).all();
  return json({ righe: results.slice(0, 100), altre: results.length > 100, giorni: GIORNI_REGISTRO });
}
