// Annunci automatici in un canale Discord tramite webhook (nome e immagine sono quelli del webhook su Discord).
// L'URL del webhook è un segreto (DISCORD_WEBHOOK_URL) impostato nel pannello Cloudflare.
// Ogni annuncio ha una chiave (es. "apertura-5") salvata nella tabella annunci: così parte una volta sola.
import { editionDays, romeNow, addDays, weekday } from "./time.js";
import { premiEstratti, contaLettere } from "./gioco.js";
import { assegnazioniPerGiorno, inPalio, donatoriPalio } from "./donazioni.js";
import { statoBonus } from "./bonus.js";

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
const err = (status, messaggio) => json({ errore: messaggio }, status);

const COLORE = 0xe8962a; // arancio biscotto del sito
const GIORNI = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];
const MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
function dataLunga(iso) {
  const g = Number(iso.slice(8, 10));
  return `${GIORNI[weekday(iso)]} ${g === 1 ? "1°" : g} ${MESI[Number(iso.slice(5, 7)) - 1]}`;
}

export async function annunciAttivi(env) {
  const r = await env.DB.prepare("SELECT value FROM settings WHERE key='annunci_attivi'").first();
  return r?.value === "1";
}

// Invia un messaggio al webhook. Restituisce true se Discord lo ha accettato.
async function invia(env, corpo) {
  if (!env.DISCORD_WEBHOOK_URL) return false;
  const res = await fetch(env.DISCORD_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ allowed_mentions: { parse: [] }, ...corpo }),
  });
  if (!res.ok) console.error("Webhook Discord", res.status, await res.text().catch(() => ""));
  return res.ok;
}

// Prenota la chiave: solo chi riesce a inserirla invia l'annuncio (niente doppioni anche con richieste in parallelo).
async function prenota(env, year, chiave) {
  const r = await env.DB.prepare("INSERT OR IGNORE INTO annunci(edition,chiave,inviato_at) VALUES(?,?,?)").bind(year, chiave, Date.now()).run();
  return !!r.meta?.changes;
}
async function libera(env, year, chiave) {
  await env.DB.prepare("DELETE FROM annunci WHERE edition=? AND chiave=?").bind(year, chiave).run();
}
async function annuncia(env, year, chiave, corpo) {
  if (!(await prenota(env, year, chiave))) return false;
  let ok = false;
  try { ok = await invia(env, corpo); } catch (e) { console.error(e); }
  if (!ok) await libera(env, year, chiave); // riproverà al giro successivo
  return ok;
}

/* ---------- testi degli annunci (modificabili dallo staff) ---------- */

