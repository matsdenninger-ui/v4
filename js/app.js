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
        S.habits = S.habits.filter(h=>h.id!==id); tombstone(id); save(); renderHabits(); renderHeatmap();
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
      tombstone(id); save(); renderRoutines();
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
      S.supplements = S.supplements.filter(s=>s.id!==id); tombstone(id); save(); renderSupps(); break;

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
      S.workouts = S.workouts.filter(w=>w.id!==id); tombstone(id);
      save(); renderWorkouts(); renderStrengthSel(); renderTraining(); break;

    /* ---------- Training: laufende Einheit ---------- */
    case "tr-start":
      startSession(id === "free" ? null : id);
      break;
    case "tr-ex-open": {
      const i = parseInt(el.dataset.ex);
      openSessionEx = (openSessionEx === i) ? -1 : i;
      renderSessionCard();
      break; }
    case "tr-set-done":
      toggleSet(parseInt(el.dataset.ex), parseInt(el.dataset.i));
      break;
    case "tr-set-add":
      addSet(parseInt(el.dataset.ex));
      break;
    case "tr-set-del":
      removeSet(parseInt(el.dataset.ex));
      break;
    case "tr-ex-del":
      removeSessionExercise(parseInt(el.dataset.ex));
      break;
    case "tr-ex-pick-session":
      openExPicker("session");
      break;
    case "tr-ex-pick-plan":
      openExPicker("plan");
      break;
    case "tr-finish":
      openFinishModal();
      break;
    case "tr-discard":
      discardSession();
      break;

    /* ---------- Training: Plan ---------- */
    case "plan-split":
      applySplit(el.dataset.split);
      break;
    case "plan-day-sel":
      planDayIdx = parseInt(el.dataset.i); renderPlanEditor();
      break;
    case "plan-day-add":
      S.trainingDays.push({id:uid(), name:"Neuer Tag", icon:"🏋️", focus:"", weekdays:[], exercises:[]});
      planDayIdx = S.trainingDays.length-1; save(); renderTraining();
      break;
    case "plan-day-del":
      customConfirm("Trainingstag wirklich löschen?", {okLabel:"Löschen", danger:true}).then(ok=>{
        if(!ok) return;
        S.trainingDays.splice(parseInt(el.dataset.i), 1);
        planDayIdx = Math.max(0, planDayIdx-1); save(); renderTraining();
      });
      break;
    case "plan-weekday": {
      const day = S.trainingDays[parseInt(el.dataset.i)]; if(!day) break;
      const wd = parseInt(el.dataset.wd);
      if(!day.weekdays) day.weekdays = [];
      const at = day.weekdays.indexOf(wd);
      if(at >= 0) day.weekdays.splice(at,1); else day.weekdays.push(wd);
      save(); renderPlanEditor(); renderWeekPlan(); renderSessionCard();
      break; }
    case "plan-ex-del": {
      const day = S.trainingDays[planDayIdx]; if(!day) break;
      day.exercises.splice(parseInt(el.dataset.i), 1); save(); renderPlanEditor();
      break; }
    case "plan-ex-up": {
      const day = S.trainingDays[planDayIdx]; const i = parseInt(el.dataset.i);
      if(!day || i < 1) break;
      [day.exercises[i-1], day.exercises[i]] = [day.exercises[i], day.exercises[i-1]];
      save(); renderPlanEditor();
      break; }
    case "plan-ex-down": {
      const day = S.trainingDays[planDayIdx]; const i = parseInt(el.dataset.i);
      if(!day || i >= day.exercises.length-1) break;
      [day.exercises[i+1], day.exercises[i]] = [day.exercises[i], day.exercises[i+1]];
      save(); renderPlanEditor();
      break; }

    /* ---------- Training: Picker, Verlauf ---------- */
    case "pick-muscle":
      pickerMuscle = el.dataset.m; renderExPicker();
      break;
    case "pick-ex": {
      const exId = el.dataset.id;
      if(pickerMode === "session"){ addSessionExercise(exId); }
      else {
        const day = S.trainingDays[planDayIdx];
        if(day){
          const ex = exById(exId);
          day.exercises.push({id:uid(), exId, sets:3, reps: exUnit(ex)==="time" ? 15 : 10, rest: S.restDefault||90});
          save(); renderPlanEditor();
        }
      }
      $("exPickModal").classList.remove("open");
      toast((exById(exId)?exById(exId).name:"Übung") + " hinzugefügt.");
      break; }
    case "hist-open":
      openHistoryId = (openHistoryId === id) ? null : id;
      renderHistory();
      break;
    case "hist-repeat":
      repeatSession(id);
      break;
    case "hist-del":
      customConfirm("Diese Einheit aus dem Verlauf löschen?", {okLabel:"Löschen", danger:true}).then(ok=>{
        if(!ok) return;
        S.sessions = S.sessions.filter(s=>s.id!==id); tombstone(id); save();
        renderTraining(); renderTrainingCharts(); renderBodyCharts();
      });
      break;

    case "learn-del":
      S.learning = S.learning.filter(l=>l.id!==id); tombstone(id); save(); renderLearning(); break;

    case "person-ping": {
      const p = S.people.find(p=>p.id===id); if(!p) break;
      p.last = tk; p.touched = Date.now(); save(); renderPeople();
      toast("Check-in bei "+p.name+" notiert 💬");
      break; }
    case "person-del":
      S.people = S.people.filter(p=>p.id!==id); tombstone(id); save(); renderPeople(); break;

    case "goal-del":
      customConfirm("Ziel wirklich löschen?", {okLabel:"Löschen", danger:true}).then(ok=>{
        if(!ok) return;
        S.goals = S.goals.filter(g=>g.id!==id); tombstone(id); save(); renderGoals();
      });
      break;
    case "ms-toggle": {
      const g = S.goals.find(g=>g.id===id); if(!g) break;
      const m = g.ms[parseInt(el.dataset.i)]; if(!m) break;
      m.done = !m.done; g.touched = Date.now(); save();
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
      g.touched = Date.now(); save(); renderGoals();
      break; }
    case "goal-todo-toggle": {
      const g = S.goals.find(g=>g.id===id); if(!g) break;
      const at = (g.actionTodos||[]).find(x=>x.id===el.dataset.tid); if(!at) break;
      at.done = !at.done; g.touched = Date.now(); save(); renderGoals();
      if(at.done) addXP(5, "Aufgabe erledigt: "+at.text);
      break; }
    case "goal-todo-del": {
      const g = S.goals.find(g=>g.id===id); if(!g) break;
      g.actionTodos = (g.actionTodos||[]).filter(x=>x.id!==el.dataset.tid);
      g.touched = Date.now(); save(); renderGoals();
      break; }

    case "know-del":
      customConfirm("Thema wirklich löschen? Notizen und To-Dos gehen verloren.", {okLabel:"Löschen", danger:true}).then(ok=>{
        if(!ok) return;
        S.knowledge = S.knowledge.filter(t=>t.id!==id); tombstone(id); save(); renderKnowledge();
      });
      break;
    case "know-todo-add": {
      const t = S.knowledge.find(t=>t.id===id); if(!t) break;
      const input = document.querySelector(`[data-act="know-todo-input"][data-id="${id}"]`);
      const text = input ? input.value.trim() : "";
      if(!text) break;
      if(!t.todos) t.todos = [];
      t.todos.push({id:uid(), text, done:false});
      t.touched = Date.now(); save(); renderKnowledge();
      break; }
    case "know-todo-toggle": {
      const t = S.knowledge.find(t=>t.id===id); if(!t) break;
      const td = (t.todos||[]).find(x=>x.id===el.dataset.tid); if(!td) break;
      td.done = !td.done; t.touched = Date.now(); save(); renderKnowledge();
      if(td.done) addXP(3, "Knowledge-To-Do: "+td.text);
      break; }
    case "know-todo-del": {
      const t = S.knowledge.find(t=>t.id===id); if(!t) break;
      t.todos = (t.todos||[]).filter(x=>x.id!==el.dataset.tid);
      t.touched = Date.now(); save(); renderKnowledge();
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
    case "goto-body":
      document.querySelector('#nav button[data-page="body"]').click();
      switchBodyTab("train");
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
    if(obj){ obj.note = el.value; obj.touched = Date.now(); save(); }
    return; // kein Re-Render, damit der Cursor beim Tippen nicht springt
  }
  if(el.dataset.act === "know-notes-input"){
    const t = S.knowledge.find(t=>t.id===el.dataset.id);
    if(t){ t.notes = el.value; t.touched = Date.now(); save(); }
    return; // kein Re-Render, damit der Cursor beim Tippen nicht springt
  }
  if(el.dataset.act === "learn-range"){
    const l = S.learning.find(x=>x.id===el.dataset.id); if(!l) return;
    const prev = l.progress;
    l.progress = parseInt(el.value); l.touched = Date.now(); save();
    el.closest(".check-item").querySelector(".meta").textContent = l.progress+"%";
    if(l.progress > prev) addXP(5, "Lernfortschritt: "+l.title+" → "+l.progress+"%");
    checkBadges();
  }
  if(el.dataset.act === "goal-range"){
    const g = S.goals.find(x=>x.id===el.dataset.id); if(!g) return;
    g.progress = parseInt(el.value); g.touched = Date.now(); save();
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
    sp.time = el.value; sp.touched = Date.now(); save(); renderSupps(); renderHero();
  }

  /* ---------- Trainings-Eingaben (ohne Re-Render, damit der Fokus bleibt) ---------- */
  if(el.dataset.act === "set-kg" || el.dataset.act === "set-reps"){
    const sess = S.activeSession; if(!sess) return;
    const ex = sess.exercises[parseInt(el.dataset.ex)]; if(!ex) return;
    const set = ex.sets[parseInt(el.dataset.i)]; if(!set) return;
    const val = el.value === "" ? "" : parseFloat(el.value);
    if(el.dataset.act === "set-kg") set.kg = val; else set.reps = val;
    save();
    return;
  }
  if(["plan-sets","plan-reps","plan-rest"].includes(el.dataset.act)){
    const day = S.trainingDays[planDayIdx]; if(!day) return;
    const pe = day.exercises[parseInt(el.dataset.i)]; if(!pe) return;
    const val = Math.max(0, parseInt(el.value)||0);
    if(el.dataset.act === "plan-sets") pe.sets = Math.max(1, val);
    else if(el.dataset.act === "plan-reps") pe.reps = Math.max(1, val);
    else pe.rest = val;
    save(); renderPlanEditor();
    return;
  }
  if(el.dataset.act === "plan-day-name" || el.dataset.act === "plan-day-focus"){
    const day = S.trainingDays[parseInt(el.dataset.i)]; if(!day) return;
    if(el.dataset.act === "plan-day-name") day.name = el.value.trim() || "Trainingstag";
    else day.focus = el.value.trim();
    save(); renderTraining();
    return;
  }
});


