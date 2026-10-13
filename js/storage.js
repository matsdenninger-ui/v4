"use strict";
/* ASCEND storage.js — State-Modell, localStorage, Cloud-Sync, Grundinit */

/* ---------- Storage (localStorage mit In-Memory-Fallback) ---------- */
const LS_KEY = "ascend_state_v1";
const LS_PREV_KEY = "ascend_state_prev";   // Sicherungskopie vor jeder Cloud-Übernahme
const APP_STATE_VERSION = 26;              // hochzählen, sobald neue Felder dazukommen
let memoryFallback = null;

/* Felder, die erst spätere App-Versionen eingeführt haben. Ein Gerät mit
   älterer App-Version schickt sie gar nicht mit — dann dürfen sie beim
   Zusammenführen NICHT durch Standardwerte ersetzt werden.
     v21: Trainings-App
     v26: Glaubenssätze/Experimente/Beweise + Session-Rahmen (Pre-Flight) */
const RESCUE_FIELDS = ["trainingSplit","trainingDays","trainingGoal","restDefault","restSound","activeSession","sessions",
  "beliefs","evidence","experiments","focusSessions"];

/* Felder, bei denen null ein echter Wert ist ("läuft nicht mehr") und nicht
   "diese App-Version kennt das Feld nicht". Nur hier darf ein null aus der
   Cloud einen lokalen Wert überschreiben, sofern es neuer ist. */
const NULLABLE_FIELDS = ["timerStart","timerId"];

/* ============================================================
   Zeitstempel pro Feld
   Vorher entschied EIN Zeitstempel (updatedAt), welcher Stand der
   neuere ist — für den gesamten Datenbestand. Schon das Öffnen der
   App schreibt diesen Zeitstempel aber neu (To-Do-Rollover,
   Tageswechsel bei den Makros rufen save() auf, noch bevor der
   Cloud-Abgleich läuft). Damit wurde ein Gerät mit wochenaltem Stand
   automatisch zum "neueren" und schob ihn über den frischen Stand.

   Jetzt trägt jedes Feld seinen eigenen Zeitstempel. Sammlungen und
   Protokolle werden weiterhin eintragsweise vereinigt (siehe unten);
   für die übrigen Felder — darunter der Trainingsplan — entscheidet
   der Zeitstempel des Feldes, nicht der des ganzen Datenbestands.
   ============================================================ */
const META_FIELDS = ["updatedAt","appVersion","fieldTs","deletedIds","wipeAt","dedupedAt","xpSetAt","xpFix"];
/* Felder, die eintragsweise zusammengeführt werden (mergeCollections/mergeLogArrays)
   und deshalb NICHT feldweise überschrieben werden dürfen. */
const MERGED_FIELDS = ["sessions","workouts","bodyLog","sleep","moods",
  "todos","habits","supplements","routineAM","routinePM","goals","learning","people","knowledge",
  "routineChecks","mealEaten","focusByDate","sessionsByDate","skills","badges","journal","xp","trash",
  "beliefs","evidence","experiments","focusSessions"];
/* hydration steht bewusst NICHT in dieser Liste: Trinkmenge lässt sich per Klick
   oder Reset-Button gewollt verringern. Über mergeDateMax kam der höhere Wert nach
   jedem Abgleich zurück — jetzt entscheidet der Feld-Zeitstempel. */

function contentKeys(state){ return Object.keys(state).filter(k => !META_FIELDS.includes(k)); }
function plainKeys(state){ return contentKeys(state).filter(k => !MERGED_FIELDS.includes(k)); }

/* Ältere Stände kennen fieldTs nicht — dort gilt für alle Felder ihr globaler Zeitstempel. */
function ensureFieldTs(state){
  if(!state) return state;
  if(!state.fieldTs || typeof state.fieldTs !== "object") state.fieldTs = {};
  const base = state.updatedAt || 0;
  contentKeys(state).forEach(k=>{ if(typeof state.fieldTs[k] !== "number") state.fieldTs[k] = base; });
  return state;
}
function isCurrentFormat(state){ return !!(state && state.fieldTs && (state.appVersion||0) >= 23); }
function fieldStamp(state, key, isCurrent){
  if(isCurrent && state.fieldTs && typeof state.fieldTs[key] === "number") return state.fieldTs[key];
  return state.updatedAt || 0;   // Stand einer älteren App-Version: ein Zeitstempel für alles
}
function mergeFieldTs(local, remote){
  const remoteCurrent = isCurrentFormat(remote);
  const out = Object.assign({}, (local && local.fieldTs) || {});
  contentKeys(local || {}).concat(contentKeys(remote || {})).forEach(k=>{
    const lt = local ? fieldStamp(local, k, true) : 0;
    const rt = remote ? fieldStamp(remote, k, remoteCurrent) : 0;
    out[k] = Math.max(lt, rt, out[k] || 0);
  });
  return out;
}

/* Nur Felder, die sich wirklich geändert haben, bekommen einen neuen Zeitstempel.
   Ein Render oder ein Reload allein verändert nichts. */
let lastSnapshot = {};
function snapshotOf(state){
  const out = {};
  contentKeys(state).forEach(k=>{ try{ out[k] = JSON.stringify(state[k]); }catch(e){ out[k] = "?"; } });
  return out;
}
function stampChanges(){
  ensureFieldTs(S);
  const snap = snapshotOf(S), now = Date.now();
  let changed = 0;
  Object.keys(snap).forEach(k=>{ if(snap[k] !== lastSnapshot[k]){ S.fieldTs[k] = now; changed++; } });
  lastSnapshot = snap;
  if(changed) S.updatedAt = now;
  return changed;
}
/* Nach dem Übernehmen eines fremden Stands ist dessen Inhalt die neue
   Vergleichsbasis — sonst gälte beim nächsten Speichern alles als geändert. */
function resetChangeTracking(){ lastSnapshot = snapshotOf(S); }

