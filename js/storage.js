"use strict";
/* ASCEND storage.js — State-Modell, localStorage, Cloud-Sync, Grundinit */

/* ---------- Storage (localStorage mit In-Memory-Fallback) ---------- */
const LS_KEY = "ascend_state_v1";
const LS_PREV_KEY = "ascend_state_prev";   // Sicherungskopie vor jeder Cloud-Übernahme
const APP_STATE_VERSION = 22;              // hochzählen, sobald neue Felder dazukommen
let memoryFallback = null;

/* Felder, die es vor der Trainings-App (v21) noch nicht gab. Ein Gerät mit
   älterer App-Version schickt sie gar nicht mit — dann dürfen sie beim
   Zusammenführen NICHT durch Standardwerte ersetzt werden. */
const V21_FIELDS = ["trainingSplit","trainingDays","trainingGoal","restDefault","restSound","activeSession","sessions"];

function defaultState(){
  return {
    xp: 0,
    todos: [],                       // {id, text, done, date, estMinutes, focusedMinutes, order}
                                      // date = zugewiesener Tag (YYYY-MM-DD) ODER null = nicht eingeplant
                                      // Weekly Board zeigt To-Dos gruppiert nach date; To-Do-Liste zeigt IMMER alle
    habits: [
      {id: uid(), name: "10 Minuten lesen", dates: {}, note: ""},
      {id: uid(), name: "Bewegung / Training", dates: {}, note: ""},
      {id: uid(), name: "Kein Handy in der ersten Stunde", dates: {}, note: ""},
    ],
    routineAM: [
      {id: uid(), text: "Glas Wasser trinken", note: ""},
      {id: uid(), text: "5 Min. Stretching / Mobility", note: ""},
      {id: uid(), text: "Top-3-Prioritäten festlegen", note: ""},
      {id: uid(), text: "Kalt duschen", note: ""},
    ],
    routinePM: [
      {id: uid(), text: "Bildschirm aus 60 Min. vor dem Schlafen", note: ""},
      {id: uid(), text: "Abendjournal schreiben", note: ""},
      {id: uid(), text: "Morgigen Tag kurz planen", note: ""},
    ],
    routineChecks: {},               // {"2026-07-28": {itemId:true}}
    focusByDate: {},                 // {"date": minutes}
    sessionsByDate: {},              // {"date": count}
    timerStart: null,
    nutrition: { extraKcal:0, extraPro:0, extraCarb:0, extraFat:0, tKcal:2800, tPro:220, tCarb:300, tFat:80, date: todayKey() },
    mealPlan: "",                    // freie Notizen (Ausnahmen, auswärts essen, ...)
    mealSlots: {                     // ausgewählte Variante + Uhrzeit je Slot
      slot1:{idx:0,time:"07:00"}, slot2:{idx:0,time:"10:00"}, slot3:{idx:0,time:"13:00"},
      slot4:{idx:0,time:"16:30"}, slot5:{idx:0,time:"19:30"}, slot6:{idx:0,time:"21:30"},
    },
    mealEaten: {},                   // {"date": {slot1:true, ...}}
    supplements: SUPP_STACK.map(s => ({id: uid(), name:s.name, icon:s.icon, dose:s.dose, when:s.when, body:s.body, time:s.time, dates:{}})),
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
  };
}

/* Bewusst gelöschte Einträge merken, damit sie ein anderes Gerät
   beim Zusammenführen nicht wieder einspielt. */
function tombstone(id){
  if(!id) return;
  if(!Array.isArray(S.deletedIds)) S.deletedIds = [];
  if(!S.deletedIds.includes(id)) S.deletedIds.push(id);
  if(S.deletedIds.length > 500) S.deletedIds = S.deletedIds.slice(-500);
}

