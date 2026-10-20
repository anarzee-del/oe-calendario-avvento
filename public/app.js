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
const dataLunga = (iso) => new Date(iso + "T12:00:00Z").toLocaleDateString("it-IT", { day: "numeric", month: "long", timeZone: "UTC" });
const dataBreve = (iso) => new Date(iso + "T12:00:00Z").toLocaleDateString("it-IT", { day: "numeric", month: "short", timeZone: "UTC" });
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
  $("#brand-anno").textContent = "Avvento " + ed.anno;
  $("#sottotitolo").textContent = ed.sottotitolo || "";
  $("#titolo").textContent = ed.titolo || "Calendario dell'Avvento";
  $("#intro").textContent = ed.intro || "";
  $("#footer-consegne").textContent = `Le consegne dei premi avvengono in gioco dal ${dataLunga(ed.consegna_da)} al ${dataLunga(ed.consegna_a)}.`;
  document.title = (ed.titolo ? ed.titolo + " · " : "") + "Avvento Our Elysion";

  const voci = [["calendario", "Calendario"], ["aiutanti", "Aiutanti"], ["regolamento", "Regolamento"]];
  if (connesso()) voci.push(["profilo", "Il mio profilo"]);
  if (admin()) voci.push(["staff", "Area staff"]);
  const attiva = S.vista === "casella" ? "calendario" : S.vista;
  $("#menu").innerHTML = voci.map(([k, t]) => `<a href="#${k}" ${attiva === k ? 'aria-current="page"' : ""}>${t}</a>`).join("");

  const u = d.utente;
  $("#utente").innerHTML = u
    ? `<span class="avatar" aria-hidden="true">${u.avatar ? `<img src="${esc(u.avatar)}" alt="">` : esc(u.nome[0] || "?")}</span><span>${esc(u.nome)}${u.ruolo === "admin" ? " · staff" : ""}</span><button class="esci" data-act="esci">Esci</button>`
    : `<a class="btn-discord" href="/api/auth/login">${ICO.discord} Accedi con Discord</a>`;

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
  const cls = ["busta", st === "oggi" ? "oggi" : st === "passata" ? "aperta" : "sigillata", g.n === S.dati.giorni.length ? "natale" : "", fb ? "con-fb" : ""].join(" ");
  let nota = "";
  if (st === "sigillata") { const k = giorniTra(S.dati.oggi, g.data); nota = k === 1 ? "domani" : `tra ${k} giorni`; }
  const lab = `Casella ${g.n}, ${GG_LUNGO[g.wd]} ${dataLunga(g.data)}${g.etichetta ? ", " + g.etichetta : ""}${g.tipo === "sfida" ? ", giorno di sfida" : ""}, ${st === "oggi" ? "aperta oggi" : st === "passata" ? "già aperta" : "ancora sigillata"}`;
  return `<a class="${cls}" href="#casella-${g.n}" aria-label="${esc(lab)}">
    <svg class="forma" viewBox="0 0 100 75" preserveAspectRatio="none" aria-hidden="true">
      ${st === "passata" ? '<rect class="foglio" x="14" y="6" width="72" height="40" rx="1"/>' : ""}
      <path class="piega" d="M0 75 L42 38 M100 75 L58 38"/>
      <path class="lembo" d="M0 0 L50 42 L100 0 Z"/>
    </svg>
    ${g.tipo === "sfida" ? `<span class="nastro">${esc(g.etichetta || "Sfida")}</span>` : ""}
    ${fb ? `<span class="fb" aria-hidden="true"><span class="fb-in" style="display:block"><img src="${esc(fb)}" alt="" loading="lazy"></span></span>` : ""}
    <span class="gg">${GG[g.wd]}</span>
    ${st === "oggi" ? `<span class="sigillo" aria-hidden="true">${ICO.fiocco}</span>` : ""}
    <span class="n num">${g.n}</span>
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
    ${connesso() ? `<a class="btn" href="#profilo">Completa il profilo</a>` : `<a class="btn-discord" href="/api/auth/login">${ICO.discord} Accedi con Discord</a>`}
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
    <div class="legenda"><span><i class="dot" style="background:var(--accent)"></i>Oggi</span><span><i class="dot" style="background:var(--primary)"></i>Giorno di sfida</span></div></div>
  <div class="griglia">${d.giorni.map(busta).join("")}</div>
  <div class="sotto">${pannelloCome()}
    <section class="pannello"><h3>Un messaggio per la community</h3><p class="sub">Presto potrai lasciare un messaggio a Tullio: da buon portavoce di Our Elysion, lo consegnerà a tutta la community.</p></section>
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
  const testo = paragrafi(g.testo);
  const anteprima = g.stato === "sigillata" ? `<div class="avviso"><span class="stato warn">Anteprima staff</span><p>Questa busta è ancora sigillata per i giocatori: la vedi solo tu.</p></div>` : "";
  let azione = `<div class="pannello" style="display:grid;gap:14px">`;
  if (g.premio) azione += `<div class="premio"><span class="label">Premio del giorno</span><b>${esc(g.premio)}</b>${g.premio_da ? `<span class="aiuto">${esc(g.premio_da.frase)}</span>` : ""}</div>`;
  if (g.tipo === "sfida") {
    azione += `<div><span class="label" style="color:var(--primary)">Sfida${g.etichetta ? " di " + esc(g.etichetta) : ""}</span>
      <p style="font-size:18px;margin-top:6px;font-weight:600">${esc(g.domanda || "La domanda della sfida comparirà qui.")}</p>
      <div class="scelte">${(g.risposte || []).filter(Boolean).map((r, i) => `<div class="scelta" style="cursor:default">${g.giusta === i ? ICO.spunta : ""} ${esc(r)}</div>`).join("")}</div></div>`;
  }
  azione += `<p class="prossimamente">Le partecipazioni e le estrazioni arrivano con il prossimo aggiornamento del sito.</p></div>`;
  v.innerHTML = `<a class="indietro" href="#calendario">← Torna al calendario</a>${anteprima}
  <div class="casella">
    <article class="capitolo">
      <span class="label">Capitolo ${g.n} · ${GG_LUNGO[g.wd]} ${dataLunga(g.data)}${g.etichetta ? " · " + esc(g.etichetta) : ""}</span>
      <h2>${esc(g.titolo || "Capitolo " + g.n)}</h2>
      ${g.immagine ? `<img class="illustrazione" src="${esc(g.immagine)}" alt="Immagine del capitolo ${g.n}">` : ""}
      <div class="storia">${testo.length ? testo.map((p) => `<p>${esc(p)}</p>`).join("") : `<p class="vuoto">Il testo di questo capitolo non è ancora stato scritto.</p>`}</div>
    </article>
    <aside class="azione">${azione}</aside>
  </div>`;
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
  if (!u) return `<div class="pannello sigillata-box"><h2>Accedi per vedere il tuo profilo</h2><a class="btn-discord" href="/api/auth/login">${ICO.discord} Accedi con Discord</a></div>`;
  const dc = u.dc || "Light";
  return `<div class="pagina-h"><span class="label">Il mio profilo</span><h2>${esc(u.nome)}</h2><p>@${esc(u.username)} su Discord</p>${u.aiutante ? `<span class="segno-aiutante">${ICO.dono} Aiutante del postino</span>` : ""}</div>
  <section class="pannello" style="max-width:560px"><h3>Dove consegnarti i premi</h3><p class="sub">Il personaggio e il mondo su cui ti consegneremo eventuali premi in gioco.</p>
    <form id="form-profilo">
      <div class="campo"><label for="pg">Nome del personaggio</label><input type="text" id="pg" maxlength="40" value="${esc(u.pg)}" placeholder="Nome Cognome" autocomplete="off"></div>
      <div class="due"><div class="campo"><label for="dc">Data center</label><select id="dc">${Object.keys(MONDI).map((x) => `<option ${x === dc ? "selected" : ""}>${x}</option>`).join("")}</select></div>
      <div class="campo"><label for="mondo">Mondo</label><select id="mondo">${MONDI[dc].map((m) => `<option ${m === u.mondo ? "selected" : ""}>${m}</option>`).join("")}</select></div></div>
      <button class="btn" type="submit">Salva</button>
    </form></section>
  <p style="margin-top:18px"><a href="#aiutanti">${u.aiutante ? "Le tue offerte per il calendario" : "Vuoi offrire un premio? Diventa un aiutante"}</a></p>`;
}

/* ---------- area staff ---------- */
async function vStaff() {
  if (!admin()) return `<div class="pannello sigillata-box"><h2>Area riservata allo staff</h2></div>`;
  const nav = [["giorni", "Giorni e capitoli"], ["premi", "Premi e aiutanti"], ["testi", "Testi e date"]];
  const head = `<div class="staff"><nav class="staff-nav" aria-label="Sezioni staff">${nav.map(([k, t]) => `<button data-sez="${k}" aria-current="${S.staffSez === k}">${t}</button>`).join("")}
    <p class="aiuto" style="padding:10px 12px">Regole, estrazioni, partecipanti, messaggi e consegne arrivano nei prossimi aggiornamenti.</p></nav><section id="staff-corpo"><p class="caricamento">Caricamento…</p></section></div>`;
  return head;
}

async function riempiStaff() {
  const corpo = $("#staff-corpo");
  if (!corpo) return;
  if (S.staffSez === "testi") { corpo.innerHTML = formTesti(); return; }
  if (S.staffSez === "premi") return riempiPremi();
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
      <span class="gt"><b>${esc(x.titolo || "Senza titolo")}</b><span class="fila">${pill(c, t)}${x.tipo === "sfida" ? pill("", "Sfida" + (x.etichetta ? " · " + esc(x.etichetta) : "")) : ""}</span><span class="aiuto">${x.premio ? "Premio: " + esc(x.premio) : "Nessun premio assegnato"}</span></span>
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
        <div class="campo"><span class="label" style="color:var(--ink)">Premio del giorno</span><p style="font-size:16px">${g.premio ? `<b>${esc(g.premio)}</b> <span class="aiuto">${esc(g.premio_da)}</span>` : "Nessun premio assegnato"}</p><span class="aiuto">Si assegna dalla sezione <button type="button" class="btn quieto piccolo" data-sez="premi">Premi e aiutanti</button></span></div>
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
      <div class="campo"><label for="t-titolo">Titolo</label><input type="text" id="t-titolo" maxlength="80" value="${esc(ed.titolo)}"></div>
      <div class="campo"><label for="t-sotto">Sottotitolo</label><input type="text" id="t-sotto" maxlength="120" value="${esc(ed.sottotitolo)}"></div>
      <div class="campo"><label for="t-intro">Introduzione</label><textarea id="t-intro" maxlength="600">${esc(ed.intro)}</textarea></div></div>
    <div class="pannello" style="margin-top:16px"><h3 style="font-size:22px;margin-bottom:10px">Traguardi della community</h3>
      <div class="tappe-ed">${tappe.map((t, i) => `<div class="tappa-ed"><div class="campo"><label for="ts${i}">Tappa ${i + 1}: lettere</label><input type="number" min="1" id="ts${i}" value="${esc(t.s)}"></div><div class="campo"><label for="tb${i}">Biscotti ai partecipanti</label><input type="number" min="0" id="tb${i}" value="${esc(t.b)}"></div></div>`).join("")}</div>
      <p class="aiuto">L'ultima tappa è il traguardo finale e sblocca il capitolo bonus. Lascia vuota una riga per toglierla.</p></div>
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
  v.innerHTML = S.vista === "regolamento" ? vRegolamento() : S.vista === "aiutanti" ? `<p class="caricamento">Caricamento…</p>` : S.vista === "profilo" ? vProfilo() : S.vista === "staff" ? await vStaff() : vCalendario();
  if (S.vista === "staff") riempiStaff();
  if (S.vista === "aiutanti") vAiutanti();
}

function leggiHash() {
  const h = (location.hash || "").slice(1);
  if (/^casella-\d+$/.test(h)) { S.vista = "casella"; S.giorno = Number(h.split("-")[1]); }
  else if (["regolamento", "profilo", "staff", "calendario", "aiutanti"].includes(h)) S.vista = h;
  else S.vista = "calendario";
}
window.addEventListener("hashchange", async () => {
  leggiHash();
  if (!S.dati) return; // il primo caricamento disegnerà la vista giusta
  if (S.vista === "profilo" || S.vista === "calendario") { try { S.dati = await api(conSim("/api/stato")); } catch {} }
  renderTesta(); render();
  $("#vista").focus({ preventScroll: true });
  window.scrollTo({ top: Math.max(0, $(".testata").offsetHeight - 10), behavior: "smooth" });
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
      titolo: $("#t-titolo").value, sottotitolo: $("#t-sotto").value, intro: $("#t-intro").value,
      come_funziona: $("#t-come").value, regolamento: $("#t-reg").value, tappe,
      donazioni_fino: $("#t-dfino").value, aiutanti_intro: $("#t-aiut").value,
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
const dataOra = (ms) => new Date(ms).toLocaleDateString("it-IT", { day: "numeric", month: "short" });

function campiDono(pref, conTipo = true) {
  return `${conTipo ? `<fieldset class="scelta-tipo"><legend class="label" style="margin-bottom:8px">Cosa vuoi offrire</legend>
      <label class="scelta" for="${pref}-t-ogg"><input type="radio" name="${pref}-tipo" id="${pref}-t-ogg" value="oggetto" checked> Un oggetto in gioco</label>
      <label class="scelta" for="${pref}-t-gil"><input type="radio" name="${pref}-tipo" id="${pref}-t-gil" value="gil"> Dei GIL</label></fieldset>` : ""}
    <div class="due" id="${pref}-ogg">
      <div class="campo"><label for="${pref}-desc">Oggetto</label><input type="text" id="${pref}-desc" maxlength="100" placeholder="Es. Pure White Dye"></div>
      <div class="campo"><label for="${pref}-qta">Quantità</label><input type="number" id="${pref}-qta" min="1" max="999" value="1"></div>
    </div>
    <div class="campo" id="${pref}-gil" hidden><label for="${pref}-gilv">Quanti GIL</label><input type="number" id="${pref}-gilv" min="1" step="1" placeholder="Es. 500000"></div>`;
}
function leggiDono(pref) {
  const tipo = document.querySelector(`input[name=${pref}-tipo]:checked`)?.value || "oggetto";
  return { tipo, descrizione: $(`#${pref}-desc`).value, quantita: Number($(`#${pref}-qta`).value || 1), gil: Number($(`#${pref}-gilv`).value || 0) };
}

