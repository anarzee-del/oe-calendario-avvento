// Orari: tutto ragiona in ora italiana (Europe/Rome), anche con l'ora legale.

const fmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Rome",
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

export function romeNow(date = new Date()) {
  const p = Object.fromEntries(fmt.formatToParts(date).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hh: Number(p.hour), mm: Number(p.minute) };
}

export function addDays(iso, k) {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + k);
  return d.toISOString().slice(0, 10);
}

export function diffDays(a, b) {
  return Math.round((new Date(b + "T12:00:00Z") - new Date(a + "T12:00:00Z")) / 86400000);
}

export function weekday(iso) {
  return new Date(iso + "T12:00:00Z").getUTCDay();
}

export function isIsoDate(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s + "T12:00:00Z"));
}

// Numero di giorni dell'edizione e data di ciascuna casella
export function editionDays(ed) {
  const count = Math.min(31, Math.max(1, diffDays(ed.inizio, ed.fine) + 1));
  return Array.from({ length: count }, (_, i) => ({ n: i + 1, data: addDays(ed.inizio, i) }));
}

// Stato di una casella rispetto a "oggi" (data italiana)
export function dayState(dayDate, today) {
  if (today < dayDate) return "sigillata";
  if (today === dayDate) return "oggi";
  return "passata";
}