function defaultState(){
  return {
    xp: 0,
    todos: [],                       // {id, text, done, date, estMinutes, focusedMinutes, order,
                                      //  parent_id|null, is_outcome, scheduled_date, status}
                                      // date = zugewiesener Tag (YYYY-MM-DD) ODER null = nicht eingeplant
                                      // Weekly Board zeigt To-Dos gruppiert nach date; die Liste zeigt den Backlog
                                      // Outcomes: is_outcome=true, kein parent_id. Subtasks: parent_id = Outcome-id.
                                      // „Klar" ist ein Outcome nur mit mindestens einem OFFENEN Subtask.
    habits: [
      {id: "def-habit-lesen",   name: "10 Minuten lesen", dates: {}, note: ""},
      {id: "def-habit-bewegung",name: "Bewegung / Training", dates: {}, note: ""},
      {id: "def-habit-handy",   name: "Kein Handy in der ersten Stunde", dates: {}, note: ""},
    ],
    routineAM: [
      {id: "def-am-wasser",  text: "Glas Wasser trinken", note: ""},
      {id: "def-am-stretch", text: "5 Min. Stretching / Mobility", note: ""},
      {id: "def-am-top3",    text: "Top-3-Prioritäten festlegen", note: ""},
      {id: "def-am-kalt",    text: "Kalt duschen", note: ""},
    ],
    routinePM: [
      {id: "def-pm-screen",  text: "Bildschirm aus 60 Min. vor dem Schlafen", note: ""},
      {id: "def-pm-journal", text: "Abendjournal schreiben", note: ""},
      {id: "def-pm-plan",    text: "Morgigen Tag kurz planen", note: ""},
    ],
    routineChecks: {},               // {"2026-07-28": {itemId:true}}
    focusByDate: {},                 // {"date": minutes}
    sessionsByDate: {},              // {"date": count}
    timerStart: null,
    timerId: null,                   // Kennung der laufenden Session
    lastFocusId: null,               // zuletzt angerechnete Session — verhindert doppelte Gutschrift,
                                      // wenn zwei Geräte dieselbe Session beenden
    nutrition: { extraKcal:0, extraPro:0, extraCarb:0, extraFat:0, tKcal:2800, tPro:220, tCarb:300, tFat:80, date: todayKey() },
    mealPlan: "",                    // freie Notizen (Ausnahmen, auswärts essen, ...)
    mealSlots: {                     // ausgewählte Variante + Uhrzeit je Slot
      slot1:{idx:0,time:"07:00"}, slot2:{idx:0,time:"10:00"}, slot3:{idx:0,time:"13:00"},
      slot4:{idx:0,time:"16:30"}, slot5:{idx:0,time:"19:30"}, slot6:{idx:0,time:"21:30"},
    },
    mealEaten: {},                   // {"date": {slot1:true, ...}}
    supplements: SUPP_STACK.map(s => ({id: "def-supp-" + s.name.toLowerCase().replace(/[^a-z0-9]+/g,"-"), name:s.name, icon:s.icon, dose:s.dose, when:s.when, body:s.body, time:s.time, dates:{}})),
    hydration: {},                   // {"date": glasses}
    hydroGoal: 8,
    workouts: [],                    // Schnell-Log: {id, date, name, sets, reps, kg}
    gymPlan: "",
    /* ---------- Trainings-App ---------- */
    trainingSplit: "ppl",            // aktive Plan-Vorlage (Key aus SPLITS)
    trainingDays: buildDaysFromSplit("ppl"),
                                     // [{id, name, icon, focus, weekdays:[0-6], exercises:[{id, exId, sets, reps, rest}]}]
    trainingGoal: 6,                 // Ziel-Einheiten pro Woche (aus dem Split abgeleitet)
    restDefault: 90,                 // Standard-Pause in Sekunden
    restSound: true,                 // Signalton am Ende der Pause
    activeSession: null,             // laufende Einheit {id, dayId, name, icon, startedAt, exercises:[{...sets:[{kg,reps,done}]}], restEnd}
    sessions: [],                    // abgeschlossene Einheiten {id, date, name, durationSec, exercises, prs, feeling, note}
    bodyLog: [],                     // {date, kg, waist, arm}
    sleep: [],                       // {date, hours, quality}
    journal: {},                     // {"date": {morning:{gratitude:[3], lookforward:[3], touched}, evening:{good, better, touched}}}
    moods: [],                       // {ts, date, mood, energy, tags:[]}
    learning: [],                    // {id, title, type, progress}
    skills: [
      {cat:"Körper",  items:[{id:uid(),name:"Krafttraining",lvl:0},{id:uid(),name:"Ausdauer",lvl:0},{id:uid(),name:"Mobilität",lvl:0}]},
      {cat:"Geist",   items:[{id:uid(),name:"Fokus",lvl:0},{id:uid(),name:"Meditation",lvl:0},{id:uid(),name:"Schreiben",lvl:0}]},
      {cat:"Karriere",items:[{id:uid(),name:"Programmieren",lvl:0},{id:uid(),name:"Kommunikation",lvl:0},{id:uid(),name:"Finanzen",lvl:0}]},
    ],
    people: [],                      // {id, name, last}
    goals: [],                       // {id, title, type, skillId, ms:[{text,done}], progress, actionTodos:[{id,text,done}], skillXPGranted}
    knowledge: [],                   // {id, title, notes:"", todos:[{id,text,done}]}
    badges: {},                      // {badgeId: dateUnlocked}
    profile: { name: "", avatar: "🔥" },
    updatedAt: 0,                    // Zeitstempel des letzten Speicherns, für Konfliktauflösung beim Cloud-Sync
    wipeAt: 0,                       // Zeitstempel von "Alles zurücksetzen" — verhindert, dass ein Sync die
                                      // gelöschten Daten von einem noch nicht synchronisierten Gerät zurückholt
    appVersion: APP_STATE_VERSION,   // Datenmodell-Version — erkennt Stände, die von einer älteren App-Version stammen
    deletedIds: [],                  // Grabsteine: bewusst gelöschte Einträge kommen beim Sync nicht zurück
    trash: [],                       // gelöschte To-Dos, 30 Tage wiederherstellbar: {...todo, deletedAt}
    xpSetAt: 0,                      // Zeitstempel der letzten bewussten XP-/Level-Korrektur
    xpFix: null,                     // Kennung bereits angewandter einmaliger XP-Korrekturen
    /* ---------- Verhalten → Beweise (v26) ----------
       Beliefs hängen an Zielen, Evidence hängt an Beliefs und Sessions,
       Experiments koppeln Wenn-dann an einen Kontext (deep_work | workout | general). */
    beliefs: [],                     // {id, old_statement, replacement_statement, strength 1-5, goal_id|null, active, touched}
    evidence: [],                    // {id, belief_id, session_id|null, text, created_at, touched}
    experiments: [],                 // {id, if_text, then_text, context, started_on, duration_days, status, touched}
    focusSessions: [],               // {id, context, outcome_task_id, goal_id, belief_id, challenge, duration_min,
                                      //  distraction_plan, preflight{6 Toggles}, started_at, ended_at,
                                      //  flow_score, evidence_text, next_subtask_text, touched}
  };
}

