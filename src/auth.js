// Login con Discord (OAuth2: identify + guilds) e sessioni salvate nel database.

const SESSION_DAYS = 30;
const COOKIE = "oe_sess";
const STATE_COOKIE = "oe_state";

function randomHex(bytes = 32) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256(s) {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function getCookie(req, name) {
  const c = req.headers.get("Cookie") || "";
  for (const part of c.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

function cookie(name, value, maxAge, secure) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
}

function isLocal(url) {
  return url.hostname === "localhost" || url.hostname === "127.0.0.1";
}

function adminIds(env) {
  return new Set(String(env.ADMIN_IDS || "").split(",").map((s) => s.trim()).filter(Boolean));
}

export async function currentUser(req, env) {
  const tok = getCookie(req, COOKIE);
  if (!tok) return null;
  const hash = await sha256(tok);
  const row = await env.DB.prepare(
    `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash=? AND s.expires>?`
  ).bind(hash, Date.now()).first();
  if (!row) return null;
  // Il ruolo admin dipende sempre dalla lista ufficiale, non da quanto salvato
  row.role = adminIds(env).has(row.id) ? "admin" : "giocatore";
  return row;
}

async function startSession(env, user, local) {
  const tok = randomHex();
  await env.DB.prepare("INSERT INTO sessions(token_hash,user_id,expires) VALUES(?,?,?)")
    .bind(await sha256(tok), user.id, Date.now() + SESSION_DAYS * 86400000).run();
  return cookie(COOKIE, tok, SESSION_DAYS * 86400, !local);
}

async function upsertUser(env, u) {
  const now = Date.now();
  const role = adminIds(env).has(u.id) ? "admin" : "giocatore";
  await env.DB.prepare(
    `INSERT INTO users(id,username,global_name,avatar,role,created_at,last_login) VALUES(?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET username=excluded.username, global_name=excluded.global_name,
       avatar=excluded.avatar, role=excluded.role, last_login=excluded.last_login`
  ).bind(u.id, u.username, u.global_name || null, u.avatar || null, role, now, now).run();
}

function redirect(location, headers = {}) {
  const h = new Headers({ Location: location });
  for (const [k, v] of Object.entries(headers)) {
    if (Array.isArray(v)) v.forEach((x) => h.append(k, x)); else h.set(k, v);
  }
  return new Response(null, { status: 302, headers: h });
}

export async function handleAuth(req, env, url) {
  const path = url.pathname;
  // In sviluppo locale (file .dev.vars con DEV_LOGIN=1) niente cookie "Secure" e accesso di prova attivo
  const local = isLocal(url) || env.DEV_LOGIN === "1";
  const base = isLocal(url) ? url.origin : env.BASE_URL;
  const redirectUri = `${base}/api/auth/callback`;

  if (path === "/api/auth/login") {
    const state = randomHex(16);
    await env.DB.prepare("INSERT INTO oauth_states(state,expires) VALUES(?,?)").bind(state, Date.now() + 600000).run();
    const q = new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID, response_type: "code", redirect_uri: redirectUri,
      scope: "identify guilds", state, prompt: "none",
    });
    return redirect(`https://discord.com/oauth2/authorize?${q}`, {
      "Set-Cookie": cookie(STATE_COOKIE, state, 600, !local),
    });
  }

  if (path === "/api/auth/callback") {
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const fail = (why) => redirect(`/?accesso=${why}`, { "Set-Cookie": cookie(STATE_COOKIE, "", 0, !local) });
    if (!code || !state || state !== getCookie(req, STATE_COOKIE)) return fail("annullato");
    const st = await env.DB.prepare("DELETE FROM oauth_states WHERE state=? AND expires>? RETURNING state")
      .bind(state, Date.now()).first();
    if (!st) return fail("scaduto");
    if (!env.DISCORD_CLIENT_SECRET) return fail("configurazione");

    const tokRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.DISCORD_CLIENT_ID, client_secret: env.DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code", code, redirect_uri: redirectUri,
      }),
    });
    if (!tokRes.ok) return fail("discord");
    const tok = await tokRes.json();
    const auth = { Authorization: `Bearer ${tok.access_token}` };
    const [meRes, guildsRes] = await Promise.all([
      fetch("https://discord.com/api/users/@me", { headers: auth }),
      fetch("https://discord.com/api/users/@me/guilds", { headers: auth }),
    ]);
    if (!meRes.ok || !guildsRes.ok) return fail("discord");
    const me = await meRes.json();
    const guilds = await guildsRes.json();
    if (!Array.isArray(guilds) || !guilds.some((g) => g.id === env.DISCORD_GUILD_ID)) return fail("server");

    await upsertUser(env, me);
    const sess = await startSession(env, me, local);
    // al primo accesso (personaggio non ancora indicato) si va dritti alla scheda del profilo
    const prof = await env.DB.prepare("SELECT pg FROM users WHERE id=?").bind(me.id).first();
    const dove = !prof?.pg && !adminIds(env).has(me.id) ? "/#profilo" : "/";
    return redirect(dove, { "Set-Cookie": [sess, cookie(STATE_COOKIE, "", 0, !local)] });
  }

  if (path === "/api/auth/logout" && req.method === "POST") {
    const t = getCookie(req, COOKIE);
    if (t) await env.DB.prepare("DELETE FROM sessions WHERE token_hash=?").bind(await sha256(t)).run();
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json", "Set-Cookie": cookie(COOKIE, "", 0, !local) },
    });
  }

  // Accesso di prova: SOLO in locale e solo se abilitato nel file .dev.vars
  if (path === "/api/auth/dev" && env.DEV_LOGIN === "1") {
    const k = Math.max(1, Math.min(99, Number(url.searchParams.get("id")) || 1));
    const as = url.searchParams.get("as") === "admin" ? [...adminIds(env)][0] : "1000000000000000" + String(k).padStart(2, "0");
    const fake = { id: as, username: url.searchParams.get("as") === "admin" ? "admin.prova" : (k === 1 ? "giocatore.prova" : `giocatore.${k}`), global_name: null };
    await upsertUser(env, fake);
    const profDev = await env.DB.prepare("SELECT pg FROM users WHERE id=?").bind(as).first();
    return redirect(!profDev?.pg && url.searchParams.get("as") !== "admin" ? "/#profilo" : "/", { "Set-Cookie": await startSession(env, fake, local) });
  }

  return new Response("Not found", { status: 404 });
}
