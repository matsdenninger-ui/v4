"use strict";
/* ASCEND app.js — Zentrale Event-Delegation, Demo/Reset, Orchestrierung & Start */

/* ============================================================
   Zentraler Klick-Handler (Event Delegation)
   ============================================================ */
document.body.addEventListener("click", e=>{
  const el = e.target.closest("[data-act]");
  if(!el) return;
  const act = el.dataset.act, id = el.dataset.id;
  const tk = todayKey();

  switch(act){
    case "todo-toggle":
      toggleTodoDone(id);
      break;
    case "todo-del":
      deleteTodo(id);
      break;

    case "habit-toggle": {
      const hb = S.habits.find(h=>h.id===id); if(!hb) break;
      if(hb.dates[tk]){ delete hb.dates[tk]; save(); }
      else { hb.dates[tk] = true; save(); addXP(10, "Habit: "+hb.name); }
      renderHabits(); renderHeatmap(); checkBadges();
      break; }
    case "habit-del":
      customConfirm("Habit und Historie wirklich löschen?", {okLabel:"Löschen", danger:true}).then(ok=>{
        if(!ok) return;
        S.habits = S.habits.filter(h=>h.id!==id); save(); renderHabits(); renderHeatmap();
      });
      break;

    case "routine-toggle": {
      if(!S.routineChecks[tk]) S.routineChecks[tk] = {};
      const c = S.routineChecks[tk];
      if(c[id]){ delete c[id]; save(); }
      else { c[id] = true; save(); addXP(2, "Routine-Schritt erledigt"); }
      renderRoutines();
      break; }
    case "routine-add":
      addRoutineItem(el.dataset.list);
      break;
    case "routine-del": {
      const list = el.dataset.list;
      if(list === "am") S.routineAM = S.routineAM.filter(x=>x.id!==id);
      else S.routinePM = S.routinePM.filter(x=>x.id!==id);
      save(); renderRoutines();
      break; }

    case "note-toggle": {
      const kind = el.dataset.kind;
      const key = kind + ":" + id;
      if(openNotes.has(key)) openNotes.delete(key); else openNotes.add(key);
      if(kind === "habit") renderHabits(); else renderRoutines();
      break; }

    case "wb-assign":
      openTodoAssignPicker(parseInt(el.dataset.day));
      break;
    case "wb-toggle":
      toggleTodoDone(id);
      break;
    case "wb-unassign":
      e.stopPropagation();
      unassignTodo(id);
      break;

    case "glass": {
      const i = parseInt(el.dataset.i), cur = S.hydration[tk]||0;
      const next = (i < cur) ? i : i+1;          // Klick auf volles Glas = zurücknehmen
      const gained = next > cur;
      S.hydration[tk] = next; save(); renderHydro();
      if(gained) addXP(2, "Glas Wasser getrunken");
      checkBadges();
      break; }

    case "supp-toggle": {
      const sp = S.supplements.find(s=>s.id===id); if(!sp) break;
      if(sp.dates[tk]){ delete sp.dates[tk]; save(); }
      else { sp.dates[tk] = true; save(); addXP(2, "Supplement: "+sp.name); }
      renderSupps();
      break; }
    case "supp-del":
      S.supplements = S.supplements.filter(s=>s.id!==id); save(); renderSupps(); break;

    case "meal-open": {
      const slot = el.dataset.slot;
      openMealSlot = (openMealSlot === slot) ? null : slot;
      renderMealPlan();
      break; }
    case "meal-shuffle": {
      const slot = el.dataset.slot;
      const total = MEALS[slot].options.length;
      S.mealSlots[slot].idx = (S.mealSlots[slot].idx + 1) % total;
      save(); openMealSlot = slot; renderMealPlan(); renderMacros();
      break; }
    case "meal-eat": {
      const slot = el.dataset.slot;
      if(!S.mealEaten[tk]) S.mealEaten[tk] = {};
      const wasEaten = !!S.mealEaten[tk][slot];
      if(wasEaten){ delete S.mealEaten[tk][slot]; }
      else { S.mealEaten[tk][slot] = true; }
      save(); openMealSlot = slot; renderMealPlan(); renderMacros();
      if(!wasEaten) addXP(5, MEALS[slot].label+" geloggt");
      checkBadges();
      break; }

    case "wo-del":
      S.workouts = S.workouts.filter(w=>w.id!==id); save(); renderWorkouts(); renderStrengthSel(); break;

    case "learn-del":
      S.learning = S.learning.filter(l=>l.id!==id); save(); renderLearning(); break;

    case "person-ping": {
      const p = S.people.find(p=>p.id===id); if(!p) break;
      p.last = tk; save(); renderPeople();
      toast("Check-in bei "+p.name+" notiert 💬");
      break; }
    case "person-del":
      S.people = S.people.filter(p=>p.id!==id); save(); renderPeople(); break;

    case "goal-del":
      customConfirm("Ziel wirklich löschen?", {okLabel:"Löschen", danger:true}).then(ok=>{
        if(!ok) return;
        S.goals = S.goals.filter(g=>g.id!==id); save(); renderGoals();
      });
      break;
    case "ms-toggle": {
      const g = S.goals.find(g=>g.id===id); if(!g) break;
      const m = g.ms[parseInt(el.dataset.i)]; if(!m) break;
      m.done = !m.done; save();
      if(m.done){
        addXP(25, "Meilenstein erreicht: "+m.text);
        if(g.ms.every(x=>x.done)) grantGoalCompletionXP(g);
      }
      renderGoals();
      break; }

    case "goal-todo-add": {
      const g = S.goals.find(g=>g.id===id); if(!g) break;
      const input = document.querySelector(`[data-act="goal-todo-input"][data-id="${id}"]`);
      const text = input ? input.value.trim() : "";
      if(!text) break;
      if(!g.actionTodos) g.actionTodos = [];
      g.actionTodos.push({id:uid(), text, done:false});
      save(); renderGoals();
      break; }
    case "goal-todo-toggle": {
      const g = S.goals.find(g=>g.id===id); if(!g) break;
      const at = (g.actionTodos||[]).find(x=>x.id===el.dataset.tid); if(!at) break;
      at.done = !at.done; save(); renderGoals();
      if(at.done) addXP(5, "Aufgabe erledigt: "+at.text);
      break; }
    case "goal-todo-del": {
      const g = S.goals.find(g=>g.id===id); if(!g) break;
      g.actionTodos = (g.actionTodos||[]).filter(x=>x.id!==el.dataset.tid);
      save(); renderGoals();
      break; }

    case "hero-avatar": {
      const cur = AVATAR_OPTIONS.indexOf(S.profile.avatar);
      S.profile.avatar = AVATAR_OPTIONS[(cur+1) % AVATAR_OPTIONS.length];
      save(); renderHero();
      break; }
    case "hero-name-edit":
      editingName = true; renderHero();
      break;
    case "goto-goals":
      document.querySelector('#nav button[data-page="goals"]').click();
      break;
  }
  // Hero-Leiste & Fokus-Ziele reagieren auf so gut wie jede Aktion auf der Today-Seite
  if(["habit-toggle","habit-del","routine-toggle","routine-add","routine-del",
      "meal-eat","meal-shuffle","supp-toggle","goal-del","ms-toggle","glass"].includes(act)){
    renderHero();
  }
  if(["goal-del","ms-toggle"].includes(act)) renderTodayFocusGoals();
});

