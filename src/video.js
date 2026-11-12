// Video del capitolo bonus. I video sono troppo grandi per il database: stanno nello spazio file R2
// dell'account (binding MEDIA, cartella avvento/), e si servono a pezzi così si possono guardare subito.
// Come le immagini, finché il capitolo bonus è chiuso il video lo vede solo lo staff.
import { romeNow } from "./time.js";
import { statoBonus } from "./bonus.js";

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
const err = (status, messaggio) => json({ errore: messaggio }, status);

export const MAX_VIDEO = 95 * 1024 * 1024; // il piano gratuito accetta richieste fino a 100 MB
const TIPI = { "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov" };

export async function handleVideo(req, env, url, user, ed) {
  const p = url.pathname, m = req.method;
  const isAdmin = user?.role === "admin";

  // Riproduzione: GET /api/video/0?v=N
  if (p === "/api/video/0" && (m === "GET" || m === "HEAD")) {
    const aperto = !!statoBonus(ed, romeNow().date)?.aperto;
    if (!aperto && !isAdmin) return new Response("Forbidden", { status: 403 });
    if (!env.MEDIA) return new Response("Not found", { status: 404 });
    const row = await env.DB.prepare("SELECT video_key FROM days WHERE edition=? AND n=0").bind(ed.year).first();
    if (!row?.video_key) return new Response("Not found", { status: 404 });
    const range = req.headers.get("Range");
    const obj = await env.MEDIA.get(row.video_key, range ? { range: req.headers } : undefined);
    if (!obj) return new Response("Not found", { status: 404 });
    const h = new Headers();
    obj.writeHttpMetadata(h);
    h.set("Accept-Ranges", "bytes");
    h.set("Cache-Control", aperto ? "public, max-age=86400" : "private, no-store");
    if (range && obj.range) {
      const off = obj.range.offset ?? 0;
      const len = obj.range.length ?? obj.size - off;
      h.set("Content-Range", `bytes ${off}-${off + len - 1}/${obj.size}`);
      h.set("Content-Length", String(len));
      return new Response(m === "HEAD" ? null : obj.body, { status: 206, headers: h });
    }
    h.set("Content-Length", String(obj.size));
    return new Response(m === "HEAD" ? null : obj.body, { headers: h });
  }

  // Caricamento e rimozione (solo staff): PUT / DELETE /api/admin/giorno/0/video
  if (p === "/api/admin/giorno/0/video") {
    if (!isAdmin) return err(403, "Area riservata allo staff");
    if (!env.MEDIA) return err(500, "Lo spazio per i video non è collegato: scrivi a Claude");
    const row = await env.DB.prepare("SELECT video_key FROM days WHERE edition=? AND n=0").bind(ed.year).first();
    if (m === "DELETE") {
      if (row?.video_key) await env.MEDIA.delete(row.video_key);
      await env.DB.prepare("UPDATE days SET video_key=NULL, video_ver=0 WHERE edition=? AND n=0").bind(ed.year).run();
      return json({ ok: true });
    }
    if (m === "PUT") {
      const tipo = (req.headers.get("Content-Type") || "").split(";")[0].trim();
      const est = TIPI[tipo];
      if (!est) return err(400, "Formato non supportato: usa un video MP4 (consigliato) o WebM");
      const lung = Number(req.headers.get("Content-Length") || 0);
      if (!lung) return err(400, "Video vuoto");
      if (lung > MAX_VIDEO) return err(400, "Video troppo pesante: massimo 95 MB");
      const chiave = `avvento/${ed.year}/bonus-${Date.now()}.${est}`;
      await env.MEDIA.put(chiave, req.body, { httpMetadata: { contentType: tipo } });
      if (row?.video_key) await env.MEDIA.delete(row.video_key).catch(() => {});
      await env.DB.prepare("UPDATE days SET video_key=?, video_ver=video_ver+1 WHERE edition=? AND n=0").bind(chiave, ed.year).run();
      return json({ ok: true });
    }
  }
  return null;
}
