// /api/cron.js — wird alle 15 Minuten vom GitHub-Zeitplan aufgerufen
// (.github/workflows/reminders.yml) und verschickt fällige Erinnerungen.
// Zugriff: "Authorization: Bearer <APP_SECRET>" (oder optional CRON_SECRET).
//
// Warum GitHub und nicht Vercel-Cron? Auf dem kostenlosen Vercel-Tarif laufen
// Cron-Jobs nur einmal am Tag — für Erinnerungen zu festen Uhrzeiten zu wenig.

import { redis, STATE_KEY, SENT_KEY, authorized, getSubs, sendToAll } from "./_push-core.js";
import { dueReminders } from "./_reminder-rules.js";

export default async function handler(req, res) {
  if (!authorized(req)) return res.status(401).json({ error: "Unauthorized" });
  try {
    const subs = await getSubs();
    if (!subs.length) return res.status(200).json({ ok: true, sent: 0, note: "keine Geräte angemeldet" });

    const state = await redis.get(STATE_KEY);
    if (!state) return res.status(200).json({ ok: true, sent: 0, note: "kein Sync-Stand" });

    const log = (await redis.get(SENT_KEY)) || {};
    const msgs = dueReminders(state, new Date(), log);
    await redis.set(SENT_KEY, log);

    let sent = 0;
    for (const m of msgs) {
      const r = await sendToAll(m, req.headers.host);
      sent += r.sent;
    }
    return res.status(200).json({ ok: true, reminders: msgs.map(m => m.tag), sent });
  } catch (err) {
    return res.status(500).json({ error: "Cron-Fehler", detail: String(err) });
  }
}
