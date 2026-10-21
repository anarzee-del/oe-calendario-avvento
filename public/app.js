// Calendario dell'Avvento di Our Elysion — interfaccia
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const GG = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];
const GG_LUNGO = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];
const MONDI = {
  Light: ["Alpha", "Lich", "Odin", "Phoenix", "Raiden", "Shiva", "Twintania", "Zodiark"],
  Chaos: ["Cerberus", "Louisoix", "Moogle", "Omega", "Phantom", "Ragnarok", "Sagittarius", "Spriggan"],
};
const FP = { sinistra: "0%", centro: "50%", destra: "100%" };
const ICO = {
  fiocco: '<svg viewBox="0 0 24 24" fill="none" stroke="#2A1A05" stroke-width="2.2" stroke-linecap="round"><path d="M12 2v20M3.3 7l17.4 10M3.3 17l17.4-10"/></svg>',
  spunta: '<svg viewBox="0 0 24 24" width="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7"/></svg>',
  lucchetto: '<svg class="lucchetto" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  dono: '<svg viewBox="0 0 24 24" width="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="9" width="18" height="12" rx="1"/><path d="M3 13h18M12 9v12M12 9c-2-4-6-4-6-1.5S9 9 12 9c3 0 6-.5 6-1.5S14 5 12 9Z"/></svg>',
  discord: '<svg viewBox="0 0 24 24" width="18" fill="currentColor" aria-hidden="true"><path d="M19.6 5.3A16.6 16.6 0 0 0 15.5 4l-.5 1a15.3 15.3 0 0 0-6 0L8.5 4a16.6 16.6 0 0 0-4.1 1.3C1.8 9.2 1.1 13 1.4 16.7a16.8 16.8 0 0 0 5 2.5l1.1-1.7a10.8 10.8 0 0 1-1.7-.8l.4-.3a11.9 11.9 0 0 0 10.2 0l.4.3c-.5.3-1.1.6-1.7.8l1.1 1.7a16.7 16.7 0 0 0 5-2.5c.4-4.3-.7-8.1-3-11.4ZM8.7 14.5c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Zm6.6 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Z"/></svg>',
};
const SEGNO = (cls = "") => `<svg class="segno ${cls}" viewBox="0 0 64 64" role="img" aria-label="Aiutante del postino"><title>Aiutante del postino</title><use href="#segno-aiutante"/></svg>`;
const NOTA_LOGIN = `<p class="aiuto nota-login">Si apre il sito ufficiale discord.com: noi non vediamo mai la tua password. <a href="/info.html">Come funziona</a></p>`;
const ACCESSO = {
  server: "Per entrare devi far parte del server Discord di Our Elysion.",
  annullato: "Accesso annullato. Puoi riprovare quando vuoi.",
  scaduto: "L'accesso ha impiegato troppo tempo. Riprova.",
  dono: '<svg viewBox="0 0 24 24" width="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="9" width="18" height="12" rx="1"/><path d="M3 13h18M12 9v12M12 9c-2-4-6-4-6-1.5S9 9 12 9c3 0 6-.5 6-1.5S14 5 12 9Z"/></svg>',
  discord: "Discord non ha risposto. Riprova tra poco.",
  configurazione: "Il login non è ancora configurato: avvisa lo staff.",
};

const S = { dati: null, vista: "calendario", giorno: null, staffSez: "giorni", staffGiorno: null, adminGiorni: null };

/* ---------- utilità ---------- */
function sim() { try { return sessionStorage.getItem("oe_sim") || ""; } catch { return ""; } }
function setSim(v) { try { v ? sessionStorage.setItem("oe_sim", v) : sessionStorage.removeItem("oe_sim"); } catch {} }
function conSim(path) {
  const s = sim();
  if (!s || S.dati?.utente?.ruolo !== "admin") return path;
  return path + (path.includes("?") ? "&" : "?") + "simula=" + s;
}
async function api(path, opts = {}) {
  const res = await fetch(path, { credentials: "same-origin", ...opts });
  let data = null;
  try { data = await res.json(); } catch {}
  if (!res.ok) throw new Error(data?.errore || "Qualcosa è andato storto, riprova");
  return data;
}
const putJson = (path, body) => api(path, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
let toastT;
function toast(t) { const el = $("#toast"); el.textContent = t; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (el.hidden = true), 3500); }
// il primo del mese si scrive con l'ordinale: "1° dicembre"
const primo = (t) => t.replace(/^1 /, "1° ");
const dataLunga = (iso) => primo(new Date(iso + "T12:00:00Z").toLocaleDateString("it-IT", { day: "numeric", month: "long", timeZone: "UTC" }));
const dataBreve = (iso) => primo(new Date(iso + "T12:00:00Z").toLocaleDateString("it-IT", { day: "numeric", month: "short", timeZone: "UTC" }));
const giorniTra = (a, b) => Math.round((new Date(b + "T12:00:00Z") - new Date(a + "T12:00:00Z")) / 86400000);
const paragrafi = (t) => String(t || "").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
const admin = () => S.dati?.utente?.ruolo === "admin";
const connesso = () => !!S.dati?.utente;

/* ---------- caricamento ---------- */
async function carica() {
  S.dati = await api(conSim("/api/stato"));
  renderTesta();
  render();
}

/* ---------- testata ---------- */
function renderTesta() {
  const d = S.dati, ed = d.edizione;
  $("#brand-anno").textContent = ed.marchio || "Avvento " + ed.anno;
  $("#sottotitolo").textContent = ed.sottotitolo || "";
  $("#titolo").textContent = ed.titolo || "Calendario dell'Avvento";
  $("#intro").textContent = ed.intro || "";
  $("#footer-consegne").textContent = `Le consegne dei premi avvengono in gioco dal ${dataLunga(ed.consegna_da)} al ${dataLunga(ed.consegna_a)}.`;
  document.title = (ed.titolo ? ed.titolo + " · " : "") + "Avvento Our Elysion";

  const voci = [["calendario", "Calendario"], ["aiutanti", "Aiutanti"]];
  if ((!S.dati.chiuso && !S.dati.prima) || S.dati.ha_albo) voci.push(["albo", "Albo"]);
  voci.push(["regolamento", "Regolamento"]);
  if (connesso()) voci.push(["profilo", "Il mio profilo"]);
  if (admin()) voci.push(["staff", "Area staff"]);
  const attiva = S.vista === "casella" ? "calendario" : S.vista;
  $("#menu").innerHTML = voci.map(([k, t]) => `<a href="#${k}" ${attiva === k ? 'aria-current="page"' : ""}>${t}</a>`).join("");

  const u = d.utente;
  $("#utente").innerHTML = u
    ? `<span class="avatar" aria-hidden="true">${u.avatar ? `<img src="${esc(u.avatar)}" alt="">` : esc(u.nome[0] || "?")}</span><span>${esc(u.nome)}${u.aiutante ? SEGNO() : ""}${u.ruolo === "admin" ? " · staff" : ""}</span><button class="esci" data-act="esci">Esci</button>`
    : `<a class="btn-discord" href="/api/auth/login">Entra con Discord</a>`;

  // contatore della community
  const c = $("#contatore");
  if (d.chiuso || !ed.tappe?.length) { c.hidden = true; }
  else {
    const tappe = ed.tappe, max = tappe[tappe.length - 1].s, pct = Math.min(100, (d.lettere / max) * 100);
    c.hidden = false;
    c.innerHTML = `<div class="riga"><span>Lettere ritrovate dalla community</span><b class="num">${d.lettere.toLocaleString("it-IT")} / ${max.toLocaleString("it-IT")}</b></div>
      <div class="barra" role="progressbar" aria-valuemin="0" aria-valuemax="${max}" aria-valuenow="${d.lettere}" aria-label="Lettere ritrovate"><i style="width:${pct}%"></i>${tappe.slice(0, -1).map((t) => `<span class="tacca" style="left:${(t.s / max) * 100}%"></span>`).join("")}</div>
      <div class="tappe" style="grid-template-columns:repeat(${tappe.length},minmax(0,1fr))">${tappe.map((t, i) => `<div class="tappa ${d.lettere >= t.s ? "ok" : ""}"><b>${t.s} lettere</b><span>+${t.b} Biscotti ai partecipanti${i === tappe.length - 1 ? " e capitolo bonus" : ""}</span></div>`).join("")}</div>`;
  }

  // barra anteprima staff
  const bar = $("#barra-staff");
  bar.hidden = !admin();
  if (admin()) {
    $("#sim-data").value = sim() || d.oggi;
    $("#sim-nota").textContent = d.simulata ? "Stai vedendo una data simulata: i giocatori vedono il sito di oggi." : (d.prima ? "I giocatori ora vedono solo la pagina d'attesa." : "");
  }
}

/* ---------- busta ---------- */
function busta(g) {
  const st = g.stato;
  const fb = st !== "sigillata" && g.francobollo ? g.francobollo : (admin() && g.francobollo ? g.francobollo : null);
  const part = connesso() && g.partecipato && st !== "sigillata";
  const cls = ["busta", st === "oggi" ? "oggi" : st === "passata" ? "aperta" : "sigillata", g.n === S.dati.giorni.length ? "natale" : "", fb ? "con-fb" : ""].join(" ");
  let nota = "";
  if (st === "sigillata") { const k = giorniTra(S.dati.oggi, g.data); nota = k === 1 ? "domani" : `tra ${k} giorni`; }
  const lab = `Casella ${g.n}, ${GG_LUNGO[g.wd]} ${dataLunga(g.data)}${g.etichetta ? ", " + g.etichetta : ""}${g.tipo === "sfida" ? ", giorno di sfida" : ""}, ${st === "oggi" ? "aperta oggi" : st === "passata" ? "già aperta" : "ancora sigillata"}${part ? ", hai partecipato" : ""}`;
  return `<a class="${cls}" href="#casella-${g.n}" aria-label="${esc(lab)}">
    <svg class="forma" viewBox="0 0 100 75" preserveAspectRatio="none" aria-hidden="true">
      ${st === "passata" ? '<rect class="foglio" x="14" y="6" width="72" height="40" rx="1"/>' : ""}
      <path class="piega" d="M0 75 L42 38 M100 75 L58 38"/>
      <path class="lembo" d="M0 0 L50 42 L100 0 Z"/>
    </svg>
    ${g.tipo === "sfida" ? `<span class="nastro">${esc(g.etichetta || "Sfida")}</span>` : ""}
    ${fb ? `<span class="fb" aria-hidden="true"><span class="fb-in" style="display:block"><img src="${esc(fb)}" alt="" loading="lazy"></span></span>` : ""}
    <span class="gg">${GG[g.wd]}</span>
    ${st === "oggi" && !part ? `<span class="sigillo" aria-hidden="true">${ICO.fiocco}</span>` : ""}
    <span class="n num">${g.n}</span>
    ${part ? `<span class="spunta" aria-hidden="true">${ICO.spunta}</span>` : ""}
    ${st === "sigillata" ? ICO.lucchetto + `<span class="nota" style="right:calc(7% + 20px)">${nota}</span>` : ""}
  </a>`;
}

/* ---------- viste ---------- */
function vAttesa() {
  const ed = S.dati.edizione, k = giorniTra(S.dati.oggi, ed.inizio);
  return `<div class="attesa">
    <span class="label">Edizione ${ed.anno}</span>
    <h2>Il calendario si apre il ${dataLunga(ed.inizio)} a mezzanotte</h2>
    <div class="conto"><div><b>${k}</b><span>${k === 1 ? "giorno" : "giorni"} all'apertura</span></div><div><b>${S.dati.giorni.length || giorniTra(ed.inizio, ed.fine) + 1}</b><span>buste da aprire</span></div></div>
    <p>${connesso() ? "Ci sei! Intanto completa il tuo profilo: indica il personaggio a cui consegnare gli eventuali premi." : "Per partecipare servirà accedere con il tuo account Discord del server Our Elysion."}</p>
    ${connesso() ? `<a class="btn" href="#profilo">Completa il profilo</a>` : `<a class="btn-discord" href="/api/auth/login">Entra con Discord</a>`}
    ${connesso() ? "" : NOTA_LOGIN}
  </div>
  <div class="sotto">${pannelloCome()}</div>`;
}

function pannelloCome() {
  const passi = paragrafi(S.dati.edizione.come_funziona);
  return `<section class="pannello" aria-labelledby="h-come"><h3 id="h-come">Come funziona</h3>
    <ol class="passi">${passi.map((p, i) => `<li><span class="k">${i + 1}</span><span>${esc(p)}</span></li>`).join("")}</ol>
    <p style="margin-top:14px"><a href="#regolamento">Leggi il regolamento completo</a></p></section>`;
}

function vCalendario() {
  const d = S.dati;
  if (d.chiuso) return vAttesa();
  let avviso = "";
  if (d.prima) avviso = `<div class="avviso"><span class="stato">Anteprima</span><p><b>Il calendario non è ancora aperto.</b> Lo vedete solo voi dello staff; i giocatori vedono la pagina d'attesa fino al ${dataLunga(d.edizione.inizio)}.</p></div>`;
  else if (d.dopo) avviso = `<div class="avviso"><span class="stato ok">Concluso</span><p><b>Grazie a tutti!</b> Il calendario è chiuso. Le consegne in gioco sono aperte fino al ${dataLunga(d.edizione.consegna_a)}.</p></div>`;
  else if (!connesso()) avviso = `<div class="avviso"><span class="stato acc">Oggi</span><p><b>La busta del ${dataLunga(d.oggi)} è aperta.</b> Per partecipare accedi con il tuo account Discord del server Our Elysion.</p></div>`;
  const mese = new Date(d.edizione.inizio + "T12:00:00Z").toLocaleDateString("it-IT", { month: "long", year: "numeric", timeZone: "UTC" });
  return `${avviso}
  <div class="cal-head"><h2 style="text-transform:capitalize">${esc(mese)}</h2>
    <div class="legenda"><span><i class="dot" style="background:var(--accent)"></i>Oggi</span><span><i class="dot" style="background:var(--primary)"></i>Giorno di sfida</span>${connesso() ? `<span><i class="dot" style="background:var(--ok)"></i>Hai partecipato</span>` : ""}</div></div>
  <div class="griglia">${d.giorni.map(busta).join("")}</div>
  <div class="sotto">${pannelloCome()}
    <section class="pannello" id="box-messaggi"><h3>Un messaggio per la community</h3><p class="sub">Caricamento…</p></section>
  </div>`;
}