/* Range-Slider (input statt click) */
document.body.addEventListener("input", e=>{
  const el = e.target.closest("[data-act]");
  if(!el) return;
  if(el.dataset.act === "note-input"){
    const kind = el.dataset.kind, nid = el.dataset.id;
    let obj = null;
    if(kind === "habit") obj = S.habits.find(h=>h.id===nid);
    else if(kind === "am") obj = S.routineAM.find(x=>x.id===nid);
    else if(kind === "pm") obj = S.routinePM.find(x=>x.id===nid);
    if(obj){ obj.note = el.value; save(); }
    return; // kein Re-Render, damit der Cursor beim Tippen nicht springt
  }
  if(el.dataset.act === "learn-range"){
    const l = S.learning.find(x=>x.id===el.dataset.id); if(!l) return;
    const prev = l.progress;
    l.progress = parseInt(el.value); save();
    el.closest(".check-item").querySelector(".meta").textContent = l.progress+"%";
    if(l.progress > prev) addXP(5, "Lernfortschritt: "+l.title+" → "+l.progress+"%");
    checkBadges();
  }
  if(el.dataset.act === "goal-range"){
    const g = S.goals.find(x=>x.id===el.dataset.id); if(!g) return;
    g.progress = parseInt(el.value); save();
    if(g.progress === 100 && !g.ms.length) grantGoalCompletionXP(g);
    // sanftes Re-Render nach Loslassen
  }
});
document.body.addEventListener("change", e=>{
  if(e.target.closest('[data-act="goal-range"]')){ renderGoals(); renderTodayFocusGoals(); renderHero(); }
  const el = e.target.closest("[data-act]");
  if(!el) return;
  if(el.dataset.act === "meal-time"){
    const slot = el.dataset.slot;
    S.mealSlots[slot].time = el.value; save();
    openMealSlot = slot; renderMealPlan(); renderHero();
  }
  if(el.dataset.act === "supp-time"){
    const sp = S.supplements.find(s=>s.id===el.dataset.id); if(!sp) return;
    sp.time = el.value; save(); renderSupps(); renderHero();
  }
});


