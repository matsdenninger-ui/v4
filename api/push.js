// /api/push.js — Geräte für Push-Erinnerungen an- und abmelden, Test-Push.
// Zugriffsschutz wie /api/state: "Authorization: Bearer <APP_SECRET>" (= dein Sync-Code).
//
//   GET                         → { publicKey }  (VAPID-Schlüssel für das Abo im Browser)
//   POST {action:"subscribe", subscription, device}
//   POST {action:"unsubscribe", endpoint}
//   POST {action:"test"}        → schickt eine Test-Benachrichtigung an alle Geräte

import { redis, SUBS_KEY, authorized, getVapid, getSubs, sendToAll, parseBody } from "./_push-core.js";

export default async function handler(req, res) {
  if (!authorized(req)) return res.status(401).json({ error: "Unauthorized" });

  try {
    if (req.method === "GET") {
      const v = await getVapid();
      const subs = await getSubs();
      return res.status(200).json({ publicKey: v.publicKey, devices: subs.length });
    }

    if (req.method === "POST") {
      const body = parseBody(req);
      const subs = await getSubs();

      if (body.action === "subscribe") {
        const sub = body.subscription;
        if (!sub || !sub.endpoint || !sub.keys) return res.status(400).json({ error: "Ungültiges Abo" });
        const rest = subs.filter(s => s.subscription && s.subscription.endpoint !== sub.endpoint);
        rest.push({ subscription: sub, device: String(body.device || "").slice(0, 80), added: Date.now() });
        await redis.set(SUBS_KEY, rest.slice(-10));
        return res.status(200).json({ ok: true, devices: Math.min(rest.length, 10) });
      }

      if (body.action === "unsubscribe") {
        const rest = subs.filter(s => s.subscription && s.subscription.endpoint !== body.endpoint);
        await redis.set(SUBS_KEY, rest);
        return res.status(200).json({ ok: true, devices: rest.length });
      }

      if (body.action === "test") {
        const r = await sendToAll({ title: "🔔 Ascend", body: "Test erfolgreich — so sehen deine Erinnerungen aus.", url: "/", tag: "test" }, req.headers.host);
        return res.status(200).json({ ok: true, ...r });
      }

      return res.status(400).json({ error: "Unbekannte Aktion" });
    }

    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    return res.status(500).json({ error: "Push-Fehler", detail: String(err) });
  }
}