async function vCasella(n) {
  const v = $("#vista");
  v.innerHTML = `<p class="caricamento">Apro la busta…</p>`;
  let g;
  try { g = await api(conSim(`/api/giorno/${n}`)); }
  catch (e) {
    const info = S.dati.giorni.find((x) => x.n === n);
    v.innerHTML = `<a class="indietro" href="#calendario">← Torna al calendario</a>
      <div class="pannello sigillata-box"><span class="label">Casella ${n}${info ? " · " + GG_LUNGO[info.wd] + " " + dataLunga(info.data) : ""}</span>
      <h2>Questa busta è ancora sigillata</h2><p style="color:var(--muted)">${info ? `Si apre ${giorniTra(S.dati.oggi, info.data) === 1 ? "domani" : "tra " + giorniTra(S.dati.oggi, info.data) + " giorni"} a mezzanotte.` : esc(e.message)}</p></div>`;
    return;
  }
  if (S.vista !== "casella" || S.giorno !== n) return;
  S.casella = g;
  const testo = paragrafi(g.testo);
  const anteprima = g.stato === "sigillata" ? `<div class="avviso"><span class="stato warn">Anteprima staff</span><p>Questa busta è ancora sigillata per i giocatori: la vedi solo tu.</p></div>` : "";
  v.innerHTML = `<a class="indietro" href="#calendario">← Torna al calendario</a>${anteprima}
  <div class="casella">
    <article class="capitolo">
      <span class="label">Capitolo ${g.n} · ${GG_LUNGO[g.wd]} ${dataLunga(g.data)}${g.etichetta ? " · " + esc(g.etichetta) : ""}</span>
      <h2>${esc(g.titolo || "Capitolo " + g.n)}</h2>
      ${g.immagine ? `<img class="illustrazione" src="${esc(g.immagine)}" alt="Immagine del capitolo ${g.n}">` : ""}
      <div class="storia">${testo.length ? testo.map((p) => `<p>${esc(p)}</p>`).join("") : `<p class="vuoto">Il testo di questo capitolo non è ancora stato scritto.</p>`}</div>
    </article>
    <aside class="azione">${pannelloGioco(g)}</aside>
  </div>
  ${puoPartecipare(g) ? `<div class="barra-partecipa" id="barra-partecipa"><button class="btn grande" data-act="vai-azione">${g.tipo === "sfida" ? "Rispondi alla sfida" : "Partecipa all'estrazione"}</button></div>` : ""}`;
  osservaBarra();
}

const puoPartecipare = (g) => { const u = S.dati.utente; return !!u && u.ruolo !== "admin" && !!u.pg && g.stato === "oggi" && !g.estratta && !g.mia?.partecipato; };

function osservaBarra() {
  const bar = $("#barra-partecipa"), box = $("#azione");
  if (!bar || !box || !("IntersectionObserver" in window)) return;
  new IntersectionObserver(([e]) => { bar.hidden = e.isIntersecting; }).observe(box);
}

function chipsPalio(list) {
  return list?.length ? `<div class="palio">${list.map((c) => `<span class="chip-palio">${esc(c.categoria)}${c.vincitori > 1 ? ` <b>×${c.vincitori}</b>` : ""}</span>`).join("")}</div>` : "";
}

function domandaSfida(g, interattiva) {
  const ris = (g.risposte || []).map((r, i) => [r, i]).filter(([r]) => r);
  return `<div><span class="label" style="color:var(--primary)">Sfida${g.etichetta ? " di " + esc(g.etichetta) : ""} · ${S.dati.edizione.biglietti_sfida} biglietti se corretta</span>
    <p class="domanda">${esc(g.domanda || "La domanda della sfida comparirà qui.")}</p>
    ${interattiva
      ? `<div class="scelte">${ris.map(([r, i]) => `<label class="scelta" for="r${i}"><input type="radio" name="r" id="r${i}" value="${i}"> ${esc(r)}</label>`).join("")}</div>`
      : `<div class="scelte">${ris.map(([r, i]) => `<div class="scelta" style="cursor:default">${g.giusta === i ? ICO.spunta : ""} ${esc(r)}${g.mia?.risposta === i ? ` <span class="aiuto">· la tua risposta</span>` : ""}</div>`).join("")}</div>`}
  </div>`;
}