/* ---------- Migration: Todos um die Outcome-Felder ergänzen ----------
   Bestehende Einträge bekommen parent_id/is_outcome/scheduled_date/status
   nachgetragen — alte Daten bleiben vollständig erhalten und werden nur
   beschrieben, nicht umgedeutet. `date`/`done` bleiben führend; `status`
   und `scheduled_date` werden daraus gespiegelt. */
function normalizeTodo(t){
  if(!t || typeof t !== "object") return t;
  if(!Object.prototype.hasOwnProperty.call(t, "parent_id")) t.parent_id = null;
  if(t.is_outcome === undefined) t.is_outcome = false;
  if(!Object.prototype.hasOwnProperty.call(t, "scheduled_date")) t.scheduled_date = t.date || null;
  const soll = t.done ? "done" : "open";
  if(t.status !== soll) t.status = soll;
  // Ein Subtask kann kein Outcome sein — sonst zählt er doppelt auf Heute.
  if(t.parent_id) t.is_outcome = false;
  return t;
}
function normalizeTodos(state){
  if(state && Array.isArray(state.todos)) state.todos.forEach(normalizeTodo);
  return state;
}

/* ---------- Level von Hand setzen ----------
   XP werden beim Abgleich sonst nur größer (siehe mergeXp). Eine Korrektur
   braucht deshalb einen Zeitstempel, damit sie auf allen Geräten gewinnt. */
function xpFloorForLevel(level){
  let lvl = 1, need = 100, floor = 0;
  while(lvl < level){ floor += need; lvl++; need = 100 + (lvl-1)*50; }
  return floor;
}
function setLevel(level){
  const lvl = Math.max(1, Math.min(999, Math.round(level) || 1));
  S.xp = xpFloorForLevel(lvl);
  S.xpSetAt = Date.now();
  save();
  return lvl;
}

/* Bewusst gelöschte Einträge merken, damit sie ein anderes Gerät
   beim Zusammenführen nicht wieder einspielt. */
function tombstone(id){
  if(!id) return;
  if(!Array.isArray(S.deletedIds)) S.deletedIds = [];
  if(!S.deletedIds.includes(id)) S.deletedIds.push(id);
  if(S.deletedIds.length > 500) S.deletedIds = S.deletedIds.slice(-500);
}

/* Einmalige Bereinigung: Vor den stabilen IDs erzeugte JEDES Gerät die
   Standard-Einträge (Habits, Routinen, Supplements) mit eigenen IDs. Beim
   Abgleich hielt der Merge sie für verschiedene Einträge — aus 3 Habits
   wurden 6, dann 9. Gleichnamige Einträge werden hier einmalig
   zusammengeführt, die überzähligen IDs als gelöscht vermerkt, damit ein
   anderes Gerät sie nicht wieder einspielt. */
function dedupeByLabel(list, labelKey, deletedIds){
  const seen = new Map(), out = [];
  (list||[]).forEach(it=>{
    if(!it) return;
    const key = String(it[labelKey]||"").trim().toLowerCase();
    const first = seen.get(key);
    if(!first){ seen.set(key, it); out.push(it); return; }
    if(first.dates || it.dates) first.dates = mergeDateFlags(first.dates, it.dates);
    if(!first.note && it.note) first.note = it.note;
    if(it.id && !deletedIds.includes(it.id)) deletedIds.push(it.id);
  });
  return out;
}
function dedupeDefaults(state){
  if(state.dedupedAt) return state;
  if(!Array.isArray(state.deletedIds)) state.deletedIds = [];
  const del = state.deletedIds;
  state.habits      = dedupeByLabel(state.habits,      "name", del);
  state.supplements = dedupeByLabel(state.supplements, "name", del);
  state.routineAM   = dedupeByLabel(state.routineAM,   "text", del);
  state.routinePM   = dedupeByLabel(state.routinePM,   "text", del);
  state.dedupedAt = Date.now();
  return state;
}

/* Einmalige Korrektur: der ungedeckelte Deep-Work-Timer rechnete vergessene
   Sessions in voller Länge an (drei Tage = 4.320 XP). Das hat das Level
   verfälscht — einmalig auf Level 10 zurücksetzen. Läuft über die Kennung
   genau ein Mal, auch über mehrere Geräte hinweg. */
const XP_FIX_ID = "timer-overflow-level10";
let xpFixApplied = false;
function applyXpFix(state){
  if(state.xpFix === XP_FIX_ID) return state;
  state.xp = xpFloorForLevel(10);
  state.xpSetAt = Date.now();
  state.xpFix = XP_FIX_ID;
  xpFixApplied = true;
  return state;
}

function loadState(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    if(raw){ return applyXpFix(dedupeDefaults(normalizeTodos(Object.assign(defaultState(), JSON.parse(raw))))); }
  }catch(e){ /* localStorage nicht verfügbar (z. B. Sandbox) */ }
  // Frischer Start: nichts zu korrigieren — ein neuer Stand beginnt bei Level 1.
  return memoryFallback ? memoryFallback : defaultState();
}
function save(){
  S.appVersion = APP_STATE_VERSION;
  const changed = stampChanges();          // stempelt nur, was sich wirklich geändert hat
  try{ localStorage.setItem(LS_KEY, JSON.stringify(S)); }
  catch(e){ memoryFallback = S; }
  writeSnapshot();
  if(changed) cloudSave();                 // ohne echte Änderung nichts in die Cloud schieben
}