/* ============================================================
   Demo-Daten
   ============================================================ */
$("demoBtn").addEventListener("click", async ()=>{
  const ok = await customConfirm("Demo-Daten laden? Bestehende Daten bleiben erhalten, Historie wird ergänzt.", {okLabel:"Laden"});
  if(!ok) return;
  const rnd = (a,b)=>a+Math.random()*(b-a);
  // 60 Tage Historie
  for(let i=60;i>=1;i--){
    const k = todayKey(addDays(new Date(),-i));
    S.habits.forEach(h=>{ if(Math.random() < .72) h.dates[k] = true; });
    const sleepH = +(rnd(5.8,8.6).toFixed(2));
    if(Math.random()<.9 && !S.sleep.find(s=>s.date===k))
      S.sleep.push({date:k, hours:sleepH, quality:Math.round(rnd(4,9))});
    if(Math.random()<.8)
      S.focusByDate[k] = (S.focusByDate[k]||0) + Math.round((sleepH-5.5)*38 + rnd(0,60));
    if(i%7<3 && Math.random()<.6){
      const ex = ["Bankdrücken","Kniebeugen","Kreuzheben"][Math.floor(Math.random()*3)];
      const base = {Bankdrücken:72, Kniebeugen:95, Kreuzheben:120}[ex];
      S.workouts.push({id:uid(), date:k, name:ex, sets:4, reps:8, kg:+(base + (60-i)*0.22 + rnd(-2,2)).toFixed(1)});
    }
    if(i%4===0) S.bodyLog.push({date:k, kg:+(84 - (60-i)*0.045 + rnd(-.4,.4)).toFixed(1), waist:+(88-(60-i)*0.05).toFixed(1), arm:+(38+(60-i)*0.01).toFixed(1)});
  }
  S.sleep.sort((a,b)=>a.date.localeCompare(b.date));
  S.bodyLog.sort((a,b)=>a.date.localeCompare(b.date));
  if(!S.learning.length){
    S.learning.push({id:uid(), title:"Atomic Habits", type:"📖 Buch", progress:65});
    S.learning.push({id:uid(), title:"JavaScript Masterclass", type:"🎓 Kurs", progress:30});
  }
  if(!S.goals.length){
    S.goals.push({id:uid(), title:"100 kg Bankdrücken", type:"fokus", skillId:S.skills[0].items[0].id,
      ms:[{text:"80 kg",done:true},{text:"90 kg",done:true},{text:"95 kg",done:false},{text:"100 kg",done:false}], progress:0});
    S.goals.push({id:uid(), title:"Einen Marathon laufen", type:"lang", skillId:S.skills[0].items[1].id,
      ms:[{text:"10 km",done:true},{text:"Halbmarathon",done:false},{text:"Marathon",done:false}], progress:0});
  }
  S.xp = Math.max(S.xp, 780);
  save(); renderAll(); checkBadges();
  toast("Demo-Daten geladen — viel Spaß beim Erkunden ✦");
});