function pannelloGioco(g) {
  const tot = (g.in_palio || []).reduce((s, c) => s + c.vincitori, 0);
  const chiude = `<p class="chiusura">Si chiude stasera alle <b>23:59</b>. Estrazione a mezzanotte.</p>`;
  const u = S.dati.utente;
  let h = `<div class="pannello pannello-gioco" id="azione">`;
  if (g.estratta) {
    const vinti = u ? g.premi.filter((p) => p.vincitori.some((x) => x.id === u.id)) : [];
    h += `<span class="label">Premi del giorno</span>`;
    if (vinti.length) h += `<div class="avviso vinto"><span class="stato acc">Hai vinto!</span><p><b>${esc(vinti[0].etichetta)}</b>. Te lo consegniamo in gioco dal ${dataLunga(S.dati.edizione.consegna_da)}.</p></div>`;
    else if (g.mia?.partecipato) h += `<span class="stato">Hai partecipato · +${S.dati.edizione.biscotti_partecipazione} Biscotti di Tullio</span>`;
    h += g.premi.length ? `<div class="premi">${g.premi.map(cardPremio).join("")}</div>` : `<p class="sub">Nessun premio in questo giorno.</p>`;
    if (g.tipo === "sfida") h += domandaSfida(g, false);
    return h + `</div>`;
  }
  h += `<div class="in-palio"><span class="label">In palio ${g.stato === "oggi" ? "oggi" : ""}</span><b>${tot ? `${tot} ${tot === 1 ? "premio" : "premi"}` : "Premi in arrivo"}</b>${chipsPalio(g.in_palio)}
    <span class="aiuto">Il premio esatto si scopre dopo l'estrazione.</span></div>`;
  if (g.stato === "passata") return h + `<p class="prossimamente">Estrazione in corso: ricarica la pagina tra qualche minuto.</p></div>`;
  if (g.stato === "sigillata") return h + (g.tipo === "sfida" ? domandaSfida(g, false) : "") + `<p class="prossimamente">Anteprima: il ${dataLunga(g.data)} qui i giocatori troveranno il pulsante per partecipare.</p></div>`;
  if (!u) return h + `<a class="btn-discord" href="/api/auth/login">Accedi con Discord per partecipare</a>${NOTA_LOGIN}${chiude}</div>`;
  if (u.ruolo === "admin") return h + (g.tipo === "sfida" ? domandaSfida(g, false) : "") + `<p class="prossimamente">Lo staff non partecipa alle estrazioni. I giocatori qui vedono il pulsante "Partecipa"${g.tipo === "sfida" ? " e la domanda" : ""}.</p>${chiude}</div>`;
  if (!u.pg) return h + `<p>Prima di partecipare indica il personaggio a cui consegnare i premi.</p><a class="btn" href="#profilo">Completa il profilo</a>${chiude}</div>`;
  if (g.mia?.partecipato) {
    return h + `<span class="stato ok">${ICO.spunta} Sei in gara</span>
      <p>${g.tipo === "sfida" ? `Hai risposto <b>${esc(g.risposte[g.mia.risposta])}</b>. Scoprirai se è giusta a mezzanotte, insieme all'estrazione.` : "La tua partecipazione è registrata."}</p>
      <p class="aiuto">Hai ritrovato una lettera per la community. Se non vinci ricevi comunque ${S.dati.edizione.biscotti_partecipazione} Biscotti di Tullio.</p>${chiude}</div>`;
  }
  if (g.tipo === "sfida") {
    return h + `<form id="form-sfida" data-n="${g.n}">${domandaSfida(g, true)}
      <button class="btn grande" type="submit">Invia la risposta</button>
      <p class="aiuto" style="margin-top:8px">Una sola risposta, non modificabile. Con la risposta sbagliata partecipi comunque, con 1 biglietto.</p></form>${chiude}</div>`;
  }
  return h + `<button class="btn grande" data-act="partecipa" data-n="${g.n}">Partecipa all'estrazione</button>${chiude}</div>`;
}

function cardPremio(p) {
  const u = S.dati.utente;
  const io = u && p.vincitori.some((v) => v.id === u.id);
  return `<div class="premio-card${io ? " mio" : ""}">
    ${p.immagine ? `<img src="${esc(p.immagine)}" alt="" loading="lazy">` : ""}
    <div class="pc-t"><span class="label">${esc(p.categoria)}${p.posti > 1 ? ` · ${p.posti} vincitori` : ""}</span><b>${esc(p.etichetta)}</b>
      ${p.dettagli ? `<p>${esc(p.dettagli)}</p>` : ""}<span class="aiuto">${esc(p.offerto)}</span>
      <ul class="vincitori">${p.vincitori.length ? p.vincitori.map((v) => `<li${u && v.id === u.id ? ' class="io"' : ""}>${esc(v.nome)}${v.aiutante ? SEGNO() : ""}</li>`).join("") : `<li class="nessuno">Nessun vincitore</li>`}</ul>
    </div></div>`;
}

function vRegolamento() {
  const ed = S.dati.edizione;
  const blocchi = paragrafi(ed.regolamento).map((p) => {
    const righe = p.split("\n");
    if (righe[0].startsWith("# ")) return `<section><h3>${esc(righe[0].slice(2))}</h3>${righe.slice(1).join(" ").trim() ? `<p>${esc(righe.slice(1).join(" "))}</p>` : ""}</section>`;
    return `<section><p>${esc(p)}</p></section>`;
  });
  return `<div class="pagina-h"><span class="label">Edizione ${ed.anno}</span><h2>Regolamento</h2></div><div class="regole">${blocchi.join("")}</div>`;
}

function vProfilo() {
  const u = S.dati.utente;
  if (!u) return `<div class="pannello sigillata-box"><h2>Accedi per vedere il tuo profilo</h2><a class="btn-discord" href="/api/auth/login">Entra con Discord</a></div>`;
  const dc = u.dc || "Light";
  return `<div class="pagina-h"><span class="label">Il mio profilo</span><h2>${esc(u.nome)}</h2><p>@${esc(u.username)} su Discord</p></div>
  ${u.aiutante ? `<div class="timbro-aiutante">${SEGNO("grande")}<span><b>Aiutante del postino</b><span>Edizione ${S.dati.edizione.anno} · grazie per aver aiutato Tullio con i premi! Il francobollo compare accanto al tuo nome in tutto il sito.</span></span></div>` : ""}
  <section class="pannello" style="max-width:560px"><h3>Dove consegnarti i premi</h3><p class="sub">Il personaggio e il mondo su cui ti consegneremo eventuali premi in gioco.</p>
    <form id="form-profilo">
      <div class="campo"><label for="pg">Nome del personaggio</label><input type="text" id="pg" maxlength="40" value="${esc(u.pg)}" placeholder="Nome Cognome" autocomplete="off"></div>
      <div class="due"><div class="campo"><label for="dc">Data center</label><select id="dc">${Object.keys(MONDI).map((x) => `<option ${x === dc ? "selected" : ""}>${x}</option>`).join("")}</select></div>
      <div class="campo"><label for="mondo">Mondo</label><select id="mondo">${MONDI[dc].map((m) => `<option ${m === u.mondo ? "selected" : ""}>${m}</option>`).join("")}</select></div></div>
      <button class="btn" type="submit">Salva</button>
    </form></section>
  <section id="mio-dicembre" style="margin-top:24px"></section>
  ${u.aiutante ? `<p style="margin-top:18px"><a href="#aiutanti">Le tue offerte per il calendario</a></p>`
    : S.dati.oggi <= (S.dati.edizione.donazioni_fino || "") ? `<p style="margin-top:18px"><a href="#aiutanti">Vuoi offrire un premio? Diventa un aiutante</a></p>` : ""}`;
}

/* ---------- area staff ---------- */
async function vStaff() {
  if (!admin()) return `<div class="pannello sigillata-box"><h2>Area riservata allo staff</h2></div>`;
  const nav = [["giorni", "Giorni e capitoli"], ["premi", "Premi e aiutanti"], ["estrazioni", "Estrazioni"], ["consegne", "Consegne"], ["biscotti", "Biscotti per Mee6"], ["messaggi", "Messaggi per Tullio"], ["partecipanti", "Partecipanti"], ["testi", "Testi, date e regole"], ["edizioni", "Edizioni e backup"]];
  const head = `<div class="staff"><nav class="staff-nav" aria-label="Sezioni staff">${nav.map(([k, t]) => `<button data-sez="${k}" aria-current="${S.staffSez === k}">${t}</button>`).join("")}
</nav><section id="staff-corpo"><p class="caricamento">Caricamento…</p></section></div>`;
  return head;
}

async function riempiStaff() {
  const corpo = $("#staff-corpo");
  if (!corpo) return;
  if (S.staffSez === "testi") { corpo.innerHTML = formTesti(); return; }
  if (S.staffSez === "premi") return riempiPremi();
  if (S.staffSez === "estrazioni") return riempiEstrazioni();
  if (S.staffSez === "biscotti") return riempiBiscotti();
  if (S.staffSez === "consegne") return riempiConsegne();
  if (S.staffSez === "messaggi") return riempiMessaggi();
  if (S.staffSez === "partecipanti") return riempiPartecipanti();
  if (S.staffSez === "edizioni") return riempiEdizioni();
  try { S.adminGiorni = (await api("/api/admin/giorni")).giorni; }
  catch (e) { corpo.innerHTML = `<p class="avviso">${esc(e.message)}</p>`; return; }
  corpo.innerHTML = S.staffGiorno ? editorGiorno(S.adminGiorni.find((g) => g.n === S.staffGiorno)) : listaGiorni();
}

const pill = (c, t) => `<span class="stato ${c}">${t}</span>`;
const PILL_CAP = { pronto: ["ok", "Pronto"], bozza: ["warn", "Bozza"], manca: ["err", "Da scrivere"] };

function listaGiorni() {
  const g = S.adminGiorni;
  const pronti = g.filter((x) => x.stato_capitolo === "pronto").length;
  return `<h2>Giorni e capitoli</h2><p class="intro">${pronti} capitoli pronti su ${g.length}. Puoi modificare anche le caselle future: le vedete solo voi dello staff.</p>
  <div class="giorni-lista">${g.map((x) => {
    const [c, t] = PILL_CAP[x.stato_capitolo] || PILL_CAP.manca;
    return `<div class="giorno-card">
      <span class="gn">${x.n}<small>${GG[x.wd]} ${dataBreve(x.data)}</small></span>
      <span class="mini">${x.img_ver ? `<img src="/api/img/${x.n}/thumb?v=${x.img_ver}" alt="" loading="lazy">` : ""}</span>
      <span class="gt"><b>${esc(x.titolo || "Senza titolo")}</b><span class="fila">${pill(c, t)}${x.tipo === "sfida" ? pill("", "Sfida" + (x.etichetta ? " · " + esc(x.etichetta) : "")) : ""}</span><span class="aiuto">${x.in_palio?.length ? "In palio: " + x.in_palio.map((c) => esc(c.categoria) + (c.vincitori > 1 ? " ×" + c.vincitori : "")).join(", ") : "Nessun premio assegnato"}</span></span>
      <button class="btn sec" data-staffday="${x.n}">Modifica</button></div>`;
  }).join("")}</div>`;
}

function editorGiorno(g) {
  const ris = [...(g.risposte || [])];
  while (ris.length < 4) ris.push("");
  const sfida = g.tipo === "sfida";
  return `<button class="btn quieto" data-act="lista-giorni">← Tutti i giorni</button>
  <form id="form-giorno" data-n="${g.n}" style="margin-top:10px">
    <span class="label">Casella ${g.n} · ${GG_LUNGO[g.wd]} ${dataLunga(g.data)}</span>
    <h2 style="margin:4px 0 16px">${esc(g.titolo || "Capitolo " + g.n)}</h2>
    <div class="pannello" style="display:grid;gap:4px">
      <div class="due">
        <div class="campo"><label for="e-titolo">Titolo del capitolo</label><input type="text" id="e-titolo" maxlength="120" value="${esc(g.titolo)}"></div>
        <div class="campo"><label for="e-stato">Stato del capitolo</label><select id="e-stato">${Object.entries(PILL_CAP).map(([k, [, t]]) => `<option value="${k}" ${g.stato_capitolo === k ? "selected" : ""}>${t}</option>`).join("")}</select></div>
      </div>
      <div class="campo"><label for="e-testo">Testo</label><textarea id="e-testo" style="min-height:260px">${esc(g.testo)}</textarea><span class="aiuto">Lascia una riga vuota tra un paragrafo e l'altro.</span></div>
    </div>

    <div class="pannello" style="margin-top:16px">
      <h3 style="font-size:22px;margin-bottom:10px">Immagine</h3>
      <div class="editor-img">
        <div class="anteprima-full" id="ed-full">${g.img_ver ? `<img src="/api/img/${g.n}/full?v=${g.img_ver}" alt="Immagine attuale" crossorigin="anonymous">` : "Nessuna immagine"}</div>
        <div style="display:grid;gap:10px;align-content:start">
          <div class="campo" style="margin:0"><label for="e-img">${g.img_ver ? "Sostituisci l'immagine" : "Carica l'immagine"}</label><input type="file" id="e-img" accept="image/*"><span class="aiuto">Orizzontale, 16:9. Viene ridimensionata e compressa in automatico.</span></div>
          <div class="campo" style="margin:0"><label for="e-fuoco">Parte da tenere nel francobollo</label><select id="e-fuoco">${Object.keys(FP).map((k) => `<option ${g.fuoco === k ? "selected" : ""}>${k}</option>`).join("")}</select></div>
          <div class="fb-demo" id="ed-fb">${g.img_ver ? `<span class="fb"><span class="fb-in" style="display:block"><img src="/api/img/${g.n}/thumb?v=${g.img_ver}" alt="Francobollo"></span></span>` : ""}</div>
          <button type="button" class="btn quieto" id="btn-rimuovi" data-act="rimuovi-img" style="justify-self:start" ${g.img_ver ? "" : "hidden"}>Rimuovi l'immagine</button>
        </div>
      </div>
    </div>

    <div class="pannello" style="margin-top:16px">
      <h3 style="font-size:22px;margin-bottom:10px">Il giorno</h3>
      <div class="due">
        <div class="campo"><label for="e-tipo">Tipo di giorno</label><select id="e-tipo"><option value="sorteggio" ${!sfida ? "selected" : ""}>Sorteggio</option><option value="sfida" ${sfida ? "selected" : ""}>Sfida</option></select></div>
        <div class="campo"><label for="e-etichetta">Etichetta sul nastro</label><input type="text" id="e-etichetta" maxlength="24" value="${esc(g.etichetta)}" placeholder="Es. S. Nicola"><span class="aiuto">Compare sulla busta nei giorni di sfida. Vuota: "Sfida".</span></div>
        <div class="campo"><span class="label" style="color:var(--ink)">Premi in palio</span>${g.in_palio?.length ? chipsPalio(g.in_palio) : `<p style="font-size:16px">Nessun premio assegnato</p>`}<span class="aiuto">Si assegna dalla sezione <button type="button" class="btn quieto piccolo" data-sez="premi">Premi e aiutanti</button></span></div>
      </div>
      <div id="ed-sfida" ${sfida ? "" : "hidden"}>
        <div class="campo"><label for="e-domanda">Domanda della sfida</label><input type="text" id="e-domanda" maxlength="300" value="${esc(g.domanda)}"></div>
        <fieldset style="border:0;padding:0;margin:0"><legend class="label" style="margin-bottom:8px">Risposte · seleziona quella giusta</legend>
          <div class="risposte-ed">${ris.map((r, i) => `<div class="risposta-ed"><input type="radio" name="giusta" value="${i}" id="g${i}" ${g.giusta === i ? "checked" : ""} aria-label="Risposta ${i + 1} giusta"><input type="text" id="r${i}" maxlength="200" value="${esc(r)}" placeholder="Risposta ${i + 1}"></div>`).join("")}</div>
        </fieldset>
      </div>
    </div>

    <div class="salva-barra">
      <button class="btn" type="submit">Salva</button>
      <a class="btn sec" href="#casella-${g.n}" data-act="anteprima" data-data="${g.data}">Anteprima</a>
      <span class="modificato" id="ed-mod" hidden>Modifiche non salvate</span>
      ${g.updated_by ? `<span class="aiuto">Ultima modifica: ${esc(g.updated_by)}</span>` : ""}
    </div>
  </form>`;
}

function formTesti() {
  const ed = S.dati.edizione;
  const tappe = [...ed.tappe];
  while (tappe.length < 3) tappe.push({ s: "", b: "" });
  const d = (id, l, v) => `<div class="campo"><label for="${id}">${l}</label><input type="date" id="${id}" value="${esc(v)}"></div>`;
  return `<h2>Testi e date</h2><p class="intro">Le informazioni dell'edizione ${ed.anno}. Gli orari restano fissi: apertura 00:01, chiusura 23:59, estrazione alle 00:00.</p>
  <form id="form-testi">
    <div class="pannello"><h3 style="font-size:22px;margin-bottom:10px">Date</h3>
      <div class="due">${d("t-inizio", "Prima casella", ed.inizio)}${d("t-fine", "Ultima casella", ed.fine)}${d("t-cda", "Consegne dal", ed.consegna_da)}${d("t-ca", "Consegne fino al", ed.consegna_a)}</div>
      <p class="aiuto">Se cambi le date, le caselle si adattano da sole (massimo 31).</p></div>
    <div class="pannello" style="margin-top:16px"><h3 style="font-size:22px;margin-bottom:10px">Testata</h3>
      <div class="campo"><label for="t-marchio">Scritta accanto al logo</label><input type="text" id="t-marchio" maxlength="40" value="${esc(ed.marchio)}" placeholder="Calendario dell'Avvento"><span class="aiuto">Sotto "Our Elysion", in alto a sinistra.</span></div>
      <div class="campo"><label for="t-titolo">Titolo</label><input type="text" id="t-titolo" maxlength="80" value="${esc(ed.titolo)}"></div>
      <div class="campo"><label for="t-sotto">Sottotitolo</label><input type="text" id="t-sotto" maxlength="120" value="${esc(ed.sottotitolo)}"></div>
      <div class="campo"><label for="t-intro">Introduzione</label><textarea id="t-intro" maxlength="600">${esc(ed.intro)}</textarea></div></div>
    <div class="pannello" style="margin-top:16px"><h3 style="font-size:22px;margin-bottom:10px">Traguardi della community</h3>
      <div class="tappe-ed">${tappe.map((t, i) => `<div class="tappa-ed"><div class="campo"><label for="ts${i}">Tappa ${i + 1}: lettere</label><input type="number" min="1" id="ts${i}" value="${esc(t.s)}"></div><div class="campo"><label for="tb${i}">Biscotti ai partecipanti</label><input type="number" min="0" id="tb${i}" value="${esc(t.b)}"></div></div>`).join("")}</div>
      <p class="aiuto">L'ultima tappa è il traguardo finale e sblocca il capitolo bonus. Lascia vuota una riga per toglierla.</p></div>
    <div class="pannello" style="margin-top:16px"><h3 style="font-size:22px;margin-bottom:10px">Regole delle estrazioni</h3>
      <div class="due">
        <div class="campo"><label for="t-tetto">Premi massimi a persona</label><input type="number" id="t-tetto" min="1" max="25" value="${esc(ed.tetto)}"><span class="aiuto">In tutto il calendario.</span></div>
        <div class="campo"><label for="t-big">Biglietti per la risposta giusta</label><input type="number" id="t-big" min="1" max="10" value="${esc(ed.biglietti_sfida)}"><span class="aiuto">La risposta sbagliata vale 1.</span></div>
        <div class="campo"><label for="t-bisc">Biscotti per partecipazione</label><input type="number" id="t-bisc" min="0" value="${esc(ed.biscotti_partecipazione)}"><span class="aiuto">A chi partecipa e quel giorno non vince.</span></div>
      </div>
      <p class="aiuto">L'estrazione dà la precedenza a chi ha vinto meno premi finora; a parità decide la sorte. Nessuno vince più di un premio al giorno né il premio che ha donato.</p></div>
    <div class="pannello" style="margin-top:16px"><h3 style="font-size:22px;margin-bottom:10px">Aiutanti</h3>
      <div class="due">${d("t-dfino", "Offerte aperte fino al", ed.donazioni_fino)}</div>
      <div class="campo"><label for="t-aiut">Testo della pagina Aiutanti</label><textarea id="t-aiut" style="min-height:200px">${esc(ed.aiutanti_intro)}</textarea><span class="aiuto">Spiega come consegnare i doni e a chi. Lascia una riga vuota tra i paragrafi.</span></div></div>
    <div class="pannello" style="margin-top:16px"><h3 style="font-size:22px;margin-bottom:10px">Come funziona</h3>
      <div class="campo"><label for="t-come">Passaggi</label><textarea id="t-come" style="min-height:200px">${esc(ed.come_funziona)}</textarea><span class="aiuto">Un passaggio per paragrafo, separati da una riga vuota.</span></div></div>
    <div class="pannello" style="margin-top:16px"><h3 style="font-size:22px;margin-bottom:10px">Regolamento</h3>
      <div class="campo"><label for="t-reg">Testo</label><textarea id="t-reg" style="min-height:320px">${esc(ed.regolamento)}</textarea><span class="aiuto">Scrivi "# " all'inizio di una riga per un titolo. Lascia una riga vuota tra le sezioni.</span></div></div>
    <div class="salva-barra"><button class="btn" type="submit">Salva testi e date</button></div>
  </form>`;
}

/* ---------- immagini: ridimensionamento e francobollo ---------- */
async function caricaImmagine(src) {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = src;
  await img.decode();
  return img;
}
function toBlob(canvas, q) {
  return new Promise((res) => canvas.toBlob((b) => {
    if (b && b.type === "image/webp") return res(b);
    canvas.toBlob(res, "image/jpeg", q); // browser senza WebP
  }, "image/webp", q));
}
async function versioneGrande(img) {
  const w = Math.min(1600, img.naturalWidth), h = Math.round(img.naturalHeight * (w / img.naturalWidth));
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  c.getContext("2d").drawImage(img, 0, 0, w, h);
  let q = 0.82, b = await toBlob(c, q);
  while (b.size > 1_400_000 && q > 0.4) { q -= 0.12; b = await toBlob(c, q); }
  return b;
}
async function francobollo(img, fuoco) {
  const W = 360, H = 270, iw = img.naturalWidth, ih = img.naturalHeight;
  let sw = iw, sh = Math.round(iw * 3 / 4);
  if (sh > ih) { sh = ih; sw = Math.round(ih * 4 / 3); }
  const sx = fuoco === "sinistra" ? 0 : fuoco === "destra" ? iw - sw : Math.round((iw - sw) / 2);
  const sy = Math.round((ih - sh) / 2);
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  c.getContext("2d").drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
  return toBlob(c, 0.8);
}
function aggiornaImgEditor(n, ver) {
  const g = S.adminGiorni.find((x) => x.n === n); if (g) g.img_ver = ver;
  $("#ed-full").innerHTML = ver ? `<img src="/api/img/${n}/full?v=${ver}" alt="Immagine attuale">` : "Nessuna immagine";
  $("#ed-fb").innerHTML = ver ? `<span class="fb"><span class="fb-in" style="display:block"><img src="/api/img/${n}/thumb?v=${ver}" alt="Francobollo"></span></span>` : "";
  const rm = $("#btn-rimuovi"); if (rm) rm.hidden = !ver;
}
async function inviaImmagine(n, full, thumb) {
  const fd = new FormData();
  if (full) fd.append("full", full, "full");
  fd.append("thumb", thumb, "thumb");
  return api(`/api/admin/giorno/${n}/immagine`, { method: "PUT", body: fd });
}

/* ---------- render e navigazione ---------- */
async function render() {
  const v = $("#vista");
  if (S.vista === "casella") { renderTesta(); return vCasella(S.giorno); }
  v.innerHTML = S.vista === "regolamento" ? vRegolamento() : ["aiutanti", "albo", "posta"].includes(S.vista) ? `<p class="caricamento">Caricamento…</p>` : S.vista === "profilo" ? vProfilo() : S.vista === "staff" ? await vStaff() : vCalendario();
  if (S.vista === "staff") riempiStaff();
  if (S.vista === "aiutanti") vAiutanti();
  if (S.vista === "albo") vAlbo();
  if (S.vista === "posta") vPosta();
  if (S.vista === "calendario" && !S.dati.chiuso) boxMessaggi();
  if (S.vista === "profilo") mioDicembre();
}

function leggiHash() {
  const h = (location.hash || "").slice(1);
  if (/^casella-\d+$/.test(h)) { S.vista = "casella"; S.giorno = Number(h.split("-")[1]); }
  else if (["regolamento", "profilo", "staff", "calendario", "aiutanti", "albo", "posta"].includes(h)) S.vista = h;
  else S.vista = "calendario";
}
window.addEventListener("hashchange", async () => {
  leggiHash();
  if (!S.dati) return; // il primo caricamento disegnerà la vista giusta
  // disegna subito con i dati che abbiamo, poi aggiorna in silenzio
  renderTesta(); render();
  $("#vista").focus({ preventScroll: true });
  window.scrollTo({ top: Math.max(0, $(".testata").offsetHeight - 10), behavior: "smooth" });
  if (S.vista === "profilo" || S.vista === "calendario") {
    const vista = S.vista, prima = JSON.stringify(S.dati);
    try {
      const nuovi = await api(conSim("/api/stato"));
      if (S.vista !== vista || JSON.stringify(nuovi) === prima) return;
      S.dati = nuovi; renderTesta(); render();
    } catch {}
  }
});

/* ---------- eventi ---------- */
document.addEventListener("click", async (e) => {
  const sez = e.target.closest("[data-sez]");
  if (sez) { S.staffSez = sez.dataset.sez; S.staffGiorno = null; render(); return; }
  const sd = e.target.closest("[data-staffday]");
  if (sd) { S.staffGiorno = Number(sd.dataset.staffday); riempiStaff(); window.scrollTo({ top: $("#vista").offsetTop - 10 }); return; }
  const a = e.target.closest("[data-act]");
  if (!a) return;
  const act = a.dataset.act;
  if (act === "esci") { await api("/api/auth/logout", { method: "POST" }).catch(() => {}); location.hash = "calendario"; carica(); }
  if (act === "lista-giorni") { S.staffGiorno = null; riempiStaff(); }
  if (act === "anteprima") { if (S.dati.oggi < a.dataset.data) { setSim(a.dataset.data); await carica(); } }
  if (act === "rimuovi-img") {
    const n = Number($("#form-giorno").dataset.n);
    try { await api(`/api/admin/giorno/${n}/immagine`, { method: "DELETE" }); toast("Immagine rimossa"); aggiornaImgEditor(n, 0); }
    catch (err) { toast(err.message); }
  }
});

document.addEventListener("input", (e) => {
  if (e.target.closest("#form-giorno")) { const m = $("#ed-mod"); if (m) m.hidden = false; }
});

document.addEventListener("change", async (e) => {
  const t = e.target;
  if (t.id === "dc") { $("#mondo").innerHTML = MONDI[t.value].map((m) => `<option>${m}</option>`).join(""); }
  if (t.id === "e-tipo") { $("#ed-sfida").hidden = t.value !== "sfida"; }
  if (t.id === "e-img" && t.files[0]) {
    const n = Number($("#form-giorno").dataset.n);
    const url = URL.createObjectURL(t.files[0]);
    try {
      toast("Preparo l'immagine…");
      const img = await caricaImmagine(url);
      const [full, thumb] = await Promise.all([versioneGrande(img), francobollo(img, $("#e-fuoco").value)]);
      const r = await inviaImmagine(n, full, thumb);
      aggiornaImgEditor(n, r.img_ver);
      toast("Immagine caricata");
      t.value = "";
    } catch (err) { toast(err.message || "Non riesco a leggere questa immagine"); }
    finally { URL.revokeObjectURL(url); }
  }
  if (t.id === "e-fuoco") {
    const n = Number($("#form-giorno").dataset.n);
    const g = S.adminGiorni.find((x) => x.n === n);
    if (!g?.img_ver) return;
    try {
      const img = await caricaImmagine(`/api/img/${n}/full?v=${g.img_ver}`);
      const thumb = await francobollo(img, t.value);
      const r = await inviaImmagine(n, null, thumb);
      aggiornaImgEditor(n, r.img_ver);
      toast("Francobollo aggiornato. Ricorda di salvare.");
    } catch (err) { toast(err.message); }
  }
});

document.addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  if (f.id === "form-profilo") {
    try { await putJson("/api/profilo", { pg: $("#pg").value, dc: $("#dc").value, mondo: $("#mondo").value }); toast("Profilo salvato"); await carica(); }
    catch (err) { toast(err.message); }
  }
  if (f.id === "form-giorno") {
    const n = Number(f.dataset.n);
    const giusta = f.querySelector("input[name=giusta]:checked");
    const body = {
      titolo: $("#e-titolo").value, testo: $("#e-testo").value, stato_capitolo: $("#e-stato").value,
      tipo: $("#e-tipo").value, etichetta: $("#e-etichetta").value, fuoco: $("#e-fuoco").value,
      domanda: $("#e-domanda").value, risposte: [0, 1, 2, 3].map((i) => $("#r" + i).value), giusta: giusta ? Number(giusta.value) : null,
    };
    try { await putJson(`/api/admin/giorno/${n}`, body); toast(`Casella ${n} salvata`); $("#ed-mod").hidden = true; S.dati = await api(conSim("/api/stato")); }
    catch (err) { toast(err.message); }
  }
  if (f.id === "form-testi") {
    const tappe = [0, 1, 2].map((i) => ({ s: $("#ts" + i).value, b: $("#tb" + i).value })).filter((t) => t.s !== "");
    const body = {
      inizio: $("#t-inizio").value, fine: $("#t-fine").value, consegna_da: $("#t-cda").value, consegna_a: $("#t-ca").value,
      marchio: $("#t-marchio").value, titolo: $("#t-titolo").value, sottotitolo: $("#t-sotto").value, intro: $("#t-intro").value,
      come_funziona: $("#t-come").value, regolamento: $("#t-reg").value, tappe,
      donazioni_fino: $("#t-dfino").value, aiutanti_intro: $("#t-aiut").value,
      tetto: Number($("#t-tetto").value), biglietti_sfida: Number($("#t-big").value), biscotti_partecipazione: Number($("#t-bisc").value),
    };
    try { await putJson("/api/admin/edizione", body); toast("Testi e date salvati"); await carica(); }
    catch (err) { toast(err.message); }
  }
});