/* ============================================================
   Zusammenführen statt Überschreiben
   Früher wurde ein neuerer Cloud-Stand komplett über den lokalen
   gelegt. Schrieb ein zweites Gerät (oder ein Tab mit älterer
   App-Version) danach seinen Stand, verschwanden damit lokal
   angelegte Trainingspläne und geloggte Einheiten spurlos.
   Jetzt gilt:
     · Protokolle (Einheiten, Workouts, Gewicht, Schlaf, Stimmung)
       werden additiv vereinigt — Geloggtes geht nie verloren.
     · Editierbare Listen (To-Dos, Habits, Routinen, Ziele, Wissen, Lernen,
       Menschen) werden pro Eintrag anhand von `touched` vereinigt, nicht als
       ganzes Array ersetzt — sonst gewinnt bei jedem Sync einfach, wer
       zuletzt lokal gespeichert hat, auch wenn dessen Stand veraltet war
       (genau das ließ Knowledge-Themen und To-Do-Reihenfolge verschwinden).
     · Tages-Häkchen (Routine, Mahlzeiten, Habit-/Supplement-Tage) sind
       einmal gesetzt für immer gesetzt — ein Sync kann sie nicht mehr auf
       0 zurücksetzen.
     · Tages-Zahlen (Fokuszeit, Sessions), Skill-Level, XP und Badges laufen
       nie rückwärts (jeweils das Maximum/die Vereinigung beider Seiten).
       Trinkmenge ist bewusst ausgenommen — die lässt sich per Klick oder
       Reset-Button gewollt verringern.
     · Journal wird pro Tag vereinigt statt als Ganzes ersetzt.
     · Felder, die die Gegenseite gar nicht kennt, bleiben lokal.
     · Bewusst Gelöschtes bleibt gelöscht (deletedIds).
     · "Alles zurücksetzen" setzt `wipeAt` — ein danach synchronisiertes,
       noch nicht aktualisiertes Gerät holt die gelöschten Daten dann NICHT
       per Merge zurück (sonst würde jeder obige Punkt einen echten Reset
       unmöglich machen).
   ============================================================ */
function unionBy(remoteArr, localArr, keyFn, deleted){
  const out = [], seen = new Set();
  (remoteArr||[]).concat(localArr||[]).forEach(item=>{
    if(!item) return;
    const k = keyFn(item);
    if(k == null || seen.has(k)) return;      // Cloud-Eintrag gewinnt bei gleichem Schlüssel
    if(deleted && deleted.has(k)) return;     // gelöscht bleibt gelöscht
    seen.add(k); out.push(item);
  });
  return out;
}

/* Protokoll-Arrays vereinigen. `base` gewinnt bei gleichem Schlüssel. */
const LOG_FIELDS = ["sessions","workouts","bodyLog","sleep","moods"];
function mergeLogArrays(base, other, deleted){
  const byDateAsc  = (a,b)=>String(a.date).localeCompare(String(b.date));
  const byDateDesc = (a,b)=>String(b.date).localeCompare(String(a.date));
  return {
    sessions: unionBy(base.sessions, other.sessions, s=>s.id,          deleted).sort(byDateDesc),
    workouts: unionBy(base.workouts, other.workouts, w=>w.id,          deleted),
    bodyLog:  unionBy(base.bodyLog,  other.bodyLog,  b=>b.date).sort(byDateAsc),
    sleep:    unionBy(base.sleep,    other.sleep,    s=>s.date).sort(byDateAsc),
    moods:    unionBy(base.moods,    other.moods,    m=>String(m.ts)),
  };
}
function deletedSet(a, b){ return new Set([].concat(a.deletedIds||[], b.deletedIds||[])); }
function logsGrew(before, after){
  return LOG_FIELDS.some(k => (after[k]||[]).length > (before[k]||[]).length);
}

/* Editierbare Listen (To-Dos, Habits, Routinen, Ziele, Wissen, Lernen, Menschen)
   vereinigen: anders als Protokolle können sie sich ändern (Reihenfolge, erledigt,
   Text) statt nur zu wachsen. Ein simples "base gewinnt" würde also Änderungen der
   Gegenseite verschlucken. Stattdessen gewinnt pro Eintrag, wer ihn zuletzt
   angefasst hat (`touched`-Zeitstempel) — unabhängig davon, welche Seite insgesamt
   den neueren `updatedAt`-Gesamtstand hat. */
function mergeById(baseArr, otherArr, deleted){
  const map = new Map();
  (otherArr||[]).forEach(t=>{ if(t && !(deleted && deleted.has(t.id))) map.set(t.id, t); });
  (baseArr||[]).forEach(t=>{
    if(!t || (deleted && deleted.has(t.id))) return;
    const existing = map.get(t.id);
    if(!existing || (t.touched||0) >= (existing.touched||0)) map.set(t.id, t);
  });
  return [...map.values()];
}
function arrChanged(before, after){
  return JSON.stringify(before||[]) !== JSON.stringify(after||[]);
}

/* Habits/Supplements: Array per id vereinigen (siehe mergeById), aber die
   verschachtelten "dates"-Häkchen aus BEIDEN Seiten übernehmen. Sonst gewinnt ein
   Gerät strukturell komplett und die am anderen Gerät abgehakten Tage verschwinden —
   selbst wenn das gewinnende Gerät den Eintrag zuletzt nur umbenannt hat. */
function mergeArrWithDates(baseArr, otherArr, deleted){
  const merged = mergeById(baseArr, otherArr, deleted);
  const otherById = new Map((otherArr||[]).map(x=>[x.id,x]));
  const baseById  = new Map((baseArr||[]).map(x=>[x.id,x]));
  return merged.map(item=>{
    const a = baseById.get(item.id), b = otherById.get(item.id);
    if(a && b) return Object.assign({}, item, { dates: mergeDateFlags(a.dates, b.dates) });
    return item;
  });
}

/* Datums-Dict mit Boolean-Flags (Routine-/Mahlzeiten-Checks, Habit-/Supplement-Tage):
   einmal abgehakt bleibt abgehakt. Ohne das kann ein Sync mit einem Gerät, das den
   heutigen Klick noch nicht kennt, ein Häkchen wieder auf 0 zurücksetzen. */