function loadState(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    if(raw){ return Object.assign(defaultState(), JSON.parse(raw)); }
  }catch(e){ /* localStorage nicht verfügbar (z. B. Sandbox) */ }
  return memoryFallback ? memoryFallback : defaultState();
}
function save(){
  S.updatedAt = Date.now();
  S.appVersion = APP_STATE_VERSION;
  try{ localStorage.setItem(LS_KEY, JSON.stringify(S)); }
  catch(e){ memoryFallback = S; }
  cloudSave();
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
function mergeDateFlags(baseDict, otherDict){
  const out = {};
  const dates = new Set([...Object.keys(baseDict||{}), ...Object.keys(otherDict||{})]);
  dates.forEach(d=>{
    const merged = Object.assign({}, (otherDict||{})[d], (baseDict||{})[d]);
    if(Object.keys(merged).length) out[d] = merged;
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
    xp: Math.max(base.xp||0, other.xp||0),
  };
}
const COLLECTION_KEYS = ["todos","habits","supplements","routineAM","routinePM","goals","learning","people","knowledge"];
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
  const merged = Object.assign(defaultState(), remote);
  const remoteVersion = remote.appVersion || 0;
  const localVersion  = local.appVersion  || 0;

  // Wurde die Cloud per "Alles zurücksetzen" geleert, NACHDEM dieses Gerät zuletzt
  // gespeichert hat? Dann ist der lokale Stand komplett veraltet (Vor-Reset) — er
  // darf nicht in den frisch geleerten Cloud-Stand zurückgemischt werden, sonst
  // macht das übliche "nichts geht verloren"-Merge den Reset rückgängig.
  const remoteWipedLocal = (remote.wipeAt||0) > (local.updatedAt||0);

  // 1) Neue Felder retten, wenn die Cloud sie (noch) nicht kennt
  let rescued = false;
  if(!remoteWipedLocal){
    V21_FIELDS.forEach(k=>{
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

  // 3) Eine laufende Einheit nie durch einen Sync abwürgen
  if(!merged.activeSession && local.activeSession) merged.activeSession = local.activeSession;

  merged.appVersion = Math.max(remoteVersion, localVersion, APP_STATE_VERSION);
  const extras = rescued || logsGrew(before, merged) || collectionsChanged(before, merged);
  return { state: merged, localExtras: extras };
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
        if(remote && (remote.updatedAt || 0) > (S.updatedAt || 0)){
          // Cloud ist neuer -> beide Stände zusammenführen, statt die gerade
          // gemachte lokale Änderung stillschweigend zu verwerfen
          backupLocalState();
          S = mergeCloudState(S, remote).state;
          S.updatedAt = Date.now();
          save0();
          openMealSlot = null;
          // nicht neu zeichnen, während gerade in ein Feld getippt wird (z. B. Journal) —
          // sonst verschwindet der ungespeicherte Text durch einen Sync im Hintergrund
          const activeEl1 = document.activeElement;
          if(!activeEl1 || (activeEl1.tagName !== "INPUT" && activeEl1.tagName !== "TEXTAREA")) renderAll();
          checkBadges();
          setSyncStatus("☁️ Mit anderem Gerät zusammengeführt", "ok");
        } else if(remote){
          // Wir sind neuer -> trotzdem die Protokolle der Cloud übernehmen,
          // damit auf einem anderen Gerät geloggte Einheiten nicht wegfallen
          if(absorbRemoteLogs(S, remote)){
            save0(); checkBadges();
            // nicht neu zeichnen, während gerade in ein Feld getippt wird —
            // sonst verschwinden Eingaben mitten in einer laufenden Einheit
            const el = document.activeElement;
            if(!el || (el.tagName !== "INPUT" && el.tagName !== "TEXTAREA")) renderAll();
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
    const cloudUpdatedAt = cloudData ? (cloudData.updatedAt || 0) : 0;

    if(cloudData && cloudUpdatedAt > (S.updatedAt || 0)){
      // Cloud ist neuer -> übernehmen, aber lokale Daten dabei nicht wegwerfen
      backupLocalState();
      const merge = mergeCloudState(S, cloudData);
      S = merge.state;
      save0(); // nur lokal cachen
      openMealSlot = null;
      // nicht neu zeichnen, während gerade in ein Feld getippt wird (z. B. Journal) —
      // sonst verschwindet der ungespeicherte Text durch einen Sync im Hintergrund
      const activeEl2 = document.activeElement;
      if(!activeEl2 || (activeEl2.tagName !== "INPUT" && activeEl2.tagName !== "TEXTAREA")) renderAll();
      checkBadges();
      if(merge.localExtras){
        // Dieses Gerät hatte Daten, die in der Cloud fehlten -> nachreichen
        S.updatedAt = Date.now();
        save0();
        cloudSave(true);
      }
    } else if((S.updatedAt || 0) > cloudUpdatedAt){
      // Dieses Gerät hat neuere Daten als die Cloud -> Cloud aktualisieren statt sie zu überschreiben
      cloudSave(true);
    }
    setSyncStatus("☁️ Verbunden · " + new Date().toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"}), "ok");
  }catch(e){
    setSyncStatus("☁️ Verbindung fehlgeschlagen", "err");
  }
}
function save0(){
  try{ localStorage.setItem(LS_KEY, JSON.stringify(S)); }catch(e){ memoryFallback = S; }
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
    await cloudLoad(); // vergleicht Zeitstempel und gleicht in beide Richtungen ab
    toast("Sync-Code gespeichert.");
  });
}


let S = loadState();
const $ = id => document.getElementById(id);