// Ogni annuncio ha un titolo e un testo con dei segnaposto tra graffe, es. {data}.
// Se in una riga c'è un segnaposto che quel giorno è vuoto (es. nessun donatore), la riga intera non viene inviata.
export const ANNUNCI = [
  { k: "apertura", nome: "Busta del giorno aperta", quando: "Ogni giorno a mezzanotte, quando si apre la busta di un giorno normale. Sotto il testo c'è l'immagine del capitolo.",
    segnaposto: ["data", "capitolo", "in_palio", "offerti_da", "link"],
    titolo: "La busta di {data} è aperta",
    testo: "**{capitolo}**\nIn palio: {in_palio}\nPremi offerti da {offerti_da}. Grazie!\nBasta un clic per partecipare.\nLa busta resta aperta fino alle 23:59. [Apri la busta]({link})" },
  { k: "apertura_sfida", nome: "Busta di un giorno di sfida", quando: "A mezzanotte, quando si apre la busta di un giorno di sfida. Sotto il testo c'è l'immagine del capitolo.",
    segnaposto: ["data", "capitolo", "in_palio", "offerti_da", "biglietti", "link"],
    titolo: "La busta di {data} è aperta",
    testo: "**{capitolo}**\nIn palio: {in_palio}\nPremi offerti da {offerti_da}. Grazie!\nOggi è un giorno di sfida: rispondi correttamente per avere {biglietti} biglietti.\nLa busta resta aperta fino alle 23:59. [Apri la busta]({link})" },
  { k: "vincitori", nome: "Vincitori del giorno", quando: "A mezzanotte, dopo l'estrazione del giorno appena chiuso. I vincitori vengono anche menzionati sopra il messaggio, così ricevono la notifica.",
    segnaposto: ["data", "vincitori", "consegna_da", "consegna_a", "link_albo"],
    titolo: "Estrazione di {data}",
    testo: "{vincitori}\n\nComplimenti! I premi si consegnano in gioco dal {consegna_da} al {consegna_a}. Tutti gli altri partecipanti ricevono i Biscotti di Tullio. [Vedi l'albo]({link_albo})" },
  { k: "traguardo", nome: "Traguardo di lettere", quando: "Appena la community raggiunge un traguardo di lettere (tranne l'ultimo).",
    segnaposto: ["lettere", "biscotti", "link"],
    titolo: "La community ha ritrovato {lettere} lettere!",
    testo: "+{biscotti} Biscotti di Tullio a tutti i partecipanti. Grazie a tutti!" },
  { k: "traguardo_finale", nome: "Ultimo traguardo", quando: "Appena la community raggiunge l'ultimo traguardo di lettere, quello che sblocca il capitolo bonus.",
    segnaposto: ["lettere", "biscotti", "apre_il", "link"],
    titolo: "La community ha ritrovato {lettere} lettere!",
    testo: "+{biscotti} Biscotti di Tullio a tutti i partecipanti e un capitolo bonus. Grazie a tutti!\nIl capitolo bonus si apre {apre_il}." },
  { k: "bonus", nome: "Capitolo bonus aperto", quando: "Il giorno in cui si apre il capitolo bonus (oppure quando lo staff preme \"Apri subito per tutti\"). Sotto il testo c'è l'immagine del bonus.",
    segnaposto: ["capitolo", "link"],
    titolo: "Il capitolo bonus è aperto!",
    testo: "**{capitolo}**\nTullio ha una storia in più per tutti. [Leggila qui]({link})" },
  { k: "albero", nome: "La posta di Tullio", quando: "Il giorno di Natale (ultima busta), quando l'albero con i messaggi per Tullio si apre a tutti.",
    segnaposto: ["lettere_albero", "link"],
    titolo: "La posta di Tullio è arrivata",
    testo: "Tullio ha appeso all'albero {lettere_albero} che gli avete affidato. Tocca una busta per leggerla. [Vai all'albero]({link})" },
  { k: "albero_vuoto", nome: "La posta di Tullio, senza messaggi", quando: "Il giorno di Natale, al posto del precedente, se nessuno ha lasciato un messaggio approvato.",
    segnaposto: ["link"],
    titolo: "Buon Natale da Tullio",
    testo: "Buon Natale da Tullio e da tutto lo staff di Our Elysion!" },
];
export const SEGNAPOSTO = {
  data: "il giorno, es. \"martedì 1° dicembre\"",
  capitolo: "il titolo del capitolo",
  in_palio: "le categorie e quanti vincono, es. \"Mount ×2 · GIL\"",
  offerti_da: "i donatori del giorno (gli anonimi restano anonimi)",
  biglietti: "i biglietti per chi risponde giusto",
  vincitori: "una riga per premio: premio, categoria e nomi dei vincitori",
  consegna_da: "inizio delle consegne in gioco",
  consegna_a: "fine delle consegne in gioco",
  lettere: "il traguardo raggiunto",
  biscotti: "i Biscotti del traguardo",
  apre_il: "quando si apre il capitolo bonus, es. \"sabato 26 dicembre\" o \"domani\"",
  lettere_albero: "\"la lettera\" oppure \"le N lettere\"",
  link: "l'indirizzo della pagina sul sito",
  link_albo: "l'indirizzo dell'albo dei vincitori",
};

export function testiAnnunci(ed) {
  let su = {};
  try { su = JSON.parse(ed?.annunci_testi || "{}") || {}; } catch { su = {}; }
  const out = {};
  for (const a of ANNUNCI) out[a.k] = { titolo: su[a.k]?.titolo || a.titolo, testo: su[a.k]?.testo || a.testo, modificato: !!(su[a.k]?.titolo || su[a.k]?.testo) };
  return out;
}