window.addEventListener("beforeunload", (e) => { const m = $("#ed-mod"); if (m && !m.hidden) { e.preventDefault(); e.returnValue = ""; } });

$("#sim-data").addEventListener("change", (e) => { setSim(e.target.value); carica(); });
$("#sim-reset").addEventListener("click", () => { setSim(""); carica(); });

/* ---------- avvio ---------- */
(async () => {
  const q = new URLSearchParams(location.search);
  if (q.get("accesso")) { toast(ACCESSO[q.get("accesso")] || "Accesso non riuscito"); history.replaceState(null, "", location.pathname + location.hash); }
  leggiHash();
  try { await carica(); }
  catch (e) { $("#vista").innerHTML = `<div class="avviso"><p>${esc(e.message)}</p></div>`; }
})();

/* ---------- neve ---------- */
const cv = $("#neve"), cx = cv.getContext("2d"); let W, H, fl = [];
function size() {
  const r = cv.getBoundingClientRect(); W = cv.width = r.width * devicePixelRatio; H = cv.height = r.height * devicePixelRatio;
  fl = Array.from({ length: Math.round(r.width / 9) }, () => ({ x: Math.random() * W, y: Math.random() * H, r: (Math.random() * 1.8 + 0.6) * devicePixelRatio, v: (Math.random() * 0.5 + 0.25) * devicePixelRatio, o: Math.random() * Math.PI * 2 }));
}
function disegna(mov) {
  cx.clearRect(0, 0, W, H); cx.fillStyle = "rgba(234,242,247,.75)";
  fl.forEach((f) => { if (mov) { f.y += f.v; f.o += 0.01; f.x += Math.sin(f.o) * 0.3; if (f.y > H) { f.y = -4; f.x = Math.random() * W; } } cx.beginPath(); cx.arc(f.x, f.y, f.r, 0, 7); cx.fill(); });
}
size();
try { new ResizeObserver(() => { size(); disegna(false); }).observe(cv); } catch { addEventListener("resize", () => { size(); disegna(false); }); }
disegna(false);
if (!matchMedia("(prefers-reduced-motion: reduce)").matches) (function loop() { disegna(true); requestAnimationFrame(loop); })();

/* ---------- aiutanti del postino ---------- */
const STATO_DONO = { offerta: ["warn", "Da consegnare"], ricevuta: ["ok", "Ricevuta"], rifiutata: ["err", "Non accettata"] };
const dataOra = (ms) => primo(new Date(ms).toLocaleDateString("it-IT", { day: "numeric", month: "short" }));

function campiDono(pref) {
  const cat = S.categorie || ["GIL", "Minion", "Mount", "Orchestrion roll", "Dye", "Glamour", "Fashion Accessories", "Emoticon"];
  return `<div class="campo"><label for="${pref}-cat">Categoria</label><select id="${pref}-cat" data-cat="${pref}"><option value="">Scegli…</option>${cat.map((c) => `<option>${c}</option>`).join("")}</select></div>
    <div class="due" id="${pref}-ogg">
      <div class="campo"><label for="${pref}-desc">Nome dell'oggetto</label><input type="text" id="${pref}-desc" maxlength="100" placeholder="Es. Fat Black Chocobo"></div>
      <div class="campo"><label for="${pref}-qta">Quantità</label><input type="number" id="${pref}-qta" min="1" max="999" value="1"><span class="aiuto">Quante copie: ognuna può andare a un vincitore diverso.</span></div>
    </div>
    <div class="campo" id="${pref}-gil" hidden><label for="${pref}-gilv">Quanti GIL in tutto</label><input type="number" id="${pref}-gilv" min="1" step="1" placeholder="Es. 5000000"><span class="aiuto">Lo staff potrà dividerli tra più vincitori.</span></div>`;
}
function leggiDono(pref) {
  const categoria = $(`#${pref}-cat`).value;
  return { categoria, descrizione: $(`#${pref}-desc`).value, quantita: Number($(`#${pref}-qta`).value || 1), gil: Number($(`#${pref}-gilv`).value || 0) };
}

async function vAiutanti() {
  const v = $("#vista");
  let a;
  try { a = await api(conSim("/api/aiutanti")); } catch (e) { v.innerHTML = `<div class="avviso"><p>${esc(e.message)}</p></div>`; return; }
  if (S.vista !== "aiutanti") return;
  S.categorie = a.categorie;
  const u = S.dati.utente;
  let modulo;
  if (!a.aperte) modulo = `<section class="pannello"><h3>Offerte chiuse</h3><p class="sub">Le offerte per questa edizione si sono chiuse il ${dataLunga(a.fino)}. Grazie a tutti gli aiutanti!</p></section>`;
  else if (!u) modulo = `<section class="pannello"><h3>Offri un premio</h3><p class="sub">Accedi con il tuo account Discord del server Our Elysion per registrare la tua offerta.</p><a class="btn-discord" href="/api/auth/login">Entra con Discord</a></section>`;
  else modulo = `<section class="pannello"><h3>Offri un premio</h3><p class="sub">Puoi registrare più offerte. Scadenza: ${dataLunga(a.fino)}.</p>
    <form id="form-dono">${campiDono("d")}
      <fieldset style="border:0;padding:0;margin:0 0 14px"><legend class="label" style="margin-bottom:8px">Sotto il premio, a dicembre</legend>
        <label class="scelta" for="d-nome"><input type="radio" name="d-anon" id="d-nome" value="0" checked> Mostra il mio nome: <b>${esc(u.nome)}</b></label>
        <label class="scelta" for="d-anon"><input type="radio" name="d-anon" id="d-anon" value="1"> Resta anonimo</label>
        <span class="aiuto">Lo staff vede comunque chi ha donato cosa.</span></fieldset>
      <div class="campo"><label for="d-nota">Nota per lo staff (facoltativa)</label><input type="text" id="d-nota" maxlength="300" placeholder="Es. quando sei online per la consegna"></div>
      <button class="btn" type="submit">Registra l'offerta</button>
    </form></section>`;
  const mie = u && a.mie.length ? `<section class="pannello"><h3>Le tue offerte</h3><div class="doni">${a.mie.map((d) => {
    const [c, t] = STATO_DONO[d.stato];
    return `<div class="dono"><div class="dono-t"><b>${esc(d.etichetta)}</b><span class="fila">${pill(c, t)}${d.anonimo ? pill("", "Anonimo") : ""}</span></div>
      <div class="fila"><button class="btn quieto piccolo" data-act="mio-anon" data-id="${d.id}" data-v="${d.anonimo ? 0 : 1}">${d.anonimo ? "Mostra il mio nome" : "Rendi anonimo"}</button>
      ${d.stato === "offerta" ? `<button class="btn quieto piccolo" data-act="mio-ritira" data-id="${d.id}">Ritira</button>` : ""}</div></div>`;
  }).join("")}</div>
    ${a.mie.some((d) => d.stato === "offerta") ? `<p class="aiuto" style="margin-top:10px">"Da consegnare": consegna il dono in gioco a uno degli admin. Quando lo riceviamo diventa "Ricevuta".</p>` : ""}</section>` : "";
  const grazie = `<section class="pannello"><h3>Grazie a</h3>${a.aiutanti.length || a.anonimi ? `<ul class="grazie">${a.aiutanti.map((n) => `<li>${SEGNO()}${esc(n)}</li>`).join("")}</ul>${a.anonimi ? `<p class="aiuto" style="margin-top:8px">e ${a.anonimi === 1 ? "un aiutante anonimo" : a.anonimi + " aiutanti anonimi"}</p>` : ""}` : `<p class="sub">Ancora nessun dono ricevuto. Il primo nome potrebbe essere il tuo!</p>`}</section>`;
  v.innerHTML = `<div class="pagina-h"><span class="label">Edizione ${S.dati.edizione.anno}</span><h2>Gli aiutanti del postino</h2>
    ${paragrafi(a.intro).map((p) => `<p>${esc(p)}</p>`).join("")}</div>
    <div class="sotto" style="margin-top:0"><div style="display:grid;gap:24px">${modulo}${mie}</div>${grazie}</div>`;
}