/* Tages-Häkchen vereinigen. Es gibt ZWEI Formen:
     · verschachtelt  — routineChecks/mealEaten: {"2026-08-25": {itemId:true}}
     · einfach        — habit.dates/supplement.dates: {"2026-08-25": true}
   Die einfache Form wurde bisher verschluckt: Object.assign({}, true, true)
   ergibt {}, damit war jedes abgehakte Habit nach dem nächsten Sync wieder leer. */
function mergeDateFlags(baseDict, otherDict){
  const out = {};
  const dates = new Set([...Object.keys(baseDict||{}), ...Object.keys(otherDict||{})]);
  dates.forEach(d=>{
    const a = (baseDict||{})[d], b = (otherDict||{})[d];
    const aObj = a && typeof a === "object", bObj = b && typeof b === "object";
    if(aObj || bObj){
      const merged = Object.assign({}, bObj ? b : null, aObj ? a : null);
      if(Object.keys(merged).length) out[d] = merged;
    } else if(a || b){
      out[d] = a || b;      // einmal gesetzt bleibt gesetzt
    }
  });
  return out;
}

/* Datums-Dict mit Zahlen (Fokuszeit, Sessions): fällt nie unter das Maximum
   beider Seiten. Gilt NICHT für Trinkmenge (S.hydration) — die lässt sich per
   Klick oder Reset-Button bewusst verringern, "nie sinken" würde das aushebeln. */
function mergeDateMax(baseDict, otherDict){
  const out = {};
  const dates = new Set([...Object.keys(baseDict||{}), ...Object.keys(otherDict||{})]);
  dates.forEach(d=>{ out[d] = Math.max((baseDict||{})[d]||0, (otherDict||{})[d]||0); });
  return out;
}

/* Skills: Level läuft nie rückwärts (wie XP). */
function mergeSkills(baseCats, otherCats){
  const otherMap = new Map();
  (otherCats||[]).forEach(c=>(c.items||[]).forEach(i=>otherMap.set(i.id,i)));
  return (baseCats||[]).map(cat=>({
    cat: cat.cat,
    items: (cat.items||[]).map(it=>{
      const o = otherMap.get(it.id);
      return o ? Object.assign({}, it, {lvl: Math.max(it.lvl||0, o.lvl||0)}) : it;
    })
  }));
}

/* Badges: einmal freigeschaltet bleibt freigeschaltet. */
function mergeBadges(baseDict, otherDict){
  return Object.assign({}, otherDict||{}, baseDict||{});
}

/* Journal: pro Tag vereinigen statt das ganze Tagebuch (alle Tage!) zu ersetzen.
   Innerhalb eines Tages gewinnt pro Morgen-/Abendteil, wer ihn zuletzt gespeichert
   hat (`touched`). Ohne das würde jeder Sync die komplette Journal-Historie eines
   Geräts durch die des anderen ersetzen. */
function mergeJournal(baseDict, otherDict){
  const out = {};
  const dates = new Set([...Object.keys(baseDict||{}), ...Object.keys(otherDict||{})]);
  dates.forEach(d=>{
    const a = (baseDict||{})[d], b = (otherDict||{})[d];
    if(a && b){
      const pick = (x,y)=> !x ? y : !y ? x : (x.touched||0) >= (y.touched||0) ? x : y;
      out[d] = { morning: pick(a.morning, b.morning), evening: pick(a.evening, b.evening) };
    } else out[d] = a || b;
  });
  return out;
}

/* XP wachsen normalerweise nur — beim Zusammenführen gewinnt deshalb der höhere
   Wert, damit auf einem Gerät verdiente XP nicht verschwinden. Eine BEWUSSTE
   Korrektur (Level von Hand gesetzt) muss aber kleiner werden dürfen: ohne
   Sonderregel holt das andere Gerät den alten, zu hohen Stand sofort zurück.
   Dafür trägt die Korrektur einen Zeitstempel; die jüngere gewinnt. */
function mergeXp(base, other){
  const bs = base.xpSetAt||0, os = other.xpSetAt||0;
  if(bs !== os) return (bs > os ? base.xp : other.xp) || 0;
  return Math.max(base.xp||0, other.xp||0);
}

/* Alle editierbaren Sammlungen an einer Stelle vereinigen (`base` = strukturell
   bevorzugte Seite bei Gleichstand, betrifft aber nur Metadaten wie Titel/Text —
   Häkchen, Level und XP gehen nie verloren). */
function mergeCollections(base, other, deleted){
  return {
    todos:      mergeById(base.todos, other.todos, deleted),
    habits:     mergeArrWithDates(base.habits, other.habits, deleted),
    supplements:mergeArrWithDates(base.supplements, other.supplements, deleted),
    routineAM:  mergeById(base.routineAM, other.routineAM, deleted),
    routinePM:  mergeById(base.routinePM, other.routinePM, deleted),
    goals:      mergeById(base.goals, other.goals, deleted),
    learning:   mergeById(base.learning, other.learning, deleted),
    people:     mergeById(base.people, other.people, deleted),
    knowledge:  mergeById(base.knowledge, other.knowledge, deleted),
    routineChecks:  mergeDateFlags(base.routineChecks, other.routineChecks),
    mealEaten:      mergeDateFlags(base.mealEaten, other.mealEaten),
    focusByDate:    mergeDateMax(base.focusByDate, other.focusByDate),
    sessionsByDate: mergeDateMax(base.sessionsByDate, other.sessionsByDate),
    skills:  mergeSkills(base.skills, other.skills),
    badges:  mergeBadges(base.badges, other.badges),
    journal: mergeJournal(base.journal, other.journal),
    xp: mergeXp(base, other),
    // Verhalten → Beweise: pro Eintrag nach `touched` vereinigen, damit weder
    // Glaubenssätze noch Beweise oder eine auf dem anderen Gerät beendete
    // Session beim Abgleich verloren gehen. Nur anhängen wäre falsch — eine
    // Session wird beim Beenden in place ergänzt (ended_at, flow_score).
    beliefs:      mergeById(base.beliefs, other.beliefs, deleted),
    evidence:     mergeById(base.evidence, other.evidence, deleted),
    experiments:  mergeById(base.experiments, other.experiments, deleted),
    focusSessions: mergeById(base.focusSessions, other.focusSessions, deleted),
    // Papierkorb: NICHT über die Grabsteine filtern — hier liegt ja gerade das Gelöschte
    trash: mergeById(base.trash, other.trash, null)
      .sort((a,b)=>(b.deletedAt||0)-(a.deletedAt||0)).slice(0,100),
  };
}
const COLLECTION_KEYS = ["todos","habits","supplements","routineAM","routinePM","goals","learning","people","knowledge",
  "beliefs","evidence","experiments","focusSessions"];