$("resetBtn").addEventListener("click", async ()=>{
  const ok = await customConfirm(
    "Wirklich ALLE Daten zurücksetzen? Level, XP, Habits, Workouts, Journal, Ziele, Skills — alles wird unwiderruflich gelöscht. Dein Mahlzeitenplan (gewählte Gerichte je Slot) bleibt erhalten.",
    {title:"Alles zurücksetzen?", okLabel:"Ja, alles löschen", danger:true}
  );
  if(!ok) return;
  // Mahlzeitenplan + persönliches Profil vom Reset ausnehmen
  const keepMealSlots = JSON.parse(JSON.stringify(S.mealSlots));
  const keepMealPlanNotes = S.mealPlan;
  const keepProfile = JSON.parse(JSON.stringify(S.profile));
  try{ localStorage.removeItem(LS_KEY); }catch(e){ /* ignore */ }
  memoryFallback = null;
  S = defaultState();
  S.mealSlots = keepMealSlots;
  S.mealPlan = keepMealPlanNotes;
  S.profile = keepProfile;
  save();
  openMealSlot = null;
  clearInterval(timerInterval); timerInterval = null;
  renderAll();
  checkBadges();
  toast("Alle Daten zurückgesetzt — dein Mahlzeitenplan blieb erhalten.");
});


/* ============================================================
   Init
   ============================================================ */
function renderAll(){
  renderLevel();
  renderTodos(); renderHabits(); renderHeatmap(); renderRoutines();
  renderFocus(); renderWeek();
  renderMacros(); renderMealPlan(); renderHydro(); renderSupps();
  $("mealPlan").value = S.mealPlan; $("gymPlan").value = S.gymPlan;
  renderWorkouts(); renderBodyCharts();
  loadJournalToday(); renderJournalHist(); renderMoodHist();
  renderLearning(); renderSkills(); renderPeople();
  renderProgressStats(); renderProgressCharts(); renderBadges(); renderCorrelation();
  renderGoals(); renderGoalSkillSel();
  renderHero(); renderTodayFocusGoals();
}
rolloverTodos();
initTodoDrag();
initWeekDragReorder();
renderAll();
if(S.timerStart) startTimerUI();          // laufende Session nach Reload fortsetzen
checkBadges();
initCloudSync();

/* ============================================================
   Mitternachts-Reset
   Häkchen bei Supplements, Morgen-/Abendroutine & Habits hängen
   an S.*.dates[todayKey()] — bleibt die Seite über 0 Uhr hinaus
   offen, muss die Ansicht aktiv neu gezeichnet werden, damit sie
   sich sichtbar zurücksetzen.
   ============================================================ */
let currentDayKey = todayKey();
setInterval(()=>{
  const nk = todayKey();
  if(nk === currentDayKey) return;
  currentDayKey = nk;
  rolloverTodos();
  renderHabits(); renderHeatmap(); renderRoutines(); renderSupps();
  renderHero(); renderWeek();
}, 30*1000);