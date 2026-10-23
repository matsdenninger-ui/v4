// /api/_reminder-rules.js — Wann welche Erinnerung kommt (ohne Abhängigkeiten,
// damit die Logik auch ohne Server testbar ist).
//
// Jede Erinnerung wird höchstens einmal pro Tag geprüft: sobald ihre Uhrzeit
// erreicht ist (bis 3 Stunden danach, falls der Zeitplan sich verspätet).
// Ob sie wirklich verschickt wird, entscheidet der aktuelle Stand aus dem
// Cloud-Sync — wer seine Habits schon erledigt hat, bekommt keine Habit-Erinnerung.

export const REMINDER_DEFAULTS = {
  plan:       { on: true,  time: "08:00" },
  cards:      { on: true,  time: "18:00" },
  shutdown:   { on: true,  time: "18:30" },
  habits:     { on: true,  time: "20:30" },
  friday:     { on: true,  time: "14:00" },
  comeback:   { on: true,  time: "19:00" },
  screentime: { on: true,  time: "19:00" },
};
const LATE_WINDOW_MIN = 180;

export function localParts(now, tz) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz || "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", weekday: "short", hourCycle: "h23",
  });
  const p = Object.fromEntries(fmt.formatToParts(now).map(x => [x.type, x.value]));
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday);
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: parseInt(p.hour) * 60 + parseInt(p.minute), weekday: wd };
}
function toMin(t) { const [h, m] = String(t || "00:00").split(":").map(Number); return (h || 0) * 60 + (m || 0); }
function daysBetween(a, b) { return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 864e5); }

/* Inhalt je Erinnerung — null heißt „heute nicht nötig“. */
const RULES = {
  plan(S, d) {
    const hatOutcome = (S.todos || []).some(t => t.is_outcome && t.date === d.date);
    return hatOutcome ? null : { title: "🎯 Guten Morgen", body: "Was ist heute dein wichtigstes Ergebnis? Ein Outcome reicht.", url: "/?go=today" };
  },
  cards(S, d) {
    const topics = new Map((S.knowledge || []).map(t => [t.id, t]));
    const due = (S.cards || []).filter(c => {
      if ((c.due || "0000") > d.date) return false;
      if (!c.topic_id) return true;
      const t = topics.get(c.topic_id);
      return !!t && t.para !== "archive";
    }).length;
    return due ? { title: "🧠 " + due + " Karte" + (due === 1 ? "" : "n") + " fällig", body: "Drei Minuten reichen — dann sitzt das Wissen.", url: "/?go=review" } : null;
  },
  shutdown(S, d) {
    if ((S.shutdownByDate || {})[d.date]) return null;
    if (d.weekday === 0 || d.weekday === 6) return null;          // am Wochenende kein Feierabend-Ritual
    return { title: "🌙 Feierabend?", body: "Zwei Minuten: Offenes auf morgen legen und notieren, womit du startest.", url: "/?go=shutdown" };
  },
  habits(S, d) {
    const offen = (S.habits || []).filter(h => !(h.dates || {})[d.date]);
    if (!offen.length) return null;
    const namen = offen.slice(0, 3).map(h => h.name).join(", ");
    return { title: "🔁 Noch " + offen.length + " Habit" + (offen.length === 1 ? "" : "s") + " offen", body: namen + " — nie zweimal aussetzen.", url: "/?go=habits" };
  },
  friday(S, d) {
    if (d.weekday !== 5) return null;
    return { title: "📨 Friday Highlights", body: "Deine Wochen-Mail ist vorbereitet — kurz prüfen und abschicken.", url: "/?go=friday" };
  },
  comeback(S, d, log) {
    const last = S.updatedAt ? localParts(new Date(S.updatedAt), d.tz).date : null;
    if (!last || daysBetween(last, d.date) < 2) return null;
    if (log.lastComeback && daysBetween(log.lastComeback, d.date) < 2) return null;   // höchstens alle 2 Tage
    log.lastComeback = d.date;
    return { title: "👋 Schön, wenn du wieder reinschaust", body: "Kein Aufholen nötig — eine kleine Sache heute reicht.", url: "/?go=today" };
  },
  screentime(S, d) {
    if (d.weekday !== 0) return null;
    return { title: "⏱ Wochen-Check", body: "Wie viel Bildschirmzeit hattest du diese Woche? Kurz eintragen.", url: "/?go=time" };
  },
};

/* Liefert die zu sendenden Nachrichten und aktualisiert das Versand-Log in place. */
export function dueReminders(S, now, log) {
  const cfg = (S && S.reminders) || null;
  if (!cfg || !cfg.enabled) return [];
  const tz = cfg.tz || "Europe/Berlin";
  const d = Object.assign(localParts(now, tz), { tz });
  if (!log.days) log.days = {};
  const today = log.days[d.date] || (log.days[d.date] = {});
  const out = [];
  for (const id of Object.keys(REMINDER_DEFAULTS)) {
    const item = Object.assign({}, REMINDER_DEFAULTS[id], (cfg.items || {})[id] || {});
    if (!item.on || today[id]) continue;
    const t = toMin(item.time);
    if (d.minutes < t || d.minutes >= t + LATE_WINDOW_MIN) continue;
    today[id] = true;                      // heute geprüft — auch wenn nichts nötig war
    const msg = RULES[id](S, d, log);
    if (msg) out.push(Object.assign({ tag: id }, msg));
  }
  // Log klein halten: nur die letzten 7 Tage
  Object.keys(log.days).sort().slice(0, -7).forEach(k => delete log.days[k]);
  return out;
}