async function riempiPremi() {
  const corpo = $("#staff-corpo");
  let a, giorni;
  try { [a, giorni] = await Promise.all([api("/api/admin/donazioni"), api("/api/admin/giorni").then((x) => x.giorni)]); }
  catch (e) { corpo.innerHTML = `<p class="avviso">${esc(e.message)}</p>`; return; }
  S.adminDoni = a; S.adminGiorni = giorni; S.categorie = a.categorie;
  const f = S.filtroDoni || "tutte";
  const conta = (st) => a.donazioni.filter((d) => d.stato === st).length;
  const conPremio = new Set(a.donazioni.flatMap((d) => d.assegnazioni.map((x) => x.giorno)));
  const posti = a.donazioni.reduce((s, d) => s + d.assegnazioni.reduce((t, x) => t + x.vincitori, 0), 0);
  const lista = a.donazioni.filter((d) => f === "tutte" || d.stato === f || (f === "libere" && d.stato === "ricevuta" && d.usati < d.totale));
  const filtri = [["tutte", "Tutte", a.donazioni.length], ["offerta", "Da ricevere", conta("offerta")], ["libere", "Ricevute da assegnare", a.donazioni.filter((d) => d.stato === "ricevuta" && d.usati < d.totale).length], ["rifiutata", "Non accettate", conta("rifiutata")]];
  corpo.innerHTML = `<h2>Premi e aiutanti</h2><p class="intro">Le offerte della community e i premi dello staff. Offerte aperte fino al ${dataLunga(a.fino)}${a.aperte ? "" : " (chiuse)"}.</p>
  <div class="stats">
    <div class="stat"><b>${conta("offerta")}</b><span>Da ricevere in gioco</span></div>
    <div class="stat"><b>${conta("ricevuta")}</b><span>Ricevute</span></div>
    <div class="stat"><b>${conPremio.size}/${giorni.length}</b><span>Giorni con premi</span></div>
    <div class="stat"><b>${posti}</b><span>Vincitori previsti in tutto</span></div>
  </div>
  <div class="fila filtri" role="group" aria-label="Filtra">${filtri.map(([k, t, n]) => `<button class="btn ${f === k ? "" : "sec"} piccolo" data-act="filtro-doni" data-f="${k}">${t} · ${n}</button>`).join("")}</div>
  <div class="doni" style="margin-top:14px">${lista.length ? lista.map((d) => cardDono(d, giorni)).join("") : `<p class="prossimamente">Nessun dono in questo elenco.</p>`}</div>
  <details class="pannello" style="margin-top:22px" ${a.donazioni.length ? "" : "open"}><summary><b>Aggiungi un premio dello staff</b> <span class="aiuto">o un dono ricevuto fuori dal sito</span></summary>
    <form id="form-dono-staff" style="margin-top:14px">${campiDono("s")}
      <div class="due"><div class="campo"><label for="s-chi">Donato da</label><select id="s-chi"><option value="">Staff di Our Elysion</option><option value="__nome">Un altro nome…</option>${a.utenti.map((x) => `<option value="${esc(x.id)}">${esc(x.nome)}</option>`).join("")}</select></div>
      <div class="campo" id="s-nome-box" hidden><label for="s-nome">Nome da mostrare</label><input type="text" id="s-nome" maxlength="60"></div></div>
      <label class="scelta" for="s-anon" style="margin-bottom:14px"><input type="checkbox" id="s-anon"> Mostra come anonimo</label>
      <button class="btn" type="submit">Aggiungi come ricevuto</button>
    </form></details>`;
}

function cardDono(d, giorni) {
  const [c, t] = STATO_DONO[d.stato];
  const chi = d.user_id ? `${esc(d.u_nome || "?")} <span class="aiuto">@${esc(d.u_username || "")}${d.u_pg ? " · " + esc(d.u_pg) + (d.u_mondo ? " (" + esc(d.u_mondo) + ")" : "") : ""}</span>` : esc(d.donatore_nome || "Staff di Our Elysion");
  const gil = d.tipo === "gil";
  const resto = d.totale - d.usati;
  const fmt = (x) => gil ? Number(x).toLocaleString("it-IT") + " GIL" : x + (x === 1 ? " copia" : " copie");
  const ric = d.stato === "ricevuta";
  return `<div class="dono">
    <div class="dono-t"><b>${esc(d.etichetta)}</b><span class="fila">${pill(c, t)}${d.anonimo ? pill("", "Anonimo") : ""}</span></div>
    <p class="dono-chi">Da ${chi}</p>
    <p class="aiuto">Sul sito: "${esc(d.pubblico)}" · registrata il ${dataOra(d.created_at)}${d.gestita_da ? " · ultima modifica: " + esc(d.gestita_da) : ""}</p>
    ${d.nota ? `<p class="dono-nota">“${esc(d.nota)}”</p>` : ""}
    <div class="fila"><label class="aiuto" for="cat-${d.id}">Categoria</label><select id="cat-${d.id}" data-act-change="categoria" data-id="${d.id}">${d.categoria ? "" : `<option value="">Da scegliere</option>`}${(S.categorie || []).map((k) => `<option ${d.categoria === k ? "selected" : ""}>${k}</option>`).join("")}</select></div>
    ${ric ? `<details class="dono-extra"><summary>Immagine e descrizione per dopo l'estrazione</summary>
      <div class="dono-media">
        <div class="dono-img">${d.img_ver ? `<img src="/api/img/premio/${d.id}?v=${d.img_ver}" alt="">` : `<span class="aiuto">Nessuna immagine</span>`}</div>
        <div style="display:grid;gap:8px;min-width:0">
          <label class="aiuto" for="img-${d.id}">${d.img_ver ? "Sostituisci l'immagine" : "Carica un'immagine"}</label><input type="file" id="img-${d.id}" accept="image/*" data-act-change="img-premio" data-id="${d.id}">
          ${d.img_ver ? `<button type="button" class="btn quieto piccolo" data-act="togli-img-premio" data-id="${d.id}" style="justify-self:start">Togli l'immagine</button>` : ""}
          <label class="aiuto" for="det-${d.id}">Descrizione</label><textarea id="det-${d.id}" maxlength="600" style="min-height:80px" placeholder="Es. La mount più veloce di Eorzea…">${esc(d.dettagli || "")}</textarea>
          <button type="button" class="btn sec piccolo" data-act="salva-dettagli" data-id="${d.id}" style="justify-self:start">Salva la descrizione</button>
        </div></div></details>
    <div class="assegna">
      <span class="label">Nei giorni · assegnato ${fmt(d.usati)} su ${fmt(d.totale)}</span>
      ${d.assegnazioni.length ? `<ul class="ass-lista">${d.assegnazioni.map((x) => `<li><b>Giorno ${x.giorno}</b> · ${x.vincitori} ${x.vincitori === 1 ? "vincitore" : "vincitori"} · ${esc(x.etichetta)} a testa ${x.estratto ? pill("ok", "Estratto") : `<button class="btn quieto piccolo" data-act="togli-assegnazione" data-id="${x.id}">Togli</button>`}</li>`).join("")}</ul>` : ""}
      ${resto > 0 ? `<form class="form-assegna" data-id="${d.id}">
        <div class="campo"><label for="ag-${d.id}">Giorno</label><select id="ag-${d.id}">${giorni.map((g) => `<option value="${g.n}">${g.n} · ${GG[g.wd]} ${dataBreve(g.data)}${g.tipo === "sfida" ? " · sfida" : ""}</option>`).join("")}</select></div>
        <div class="campo"><label for="av-${d.id}">Vincitori</label><input type="number" id="av-${d.id}" min="1" max="50" value="1"></div>
        <div class="campo"><label for="at-${d.id}">${gil ? "GIL a testa" : "Copie a testa"}</label><input type="number" id="at-${d.id}" min="1" value="${gil ? Math.min(resto, 1000000) : 1}"></div>
        <button class="btn piccolo" type="submit">Assegna</button>
      </form><p class="aiuto">Da assegnare: ${fmt(resto)}.</p>` : `<p class="aiuto">Tutto assegnato.</p>`}
    </div>` : ""}
    <div class="fila">${d.stato === "offerta" ? `<button class="btn piccolo" data-act="dono-stato" data-id="${d.id}" data-s="ricevuta">Ricevuto</button><button class="btn quieto piccolo" data-act="dono-stato" data-id="${d.id}" data-s="rifiutata">Non accettare</button>` : ""}
      ${ric && !d.assegnazioni.length ? `<button class="btn quieto piccolo" data-act="dono-stato" data-id="${d.id}" data-s="offerta">Annulla "ricevuto"</button>` : ""}
      ${d.stato === "rifiutata" ? `<button class="btn quieto piccolo" data-act="dono-stato" data-id="${d.id}" data-s="offerta">Riapri</button>` : ""}
      <button class="btn quieto piccolo" data-act="dono-anon" data-id="${d.id}" data-v="${d.anonimo ? 0 : 1}">${d.anonimo ? "Mostra il nome" : "Rendi anonimo"}</button>
      <button class="btn quieto piccolo pericolo-testo" data-act="dono-elimina" data-id="${d.id}">Elimina</button></div>
  </div>`;
}

document.addEventListener("change", async (e) => {
  const t = e.target;
  if (t.dataset.cat) { const pf = t.dataset.cat, gil = t.value === "GIL"; $(`#${pf}-ogg`).hidden = gil; $(`#${pf}-gil`).hidden = !gil; }
  if (t.id === "s-chi") $("#s-nome-box").hidden = t.value !== "__nome";
  if (t.dataset.actChange === "categoria") {
    try { await putJson(`/api/admin/donazione/${t.dataset.id}`, { categoria: t.value }); toast("Categoria aggiornata"); riempiPremi(); }
    catch (err) { toast(err.message); }
  }
  if (t.dataset.actChange === "img-premio" && t.files[0]) {
    const url = URL.createObjectURL(t.files[0]);
    try {
      const img = await caricaImmagine(url);
      const w = Math.min(800, img.naturalWidth), h = Math.round(img.naturalHeight * (w / img.naturalWidth));
      const c = document.createElement("canvas"); c.width = w; c.height = h; c.getContext("2d").drawImage(img, 0, 0, w, h);
      const fd = new FormData(); fd.append("img", await toBlob(c, 0.82), "img");
      await api(`/api/admin/donazione/${t.dataset.id}/immagine`, { method: "PUT", body: fd });
      toast("Immagine del premio caricata"); riempiPremi();
    } catch (err) { toast(err.message || "Non riesco a leggere questa immagine"); }
    finally { URL.revokeObjectURL(url); }
  }
});

document.addEventListener("click", async (e) => {
  const a = e.target.closest("[data-act]");
  if (!a) return;
  const act = a.dataset.act, id = a.dataset.id;
  try {
    if (act === "filtro-doni") { S.filtroDoni = a.dataset.f; riempiPremi(); }
    if (act === "togli-assegnazione") { await api(`/api/admin/assegnazione/${id}`, { method: "DELETE" }); toast("Tolto dal giorno"); riempiPremi(); }
    if (act === "salva-dettagli") { await putJson(`/api/admin/donazione/${id}`, { dettagli: $(`#det-${id}`).value }); toast("Descrizione salvata"); }
    if (act === "togli-img-premio") { await api(`/api/admin/donazione/${id}/immagine`, { method: "DELETE" }); riempiPremi(); }
    if (act === "partecipa") {
      a.disabled = true;
      const r = await api(`/api/partecipa/${a.dataset.n}`, { method: "POST" });
      toast("Sei in gara! Hai ritrovato una lettera"); S.dati.lettere = r.lettere; await carica();
    }
    if (act === "vai-azione") { $("#azione")?.scrollIntoView({ behavior: "smooth", block: "start" }); }
    if (act === "estrai" || act === "ripeti-estrazione") {
      if (act === "ripeti-estrazione" && a.dataset.conferma !== "1") { a.dataset.conferma = "1"; a.textContent = "Conferma: cancella i vincitori e riestrai"; a.classList.add("conferma"); return; }
      a.disabled = true;
      const r = await api(`/api/admin/estrazione/${a.dataset.n}${act === "ripeti-estrazione" ? "/ripeti" : ""}`, { method: "POST" });
      toast(`Estrazione fatta: ${r.vincitori} vincitori su ${r.partecipanti} partecipanti`); riempiEstrazioni();
    }
    if (act === "dono-stato") { await putJson(`/api/admin/donazione/${id}`, { stato: a.dataset.s }); toast(a.dataset.s === "ricevuta" ? "Segnato come ricevuto" : "Stato aggiornato"); riempiPremi(); }
    if (act === "dono-anon") { await putJson(`/api/admin/donazione/${id}`, { anonimo: a.dataset.v === "1" }); riempiPremi(); }
    if (act === "dono-elimina") {
      if (a.dataset.conferma !== "1") { a.dataset.conferma = "1"; a.textContent = "Conferma eliminazione"; a.classList.add("conferma"); return; }
      await api(`/api/admin/donazione/${id}`, { method: "DELETE" }); toast("Dono eliminato"); riempiPremi();
    }
    if (act === "mio-anon") { await putJson(`/api/donazioni/${id}`, { anonimo: a.dataset.v === "1" }); vAiutanti(); }
    if (act === "mio-ritira") {
      if (a.dataset.conferma !== "1") { a.dataset.conferma = "1"; a.textContent = "Conferma: ritira l'offerta"; return; }
      await api(`/api/donazioni/${id}`, { method: "DELETE" }); toast("Offerta ritirata"); vAiutanti();
    }
  } catch (err) { toast(err.message); }
});

document.addEventListener("submit", async (e) => {
  const f = e.target;
  if (f.id === "form-dono") {
    e.preventDefault();
    const body = { ...leggiDono("d"), anonimo: document.querySelector("input[name=d-anon]:checked")?.value === "1", nota: $("#d-nota").value };
    try { await api("/api/donazioni", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); toast("Offerta registrata. Grazie!"); vAiutanti(); }
    catch (err) { toast(err.message); }
  }
  if (f.id === "form-dono-staff") {
    e.preventDefault();
    const chi = $("#s-chi").value;
    const body = { ...leggiDono("s"), anonimo: $("#s-anon").checked, user_id: chi && chi !== "__nome" ? chi : null, donatore_nome: chi === "__nome" ? $("#s-nome").value : null };
    try { await api("/api/admin/donazioni", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); toast("Premio aggiunto al montepremi"); riempiPremi(); }
    catch (err) { toast(err.message); }
  }
});