function collectionsChanged(before, after){
  return COLLECTION_KEYS.some(k=>arrChanged(before[k], after[k]))
    || JSON.stringify(before.routineChecks) !== JSON.stringify(after.routineChecks)
    || JSON.stringify(before.mealEaten) !== JSON.stringify(after.mealEaten)
    || JSON.stringify(before.focusByDate) !== JSON.stringify(after.focusByDate)
    || JSON.stringify(before.sessionsByDate) !== JSON.stringify(after.sessionsByDate)
    || JSON.stringify(before.skills) !== JSON.stringify(after.skills)
    || JSON.stringify(before.badges) !== JSON.stringify(after.badges)
    || JSON.stringify(before.journal) !== JSON.stringify(after.journal)
    || (after.xp||0) > (before.xp||0);
}

/* Cloud-Stand ist neuer: übernehmen, aber lokale Daten retten.
   Liefert {state, localExtras} — localExtras = true, wenn dieses Gerät Daten
   hatte, die in der Cloud fehlten (dann muss die Cloud nachziehen). */
function mergeCloudState(local, remote){
  ensureFieldTs(local);
  // Hat DIESES Gerät gerade "Alles zurücksetzen" ausgeführt? Dann darf der alte
  // Cloud-Stand nicht zurückgemischt werden — sonst macht der Abgleich den Reset rückgängig.
  if((local.wipeAt||0) > (remote.updatedAt||0)){
    return { state: local, localExtras: true };
  }
  const merged = Object.assign(defaultState(), remote);
  const remoteVersion = remote.appVersion || 0;
  const localVersion  = local.appVersion  || 0;
  const remoteCurrent = isCurrentFormat(remote);

  // Wurde die Cloud per "Alles zurücksetzen" geleert, NACHDEM dieses Gerät zuletzt
  // gespeichert hat? Dann ist der lokale Stand komplett veraltet (Vor-Reset) — er
  // darf nicht in den frisch geleerten Cloud-Stand zurückgemischt werden, sonst
  // macht das übliche "nichts geht verloren"-Merge den Reset rückgängig.
  const remoteWipedLocal = (remote.wipeAt||0) > (local.updatedAt||0);

  // 1) Neue Felder retten, wenn die Cloud sie (noch) nicht kennt
  let rescued = false;
  if(!remoteWipedLocal){
    RESCUE_FIELDS.forEach(k=>{
      const remoteHasField = Object.prototype.hasOwnProperty.call(remote, k) && remote[k] != null;
      if(!remoteHasField || remoteVersion < localVersion){
        if(local[k] != null){ merged[k] = local[k]; rescued = true; }
      }
    });
  }

  // 2) Protokolle vereinigen (Cloud gewinnt bei Konflikten)
  const deleted = deletedSet(local, remote);
  const before = Object.assign({}, merged);
  if(!remoteWipedLocal){
    Object.assign(merged, mergeLogArrays(merged, local, deleted));
  }
  merged.deletedIds = [...deleted].slice(-500);

  // 2b) Editierbare Sammlungen (To-Dos, Habits, Routinen, Ziele, Wissen, Lernen,
  //     Menschen, Skills, Badges, Journal, Checks, XP) pro Eintrag vereinigen statt
  //     komplett zu ersetzen — sonst gewinnt bei jedem Sync einfach, wer zuletzt
  //     lokal gespeichert hat, auch wenn dessen Stand veraltet war (genau das ließ
  //     z. B. Knowledge-Themen und abgehakte Routine-Schritte verschwinden).
  if(!remoteWipedLocal){
    Object.assign(merged, mergeCollections(merged, local, deleted));
  }


  // 2c) Einzelfelder (Trainingsplan, Notizen, Profil, Makro-Ziele, Mahlzeitenplan …)
  //     feldweise nach Zeitstempel entscheiden. Basis oben ist der Cloud-Stand; hier
  //     holen wir zurück, was DIESES Gerät zuletzt geändert hat. Ohne diesen Schritt
  //     gewinnt weiterhin einfach, wer zuletzt irgendetwas gespeichert hat.
  let plainKept = false;
  if(!remoteWipedLocal){
    plainKeys(local).forEach(k=>{
      if(local[k] === undefined) return;
      const lt = fieldStamp(local, k, true);
      const rt = fieldStamp(remote, k, remoteCurrent);
      // Für die meisten Felder bedeutet null "kennt das Feld nicht" (ältere
      // App-Version) — dann gewinnt der lokale Wert. Beim Timer ist null aber
      // eine echte Aussage ("Session beendet"). Ohne diese Ausnahme blieb eine
      // auf einem Gerät beendete Session auf dem anderen für immer "laufend".
      const remoteHasField = Object.prototype.hasOwnProperty.call(remote, k)
        && (remote[k] != null || NULLABLE_FIELDS.includes(k));
      if(lt > rt || !remoteHasField){
        if(JSON.stringify(merged[k]) !== JSON.stringify(local[k])){ merged[k] = local[k]; plainKept = true; }
      }
    });
  }
  // 3) Eine laufende Einheit nur retten, wenn die Gegenseite das Feld gar nicht kennt
  //    (ältere App-Version). Sonst entscheidet der Feld-Zeitstempel — andernfalls
  //    taucht eine auf dem anderen Gerät beendete Einheit hier wieder als "läuft" auf.
  if(!merged.activeSession && local.activeSession &&
     !Object.prototype.hasOwnProperty.call(remote, "activeSession")){
    merged.activeSession = local.activeSession;
  }

  merged.fieldTs = mergeFieldTs(local, remote);
  // Marker der XP-Korrektur mitnehmen — sonst wiederholt das andere Gerät sie
  // oder überschreibt den korrigierten Stand wieder mit dem alten.
  merged.xpSetAt = Math.max(local.xpSetAt||0, remote.xpSetAt||0);
  merged.xpFix = ((local.xpSetAt||0) >= (remote.xpSetAt||0) ? local.xpFix : remote.xpFix) || local.xpFix || remote.xpFix || null;

  merged.appVersion = Math.max(remoteVersion, localVersion, APP_STATE_VERSION);
  // Eine XP-Korrektur senkt die XP — collectionsChanged() sieht nur Zuwachs und
  // würde sie übersehen, der korrigierte Stand käme nie in die Cloud.
  const xpKorrigiert = (local.xpSetAt||0) > (remote.xpSetAt||0);
  const extras = rescued || plainKept || xpKorrigiert || logsGrew(before, merged) || collectionsChanged(before, merged);
  // Ein Cloud-Stand von einer App-Version vor v26 kennt die Outcome-Felder an den
  // Todos nicht — nachtragen, damit Heute/Backlog auch mit alten Ständen sauber sind.
  return { state: normalizeTodos(merged), localExtras: extras };
}