async function vAiutanti() {
  const v = $("#vista");
  let a;
  try { a = await api(conSim("/api/aiutanti")); } catch (e) { v.innerHTML = `<div class="avviso"><p>${esc(e.message)}</p></div>`; return; }
  if (S.vista !== "aiutanti") return;
  const u = S.dati.utente;
  let modulo;
  if (!a.aperte) modulo = `<section class="pannello"><h3>Offerte chiuse</h3><p class="sub">Le offerte per questa edizione si sono chiuse il ${dataLunga(a.fino)}. Grazie a tutti gli aiutanti!</p></section>`;
  else if (!u) modulo = `<section class="pannello"><h3>Offri un premio</h3><p class="sub">Accedi con il tuo account Discord del server Our Elysion per registrare la tua offerta.</p><a class="btn-discord" href="/api/auth/login">${ICO.discord} Accedi con Discord</a></section>`;
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
  const grazie = `<section class="pannello"><h3>Grazie a</h3>${a.aiutanti.length || a.anonimi ? `<ul class="grazie">${a.aiutanti.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>${a.anonimi ? `<p class="aiuto" style="margin-top:8px">e ${a.anonimi === 1 ? "un aiutante anonimo" : a.anonimi + " aiutanti anonimi"}</p>` : ""}` : `<p class="sub">Ancora nessun dono ricevuto. Il primo nome potrebbe essere il tuo!</p>`}</section>`;
  v.innerHTML = `<div class="pagina-h"><span class="label">Edizione ${S.dati.edizione.anno}</span><h2>Gli aiutanti del postino</h2>
    ${paragrafi(a.intro).map((p) => `<p>${esc(p)}</p>`).join("")}</div>
    <div class="sotto" style="margin-top:0"><div style="display:grid;gap:24px">${modulo}${mie}</div>${grazie}</div>`;
}

async function riempiPremi() {
  const corpo = $("#staff-corpo");
  let a, giorni;
  try { [a, giorni] = await Promise.all([api("/api/admin/donazioni"), api("/api/admin/giorni").then((x) => x.giorni)]); }
  catch (e) { corpo.innerHTML = `<p class="avviso">${esc(e.message)}</p>`; return; }
  S.adminDoni = a; S.adminGiorni = giorni;
  const f = S.filtroDoni || "tutte";
  const conta = (st) => a.donazioni.filter((d) => d.stato === st).length;
  const assegnati = a.donazioni.filter((d) => d.giorno).length;
  const lista = a.donazioni.filter((d) => f === "tutte" || d.stato === f || (f === "libere" && d.stato === "ricevuta" && !d.giorno));
  const filtri = [["tutte", "Tutte", a.donazioni.length], ["offerta", "Da ricevere", conta("offerta")], ["libere", "Ricevute da assegnare", a.donazioni.filter((d) => d.stato === "ricevuta" && !d.giorno).length], ["rifiutata", "Non accettate", conta("rifiutata")]];
  corpo.innerHTML = `<h2>Premi e aiutanti</h2><p class="intro">Le offerte della community e i premi dello staff. Offerte aperte fino al ${dataLunga(a.fino)}${a.aperte ? "" : " (chiuse)"}.</p>
  <div class="stats">
    <div class="stat"><b>${conta("offerta")}</b><span>Da ricevere in gioco</span></div>
    <div class="stat"><b>${conta("ricevuta")}</b><span>Ricevute</span></div>
    <div class="stat"><b>${assegnati}/${giorni.length}</b><span>Giorni con un premio</span></div>
  </div>
  <div class="fila filtri" role="group" aria-label="Filtra">${filtri.map(([k, t, n]) => `<button class="btn ${f === k ? "" : "sec"} piccolo" data-act="filtro-doni" data-f="${k}">${t} · ${n}</button>`).join("")}</div>
  <div class="doni" style="margin-top:14px">${lista.length ? lista.map((d) => cardDono(d, giorni, a.donazioni)).join("") : `<p class="prossimamente">Nessun dono in questo elenco.</p>`}</div>
  <details class="pannello" style="margin-top:22px" ${a.donazioni.length ? "" : "open"}><summary><b>Aggiungi un premio dello staff</b> <span class="aiuto">o un dono ricevuto fuori dal sito</span></summary>
    <form id="form-dono-staff" style="margin-top:14px">${campiDono("s")}
      <div class="due"><div class="campo"><label for="s-chi">Donato da</label><select id="s-chi"><option value="">Staff di Our Elysion</option><option value="__nome">Un altro nome…</option>${a.utenti.map((x) => `<option value="${esc(x.id)}">${esc(x.nome)}</option>`).join("")}</select></div>
      <div class="campo" id="s-nome-box" hidden><label for="s-nome">Nome da mostrare</label><input type="text" id="s-nome" maxlength="60"></div></div>
      <label class="scelta" for="s-anon" style="margin-bottom:14px"><input type="checkbox" id="s-anon"> Mostra come anonimo</label>
      <button class="btn" type="submit">Aggiungi come ricevuto</button>
    </form></details>`;
}

function cardDono(d, giorni, tutti) {
  const [c, t] = STATO_DONO[d.stato];
  const chi = d.user_id ? `${esc(d.u_nome || "?")} <span class="aiuto">@${esc(d.u_username || "")}${d.u_pg ? " · " + esc(d.u_pg) + (d.u_mondo ? " (" + esc(d.u_mondo) + ")" : "") : ""}</span>` : esc(d.donatore_nome || "Staff di Our Elysion");
  const occupati = new Map(tutti.filter((x) => x.giorno && x.id !== d.id).map((x) => [x.giorno, x.etichetta]));
  const sel = d.stato === "ricevuta" ? `<label class="aiuto" for="g-${d.id}">Giorno</label><select id="g-${d.id}" data-act-change="assegna" data-id="${d.id}"><option value="">Non assegnato</option>${giorni.map((g) => `<option value="${g.n}" ${d.giorno === g.n ? "selected" : ""}>${g.n} · ${GG[g.wd]} ${dataBreve(g.data)}${occupati.has(g.n) ? " · al posto di " + esc(occupati.get(g.n)) : ""}</option>`).join("")}</select>` : "";
  return `<div class="dono">
    <div class="dono-t"><b>${esc(d.etichetta)}</b><span class="fila">${pill(c, t)}${d.anonimo ? pill("", "Anonimo") : ""}${d.giorno ? pill("acc", "Giorno " + d.giorno) : ""}</span></div>
    <p class="dono-chi">Da ${chi}</p>
    <p class="aiuto">Sul sito: "${esc(d.pubblico)}" · registrata il ${dataOra(d.created_at)}${d.gestita_da ? " · ultima modifica: " + esc(d.gestita_da) : ""}</p>
    ${d.nota ? `<p class="dono-nota">“${esc(d.nota)}”</p>` : ""}
    <div class="fila">${d.stato === "offerta" ? `<button class="btn piccolo" data-act="dono-stato" data-id="${d.id}" data-s="ricevuta">Ricevuto</button><button class="btn quieto piccolo" data-act="dono-stato" data-id="${d.id}" data-s="rifiutata">Non accettare</button>` : ""}
      ${d.stato === "ricevuta" ? sel + `<button class="btn quieto piccolo" data-act="dono-stato" data-id="${d.id}" data-s="offerta">Annulla "ricevuto"</button>` : ""}
      ${d.stato === "rifiutata" ? `<button class="btn quieto piccolo" data-act="dono-stato" data-id="${d.id}" data-s="offerta">Riapri</button>` : ""}
      <button class="btn quieto piccolo" data-act="dono-anon" data-id="${d.id}" data-v="${d.anonimo ? 0 : 1}">${d.anonimo ? "Mostra il nome" : "Rendi anonimo"}</button>
      <button class="btn quieto piccolo pericolo-testo" data-act="dono-elimina" data-id="${d.id}">Elimina</button></div>
  </div>`;
}

document.addEventListener("change", async (e) => {
  const t = e.target;
  const m = t.name && t.name.match(/^(d|s)-tipo$/);
  if (m) { const gil = t.value === "gil"; $(`#${m[1]}-ogg`).hidden = gil; $(`#${m[1]}-gil`).hidden = !gil; }
  if (t.id === "s-chi") $("#s-nome-box").hidden = t.value !== "__nome";
  if (t.dataset.actChange === "assegna") {
    try { await putJson(`/api/admin/donazione/${t.dataset.id}`, { giorno: t.value ? Number(t.value) : null }); toast(t.value ? `Premio assegnato al giorno ${t.value}` : "Premio tolto dal giorno"); riempiPremi(); }
    catch (err) { toast(err.message); }
  }
});

document.addEventListener("click", async (e) => {
  const a = e.target.closest("[data-act]");
  if (!a) return;
  const act = a.dataset.act, id = a.dataset.id;
  try {
    if (act === "filtro-doni") { S.filtroDoni = a.dataset.f; riempiPremi(); }
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