/* ---------- albo, il mio dicembre, estrazioni ---------- */
async function vAlbo() {
  const v = $("#vista");
  let a;
  try { a = await api("/api/albo" + (S.alboAnno ? `?anno=${S.alboAnno}` : "")); } catch (e) { v.innerHTML = `<div class="avviso"><p>${esc(e.message)}</p></div>`; return; }
  if (S.vista !== "albo") return;
  const corrente = a.anno === S.dati.edizione.anno;
  v.innerHTML = `<div class="pagina-h"><span class="label">Edizione ${a.anno}</span><h2>Albo dei vincitori</h2>
    <p>Ogni notte a mezzanotte il sito estrae i vincitori del giorno, dando la precedenza a chi ha vinto meno premi finora.</p>
    ${a.anni.length > 1 ? `<div class="fila filtri" role="group" aria-label="Edizione">${a.anni.map((y) => `<button class="btn ${y === a.anno ? "" : "sec"} piccolo" data-act="albo-anno" data-anno="${y}">${y}</button>`).join("")}</div>` : ""}</div>
  ${a.giorni.length ? `<div class="albo">${a.giorni.slice().reverse().map((g) => `<section class="albo-giorno"><h3>${corrente ? `<a href="#casella-${g.n}">Giorno ${g.n}</a>` : `Giorno ${g.n}`} <span class="aiuto">${g.data ? dataLunga(g.data) : ""}</span></h3>
      <div class="premi">${g.premi.map(cardPremio).join("") || `<p class="sub">Nessun premio.</p>`}</div></section>`).join("")}</div>`
    : `<div class="pannello"><p>Nessuna estrazione ancora. I primi nomi compariranno nella notte dopo la prima busta.</p></div>`}`;
}

async function mioDicembre() {
  const box = $("#mio-dicembre");
  if (!box || !connesso()) return;
  let m;
  try { m = await api("/api/mio"); } catch { return; }
  if (!$("#mio-dicembre")) return;
  const d = S.dati, ed = d.edizione;
  const giorniVinti = new Set(m.vincite.map((v) => v.giorno));
  const consolazione = m.partecipazioni.filter((n) => !giorniVinti.has(n)).length * (ed.biscotti_partecipazione || 0);
  const bonus = m.partecipazioni.length ? ed.tappe.filter((t) => d.lettere >= t.s).reduce((s, t) => s + t.b, 0) : 0;
  const tot = (d.giorni.length || 25);
  box.innerHTML = `<div class="sotto" style="margin-top:0">
    <section class="pannello"><h3>Il tuo dicembre</h3>
      <p class="sub"><span class="num">${m.partecipazioni.length}</span> ${m.partecipazioni.length === 1 ? "partecipazione" : "partecipazioni"} · <span class="num">${consolazione + bonus}</span> Biscotti di Tullio maturati${bonus ? ` (di cui ${bonus} dai traguardi)` : ""}</p>
      <div class="chips" aria-label="Giorni a cui hai partecipato">${Array.from({ length: tot }, (_, i) => i + 1).map((n) => `<span class="chip ${giorniVinti.has(n) ? "vinto" : m.partecipazioni.includes(n) ? "si" : ""}" title="${n} dicembre">${n}</span>`).join("")}</div>
      <div class="legenda" style="margin-top:10px"><span><i class="dot" style="background:var(--primary)"></i>Partecipato</span><span><i class="dot" style="background:var(--accent)"></i>Vinto</span></div>
      <p class="aiuto" style="margin-top:10px">I Biscotti vengono accreditati tutti insieme a gennaio.</p>
    </section>
    <section class="pannello"><h3>Premi vinti</h3>
      ${m.vincite.length ? `<ul class="vinti">${m.vincite.map((v) => `<li><span class="vg"><b class="num">${v.giorno}</b><span>dic</span></span><span class="vt"><b>${esc(v.etichetta)}</b><span>${esc(v.categoria)} · consegna a ${esc(d.utente.pg || "il tuo personaggio")}${d.utente.mondo ? " · " + esc(d.utente.mondo) : ""}</span>${v.consegnato ? pill("ok", "Consegnato") : v.non_ritirato ? pill("err", "Non ritirato") : pill("warn", `Da consegnare dal ${dataLunga(ed.consegna_da)} al ${dataLunga(ed.consegna_a)}`)}</span></li>`).join("")}</ul>`
        : `<p class="sub">Ancora niente. Le buste da aprire sono tante.</p>`}
    </section></div>`;
}

async function riempiEstrazioni() {
  const corpo = $("#staff-corpo");
  let a;
  try { a = await api(conSim("/api/admin/estrazioni")); } catch (e) { corpo.innerHTML = `<p class="avviso">${esc(e.message)}</p>`; return; }
  const STATI_E = { estratta: ["ok", "Estratta"], da_estrarre: ["warn", "Da estrarre"], in_corso: ["acc", "Aperta oggi"], futura: ["", "In arrivo"] };
  corpo.innerHTML = `<h2>Estrazioni</h2><p class="intro">Il sito estrae da solo ogni notte a mezzanotte. Qui vedete come è andata, e potete ripetere un'estrazione se serve (per esempio se un vincitore rinuncia prima della consegna).</p>
  ${a.classifica.length ? `<details class="pannello" style="margin-bottom:16px"><summary><b>Premi vinti per persona</b> <span class="aiuto">tetto: ${a.tetto}</span></summary>
    <ul class="grazie" style="margin-top:12px">${a.classifica.map((c) => `<li>${esc(c.nome)} · ${c.vinti}</li>`).join("")}</ul></details>` : ""}
  <div class="doni">${a.giorni.map((g) => {
    const [c, t] = STATI_E[g.stato];
    return `<div class="dono">
      <div class="dono-t"><b>Giorno ${g.n} <span class="aiuto">${GG[new Date(g.data + "T12:00:00Z").getUTCDay()]} ${dataBreve(g.data)}</span></b><span class="fila">${pill(c, t)}</span></div>
      <p class="aiuto">${g.partecipanti} ${g.partecipanti === 1 ? "partecipante" : "partecipanti"} · ${g.posti} ${g.posti === 1 ? "premio" : "premi"} in palio${g.eseguita_at ? ` · estratta il ${new Date(g.eseguita_at).toLocaleString("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} (${esc(g.eseguita_da)})` : ""}</p>
      ${g.premi.length ? `<ul class="ass-lista vinc-staff">${g.premi.map((p) => `<li><b>${esc(p.etichetta)}</b>
        ${p.vincitori.length ? `<ul>${p.vincitori.map((v) => `<li><span>${esc(v.nome)}</span>${v.consegnato === 1 ? pill("ok", "Consegnato") : `<button class="btn quieto piccolo" data-act="riestrai-uno" data-id="${v.vincita}" data-nome="${esc(v.nome)}">Rinuncia: riestrai</button>`}</li>`).join("")}</ul>` : " → <i>nessun vincitore</i>"}</li>`).join("")}</ul>` : ""}
      ${g.log.some((l) => l.startsWith("Rinuncia")) ? `<p class="aiuto">${g.log.filter((l) => l.startsWith("Rinuncia")).map(esc).join("<br>")}</p>` : ""}
      ${g.log.some((l) => l.startsWith("Nessun")) ? `<p class="aiuto" style="color:var(--warn)">${g.log.filter((l) => l.startsWith("Nessun")).map(esc).join("<br>")}</p>` : ""}
      <div class="fila">${g.stato === "da_estrarre" ? `<button class="btn piccolo" data-act="estrai" data-n="${g.n}">Estrai ora</button>` : ""}
        ${g.stato === "estratta" ? `<button class="btn quieto piccolo pericolo-testo" data-act="ripeti-estrazione" data-n="${g.n}">Ripeti tutta l'estrazione del giorno</button>` : ""}</div>
    </div>`;
  }).join("")}</div>`;
}

