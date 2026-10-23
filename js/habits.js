"use strict";
/* ASCEND habits.js — Habit Tracker, Heatmap, Morgen-/Abendroutine */

/* ---------- Habits ---------- */
function addHabit(){
  const v = $("habitInput").value.trim();
  if(!v) return;
  S.habits.push({id:uid(), name:v, dates:{}, note:"", touched:Date.now()});
  $("habitInput").value = ""; save(); renderHabits(); renderHeatmap(); renderHero();
}
$("habitAdd").addEventListener("click", addHabit);
$("habitInput").addEventListener("keydown", e=>{ if(e.key==="Enter") addHabit(); });

function habitStreak(h){
  let streak = 0, d = new Date();
  if(!h.dates[todayKey(d)]) d = addDays(d,-1);       // heute noch offen? Streak ab gestern zählen
  while(h.dates[todayKey(d)]){ streak++; d = addDays(d,-1); }
  return streak;
}

let openNotes = new Set(); // "kind:id" der Einträge mit aufgeklapptem Notizfeld (Habits/Routinen)

function renderHabits(){
  const tk = todayKey();
  const list = $("habitList");
  if(!S.habits.length){
    list.innerHTML = '<div class="empty">🌱 <b>Noch keine Habits.</b><br>Starte mit einem einzigen kleinen Habit — Konsistenz schlägt Intensität.</div>';
  } else {
    list.innerHTML = S.habits.map(h=>{
      const on = !!h.dates[tk], st = habitGraceStreak(h), retten = habitNeedsRescue(h);
      const noteKey = "habit:"+h.id, noteOpen = openNotes.has(noteKey), hasNote = !!(h.note && h.note.trim());
      return `<div class="item-wrap" data-id="${h.id}">
        <div class="check-item ${on?"done":""}">
          <button class="cbx ${on?"on":""}" data-act="habit-toggle" data-id="${h.id}">${ICON_CHECK}</button>
          <span class="txt" style="text-decoration:none;color:${on?"var(--dim)":"inherit"}">${esc(h.name)}</span>
          ${retten ? `<span class="streak rescue" title="Gestern verpasst — heute machen, dann hält die Serie">⚡ heute retten</span>` : ""}
          ${st>0 ? `<span class="streak" title="Nie zweimal aussetzen: ein einzelner verpasster Tag beendet die Serie nicht">🔥 ${st}</span>` : ""}
          <button class="icon-btn note-btn ${hasNote?"has-note":""}" data-act="note-toggle" data-kind="habit" data-id="${h.id}" aria-label="Notiz">📝</button>
          <button class="icon-btn del" data-act="habit-del" data-id="${h.id}">${ICON_X}</button>
        </div>
        ${noteOpen ? `<textarea class="note-area" data-act="note-input" data-kind="habit" data-id="${h.id}" placeholder="Notiz — z. B. Ausführung, Details …">${esc(h.note||"")}</textarea>` : ""}
      </div>`;
    }).join("");
  }
  const done = S.habits.filter(h=>h.dates[tk]).length;
  $("stHabits").textContent = done + "/" + S.habits.length;
  $("stStreak").textContent = S.habits.reduce((m,h)=>Math.max(m,habitStreak(h)),0);
}

function renderHeatmap(){
  const hm = $("heatmap");
  const weeks = 26, cells = [];
  const end = new Date();
  const start = addDays(end, -(weeks*7 - 1));
  // auf Montag zurückrechnen
  const startMon = addDays(start, -((start.getDay()+6)%7));
  const total = Math.ceil((end - startMon)/(864e5)) + 1;
  const max = Math.max(1, S.habits.length);
  for(let i=0;i<total;i++){
    const d = addDays(startMon, i);
    if(d > end){ cells.push('<span class="hm-cell" style="visibility:hidden"></span>'); continue; }
    const k = todayKey(d);
    const c = S.habits.filter(h=>h.dates[k]).length;
    let cls = "";
    if(c>0){ const r=c/max; cls = r>=1?"hm-4": r>=.66?"hm-3": r>=.33?"hm-2":"hm-1"; }
    cells.push(`<span class="hm-cell ${cls}" title="${fmtShort(k)} — ${c} Habit${c===1?"":"s"}"></span>`);
  }
  hm.innerHTML = cells.join("");
}