/* ============================================================
   Demo-Daten
   ============================================================ */
/* Startgewichte für die Demo-Trainingshistorie (kg; 0 = Körpergewichtsübung) */
const DEMO_BASE = {
  "bench-bb":72,"bench-db":28,"incline-bb":60,"incline-db":24,"fly-cable":15,"chest-press":50,
  "deadlift":120,"latpull":60,"row-bb":65,"row-db":30,"row-cable":55,"tbar":50,"facepull":25,"pullover":22,
  "squat-bb":95,"frontsquat":70,"legpress":160,"rdl":80,"lunge":20,"bulgarian":20,
  "legext":55,"legcurl":45,"hipthrust":100,"calf":80,"gobletsquat":24,
  "ohp":45,"ohp-db":20,"arnold":18,"lateral":10,"rearfly":10,"shrug":30,
  "curl-bb":30,"curl-db":14,"hammer":14,"preacher":25,"cable-curl":20,
  "pushdown":30,"skullcrusher":25,"overhead-tri":25,"closegrip":55,
};

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
    // Trainingseinheiten nach dem aktuellen Wochenplan — inklusive Sätzen, Dauer und Gefühl
    const planDay = plannedDaysFor(dateFromKey(k).getDay())[0];
    if(planDay && Math.random() < .85 && !S.sessions.some(s=>s.date===k)){
      const prog = (60-i)/60;                       // 0 = vor 60 Tagen, 1 = heute
      const exercises = planDay.exercises.map(pe=>{
        const ex = exById(pe.exId);
        const base = DEMO_BASE[pe.exId] || 0;
        const kg = base ? +(base * (0.88 + 0.2*prog) + rnd(-1.5,1.5)).toFixed(1) : 0;
        const sets = [];
        for(let s=0;s<pe.sets;s++){
          sets.push({ kg, reps: Math.max(1, pe.reps + Math.round(rnd(-1.4,1.4))), done:true });
        }
        return { id:uid(), exId:pe.exId, name: ex?ex.name:pe.exId, muscle: ex?ex.m:muscleOfName(pe.exId),
                 unit: exUnit(ex), targetSets:pe.sets, targetReps:pe.reps, rest:pe.rest, sets };
      });
      const started = dateFromKey(k).getTime() + 17*3600*1000;
      const dur = Math.round(rnd(48,78))*60;
      S.sessions.push({ id:uid(), date:k, dayId:planDay.id, name:planDay.name, icon:planDay.icon,
        startedAt:started, endedAt:started+dur*1000, durationSec:dur,
        feeling: Math.round(rnd(2.6,5)), note:"", exercises, prs:[] });
    }
    if(i%4===0) S.bodyLog.push({date:k, kg:+(84 - (60-i)*0.045 + rnd(-.4,.4)).toFixed(1), waist:+(88-(60-i)*0.05).toFixed(1), arm:+(38+(60-i)*0.01).toFixed(1)});
  }
  S.sleep.sort((a,b)=>a.date.localeCompare(b.date));
  S.bodyLog.sort((a,b)=>a.date.localeCompare(b.date));
  S.sessions.sort((a,b)=>b.date.localeCompare(a.date));   // Verlauf: neueste zuerst
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
  const cloudWarning = getCloudToken() ? " Da Cloud-Sync aktiv ist, wird danach auch der gespeicherte Cloud-Stand überschrieben." : "";
  const ok = await customConfirm(
    "Wirklich ALLE Daten zurücksetzen? Level, XP, Habits, Trainingseinheiten, Journal, Ziele, Skills — alles wird unwiderruflich gelöscht. Dein Mahlzeitenplan und dein Trainingsplan bleiben erhalten." + cloudWarning,
    {title:"Alles zurücksetzen?", okLabel:"Ja, alles löschen", danger:true}
  );
  if(!ok) return;
  // Mahlzeitenplan, Trainingsplan + persönliches Profil vom Reset ausnehmen
  const keepMealSlots = JSON.parse(JSON.stringify(S.mealSlots));
  const keepMealPlanNotes = S.mealPlan;
  const keepProfile = JSON.parse(JSON.stringify(S.profile));
  const keepTrainingDays = JSON.parse(JSON.stringify(S.trainingDays));
  const keepTrainingSplit = S.trainingSplit;
  const keepTrainingGoal = S.trainingGoal;
  const keepGymPlan = S.gymPlan;
  try{ localStorage.removeItem(LS_KEY); }catch(e){ /* ignore */ }
  memoryFallback = null;
  S = defaultState();
  S.mealSlots = keepMealSlots;
  S.mealPlan = keepMealPlanNotes;
  S.profile = keepProfile;
  S.trainingDays = keepTrainingDays;
  S.trainingSplit = keepTrainingSplit;
  S.trainingGoal = keepTrainingGoal;
  S.gymPlan = keepGymPlan;
  S.wipeAt = Date.now(); // schützt den Reset davor, per Merge von einem älteren Gerät rückgängig gemacht zu werden
  save();
  openMealSlot = null;
  clearInterval(timerInterval); timerInterval = null;
  stopRest(); stopSessionClock();
  renderAll();
  checkBadges();
  toast("Alle Daten zurückgesetzt — Mahlzeiten- und Trainingsplan blieben erhalten.");
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
  renderWorkouts(); renderBodyCharts(); renderTraining();
  loadJournalToday(); renderJournalHist(); renderMoodHist();
  renderLearning(); renderSkills(); renderPeople();
  renderProgressStats(); renderProgressCharts(); renderBadges(); renderCorrelation();
  renderGoals(); renderGoalSkillSel();
  renderKnowledge();
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
  renderHero(); renderWeek(); renderTraining();
}, 30*1000);