/* Dieses Gerät ist neuer: nur die Protokolle der Cloud dazunehmen, damit auf
   einem anderen Gerät geloggte Einheiten/Häkchen/Themen beim Hochladen nicht
   verloren gehen. */
function absorbRemoteLogs(local, remote){
  // Hat dieses Gerät gerade "Alles zurücksetzen" ausgeführt (lokal frischer als
  // die letzte bekannte Cloud-Version)? Dann ist die Cloud-Seite komplett veraltet
  // (Vor-Reset) — sie darf nicht zurück in den frisch geleerten lokalen Stand
  // gemischt werden, sonst holt genau dieser Schritt die gelöschten Daten zurück.
  if((local.wipeAt||0) > (remote.updatedAt||0)) return false;

  const deleted = deletedSet(local, remote);
  const before = Object.assign({}, local);
  Object.assign(local, mergeLogArrays(local, remote, deleted));
  Object.assign(local, mergeCollections(local, remote, deleted));
  local.deletedIds = [...deleted].slice(-500);
  return logsGrew(before, local) || collectionsChanged(before, local);
}

/* Sicherungskopie des lokalen Stands, bevor ein Cloud-Stand übernommen wird.
   Reine Notfall-Reserve — liegt unter "ascend_state_prev" im localStorage. */
function backupLocalState(){
  try{ localStorage.setItem(LS_PREV_KEY, JSON.stringify(S)); }catch(e){ /* egal */ }
}


/* ============================================================
   Cloud-Sync (optional) — synchronisiert S über /api/state,
   sobald die Datei auf Vercel gehostet ist und ein Sync-Code
   gesetzt wurde. Läuft rein additiv: ohne Verbindung verhält
   sich alles exakt wie vorher (nur localStorage).
   ============================================================ */
const CLOUD_TOKEN_KEY = "ascend_sync_code";
let cloudSaveTimer = null;
let cloudSyncing = false;

function getCloudToken(){
  try{ return localStorage.getItem(CLOUD_TOKEN_KEY) || ""; }catch(e){ return ""; }
}
/* Nach dem Übernehmen fremder Daten neu zeichnen — aber nicht,
   während gerade in ein Feld getippt wird (Journal, laufende Einheit). */
