// Dati del giocatore condivisi con il sito principale ourelysion.com (26/11, richiesta di Altea):
// nome del personaggio, data center, mondo e free trial stanno anche nel database del sito (oe-home, tabella
// "profili", collegamento OE), così per le altre attività a prenotazione non si richiedono ogni volta.
// - Chi li ha già dati sul sito li ritrova qui senza doverli riscrivere.
// - Quando li salva qui, si aggiornano anche sul sito. Se li cambia sul sito, il sito aggiorna direttamente questa tabella users.
// Se il collegamento manca (prova in locale), il calendario funziona come prima.

export async function prendiDaSito(env, user) {
  if (!env.OE || !user || (user.pg && user.free_trial != null)) return;
  try {
    const p = await env.OE.prepare("SELECT pg, dc, mondo, free_trial FROM profili WHERE discord_id=?").bind(user.id).first();
    if (!p) return;
    const pg = user.pg || p.pg || null, dc = user.pg ? user.dc : p.dc || user.dc || null, mondo = user.pg ? user.mondo : p.mondo || user.mondo || null;
    const ft = user.free_trial != null ? user.free_trial : p.free_trial;
    if (pg === user.pg && ft === user.free_trial) return;
    await env.DB.prepare("UPDATE users SET pg=?, dc=?, mondo=?, free_trial=? WHERE id=?").bind(pg, dc, mondo, ft, user.id).run();
    Object.assign(user, { pg, dc, mondo, free_trial: ft });
  } catch (e) { console.error("Profilo dal sito", e); }
}

export async function mandaAlSito(env, id, { pg, dc, mondo, free_trial }) {
  if (!env.OE) return;
  try {
    const ft = free_trial == null ? null : free_trial ? 1 : 0;
    await env.OE.prepare(`INSERT INTO profili(discord_id,pg,dc,mondo,free_trial,aggiornato) VALUES(?,?,?,?,?,?)
      ON CONFLICT(discord_id) DO UPDATE SET pg=COALESCE(NULLIF(excluded.pg,''),profili.pg), dc=COALESCE(NULLIF(excluded.dc,''),profili.dc),
        mondo=COALESCE(NULLIF(excluded.mondo,''),profili.mondo), free_trial=COALESCE(excluded.free_trial,profili.free_trial), aggiornato=excluded.aggiornato`)
      .bind(id, pg || "", dc || "", mondo || "", ft, Date.now()).run();
  } catch (e) { console.error("Profilo verso il sito", e); }
}