document.addEventListener("submit", async (e) => {
  const f = e.target;
  if (f.id === "form-sfida") {
    e.preventDefault();
    const r = f.querySelector("input[name=r]:checked");
    if (!r) { toast("Scegli una risposta"); return; }
    try {
      const res = await api(`/api/partecipa/${f.dataset.n}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ risposta: Number(r.value) }) });
      toast("Risposta registrata! Hai ritrovato una lettera"); S.dati.lettere = res.lettere; await carica();
    } catch (err) { toast(err.message); }
  }
  if (f.classList.contains("form-assegna")) {
    e.preventDefault();
    const id = f.dataset.id;
    const body = { giorno: Number($(`#ag-${id}`).value), vincitori: Number($(`#av-${id}`).value), a_testa: Number($(`#at-${id}`).value) };
    try { await api(`/api/admin/donazione/${id}/assegna`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); toast(`Assegnato al giorno ${body.giorno}`); riempiPremi(); }
    catch (err) { toast(err.message); }
  }
});

/* ---------- Biscotti per Mee6 ---------- */
async function riempiBiscotti() {
  const corpo = $("#staff-corpo");
  let a;
  try { a = await api("/api/admin/estrazioni/biscotti"); } catch (e) { corpo.innerHTML = `<p class="avviso">${esc(e.message)}</p>`; return; }
  S.biscotti = a;
  const tot = a.lista.reduce((s, x) => s + x.totale, 0), fatti = a.lista.filter((x) => x.fatto).length;
  corpo.innerHTML = `<h2>Biscotti per Mee6</h2>
  <p class="intro">Quanti Biscotti di Tullio accreditare a ciascuno: ${a.per_partecipazione} per ogni giorno giocato senza vincere${a.bonus ? `, più ${a.bonus} dai traguardi raggiunti (${a.lettere} lettere)` : ""}. Spunta chi hai già sistemato su Discord.</p>
  <div class="stats">
    <div class="stat"><b>${a.lista.length}</b><span>Persone</span></div>
    <div class="stat"><b>${tot.toLocaleString("it-IT")}</b><span>Biscotti in tutto</span></div>
    <div class="stat"><b>${fatti}/${a.lista.length}</b><span>Già accreditati</span></div>
  </div>
  ${a.lista.length ? `<div class="fila" style="margin-bottom:12px"><button class="btn sec piccolo" data-act="copia-biscotti">Copia la lista</button></div>
  <ul class="lista-biscotti">${a.lista.map((x) => `<li class="${x.fatto ? "fatto" : ""}">
    <label for="bf-${x.id}"><input type="checkbox" id="bf-${x.id}" data-biscotti="${x.id}" ${x.fatto ? "checked" : ""}>
      <span class="lb-nome"><b>${esc(x.nome)}</b> <span class="aiuto">@${esc(x.username)}</span></span></label>
    <span class="lb-tot num">${x.totale.toLocaleString("it-IT")}</span></li>`).join("")}</ul>`
  : `<p class="prossimamente">Ancora nessuna partecipazione.</p>`}`;
}

document.addEventListener("change", async (e) => {
  const id = e.target.dataset?.biscotti;
  if (!id) return;
  try { await putJson(`/api/admin/estrazioni/biscotti/${id}`, { fatto: e.target.checked }); e.target.closest("li").classList.toggle("fatto", e.target.checked); }
  catch (err) { toast(err.message); e.target.checked = !e.target.checked; }
});

document.addEventListener("click", async (e) => {
  if (!e.target.closest('[data-act="copia-biscotti"]')) return;
  const testo = S.biscotti.lista.map((x) => `${x.nome} (@${x.username}): ${x.totale}`).join("\n");
  try { await navigator.clipboard.writeText(testo); toast("Lista copiata"); }
  catch { toast("Non riesco a copiare: seleziona la lista a mano"); }
});

/* ---------- Consegne di gennaio ---------- */
async function riempiConsegne() {
  const corpo = $("#staff-corpo");
  let a;
  try { a = await api("/api/admin/estrazioni/consegne"); } catch (e) { corpo.innerHTML = `<p class="avviso">${esc(e.message)}</p>`; return; }
  S.consegne = a;
  disegnaConsegne();
}

function disegnaConsegne() {
  const corpo = $("#staff-corpo"), a = S.consegne;
  const f = S.filtroConsegne || "da";
  const q = (S.cercaConsegne || "").toLowerCase();
  const tutte = a.vincite;
  const n = (st) => tutte.filter((v) => v.consegnato === st).length;
  // raggruppa per data center → mondo → persona
  const persone = new Map();
  for (const v of tutte) {
    if (f === "da" && v.consegnato !== 0) continue;
    if (f === "fatte" && v.consegnato === 0) continue;
    if (q && ![v.nome, v.username, v.pg].some((x) => (x || "").toLowerCase().includes(q))) continue;
    if (!persone.has(v.user_id)) persone.set(v.user_id, { ...v, vincite: [] });
    persone.get(v.user_id).vincite.push(v);
  }
  const gruppi = new Map();
  for (const p of persone.values()) {
    const k = `${p.dc || "Senza data center"}|${p.mondo || "Mondo non indicato"}`;
    if (!gruppi.has(k)) gruppi.set(k, []);
    gruppi.get(k).push(p);
  }
  const filtri = [["da", "Da consegnare", n(0)], ["fatte", "Consegnate o chiuse", n(1) + n(2)], ["tutte", "Tutte", tutte.length]];
  corpo.innerHTML = `<h2>Consegne</h2>
  <p class="intro">I premi da consegnare in gioco dal ${dataLunga(a.consegna_da)} al ${dataLunga(a.consegna_a)}, raggruppati per data center e mondo così vi spostate il meno possibile. Ogni persona riceve tutti i suoi premi in un'unica consegna.</p>
  <div class="stats">
    <div class="stat"><b>${n(1)}/${tutte.length}</b><span>Premi consegnati</span></div>
    <div class="stat"><b>${n(0)}</b><span>Da consegnare</span></div>
    <div class="stat"><b>${n(2)}</b><span>Non ritirati</span></div>
  </div>
  <div class="fila filtri" role="group" aria-label="Filtra">${filtri.map(([k, t, c]) => `<button class="btn ${f === k ? "" : "sec"} piccolo" data-act="filtro-consegne" data-f="${k}">${t} · ${c}</button>`).join("")}</div>
  <div class="campo" style="max-width:360px;margin-top:12px"><label for="cerca-consegne">Cerca per nome o personaggio</label><input type="text" id="cerca-consegne" value="${esc(S.cercaConsegne || "")}" placeholder="Es. Mimi"></div>
  ${gruppi.size ? [...gruppi.entries()].map(([k, ps]) => {
    const [dc, mondo] = k.split("|");
    return `<section class="gruppo-consegne"><h3>${esc(mondo)} <span class="aiuto">${esc(dc)} · ${ps.length} ${ps.length === 1 ? "persona" : "persone"}</span></h3>
      <div class="doni">${ps.map(cardConsegna).join("")}</div></section>`;
  }).join("") : `<p class="prossimamente">${tutte.length ? "Niente in questo elenco." : "Ancora nessun vincitore."}</p>`}`;
}

function cardConsegna(p) {
  const gil = p.vincite.filter((v) => v.consegnato === 0).reduce((s, v) => s + (v.gil || 0), 0);
  const aperte = p.vincite.filter((v) => v.consegnato === 0);
  return `<div class="dono consegna">
    <div class="dono-t"><b>${esc(p.pg || "Personaggio non indicato")}</b><span class="aiuto">${esc(p.nome)} · @${esc(p.username)}</span></div>
    ${gil ? `<p class="aiuto">GIL da dare in tutto: <b>${gil.toLocaleString("it-IT")}</b></p>` : ""}
    <ul class="consegna-lista">${p.vincite.map((v) => `<li class="${v.consegnato === 1 ? "fatto" : v.consegnato === 2 ? "chiuso" : ""}">
      <label for="cv-${v.id}"><input type="checkbox" id="cv-${v.id}" data-consegna="${v.id}" ${v.consegnato === 1 ? "checked" : ""} ${v.consegnato === 2 ? "disabled" : ""}>
        <span><b>${esc(v.etichetta)}</b> <span class="aiuto">${esc(v.categoria || "")} · giorno ${v.giorno}</span>
        ${v.consegnato === 1 && v.consegnato_da ? `<span class="aiuto"> · consegnato da ${esc(v.consegnato_da)}</span>` : ""}${v.consegnato === 2 ? ` ${pill("err", "Non ritirato")}` : ""}</span></label>
      <span class="fila">${v.consegnato === 2 ? `<button class="btn quieto piccolo" data-act="riapri-consegna" data-id="${v.id}">Riapri</button>` : v.consegnato === 0 ? `<button class="btn quieto piccolo" data-act="non-ritirato" data-id="${v.id}">Non ritirato</button>` : ""}</span>
      <input type="text" class="nota-consegna" id="nc-${v.id}" data-nota="${v.id}" maxlength="200" value="${esc(v.nota || "")}" placeholder="Nota (es. glielo lascio in casa FC)" aria-label="Nota sulla consegna">
    </li>`).join("")}</ul>
    ${aperte.length > 1 ? `<button class="btn piccolo" data-act="consegna-tutto" data-ids="${aperte.map((v) => v.id).join(",")}" style="justify-self:start">Consegnato tutto</button>` : ""}
  </div>`;
}

async function aggiornaVincita(id, body) {
  await putJson(`/api/admin/estrazioni/vincita/${id}`, body);
  const v = S.consegne.vincite.find((x) => x.id === Number(id));
  if (v) Object.assign(v, body);
}

document.addEventListener("change", async (e) => {
  const t = e.target;
  try {
    if (t.dataset?.consegna) { await aggiornaVincita(t.dataset.consegna, { consegnato: t.checked ? 1 : 0 }); toast(t.checked ? "Segnato come consegnato" : "Tolto il segno"); riempiConsegne(); }
    if (t.dataset?.nota) { await aggiornaVincita(t.dataset.nota, { nota: t.value }); toast("Nota salvata"); }
  } catch (err) { toast(err.message); }
});
document.addEventListener("input", (e) => {
  if (e.target.id !== "cerca-consegne") return;
  S.cercaConsegne = e.target.value;
  const pos = e.target.selectionStart;
  disegnaConsegne();
  const el = $("#cerca-consegne"); el.focus(); el.setSelectionRange(pos, pos);
});
document.addEventListener("click", async (e) => {
  const a = e.target.closest("[data-act]");
  if (!a) return;
  try {
    if (a.dataset.act === "filtro-consegne") { S.filtroConsegne = a.dataset.f; disegnaConsegne(); }
    if (a.dataset.act === "non-ritirato") { await aggiornaVincita(a.dataset.id, { consegnato: 2 }); riempiConsegne(); }
    if (a.dataset.act === "riapri-consegna") { await aggiornaVincita(a.dataset.id, { consegnato: 0 }); riempiConsegne(); }
    if (a.dataset.act === "consegna-tutto") {
      for (const id of a.dataset.ids.split(",")) await aggiornaVincita(id, { consegnato: 1 });
      toast("Tutti i premi segnati come consegnati"); riempiConsegne();
    }
  } catch (err) { toast(err.message); }
});

/* ---------- messaggi per Tullio ---------- */
async function boxMessaggi() {
  let a;
  try { a = await api(conSim("/api/messaggi")); } catch { return; }
  const box = $("#box-messaggi");
  if (!box) return;
  const u = S.dati.utente;
  let h = `<h3>Un messaggio per la community</h3>`;
  if (a.pubblicata) {
    const n = a.posta.length;
    box.outerHTML = `<section class="pannello posta-invito" id="box-messaggi"><h3>La posta di Tullio</h3>
      ${n ? `<p class="sub">Tullio ha appeso all'albero ${n === 1 ? "una lettera" : `${n} lettere`} per tutta la community. Tocca una busta per aprirla.</p>
      <a class="btn" href="#posta">Vai all'albero delle lettere</a>` : `<p class="sub">Quest'anno la sacca di Tullio è rimasta vuota.</p>`}</section>`;
    return;
  }
  h += `<p class="sub">Lascia un messaggio a Tullio: da buon portavoce di Our Elysion, lo consegnerà a tutta la community il ${dataLunga(a.pubblici_dal)}.</p>`;
  if (!a.aperti) h += `<p class="prossimamente">${S.dati.oggi < a.da ? `Potrai scrivere dal ${dataLunga(a.da)}.` : "Tullio ha chiuso la sacca: i messaggi saranno consegnati domani."}</p>`;
  else if (!u) h += `<a class="btn-discord" href="/api/auth/login">Accedi per scrivere</a>`;
  else {
    const st = a.mio ? { attesa: ["warn", "In attesa di approvazione"], ok: ["ok", "Approvato"], no: ["err", "Non approvato: puoi modificarlo"] }[a.mio.stato] : null;
    h += `<form id="form-msg">
      <div class="campo"><label for="msg-tullio">Il tuo messaggio</label>
        <textarea id="msg-tullio" maxlength="500" placeholder="Caro Tullio, porta questo messaggio a tutti…">${esc(a.mio?.testo || "")}</textarea>
        <span class="aiuto" id="msg-cont">${(a.mio?.testo || "").length} / 500 caratteri · modificabile fino al ${dataLunga(a.fino)}</span></div>
      <div class="fila"><button class="btn" type="submit">${a.mio ? "Aggiorna il messaggio" : "Affida il messaggio a Tullio"}</button>${st ? pill(st[0], st[1]) : ""}
      ${a.mio ? `<button type="button" class="btn quieto piccolo" data-act="msg-elimina">Ritira</button>` : ""}</div></form>`;
  }
  box.innerHTML = h;
}

async function riempiMessaggi() {
  const corpo = $("#staff-corpo");
  let a;
  try { a = await api("/api/admin/extra/messaggi"); } catch (e) { corpo.innerHTML = `<p class="avviso">${esc(e.message)}</p>`; return; }
  S.messaggi = a;
  const f = S.filtroMsg || "attesa";
  const n = (st) => a.messaggi.filter((x) => x.stato === st).length;
  const lista = a.messaggi.filter((x) => f === "tutti" || x.stato === f);
  const STM = { attesa: ["warn", "Da approvare"], ok: ["ok", "Approvato"], no: ["err", "Nascosto"] };
  corpo.innerHTML = `<h2>Messaggi per Tullio</h2>
  <p class="intro">I giocatori scrivono dal ${dataLunga(a.da)} al ${dataLunga(a.fino)}; il ${dataLunga(a.pubblici_dal)} i messaggi approvati compaiono a tutti come "La posta di Tullio". Se qualcuno modifica un messaggio, torna da approvare.</p>
  <div class="fila filtri" role="group">${[["attesa", "Da approvare", n("attesa")], ["ok", "Approvati", n("ok")], ["no", "Nascosti", n("no")], ["tutti", "Tutti", a.messaggi.length]].map(([k, t, c]) => `<button class="btn ${f === k ? "" : "sec"} piccolo" data-act="filtro-msg" data-f="${k}">${t} · ${c}</button>`).join("")}
    ${n("ok") ? `<button class="btn quieto piccolo" data-act="copia-msg">Copia gli approvati</button><a class="btn quieto piccolo" href="#posta">Anteprima dell'albero</a>` : ""}</div>
  <div class="doni" style="margin-top:14px">${lista.length ? lista.map((x) => `<div class="dono">
    <div class="dono-t"><b style="font-size:18px">${esc(x.nome)} <span class="aiuto">@${esc(x.username)}</span></b>${pill(...STM[x.stato])}</div>
    <p class="msg-testo">${esc(x.testo)}</p>
    <div class="fila">${x.stato !== "ok" ? `<button class="btn piccolo" data-act="msg-stato" data-id="${x.user_id}" data-s="ok">Approva</button>` : ""}
      ${x.stato !== "no" ? `<button class="btn quieto piccolo" data-act="msg-stato" data-id="${x.user_id}" data-s="no">Nascondi</button>` : ""}
      ${x.moderato_da ? `<span class="aiuto">da ${esc(x.moderato_da)}</span>` : ""}</div></div>`).join("") : `<p class="prossimamente">Nessun messaggio in questo elenco.</p>`}</div>`;
}

/* ---------- albero delle lettere ---------- */
// Sagoma dell'abete in un riquadro 100 × 120: quattro palchi sovrapposti.
const PALCHI = [[10, 38, 17], [24, 60, 28], [42, 80, 38], [60, 99, 47]];
function larghezzaAlbero(y) {
  let w = 0;
  for (const [t, b, hw] of PALCHI) if (y >= t && y <= b) w = Math.max(w, hw * (y - t) / (b - t));
  return w;
}
function semeCasuale(seed) { let x = seed >>> 0 || 1; return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296); }
function hashTesto(t) { let h = 2166136261; for (const c of t) h = Math.imul(h ^ c.codePointAt(0), 16777619); return (h >>> 0).toString(36); }

// Posti per n buste: righe orizzontali dentro la sagoma, il più grandi possibile.
function postiLettere(n) {
  if (!n) return { posti: [], dim: 0 };
  for (let s = 15; s >= 4; s -= 0.25) {
    const righe = [];
    for (let y = 20; y <= 95; y += s * 0.82) {
      const w = larghezzaAlbero(y) - s * 0.55;
      const cap = Math.max(0, Math.floor((2 * w) / s) + 1);
      if (cap > 0 && w > 0) righe.push({ y, w, cap });
    }
    const tot = righe.reduce((a, r) => a + r.cap, 0);
    if (tot < n) continue;
    // distribuisce le buste sulle righe in proporzione allo spazio
    const quote = righe.map((r) => (n * r.cap) / tot);
    const conta = quote.map((q, i) => Math.min(righe[i].cap, Math.floor(q)));
    let resto = n - conta.reduce((a, b) => a + b, 0);
    const ordine = quote.map((q, i) => [q - Math.floor(q), i]).sort((a, b) => b[0] - a[0]);
    for (let k = 0; resto > 0; k = (k + 1) % ordine.length) { const i = ordine[k][1]; if (conta[i] < righe[i].cap) { conta[i]++; resto--; } }
    const rnd = semeCasuale(n * 7919);
    const posti = [];
    righe.forEach((r, i) => {
      const c = conta[i]; if (!c) return;
      for (let j = 0; j < c; j++) {
        const x = c === 1 ? 50 : 50 - r.w + (2 * r.w * j) / (c - 1);
        posti.push({ x: x + (rnd() - 0.5) * s * 0.18, y: r.y + (rnd() - 0.5) * s * 0.16, r: Math.round((rnd() - 0.5) * 18) });
      }
    });
    // mescola i posti così le lettere non seguono l'ordine di arrivo
    for (let i = posti.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [posti[i], posti[j]] = [posti[j], posti[i]]; }
    return { posti, dim: Math.min(s * 0.8, 12) };
  }
  return { posti: [], dim: 0 };
}

function svgAlbero() {
  const rnd = semeCasuale(25);
  const palchi = PALCHI.map(([t, b, hw], i) => {
    // bordo inferiore a festoni
    const k = 4 + i * 2, passo = (2 * hw) / k;
    let d = `M50 ${t} L${50 + hw} ${b}`;
    for (let j = 0; j < k; j++) { const x1 = 50 + hw - passo * j, x2 = x1 - passo; d += ` Q${(x1 + x2) / 2} ${b - 3.2} ${x2} ${b}`; }
    return `<path d="${d} Z" class="palco p${i}"/>`;
  }).join("");
  // ghirlande di lucine
  let luci = "";
  for (const [t, b, hw] of PALCHI) {
    const y0 = t + (b - t) * 0.45, y1 = b - 4;
    for (let j = 0; j <= 8; j++) {
      const f = j / 8, y = y0 + (y1 - y0) * f + Math.sin(f * Math.PI) * 2.5;
      const w = larghezzaAlbero(y) - 1.5;
      const x = 50 - w + 2 * w * f;
      luci += `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${(0.55 + rnd() * 0.35).toFixed(2)}" class="luce l${j % 3}" style="animation-delay:${(rnd() * 3).toFixed(2)}s"/>`;
    }
  }
  let stelle = "";
  for (let i = 0; i < 40; i++) stelle += `<circle cx="${(rnd() * 100).toFixed(1)}" cy="${(rnd() * 70).toFixed(1)}" r="${(0.15 + rnd() * 0.3).toFixed(2)}" class="stellina"/>`;
  return `<svg class="albero-svg" viewBox="0 0 100 120" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
    ${stelle}
    <ellipse cx="50" cy="111" rx="40" ry="5" class="neve"/>
    <rect x="45.5" y="97" width="9" height="12" rx="1" class="tronco"/>
    ${palchi}${luci}
    <path d="M50 2.2l1.9 4.2 4.6.5-3.4 3.1 1 4.5L50 12.2l-4.1 2.3 1-4.5-3.4-3.1 4.6-.5Z" class="puntale"/>
  </svg>`;
}
const SVG_BUSTA = `<svg viewBox="0 0 40 30" aria-hidden="true"><path class="cordino" d="M20 -14V3"/><rect class="carta" x="1" y="3" width="38" height="26" rx="1.5"/><path class="lembo" d="M1.5 4L20 18 38.5 4"/><circle class="ceralacca" cx="20" cy="17" r="3.4"/></svg>`;

function letteLeggi(anno) { try { return new Set(JSON.parse(localStorage.getItem("oe_lette_" + anno) || "[]")); } catch { return new Set(); } }
function letteSalva(anno, set) { try { localStorage.setItem("oe_lette_" + anno, JSON.stringify([...set])); } catch {} }

