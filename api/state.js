// /api/state.js
// Speichert und liefert den kompletten Dashboard-Zustand als ein einziges JSON-Objekt.
// Läuft als Vercel Serverless Function, Speicher über Upstash Redis (Vercel Marketplace).
//
// Zugriffsschutz: erwartet den Header "Authorization: Bearer <DEIN_APP_SECRET>".
// Das Secret setzt du selbst als Umgebungsvariable APP_SECRET in den Vercel-Projekteinstellungen.
// Nur wer dieses Secret kennt (also du, auf deinen eigenen Geräten), kann lesen/schreiben.

import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv(); // liest UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN automatisch
const STATE_KEY = "ascend_state";

export default async function handler(req, res) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!process.env.APP_SECRET || token !== process.env.APP_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.method === "GET") {
    try {
      const data = await redis.get(STATE_KEY);
      return res.status(200).json({ data: data ?? null });
    } catch (err) {
      return res.status(500).json({ error: "Lesefehler", detail: String(err) });
    }
  }

  if (req.method === "POST") {
    try {
      let body = req.body;
      if (typeof body === "string") {
        body = JSON.parse(body);
      }
      if (!body || typeof body !== "object") {
        return res.status(400).json({ error: "Ungültiger Body" });
      }
      await redis.set(STATE_KEY, body);
      return res.status(200).json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: "Schreibfehler", detail: String(err) });
    }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ error: "Method not allowed" });
}