function adoptRender(){
  const el = document.activeElement;
  if(el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return false;
  renderAll();
  checkBadges();
  return true;
}
function setSyncStatus(text, cls){
  const el = $("syncStatus");
  if(!el) return;
  el.textContent = text;
  el.className = "sync-status" + (cls ? " "+cls : "");
}

function cloudSave(immediate){
  const token = getCloudToken();
  if(!token) return;
  clearTimeout(cloudSaveTimer);
  const push = async ()=>{
    try{
      // Sicherheitscheck: erst prüfen, ob die Cloud inzwischen neuer ist als unser
      // lokaler Stand (z. B. weil ein anderes Gerät zwischenzeitlich gespeichert hat).
      // Ist sie neuer, werden beide Stände zusammengeführt — früher wurde die
      // gerade gemachte lokale Änderung an dieser Stelle stillschweigend verworfen.
      const check = await fetch("/api/state", { headers: { "Authorization": "Bearer " + token } });
      if(check.ok){
        const remote = (await check.json()).data;
        if(remote){
          // IMMER zusammenführen — feldweise, nicht danach, wer global "neuer" ist.
          backupLocalState();
          const before = JSON.stringify(S);
          S = mergeCloudState(S, remote).state;
          save0();
          resetChangeTracking();
          if(JSON.stringify(S) !== before){
            // Es kam wirklich etwas von der Gegenseite dazu -> anzeigen
            openMealSlot = null;
            adoptRender();
            setSyncStatus("☁️ Mit anderem Gerät zusammengeführt", "ok");
          }
        }
        // kein return: der zusammengeführte Stand wird jetzt hochgeladen,
        // damit beide Geräte denselben Datenbestand haben
      }
      const res = await fetch("/api/state", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
        body: JSON.stringify(S)
      });
      if(!res.ok) throw new Error("HTTP "+res.status);
      setSyncStatus("☁️ Synchronisiert · " + new Date().toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"}), "ok");
    }catch(e){
      setSyncStatus("☁️ Sync fehlgeschlagen — offline gespeichert", "err");
    }
  };
  if(immediate){ push(); }
  else{ cloudSaveTimer = setTimeout(push, 900); } // gebündelt, damit nicht bei jedem Tastendruck gesendet wird
}

// Sofortiges Speichern erzwingen, wenn der Tab verlassen/geschlossen wird,
// damit der 900ms-Puffer keine Einträge kurz vor dem Schließen verliert.
document.addEventListener("visibilitychange", ()=>{
  if(document.visibilityState === "hidden" && cloudSaveTimer){
    clearTimeout(cloudSaveTimer);
    cloudSave(true);
  }
  // Beim Zurückkehren in den Tab (z. B. lange offenes Gerät reaktiviert) den
  // Cloud-Stand neu abgleichen, bevor hier weitergearbeitet/gespeichert wird.
  if(document.visibilityState === "visible" && getCloudToken()){
    cloudLoad(true);
  }
});
window.addEventListener("focus", ()=>{
  if(getCloudToken()) cloudLoad(true);
});
window.addEventListener("pagehide", ()=>{
  if(getCloudToken() && cloudSaveTimer){ clearTimeout(cloudSaveTimer); cloudSave(true); }
});
// Regelmäßig abgleichen, solange die App offen ist — sonst merkt ein Gerät
// stundenlang nichts von den Änderungen des anderen.
setInterval(()=>{
  if(getCloudToken() && document.visibilityState === "visible") cloudLoad(true);
}, 120000);

async function cloudLoad(silent){
  const token = getCloudToken();
  if(!token) return;
  if(!silent) setSyncStatus("☁️ Verbinde …");
  try{
    const res = await fetch("/api/state", { headers: { "Authorization": "Bearer " + token } });
    if(res.status === 401){ setSyncStatus("☁️ Falscher Sync-Code", "err"); return; }
    if(!res.ok) throw new Error("HTTP "+res.status);
    const json = await res.json();
    const cloudData = json.data || null;

    if(cloudData){
      // Immer feldweise zusammenführen — unabhängig davon, wer global "neuer" ist.
      // Genau diese Unterscheidung ließ ein Gerät mit altem Stand gewinnen.
      backupLocalState();
      const before = JSON.stringify(S);
      const merge = mergeCloudState(S, cloudData);
      S = merge.state;
      save0();                 // nur lokal cachen
      resetChangeTracking();
      if(JSON.stringify(S) !== before){
        openMealSlot = null;
        adoptRender();
      }
      // Dieses Gerät hat Daten, die der Cloud fehlen -> nachreichen
      if(merge.localExtras) cloudSave(true);
    } else {
      cloudSave(true);         // Cloud ist noch leer
    }
    setSyncStatus("☁️ Verbunden · " + new Date().toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"}), "ok");
  }catch(e){
    setSyncStatus("☁️ Verbindung fehlgeschlagen", "err");
  }
}
/* Rollierende lokale Sicherungen: einmal pro Stunde ein Abzug, die letzten 24
   bleiben liegen. Kostet wenig und ist die Rettung, wenn versehentlich etwas
   gelöscht wurde — der Papierkorb deckt nur To-Dos ab. */
const LS_SNAP_KEY = "ascend_state_snapshots";
function writeSnapshot(){
  try{
    const raw = localStorage.getItem(LS_SNAP_KEY);
    const snaps = raw ? JSON.parse(raw) : [];
    const last = snaps[0];
    if(last && Date.now() - last.at < 3600000) return;      // höchstens stündlich
    snaps.unshift({ at: Date.now(), state: JSON.parse(JSON.stringify(S)) });
    localStorage.setItem(LS_SNAP_KEY, JSON.stringify(snaps.slice(0, 24)));
  }catch(e){ /* Speicher voll oder nicht verfügbar — dann eben ohne */ }
}
/* Alle Quellen, aus denen sich verlorene To-Dos zurückholen lassen. */
function recoverableTodos(){
  const vorhanden = new Set((S.todos||[]).map(t=>String(t.text).trim().toLowerCase()));
  const gefunden = new Map();
  const merke = (t, quelle, zeit)=>{
    if(!t || !t.text) return;
    const key = String(t.text).trim().toLowerCase();
    if(!key || vorhanden.has(key) || gefunden.has(key)) return;
    gefunden.set(key, { text:t.text, estMinutes:t.estMinutes||0, date:t.date||null, quelle, zeit: zeit||0 });
  };
  (S.trash||[]).forEach(t=>merke(t, "Papierkorb", t.deletedAt));
  try{
    const prev = JSON.parse(localStorage.getItem(LS_PREV_KEY) || "null");
    (prev && prev.todos || []).forEach(t=>merke(t, "Sicherung vor Cloud-Abgleich", prev.updatedAt));
  }catch(e){}
  try{
    const snaps = JSON.parse(localStorage.getItem(LS_SNAP_KEY) || "[]");
    snaps.forEach(sn=>((sn.state && sn.state.todos) || []).forEach(t=>merke(t, "Sicherung " + new Date(sn.at).toLocaleString("de-DE",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}), sn.at)));
  }catch(e){}
  return [...gefunden.values()].sort((a,b)=>(b.zeit||0)-(a.zeit||0));
}

function save0(){
  try{ localStorage.setItem(LS_KEY, JSON.stringify(S)); }catch(e){ memoryFallback = S; }
  writeSnapshot();
}

function initCloudSync(){
  const token = getCloudToken();
  if($("syncCode")) $("syncCode").value = token ? "••••••••" : "";
  if(token){ cloudLoad(); }
  $("syncConnect").addEventListener("click", async ()=>{
    const val = $("syncCode").value.trim();
    if(!val || val === "••••••••") return;
    try{ localStorage.setItem(CLOUD_TOKEN_KEY, val); }catch(e){}
    $("syncCode").value = "••••••••";
    await cloudLoad(); // gleicht feldweise in beide Richtungen ab
    toast("Sync-Code gespeichert.");
  });
  if($("syncNowBtn")){
    $("syncNowBtn").addEventListener("click", async ()=>{
      if(!getCloudToken()){ toast("Erst einen Sync-Code hinterlegen."); return; }
      await cloudLoad();
      toast("Abgleich abgeschlossen.");
    });
  }
}


let S = loadState();
ensureFieldTs(S);        // ältere Stände auf Feld-Zeitstempel heben
resetChangeTracking();   // ab hier zählt nur, was sich WIRKLICH ändert
// Die einmalige XP-Korrektur sofort festschreiben, sonst liefe sie bei jedem
// Start erneut und würde den Stand des anderen Geräts immer wieder überholen.
if(xpFixApplied){ try{ localStorage.setItem(LS_KEY, JSON.stringify(S)); }catch(e){} }
const $ = id => document.getElementById(id);