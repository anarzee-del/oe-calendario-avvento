// Capitolo bonus: si sblocca quando la community raggiunge l'ultimo traguardo di lettere.
// È salvato come giorno n = 0 nella tabella days (titolo, testo, immagine come gli altri capitoli).
// Nell'edizione: bonus_modo ('dopo' = la mezzanotte dopo il traguardo, 'fine' = all'ultima busta),
// bonus_raggiunto (data in cui la community ha raggiunto il traguardo), bonus_forzato (aperto a mano dallo staff).
import { addDays } from "./time.js";

export const BONUS = 0;

export function statoBonus(ed, oggi) {
  const tappe = JSON.parse(ed.tappe || "[]");
  const ultima = tappe[tappe.length - 1];
  if (!ultima) return null;
  const modo = ed.bonus_modo === "fine" ? "fine" : "dopo";
  // con una data simulata precedente al traguardo, il traguardo non risulta ancora raggiunto
  const r = ed.bonus_raggiunto && ed.bonus_raggiunto <= oggi ? ed.bonus_raggiunto : null;
  let apreIl = null;
  if (r) apreIl = modo === "fine" ? (addDays(r, 1) > ed.fine ? addDays(r, 1) : ed.fine) : addDays(r, 1);
  const forzato = !!ed.bonus_forzato;
  const aperto = forzato || (!!apreIl && oggi >= apreIl);
  return { traguardo: ultima.s, modo, raggiunto: !!r, raggiunto_il: r, apre_il: apreIl, forzato, aperto };
}

// Segna la data del traguardo, una volta sola. "giorno" è la data in cui è stato raggiunto.
export async function segnaTraguardo(env, ed, lettere, giorno) {
  if (ed.bonus_raggiunto) return false;
  const tappe = JSON.parse(ed.tappe || "[]");
  const ultima = tappe[tappe.length - 1];
  if (!ultima || lettere < ultima.s) return false;
  const r = await env.DB.prepare("UPDATE editions SET bonus_raggiunto=? WHERE year=? AND bonus_raggiunto IS NULL").bind(giorno, ed.year).run();
  if (r.meta?.changes) ed.bonus_raggiunto = giorno;
  return !!r.meta?.changes;
}
