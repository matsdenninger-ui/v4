// /api/_push-core.js — gemeinsame Bausteine für Push-Erinnerungen.
// Der Unterstrich sorgt dafür, dass Vercel daraus keinen eigenen Endpunkt macht.
//
// Die VAPID-Schlüssel (Absender-Ausweis für Web-Push) erzeugt der Server beim
// ersten Aufruf selbst und legt sie in Upstash ab — es müssen dafür KEINE
// Umgebungsvariablen eingerichtet werden.

import { Redis } from "@upstash/redis";
import webpush from "web-push";

export const redis = Redis.fromEnv();
export const STATE_KEY = "ascend_state";
export const SUBS_KEY = "ascend_push_subs";
export const VAPID_KEY = "ascend_vapid";
export const SENT_KEY = "ascend_push_sent";

export function authorized(req) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : "";
  const secrets = [process.env.APP_SECRET, process.env.CRON_SECRET].filter(Boolean);
  return !!token && secrets.includes(token);
}

export async function getVapid() {
  let v = await redis.get(VAPID_KEY);
  if (!v || !v.publicKey || !v.privateKey) {
    v = webpush.generateVAPIDKeys();
    await redis.set(VAPID_KEY, v);
  }
  return v;
}

export async function getSubs() {
  const subs = await redis.get(SUBS_KEY);
  return Array.isArray(subs) ? subs : [];
}

/* Schickt eine Nachricht an alle registrierten Geräte. Abgelaufene
   Abos (404/410 vom Push-Dienst) werden dabei aufgeräumt. */
export async function sendToAll(payload, host) {
  const vapid = await getVapid();
  const subject = process.env.VAPID_SUBJECT || (host ? "https://" + host : "mailto:ascend@example.invalid");
  webpush.setVapidDetails(subject, vapid.publicKey, vapid.privateKey);
  const subs = await getSubs();
  const keep = [];
  let sent = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification(s.subscription, JSON.stringify(payload), { TTL: 3 * 3600 });
      sent++;
      keep.push(s);
    } catch (err) {
      const code = err && err.statusCode;
      if (code !== 404 && code !== 410) keep.push(s);   // nur endgültig tote Abos entfernen
    }
  }
  if (keep.length !== subs.length) await redis.set(SUBS_KEY, keep);
  return { sent, devices: keep.length };
}

export function parseBody(req) {
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = null; } }
  return body && typeof body === "object" ? body : {};
}