async function vPosta() {
  const v = $("#vista");
  let a;
  try { a = await api(conSim("/api/messaggi")); } catch (e) { v.innerHTML = `<p class="avviso">${esc(e.message)}</p>`; return; }
  if (S.vista !== "posta") return;
  const anno = S.dati.edizione.anno;
  const staff = S.dati.utente?.ruolo === "admin";
  const indietro = `<a class="indietro" href="#calendario">← Torna al calendario</a>`;
  if (!a.pubblicata && !staff) {
    v.innerHTML = `${indietro}<div class="pannello sigillata-box"><span class="label">La posta di Tullio</span>
      <h2>Tullio sta ancora raccogliendo le lettere</h2><p style="color:var(--muted)">Le appenderà all'albero il ${dataLunga(a.pubblici_dal)}, per tutta la community.</p></div>`;
    return;
  }
  const posta = a.posta;
  S.posta = { anno, posta, chiavi: posta.map((x) => hashTesto(x.nome + "\u0000" + x.testo)), aperta: -1 };
  const lette = letteLeggi(anno);
  const { posti, dim } = postiLettere(posta.length);
  const buste = posta.map((x, i) => {
    const p = posti[i];
    return `<button type="button" class="lettera ${lette.has(S.posta.chiavi[i]) ? "letta" : ""}" data-lettera="${i}"
      style="left:${p.x}%;top:${(p.y / 120) * 100}%;width:${dim}%;--r:${p.r}deg;--c:${i % 4}"
      aria-label="Lettera di ${esc(x.nome)}">${SVG_BUSTA}</button>`;
  }).join("");
  const anteprima = !a.pubblicata ? `<div class="avviso"><span class="stato">Anteprima</span><p><b>Solo lo staff vede l'albero adesso.</b> I giocatori lo vedranno dal ${dataLunga(a.pubblici_dal)}, con i messaggi approvati a quel momento.</p></div>` : "";
  v.innerHTML = `${indietro}${anteprima}
  <div class="posta-testa"><span class="label">${esc(S.dati.edizione.marchio || "Calendario dell'Avvento")} ${anno}</span>
    <h2>La posta di Tullio</h2>
    <p class="intro">${posta.length ? `Tullio, portavoce di Our Elysion, ha appeso all'albero ${posta.length === 1 ? "la lettera che gli avete affidato" : `le ${posta.length} lettere che gli avete affidato`}. Tocca una busta per leggerla.` : "Quest'anno la sacca di Tullio è rimasta vuota."}</p>
    ${posta.length ? `<p class="aiuto" id="conta-lette"></p>` : ""}</div>
  <div class="albero-scena"><div class="albero">${svgAlbero()}${buste}</div></div>
  ${posta.length ? `<details class="pannello tutte-lettere"><summary><b>Leggile tutte in fila</b></summary>
    <ul class="posta-lista">${posta.map((x) => `<li><p>${esc(x.testo)}</p><span class="aiuto">${esc(x.nome)}${x.aiutante ? SEGNO() : ""}</span></li>`).join("")}</ul></details>` : ""}
  <dialog class="foglio-lettera" id="foglio-lettera" aria-labelledby="fl-chi">
    <div class="fl-carta">
      <span class="label" id="fl-num"></span>
      <p class="fl-testo" id="fl-testo"></p>
      <p class="fl-firma" id="fl-chi"></p>
    </div>
    <div class="fl-azioni">
      <button type="button" class="btn sec piccolo" data-act="lettera-prec" aria-label="Lettera precedente">←</button>
      <button type="button" class="btn piccolo" data-act="lettera-chiudi">Rimetti nella busta</button>
      <button type="button" class="btn sec piccolo" data-act="lettera-succ" aria-label="Lettera successiva">→</button>
    </div>
  </dialog>`;
  contaLette();
  $("#foglio-lettera").addEventListener("close", () => {
    const i = S.posta.aperta; S.posta.aperta = -1;
    $(`[data-lettera="${i}"]`)?.focus({ preventScroll: true });
  });
  $("#foglio-lettera").addEventListener("click", (e) => { if (e.target.id === "foglio-lettera") e.target.close(); });
}
function contaLette() {
  const el = $("#conta-lette"); if (!el || !S.posta) return;
  const lette = letteLeggi(S.posta.anno);
  const k = S.posta.chiavi.filter((c) => lette.has(c)).length, n = S.posta.chiavi.length;
  el.textContent = k === 0 ? "" : k === n ? `Le hai lette tutte: grazie da parte di Tullio!` : `Ne hai aperte ${k} su ${n}.`;
}
function apriLettera(i) {
  const P = S.posta; if (!P || !P.posta.length) return;
  i = (i + P.posta.length) % P.posta.length;
  P.aperta = i;
  const x = P.posta[i];
  $("#fl-num").textContent = `Lettera ${i + 1} di ${P.posta.length}`;
  $("#fl-testo").textContent = x.testo;
  $("#fl-chi").innerHTML = esc(x.nome) + (x.aiutante ? SEGNO() : "");
  const d = $("#foglio-lettera");
  if (!d.open) d.showModal();
  d.querySelector(".fl-carta").classList.remove("svela"); void d.offsetWidth; d.querySelector(".fl-carta").classList.add("svela");
  const lette = letteLeggi(P.anno);
  if (!lette.has(P.chiavi[i])) { lette.add(P.chiavi[i]); letteSalva(P.anno, lette); }
  $(`[data-lettera="${i}"]`)?.classList.add("letta");
  contaLette();
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-lettera]");
  if (b) { apriLettera(Number(b.dataset.lettera)); return; }
  const a = e.target.closest("[data-act^='lettera-']"); if (!a || !S.posta) return;
  const act = a.dataset.act;
  if (act === "lettera-chiudi") $("#foglio-lettera").close();
  if (act === "lettera-prec") apriLettera(S.posta.aperta - 1);
  if (act === "lettera-succ") apriLettera(S.posta.aperta + 1);
});
document.addEventListener("keydown", (e) => {
  if (!S.posta || S.posta.aperta < 0 || !$("#foglio-lettera")?.open) return;
  if (e.key === "ArrowLeft") apriLettera(S.posta.aperta - 1);
  if (e.key === "ArrowRight") apriLettera(S.posta.aperta + 1);
});

/* ---------- partecipanti ---------- */
async function riempiPartecipanti() {
  const corpo = $("#staff-corpo");
  let a;
  try { a = await api("/api/admin/extra/partecipanti"); } catch (e) { corpo.innerHTML = `<p class="avviso">${esc(e.message)}</p>`; return; }
  S.partecipanti = a.partecipanti;
  disegnaPartecipanti();
}
function disegnaPartecipanti() {
  const corpo = $("#staff-corpo"), q = (S.cercaPart || "").toLowerCase();
  const tutti = S.partecipanti;
  const lista = tutti.filter((x) => !q || [x.nome, x.username, x.pg].some((y) => (y || "").toLowerCase().includes(q)));
  const senzaProfilo = tutti.filter((x) => !x.staff && !x.pg).length;
  corpo.innerHTML = `<h2>Partecipanti</h2>
  <p class="intro">Tutti quelli che sono entrati nel sito con Discord. Chi viene escluso non può più partecipare, scrivere a Tullio né vincere; le partecipazioni già fatte restano ma non contano nelle estrazioni.</p>
  <div class="stats">
    <div class="stat"><b>${tutti.filter((x) => !x.staff).length}</b><span>Iscritti</span></div>
    <div class="stat"><b>${senzaProfilo}</b><span>Senza personaggio indicato</span></div>
    <div class="stat"><b>${tutti.filter((x) => x.escluso).length}</b><span>Esclusi</span></div>
  </div>
  <div class="campo" style="max-width:360px"><label for="cerca-part">Cerca per nome o personaggio</label><input type="text" id="cerca-part" value="${esc(S.cercaPart || "")}"></div>
  <div class="doni">${lista.map((x) => `<div class="dono${x.escluso ? " escluso" : ""}">
    <div class="dono-t"><b style="font-size:20px">${esc(x.nome)} <span class="aiuto">@${esc(x.username)}</span></b><span class="fila">${x.staff ? pill("", "Staff") : ""}${x.escluso ? pill("err", "Escluso") : ""}${!x.staff && !x.pg ? pill("warn", "Profilo incompleto") : ""}</span></div>
    <p class="aiuto">${x.pg ? `${esc(x.pg)} · ${esc(x.mondo || "")} (${esc(x.dc || "")})` : "Personaggio non indicato"} · ${x.partecipazioni} ${x.partecipazioni === 1 ? "partecipazione" : "partecipazioni"} · ${x.vincite} ${x.vincite === 1 ? "premio" : "premi"}${x.doni ? ` · aiutante (${x.doni})` : ""}${x.last_login ? ` · ultimo accesso ${dataOra(x.last_login)}` : ""}</p>
    ${x.staff ? "" : `<div class="fila"><button class="btn quieto piccolo ${x.escluso ? "" : "pericolo-testo"}" data-act="escludi" data-id="${x.id}" data-v="${x.escluso ? 0 : 1}">${x.escluso ? "Riammetti" : "Escludi"}</button></div>`}
  </div>`).join("") || `<p class="prossimamente">Nessuno trovato.</p>`}</div>`;
}

/* ---------- edizioni e backup ---------- */
async function riempiEdizioni() {
  const corpo = $("#staff-corpo");
  let a;
  try { a = await api("/api/admin/extra/edizioni"); } catch (e) { corpo.innerHTML = `<p class="avviso">${esc(e.message)}</p>`; return; }
  const cur = a.edizioni.find((e) => e.year === a.corrente);
  const finita = cur && a.oggi > cur.fine;
  corpo.innerHTML = `<h2>Edizioni e backup</h2>
  <section class="pannello"><h3 style="font-size:22px">Backup</h3>
    <p class="sub">Scarica una copia di tutti i dati (edizioni, capitoli, iscritti, premi, partecipazioni, vincite, consegne, messaggi). Le immagini restano nel sito. Conviene farlo prima del 1° dicembre e a fine evento.</p>
    <a class="btn sec" href="/api/admin/extra/backup" download>Scarica il backup</a></section>
  <section class="pannello" style="margin-top:16px"><h3 style="font-size:22px">Edizioni</h3>
    <div class="doni">${a.edizioni.map((e) => `<div class="dono"><div class="dono-t"><b>${e.year} · ${esc(e.titolo || "")}</b>${e.year === a.corrente ? pill("ok", "Corrente") : pill("", "Archiviata")}</div>
      <p class="aiuto">${dataLunga(e.inizio)} – ${dataLunga(e.fine)} · ${e.partecipazioni} partecipazioni · ${e.vincite} premi vinti${e.da_consegnare ? ` · ${e.da_consegnare} ancora da consegnare` : ""}</p></div>`).join("")}</div>
    <div style="margin-top:14px;display:grid;gap:8px">
      <p class="sub">Quando l'edizione ${a.corrente} è finita e le consegne sono chiuse, apri l'edizione ${a.corrente + 1}: testi, regole e giorni di sfida vengono copiati con le date spostate di un anno; capitoli, premi e partecipazioni ripartono da zero. L'albo del ${a.corrente} resta consultabile.</p>
      <button class="btn" data-act="nuova-edizione" ${finita ? "" : "disabled"} style="justify-self:start">Apri l'edizione ${a.corrente + 1}</button>
      ${finita ? "" : `<span class="aiuto">Disponibile dal giorno dopo il ${dataLunga(cur.fine)}.</span>`}
    </div></section>`;
}

document.addEventListener("submit", async (e) => {
  if (e.target.id !== "form-msg") return;
  e.preventDefault();
  try { await putJson("/api/messaggi", { testo: $("#msg-tullio").value }); toast("Messaggio affidato a Tullio: lo staff lo leggerà presto"); boxMessaggi(); }
  catch (err) { toast(err.message); }
});
document.addEventListener("input", (e) => {
  if (e.target.id === "cerca-part") {
    S.cercaPart = e.target.value; const pos = e.target.selectionStart; disegnaPartecipanti();
    const el = $("#cerca-part"); el.focus(); el.setSelectionRange(pos, pos);
  }
});
document.addEventListener("click", async (e) => {
  const a = e.target.closest("[data-act]");
  if (!a) return;
  const act = a.dataset.act;
  try {
    if (act === "albo-anno") { S.alboAnno = Number(a.dataset.anno); vAlbo(); }
    if (act === "msg-elimina") {
      if (a.dataset.conferma !== "1") { a.dataset.conferma = "1"; a.textContent = "Conferma: ritira il messaggio"; return; }
      await api("/api/messaggi", { method: "DELETE" }); toast("Messaggio ritirato"); boxMessaggi();
    }
    if (act === "filtro-msg") { S.filtroMsg = a.dataset.f; riempiMessaggi(); }
    if (act === "msg-stato") { await putJson(`/api/admin/extra/messaggio/${a.dataset.id}`, { stato: a.dataset.s }); riempiMessaggi(); }
    if (act === "copia-msg") {
      const t = S.messaggi.messaggi.filter((x) => x.stato === "ok").map((x) => `${x.nome}: ${x.testo}`).join("\n\n");
      try { await navigator.clipboard.writeText(t); toast("Messaggi copiati"); } catch { toast("Non riesco a copiare"); }
    }
    if (act === "escludi") {
      if (a.dataset.v === "1" && a.dataset.conferma !== "1") { a.dataset.conferma = "1"; a.textContent = "Conferma esclusione"; a.classList.add("conferma"); return; }
      await putJson(`/api/admin/extra/partecipante/${a.dataset.id}`, { escluso: a.dataset.v === "1" }); toast(a.dataset.v === "1" ? "Escluso dall'evento" : "Riammesso"); riempiPartecipanti();
    }
    if (act === "nuova-edizione") {
      if (a.dataset.conferma !== "1") { a.dataset.conferma = "1"; a.textContent = "Conferma: archivia e apri la nuova edizione"; a.classList.add("conferma"); return; }
      const r = await api("/api/admin/extra/edizioni", { method: "POST" }); toast(`Edizione ${r.anno} aperta`); await carica(); riempiEdizioni();
    }
  } catch (err) { toast(err.message); }
});

document.addEventListener("click", async (e) => {
  const a = e.target.closest('[data-act="riestrai-uno"]');
  if (!a) return;
  if (a.dataset.conferma !== "1") { a.dataset.conferma = "1"; a.textContent = `Conferma: togli il premio a ${a.dataset.nome} e riestrai`; a.classList.add("conferma"); return; }
  a.disabled = true;
  try { const r = await api(`/api/admin/estrazioni/vincita/${a.dataset.id}/riestrai`, { method: "POST" }); toast(`Premio passato da ${r.prima} a ${r.dopo}`); riempiEstrazioni(); }
  catch (err) { toast(err.message); a.disabled = false; }
});