/* ---------- Routinen ---------- */
function renderRoutine(listId, items, key){
  const tk = todayKey();
  const checks = S.routineChecks[tk] || {};
  $(listId).innerHTML = items.length ? items.map(it=>{
    const on = !!checks[it.id];
    const noteKey = key+":"+it.id, noteOpen = openNotes.has(noteKey), hasNote = !!(it.note && it.note.trim());
    return `<div class="item-wrap draggable-item" data-id="${it.id}">
      <div class="check-item ${on?"done":""}">
        <button class="drag-handle" aria-label="Ziehen zum Umsortieren">${DRAG_ICON}</button>
        <button class="cbx ${on?"on":""}" data-act="routine-toggle" data-id="${it.id}">${ICON_CHECK}</button>
        <span class="txt">${esc(it.text)}</span>
        <button class="icon-btn note-btn ${hasNote?"has-note":""}" data-act="note-toggle" data-kind="${key}" data-id="${it.id}" aria-label="Notiz">📝</button>
        <button class="icon-btn del" data-act="routine-del" data-list="${key}" data-id="${it.id}">${ICON_X}</button>
      </div>
      ${noteOpen ? `<textarea class="note-area" data-act="note-input" data-kind="${key}" data-id="${it.id}" placeholder="Notiz — z. B. Ausführung, Details …">${esc(it.note||"")}</textarea>` : ""}
    </div>`;
  }).join("") : '<div class="empty">Noch keine Punkte — füge oben deine Routine hinzu.</div>';
}
function renderRoutines(){
  renderRoutine("routineAM", S.routineAM, "am");
  renderRoutine("routinePM", S.routinePM, "pm");
}
function addRoutineItem(list){
  const inputId = list === "am" ? "routineAMInput" : "routinePMInput";
  const input = $(inputId);
  const v = input.value.trim();
  if(!v) return;
  const item = {id:uid(), text:v, note:"", touched:Date.now()};
  if(list === "am") S.routineAM.push(item); else S.routinePM.push(item);
  input.value = ""; save(); renderRoutines();
}
$("routineAMInput").addEventListener("keydown", e=>{ if(e.key==="Enter") addRoutineItem("am"); });
$("routinePMInput").addEventListener("keydown", e=>{ if(e.key==="Enter") addRoutineItem("pm"); });


/* ---------- Habit-Ideen ----------
   Kleine, konkrete Gewohnheiten aus den Wissens-Themen der App: Fokus,
   Erholung, Lernen, Kommunikation. Ein Tipp legt sie an. */
const HABIT_IDEAS = [
  ["📵", "90 Min. Fokus im Flugmodus", "Fokus"],
  ["🧠", "Karteikarten wiederholen", "Lernen"],
  ["📖", "30 Minuten lesen", "Lernen"],
  ["🌙", "Feierabend-Ritual machen", "Kopf"],
  ["🚶", "10 Minuten raus in die Natur", "Erholung"],
  ["🔕", "1 Stunde ohne Social Media", "Reize"],
  ["💬", "Bei einem Menschen melden", "Beziehungen"],
  ["🙏", "3 Dinge, die gut liefen", "Psyche"],
  ["🎙", "Eine Sprachnachricht/Rede aufnehmen und anhören", "Sprechen"],
  ["🧘", "5 Minuten nichts tun", "Kopf"],
];
function renderHabitIdeas(){
  const box = $("habitTpl");
  if(!box.classList.contains("open")){ box.innerHTML = ""; return; }
  const vorhanden = new Set(S.habits.map(h=>h.name.toLowerCase()));
  box.innerHTML = HABIT_IDEAS.map(([ico, name, cat])=>{
    const hat = vorhanden.has(name.toLowerCase());
    return `<button class="pf-chip ${hat?"on":""}" data-habit-idea="${esc(name)}" ${hat?"disabled":""}>${ico} ${esc(name)} <small>${esc(cat)}</small></button>`;
  }).join("");
}
$("habitTplBtn").addEventListener("click", ()=>{
  const box = $("habitTpl");
  box.classList.toggle("open");
  $("habitTplBtn").textContent = box.classList.contains("open") ? "Ideen ausblenden" : "🌱 Ideen für Habits";
  renderHabitIdeas();
});
$("habitTpl").addEventListener("click", e=>{
  const b = e.target.closest("[data-habit-idea]"); if(!b || b.disabled) return;
  const name = b.dataset.habitIdea;
  if(S.habits.some(h=>h.name.toLowerCase()===name.toLowerCase())) return;
  S.habits.push({id:uid(), name, dates:{}, note:"", touched:Date.now()});
  save(); renderHabits(); renderHeatmap(); renderHero(); renderHabitIdeas();
  toast("🌱 Habit angelegt: " + name);
});
