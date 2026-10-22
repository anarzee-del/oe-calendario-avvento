// Annunci automatici in un canale Discord tramite webhook (nome e immagine sono quelli del webhook su Discord).
// L'URL del webhook è un segreto (DISCORD_WEBHOOK_URL) impostato nel pannello Cloudflare.
// Ogni annuncio ha una chiave (es. "apertura-5") salvata nella tabella annunci: così parte una volta sola.
import { editionDays, romeNow, addDays, weekday } from "./time.js";
import { premiEstratti, contaLettere } from "./gioco.js";
import { assegnazioniPerGiorno, inPalio } from "./donazioni.js";
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

/* ---------- i singoli annunci ---------- */

function msgApertura(env, ed, d, row, palio) {
  const url = `${env.BASE_URL}/#casella-${d.n}`;
  const righe = [];
  if (row?.titolo) righe.push(`**${row.titolo}**`);
  if (palio.length) righe.push(`In palio: ${palio.map((c) => (c.vincitori > 1 ? `${c.categoria} ×${c.vincitori}` : c.categoria)).join(" · ")}`);
  righe.push(row?.tipo === "sfida"
    ? `Oggi è un giorno di sfida: rispondi correttamente per avere ${ed.biglietti_sfida || 3} biglietti.`
    : "Basta un clic per partecipare.");
  righe.push(`La busta resta aperta fino alle 23:59. [Apri la busta](${url})`);
  const e = { title: `La busta di ${dataLunga(d.data)} è aperta`, url, description: righe.join("\n"), color: COLORE };
  if (row?.img_ver) e.image = { url: `${env.BASE_URL}/api/img/${d.n}/full?v=${row.img_ver}` };
  return { embeds: [e] };
}

function msgVincitori(env, ed, d, premi) {
  const url = `${env.BASE_URL}/#casella-${d.n}`;
  const ids = new Set();
  const righe = premi.map((p) => {
    const chi = p.vincitori.map((v) => { ids.add(v.id); return `<@${v.id}>`; });
    return `**${p.etichetta}** (${p.categoria}): ${chi.length ? chi.join(", ") : "nessun vincitore"}`;
  });
  if (!righe.length) return null;
  righe.push("", `Complimenti! I premi si consegnano in gioco dal ${dataLunga(ed.consegna_da).replace(/^\S+ /, "")} al ${dataLunga(ed.consegna_a).replace(/^\S+ /, "")}. Tutti gli altri partecipanti ricevono i Biscotti di Tullio. [Vedi l'albo](${env.BASE_URL}/#albo)`);
  return {
    content: [...ids].map((id) => `<@${id}>`).join(" "),
    allowed_mentions: { users: [...ids] },
    embeds: [{ title: `Estrazione di ${dataLunga(d.data)}`, url, description: righe.join("\n"), color: COLORE }],
  };
}

function msgTraguardo(env, t, ultimo) {
  return { embeds: [{
    title: `La community ha ritrovato ${t.s} lettere!`,
    description: `+${t.b} Biscotti di Tullio a tutti i partecipanti${ultimo ? " e un capitolo bonus" : ""}. Grazie a tutti!`,
    url: env.BASE_URL, color: COLORE,
  }] };
}

function msgAlbero(env, n) {
  return { embeds: [{
    title: "La posta di Tullio è arrivata",
    description: n
      ? `Tullio ha appeso all'albero ${n === 1 ? "la lettera" : `le ${n} lettere`} che gli avete affidato. Tocca una busta per leggerla. [Vai all'albero](${env.BASE_URL}/#posta)`
      : "Buon Natale da Tullio e da tutto lo staff di Our Elysion!",
    url: `${env.BASE_URL}/#posta`, color: COLORE,
  }] };
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
      if (lettere >= t.s && (await annuncia(env, ed.year, `tappa-${t.s}`, msgTraguardo(env, t, i === tappe.length - 1)))) fatti.push(`tappa-${t.s}`);
    }
  }

  // 3. la busta di oggi
  const oggiG = giorni.find((d) => d.data === oggi);
  if (oggiG) {
    const row = await env.DB.prepare("SELECT titolo, tipo, img_ver FROM days WHERE edition=? AND n=?").bind(ed.year, oggiG.n).first();
    const palio = inPalio((await assegnazioniPerGiorno(env, ed.year)).get(oggiG.n));
    if (await annuncia(env, ed.year, `apertura-${oggiG.n}`, msgApertura(env, ed, oggiG, row, palio))) fatti.push(`apertura-${oggiG.n}`);
  }

  // 4. il capitolo bonus, quando si apre
  const sb = statoBonus(ed, oggi);
  if (sb?.aperto) {
    const row = await env.DB.prepare("SELECT titolo, img_ver FROM days WHERE edition=? AND n=0").bind(ed.year).first();
    const e = {
      title: "Il capitolo bonus è aperto!",
      description: `${sb.raggiunto ? `La community ha ritrovato ${sb.traguardo} lettere e ` : ""}Tullio ha una storia in più per tutti${row?.titolo && row.titolo !== "Capitolo bonus" ? `: **${row.titolo}**` : ""}. [Leggila qui](${env.BASE_URL}/#bonus)`,
      url: `${env.BASE_URL}/#bonus`, color: COLORE,
    };
    if (row?.img_ver) e.image = { url: `${env.BASE_URL}/api/img/0/full?v=${row.img_ver}` };
    if (await annuncia(env, ed.year, "bonus", { embeds: [e] })) fatti.push("bonus");
  }

  // 5. il giorno di Natale, l'albero con le lettere
  if (oggi === ed.fine) {
    const r = await env.DB.prepare("SELECT COUNT(*) AS c FROM messaggi WHERE edition=? AND stato='ok'").bind(ed.year).first();
    if (await annuncia(env, ed.year, "albero", msgAlbero(env, r?.c || 0))) fatti.push("albero");
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
    return json({ configurato: !!env.DISCORD_WEBHOOK_URL, attivi: await annunciAttivi(env), inviati: results });
  }
  if (p === "/api/admin/annunci" && m === "PUT") {
    const b = await req.json().catch(() => null);
    const attivi = !!b?.attivi;
    if (attivi && !env.DISCORD_WEBHOOK_URL) return err(400, "Prima aggiungi il segreto DISCORD_WEBHOOK_URL su Cloudflare");
    if (attivi) await segnaPassato(env, ed, oggi);
    await env.DB.prepare("INSERT INTO settings(key,value) VALUES('annunci_attivi',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(attivi ? "1" : "0").run();
    return json({ ok: true, attivi });
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