// Riempie un testo: le righe con un segnaposto vuoto spariscono, quelli sconosciuti restano come sono.
export function compila(tpl, v) {
  const righe = [];
  for (const riga of String(tpl || "").split("\n")) {
    let vuota = false;
    const r = riga.replace(/\{([a-z_]+)\}/g, (m, k) => {
      if (!(k in v)) return m;
      const x = v[k] == null ? "" : String(v[k]);
      if (!x) vuota = true;
      return x;
    });
    if (!vuota) righe.push(r);
  }
  return righe.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function embed(testi, k, v, extra = {}) {
  const t = testi[k];
  return { title: compila(t.titolo, v).slice(0, 256) || " ", description: compila(t.testo, v).slice(0, 4000), color: COLORE, ...extra };
}
const senzaGiorno = (iso) => dataLunga(iso).replace(/^\S+ /, "");

function msgApertura(env, ed, d, row, palio, offerto) {
  const url = `${env.BASE_URL}/#casella-${d.n}`;
  const sfida = row?.tipo === "sfida";
  const v = {
    data: dataLunga(d.data), capitolo: row?.titolo || "", link: url, biglietti: ed.biglietti_sfida || 3,
    in_palio: palio.map((c) => (c.vincitori > 1 ? `${c.categoria} ×${c.vincitori}` : c.categoria)).join(" · "),
    offerti_da: offerto || "",
  };
  const e = embed(testiAnnunci(ed), sfida ? "apertura_sfida" : "apertura", v, { url });
  if (row?.img_ver) e.image = { url: `${env.BASE_URL}/api/img/${d.n}/full?v=${row.img_ver}` };
  return { embeds: [e] };
}

function msgVincitori(env, ed, d, premi) {
  const url = `${env.BASE_URL}/#casella-${d.n}`;
  const ids = new Set();
  const righe = premi.map((p) => {
    const chi = p.vincitori.map((x) => { ids.add(x.id); return `<@${x.id}>`; });
    return `**${p.etichetta}** (${p.categoria}): ${chi.length ? chi.join(", ") : "nessun vincitore"}`;
  });
  if (!righe.length) return null;
  const v = { data: dataLunga(d.data), vincitori: righe.join("\n"), consegna_da: senzaGiorno(ed.consegna_da), consegna_a: senzaGiorno(ed.consegna_a), link_albo: `${env.BASE_URL}/#albo`, link: url };
  return {
    content: [...ids].map((id) => `<@${id}>`).join(" "),
    allowed_mentions: { users: [...ids] },
    embeds: [embed(testiAnnunci(ed), "vincitori", v, { url })],
  };
}

function quandoBonus(ed, oggi) {
  const sb = statoBonus(ed, oggi);
  if (!sb?.apre_il) return "";
  if (sb.apre_il === addDays(oggi, 1)) return "domani";
  if (sb.apre_il <= oggi) return "oggi";
  return dataLunga(sb.apre_il);
}

function msgTraguardo(env, ed, t, ultimo, oggi) {
  const v = { lettere: t.s, biscotti: t.b, link: env.BASE_URL, apre_il: ultimo ? quandoBonus(ed, oggi) : "" };
  return { embeds: [embed(testiAnnunci(ed), ultimo ? "traguardo_finale" : "traguardo", v, { url: env.BASE_URL })] };
}

function msgBonus(env, ed, row) {
  const url = `${env.BASE_URL}/#bonus`;
  const v = { capitolo: row?.titolo && row.titolo !== "Capitolo bonus" ? row.titolo : "", link: url };
  const e = embed(testiAnnunci(ed), "bonus", v, { url });
  if (row?.img_ver) e.image = { url: `${env.BASE_URL}/api/img/0/full?v=${row.img_ver}` };
  return { embeds: [e] };
}

function msgAlbero(env, ed, n) {
  const url = `${env.BASE_URL}/#posta`;
  const v = { lettere_albero: n === 1 ? "la lettera" : `le ${n} lettere`, link: url };
  return { embeds: [embed(testiAnnunci(ed), n ? "albero" : "albero_vuoto", v, { url })] };
}

// Valori finti per l'anteprima nell'area staff
function esempio(env, ed) {
  const d0 = ed.inizio || "2026-12-01";
  return {
    data: dataLunga(d0), capitolo: "Titolo del capitolo", in_palio: "Mount ×2 · GIL", offerti_da: "Altea Skysinger, Iname Naname e un aiutante anonimo",
    biglietti: ed.biglietti_sfida || 3,
    vincitori: "**Nome del premio** (Mount): Nome Cognome, Nome Cognome\n**500.000 GIL** (GIL): Nome Cognome",
    consegna_da: senzaGiorno(ed.consegna_da || "2027-01-02"), consegna_a: senzaGiorno(ed.consegna_a || "2027-01-15"),
    lettere: 100, biscotti: 50, apre_il: dataLunga(addDays(ed.fine || "2026-12-25", 1)), lettere_albero: "le 12 lettere",
    link: env.BASE_URL, link_albo: `${env.BASE_URL}/#albo`,
  };
}

/* ---------- giro degli annunci ---------- */

// Controlla cosa c'è da annunciare adesso e lo invia. Si chiama dopo l'estrazione di mezzanotte
// (dal cron o dalla rete di sicurezza) e quando arriva una partecipazione che fa scattare un traguardo.
export async function giroAnnunci(env, ed, oggi = romeNow().date) {
  if (!env.DISCORD_WEBHOOK_URL || !(await annunciAttivi(env))) return [];
  const fatti = [];
  const giorni = editionDays(ed);

  // 1. vincitori del giorno appena chiuso (solo quello: niente arretrati vecchi)
  const ieri = giorni.find((d) => d.data === addDays(oggi, -1));
  if (ieri) {
    const estratto = await env.DB.prepare("SELECT 1 FROM estrazioni WHERE edition=? AND giorno=?").bind(ed.year, ieri.n).first();
    if (estratto) {
      const m = msgVincitori(env, ed, ieri, await premiEstratti(env, ed.year, ieri.n));
      if (m && (await annuncia(env, ed.year, `vincitori-${ieri.n}`, m))) fatti.push(`vincitori-${ieri.n}`);
    }
  }

  // 2. traguardi della community
  const tappe = JSON.parse(ed.tappe || "[]");
  if (tappe.length) {
    const lettere = await contaLettere(env, ed.year);
    for (const [i, t] of tappe.entries()) {
      if (lettere >= t.s && (await annuncia(env, ed.year, `tappa-${t.s}`, msgTraguardo(env, ed, t, i === tappe.length - 1, oggi)))) fatti.push(`tappa-${t.s}`);
    }
  }

  // 3. la busta di oggi
  const oggiG = giorni.find((d) => d.data === oggi);
  if (oggiG) {
    const row = await env.DB.prepare("SELECT titolo, tipo, img_ver FROM days WHERE edition=? AND n=?").bind(ed.year, oggiG.n).first();
    const assOggi = (await assegnazioniPerGiorno(env, ed.year)).get(oggiG.n);
    const palio = inPalio(assOggi);
    if (await annuncia(env, ed.year, `apertura-${oggiG.n}`, msgApertura(env, ed, oggiG, row, palio, donatoriPalio(assOggi)))) fatti.push(`apertura-${oggiG.n}`);
  }

  // 4. il capitolo bonus, quando si apre
  const sb = statoBonus(ed, oggi);
  if (sb?.aperto) {
    const row = await env.DB.prepare("SELECT titolo, img_ver FROM days WHERE edition=? AND n=0").bind(ed.year).first();
    if (await annuncia(env, ed.year, "bonus", msgBonus(env, ed, row))) fatti.push("bonus");
  }

  // 5. il giorno di Natale, l'albero con le lettere
  if (oggi === ed.fine) {
    const r = await env.DB.prepare("SELECT COUNT(*) AS c FROM messaggi m JOIN users u ON u.id = m.user_id WHERE m.edition=? AND m.stato='ok' AND u.tester=0").bind(ed.year).first();
    if (await annuncia(env, ed.year, "albero", msgAlbero(env, ed, r?.c || 0))) fatti.push("albero");
  }
  return fatti;
}

// Quando lo staff accende gli annunci, segna come "già fatto" tutto il passato,
// così Discord non riceve una raffica di messaggi vecchi.
async function segnaPassato(env, ed, oggi) {
  const stmts = [];
  const add = (k) => stmts.push(env.DB.prepare("INSERT OR IGNORE INTO annunci(edition,chiave,inviato_at) VALUES(?,?,0)").bind(ed.year, k));
  for (const d of editionDays(ed)) {
    if (d.data < oggi) { add(`apertura-${d.n}`); if (d.data < addDays(oggi, -1)) add(`vincitori-${d.n}`); }
  }
  const lettere = await contaLettere(env, ed.year);
  for (const t of JSON.parse(ed.tappe || "[]")) if (lettere >= t.s) add(`tappa-${t.s}`);
  if (oggi > ed.fine) add("albero");
  if (statoBonus(ed, oggi)?.aperto) add("bonus");
  if (stmts.length) await env.DB.batch(stmts);
}

/* ---------- area staff ---------- */

export async function handleAnnunci(req, env, url, user, ed, oggi) {
  const p = url.pathname, m = req.method;
  if (!p.startsWith("/api/admin/annunci")) return null;
  if (user?.role !== "admin") return err(403, "Area riservata allo staff");

  if (p === "/api/admin/annunci" && m === "GET") {
    const { results } = await env.DB.prepare("SELECT chiave, inviato_at FROM annunci WHERE edition=? AND inviato_at>0 ORDER BY inviato_at DESC LIMIT 30").bind(ed.year).all();
    return json({ configurato: !!env.DISCORD_WEBHOOK_URL, attivi: await annunciAttivi(env), inviati: results,
      testi: testiAnnunci(ed), tipi: ANNUNCI, segnaposto: SEGNAPOSTO, esempio: esempio(env, ed) });
  }
  if (p === "/api/admin/annunci" && m === "PUT") {
    const b = await req.json().catch(() => null);
    const attivi = !!b?.attivi;
    if (attivi && !env.DISCORD_WEBHOOK_URL) return err(400, "Prima aggiungi il segreto DISCORD_WEBHOOK_URL su Cloudflare");
    if (attivi) await segnaPassato(env, ed, oggi);
    await env.DB.prepare("INSERT INTO settings(key,value) VALUES('annunci_attivi',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(attivi ? "1" : "0").run();
    return json({ ok: true, attivi });
  }
  // Testi personalizzati: { k, titolo, testo } salva uno; { k, predefinito: true } lo riporta al testo originale
  if (p === "/api/admin/annunci/testi" && m === "PUT") {
    const b = await req.json().catch(() => null);
    const tipo = ANNUNCI.find((a) => a.k === b?.k);
    if (!tipo) return err(400, "Annuncio sconosciuto");
    let su = {};
    try { su = JSON.parse(ed.annunci_testi || "{}") || {}; } catch { su = {}; }
    if (b.predefinito) delete su[tipo.k];
    else {
      const titolo = String(b.titolo ?? "").trim().slice(0, 240);
      const testo = String(b.testo ?? "").replace(/\r\n?/g, "\n").trim().slice(0, 3500);
      if (!titolo || !testo) return err(400, "Servono sia il titolo sia il testo");
      su[tipo.k] = { titolo: titolo === tipo.titolo ? "" : titolo, testo: testo === tipo.testo ? "" : testo };
      if (!su[tipo.k].titolo && !su[tipo.k].testo) delete su[tipo.k];
    }
    // durante la prova generale i testi valgono sia per la prova sia per il calendario vero
    await env.DB.prepare(
      `UPDATE editions SET annunci_testi=?1 WHERE year=?2 OR (prova=1 AND year=(SELECT CAST(value AS INTEGER) FROM settings WHERE key='edizione_corrente'))
         OR (?3=1 AND year=(SELECT CAST(value AS INTEGER) FROM settings WHERE key='edizione_base'))`
    ).bind(JSON.stringify(su), ed.year, ed.prova ? 1 : 0).run();
    ed.annunci_testi = JSON.stringify(su);
    return json({ ok: true, testi: testiAnnunci(ed) });
  }
  // Anteprima su Discord di un annuncio, con valori di esempio (parte anche con gli annunci spenti)
  if (p === "/api/admin/annunci/anteprima" && m === "POST") {
    if (!env.DISCORD_WEBHOOK_URL) return err(400, "Il segreto DISCORD_WEBHOOK_URL non è ancora impostato su Cloudflare");
    const b = await req.json().catch(() => null);
    const tipo = ANNUNCI.find((a) => a.k === b?.k);
    if (!tipo) return err(400, "Annuncio sconosciuto");
    const testi = testiAnnunci(ed);
    if (b.titolo || b.testo) testi[tipo.k] = { titolo: String(b.titolo || tipo.titolo).slice(0, 240), testo: String(b.testo || tipo.testo).slice(0, 3500) };
    const e = embed(testi, tipo.k, esempio(env, ed), { url: env.BASE_URL });
    e.title = `[Anteprima] ${e.title}`.slice(0, 256);
    e.footer = { text: "Anteprima con dati di esempio, inviata dall'area staff" };
    const ok = await invia(env, { embeds: [e] }).catch(() => false);
    return ok ? json({ ok: true }) : err(502, "Discord non ha accettato il messaggio: controlla che il webhook esista ancora");
  }
  if (p === "/api/admin/annunci/prova" && m === "POST") {
    if (!env.DISCORD_WEBHOOK_URL) return err(400, "Il segreto DISCORD_WEBHOOK_URL non è ancora impostato su Cloudflare");
    const chi = user.global_name || user.username;
    const ok = await invia(env, { embeds: [{
      title: "Messaggio di prova",
      description: `Se leggi questo messaggio, gli annunci del calendario dell'Avvento funzionano. Prova inviata da ${chi}.`,
      url: env.BASE_URL, color: COLORE,
    }] }).catch(() => false);
    return ok ? json({ ok: true }) : err(502, "Discord non ha accettato il messaggio: controlla che il webhook esista ancora e che l'URL sia giusto");
  }
  return err(404, "Non trovato");
}
