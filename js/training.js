"use strict";
/* ASCEND training.js — Trainings-App: Wochenplan, Live-Session, Pausen-Timer,
   Rekorde, Verlauf und Trainings-Statistiken */

/* ============================================================
   1 · BERECHNUNGEN & DATENZUGRIFF
   ============================================================ */
const WD_SHORT = ["So","Mo","Di","Mi","Do","Fr","Sa"];
const WD_LONG  = ["Sonntag","Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag"];

/* Geschätztes 1RM nach Epley — vergleichbar über verschiedene Wiederholungszahlen */
function e1rm(kg, reps){
  if(!kg || !reps) return 0;
  return Math.round(kg * (1 + reps/30) * 10) / 10;
}
function fmtClock(sec){
  sec = Math.max(0, Math.round(sec));
  const m = Math.floor(sec/60), s = sec%60;
  return m + ":" + String(s).padStart(2,"0");
}
function fmtDur(sec){
  if(sec < 60) return Math.max(0, Math.round(sec)) + " Sek.";
  const m = Math.round(sec/60);
  if(m < 60) return m + " Min.";
  return Math.floor(m/60) + " h " + String(m%60).padStart(2,"0") + " Min.";
}
function fmtVolume(kg){
  if(kg >= 1000) return h1(kg/1000) + " t";
  return Math.round(kg) + " kg";
}

/* Volumen einer abgeschlossenen oder laufenden Übung (kg × Wdh., nur gewertete Sätze) */
function exVolume(ex){
  return (ex.sets||[]).reduce((sum,s)=>{
    if(s.done === false) return sum;
    return sum + (parseFloat(s.kg)||0) * (parseInt(s.reps)||0);
  }, 0);
}
function exDoneSets(ex){ return (ex.sets||[]).filter(s=>s.done !== false).length; }

function sessionVolume(sess){ return (sess.exercises||[]).reduce((a,e)=>a+exVolume(e), 0); }
function sessionSets(sess){ return (sess.exercises||[]).reduce((a,e)=>a+exDoneSets(e), 0); }

/* Alle Trainingseinträge — aus abgeschlossenen Sessions UND dem Schnell-Log.
   Vereinheitlicht, damit Charts, Rekorde und Korrelationen eine Quelle haben. */
function allTrainingEntries(){
  const out = [];
  (S.sessions||[]).forEach(sess=>{
    (sess.exercises||[]).forEach(ex=>{
      const done = (ex.sets||[]).filter(s=>s.done !== false);
      if(!done.length) return;
      const topKg   = done.reduce((m,s)=>Math.max(m, parseFloat(s.kg)||0), 0);
      const topReps = done.reduce((m,s)=>Math.max(m, parseInt(s.reps)||0), 0);
      const best    = done.reduce((b,s)=>{
        const v = e1rm(parseFloat(s.kg)||0, parseInt(s.reps)||0);
        return v > b.v ? {v, kg:parseFloat(s.kg)||0, reps:parseInt(s.reps)||0} : b;
      }, {v:0, kg:0, reps:0});
      out.push({
        date: sess.date, name: ex.name, exId: ex.exId || null,
        muscle: ex.muscle || (ex.exId && exById(ex.exId) ? exById(ex.exId).m : muscleOfName(ex.name)),
        unit: ex.unit || "reps",
        sets: done.length, reps: topReps, kg: topKg,
        volume: exVolume(ex), bestE1rm: best.v, bestKg: best.kg, bestReps: best.reps,
        sessionId: sess.id, src: "session",
      });
    });
  });
  (S.workouts||[]).forEach(w=>{
    const vol = (w.kg||0) * (w.sets||0) * (w.reps||0);
    out.push({
      date: w.date, name: w.name, exId: w.exId || null,
      muscle: w.muscle || muscleOfName(w.name), unit: "reps",
      sets: w.sets, reps: w.reps, kg: w.kg||0,
      volume: vol, bestE1rm: e1rm(w.kg||0, w.reps), bestKg: w.kg||0, bestReps: w.reps,
      logId: w.id, src: "log",
    });
  });
  return out.sort((a,b)=>a.date.localeCompare(b.date));
}

/* Alle Tage, an denen trainiert wurde */
function trainingDates(){
  const set = new Set();
  (S.sessions||[]).forEach(s=>set.add(s.date));
  (S.workouts||[]).forEach(w=>set.add(w.date));
  return set;
}
function totalTrainingEntries(){ return allTrainingEntries().length; }

/* Letzte Leistung einer Übung (für „letztes Mal: 80 kg × 8") */
function lastPerformance(exId, name){
  const rel = (S.sessions||[])
    .filter(s=>(s.exercises||[]).some(e=>(exId && e.exId===exId) || e.name===name))
    .sort((a,b)=>b.date.localeCompare(a.date));
  if(!rel.length) return null;
  const sess = rel[0];
  const ex = sess.exercises.find(e=>(exId && e.exId===exId) || e.name===name);
  const done = (ex.sets||[]).filter(s=>s.done !== false);
  if(!done.length) return null;
  return { date: sess.date, sets: done };
}

/* Bester Satz aller Zeiten je Übung (nach geschätztem 1RM) */
function personalRecords(){
  const best = {};
  allTrainingEntries().forEach(e=>{
    if(e.unit === "time" || !e.bestKg) return;
    const cur = best[e.name];
    if(!cur || e.bestE1rm > cur.e1rm){
      best[e.name] = { name:e.name, muscle:e.muscle, kg:e.bestKg, reps:e.bestReps, e1rm:e.bestE1rm, date:e.date };
    }
  });
  return Object.values(best).sort((a,b)=>b.e1rm - a.e1rm);
}
function bestE1rmFor(name){
  const pr = personalRecords().find(p=>p.name===name);
  return pr ? pr.e1rm : 0;
}

/* Einheiten in der Woche, in der `date` liegt (Montag als Wochenstart) */
function sessionsInWeek(weekStartKey){
  const start = dateFromKey(weekStartKey);
  const keys = [];
  for(let i=0;i<7;i++) keys.push(todayKey(addDays(start,i)));
  const dates = trainingDates();
  return keys.filter(k=>dates.has(k));
}
/* Wochen in Folge, in denen das Wochenziel erreicht wurde */
function weeklyGoalStreak(){
  const goal = S.trainingGoal || 3;
  let streak = 0;
  for(let w=0; w<52; w++){
    const wk = todayKey(addDays(dateFromKey(weekKey()), -7*w));
    const cnt = sessionsInWeek(wk).length;
    if(w === 0 && cnt < goal) continue;     // laufende Woche zählt erst, wenn das Ziel steht
    if(cnt >= goal) streak++;
    else break;
  }
  return streak;
}
function daysSinceLastTraining(){
  const dates = [...trainingDates()].sort();
  if(!dates.length) return null;
  const last = dateFromKey(dates[dates.length-1]);
  return Math.round((dateFromKey(todayKey()) - last) / 86400000);
}

/* Für einen Wochentag geplante Trainingstage */
function plannedDaysFor(weekday){
  return (S.trainingDays||[]).filter(d=>(d.weekdays||[]).includes(weekday));
}


/* ============================================================
   2 · SESSION-STEUERUNG
   ============================================================ */
let restInterval = null;
let sessionInterval = null;
let openSessionEx = 0;          // aktuell aufgeklappte Übung in der Live-Session

function startSession(dayId){
  if(S.activeSession){ toast("Es läuft bereits eine Einheit."); return; }
  const day = (S.trainingDays||[]).find(d=>d.id===dayId);
  const exercises = day ? day.exercises.map(pe=>buildSessionExercise(pe.exId, pe.sets, pe.reps, pe.rest)) : [];
  S.activeSession = {
    id: uid(),
    dayId: day ? day.id : null,
    name: day ? day.name : "Freies Training",
    icon: day ? day.icon : "⚡",
    startedAt: Date.now(),
    exercises,
    note: "",
    restEnd: null,
    restTotal: 0,
  };
  openSessionEx = 0;
  save(); renderTraining();
  toast((day ? day.name : "Freies Training") + " gestartet — los geht's 💪");
}

/* Übungs-Objekt für die laufende Session inkl. Vorbelegung aus der letzten Einheit */
function buildSessionExercise(exId, setCount, targetReps, rest){
  const ex = exById(exId);
  const name = ex ? ex.name : exId;
  const last = lastPerformance(exId, name);
  const sets = [];
  for(let i=0;i<(setCount||3);i++){
    const ref = last && last.sets[Math.min(i, last.sets.length-1)];
    sets.push({
      kg:   ref ? ref.kg : "",
      reps: ref ? ref.reps : (targetReps || ""),
      done: false,
    });
  }
  return {
    id: uid(), exId, name,
    muscle: ex ? ex.m : muscleOfName(name),
    unit: exUnit(ex),
    targetSets: setCount || 3,
    targetReps: targetReps || 0,
    rest: rest != null ? rest : (S.restDefault || 90),
    sets,
  };
}

function addSessionExercise(exId){
  if(!S.activeSession) return;
  S.activeSession.exercises.push(buildSessionExercise(exId, 3, 10, S.restDefault || 90));
  openSessionEx = S.activeSession.exercises.length - 1;
  save(); renderTraining();
}

/* Werte direkt aus den Feldern lesen — so geht nichts verloren,
   wenn direkt nach dem Tippen auf ✓ getippt wird. */
function readSetInputs(exIdx, setIdx){
  const kgEl   = document.querySelector(`[data-act="set-kg"][data-ex="${exIdx}"][data-i="${setIdx}"]`);
  const repsEl = document.querySelector(`[data-act="set-reps"][data-ex="${exIdx}"][data-i="${setIdx}"]`);
  return {
    kg:   kgEl   ? (kgEl.value   === "" ? "" : parseFloat(kgEl.value))  : null,
    reps: repsEl ? (repsEl.value === "" ? "" : parseFloat(repsEl.value)) : null,
  };
}

function toggleSet(exIdx, setIdx){
  const sess = S.activeSession; if(!sess) return;
  const ex = sess.exercises[exIdx]; if(!ex) return;
  const set = ex.sets[setIdx]; if(!set) return;
  const live = readSetInputs(exIdx, setIdx);
  if(live.kg   !== null) set.kg   = live.kg;
  if(live.reps !== null) set.reps = live.reps;

  if(set.done){
    set.done = false;
    save(); renderSessionCard();
    return;
  }
  if(!set.reps){ toast(ex.unit === "time" ? "Bitte Minuten eintragen." : "Bitte Wiederholungen eintragen."); return; }
  set.done = true;
  set.ts = Date.now();
  save();
  if(ex.rest > 0 && ex.unit !== "time") startRest(ex.rest);
  // nächste unerledigte Übung automatisch aufklappen
  if(ex.sets.every(s=>s.done)){
    const next = sess.exercises.findIndex(e=>e.sets.some(s=>!s.done));
    if(next >= 0) openSessionEx = next;
  }
  renderSessionCard();
}

function addSet(exIdx){
  const ex = S.activeSession && S.activeSession.exercises[exIdx]; if(!ex) return;
  const lastSet = ex.sets[ex.sets.length-1];
  ex.sets.push({ kg: lastSet ? lastSet.kg : "", reps: lastSet ? lastSet.reps : (ex.targetReps||""), done:false });
  save(); renderSessionCard();
}
function removeSet(exIdx){
  const ex = S.activeSession && S.activeSession.exercises[exIdx]; if(!ex) return;
  if(ex.sets.length <= 1) return;
  ex.sets.pop(); save(); renderSessionCard();
}
function removeSessionExercise(exIdx){
  const sess = S.activeSession; if(!sess) return;
  sess.exercises.splice(exIdx, 1);
  if(openSessionEx >= sess.exercises.length) openSessionEx = Math.max(0, sess.exercises.length-1);
  save(); renderTraining();
}

/* ---------- Pausen-Timer ---------- */
function startRest(sec){
  const sess = S.activeSession; if(!sess) return;
  sess.restTotal = sec;
  sess.restEnd = Date.now() + sec*1000;
  save(); tickRest();
  clearInterval(restInterval);
  restInterval = setInterval(tickRest, 250);
}
function stopRest(){
  clearInterval(restInterval); restInterval = null;
  if(S.activeSession){ S.activeSession.restEnd = null; save(); }
  const bar = $("restBar");
  if(bar) bar.classList.remove("show");
}
function addRest(sec){
  const sess = S.activeSession;
  if(!sess || !sess.restEnd) return;
  sess.restEnd += sec*1000;
  sess.restTotal += sec;
  save(); tickRest();
}
function tickRest(){
  const bar = $("restBar");
  const sess = S.activeSession;
  if(!bar) return;
  if(!sess || !sess.restEnd){ bar.classList.remove("show"); return; }
  const left = (sess.restEnd - Date.now())/1000;
  if(left <= 0){
    restDing();
    stopRest();
    toast("Pause vorbei — nächster Satz 🔔");
    return;
  }
  bar.classList.add("show");
  $("restTime").textContent = fmtClock(left);
  const pct = sess.restTotal ? Math.max(0, Math.min(1, left / sess.restTotal)) : 0;
  $("restFill").style.width = (pct*100) + "%";
}
/* Kurzer Signalton ohne externe Audiodatei */
function restDing(){
  if(S.restSound === false) return;
  try{
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if(!Ctx) return;
    const ctx = new Ctx();
    [0, 0.18].forEach((offset, i)=>{
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = i === 0 ? 880 : 1174;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.22, ctx.currentTime + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + offset + 0.16);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(ctx.currentTime + offset); osc.stop(ctx.currentTime + offset + 0.18);
    });
    setTimeout(()=>{ try{ ctx.close(); }catch(e){} }, 900);
  }catch(e){ /* Audio nicht verfügbar — Toast reicht */ }
}

/* ---------- Session beenden ---------- */
function openFinishModal(){
  const sess = S.activeSession; if(!sess) return;
  const dur = (Date.now() - sess.startedAt)/1000;
  const vol = sessionVolume(sess);
  const sets = sessionSets(sess);
  const prs = detectPRs(sess);
  $("finishStats").innerHTML = `
    <div class="fin-stat"><b>${fmtDur(dur)}</b><small>Dauer</small></div>
    <div class="fin-stat"><b>${sets}</b><small>Sätze</small></div>
    <div class="fin-stat"><b>${fmtVolume(vol)}</b><small>Volumen</small></div>
    <div class="fin-stat"><b>${prs.length}</b><small>Rekorde</small></div>`;
  $("finishPRs").innerHTML = prs.length
    ? `<div class="pr-banner">🏆 <b>Neue Bestleistung${prs.length>1?"en":""}:</b> ${prs.map(p=>esc(p.name)+" — "+h1(p.kg)+" kg × "+p.reps).join(" · ")}</div>`
    : "";
  $("finishNote").value = sess.note || "";
  document.querySelectorAll("#finishFeel button").forEach(b=>b.classList.remove("on"));
  $("sessionFinishModal").classList.add("open");
}

/* Neue Rekorde der Session gegen die bisherige Historie prüfen */
function detectPRs(sess){
  const prs = [];
  (sess.exercises||[]).forEach(ex=>{
    if(ex.unit === "time") return;
    const done = (ex.sets||[]).filter(s=>s.done && (parseFloat(s.kg)||0) > 0);
    if(!done.length) return;
    const prev = bestE1rmFor(ex.name);
    if(!prev) return;                       // erste Einheit dieser Übung = Referenz, kein PR
    const best = done.reduce((b,s)=>{
      const v = e1rm(parseFloat(s.kg)||0, parseInt(s.reps)||0);
      return v > b.v ? {v, kg:parseFloat(s.kg)||0, reps:parseInt(s.reps)||0} : b;
    }, {v:0, kg:0, reps:0});
    if(best.v > prev + 0.05) prs.push({name:ex.name, kg:best.kg, reps:best.reps, e1rm:best.v});
  });
  return prs;
}

function finishSession(feeling){
  const sess = S.activeSession; if(!sess) return;
  const exercises = sess.exercises
    .map(ex=>({ ...ex, sets: (ex.sets||[]).filter(s=>s.done) }))
    .filter(ex=>ex.sets.length);
  if(!exercises.length){
    toast("Noch kein Satz abgehakt — Einheit wurde nicht gespeichert.");
    return;
  }
  const prs = detectPRs(sess);
  const durationSec = Math.round((Date.now() - sess.startedAt)/1000);
  const record = {
    id: sess.id,
    date: todayKey(),
    dayId: sess.dayId,
    name: sess.name,
    icon: sess.icon,
    startedAt: sess.startedAt,
    endedAt: Date.now(),
    durationSec,
    feeling: feeling || null,
    note: $("finishNote") ? $("finishNote").value.trim() : (sess.note||""),
    exercises,
    prs: prs.map(p=>({name:p.name, kg:p.kg, reps:p.reps})),
  };
  S.sessions.unshift(record);
  S.activeSession = null;
  stopRest();
  save();
  $("sessionFinishModal").classList.remove("open");
  renderTraining(); renderBodyCharts(); renderHero();

  const vol = sessionVolume(record);
  let xp = 30 + prs.length*10;
  if(durationSec >= 45*60) xp += 10;
  addXP(xp, "Training abgeschlossen: " + record.name + " · " + fmtVolume(vol));
  prs.forEach(p=>toast("🏆 Neuer Rekord: " + p.name + " — " + h1(p.kg) + " kg × " + p.reps));
  checkBadges();
}

function discardSession(){
  customConfirm("Laufende Einheit verwerfen? Alle abgehakten Sätze dieser Session gehen verloren.",
    {okLabel:"Verwerfen", danger:true}).then(ok=>{
    if(!ok) return;
    S.activeSession = null; stopRest(); save(); renderTraining();
    toast("Einheit verworfen.");
  });
}


/* ============================================================
   3 · RENDERING — Übersicht & Live-Session
   ============================================================ */
function renderTraining(){
  renderTrainingStats();
  renderWeekPlan();
  renderSessionCard();
  renderPlanEditor();
  renderHistory();
  renderPRTable();
}

function renderTrainingStats(){
  const goal = S.trainingGoal || 3;
  const thisWeek = sessionsInWeek(weekKey()).length;
  const entries = allTrainingEntries();
  const last7 = lastNDates(7);
  const vol7 = entries.filter(e=>last7.includes(e.date)).reduce((a,e)=>a+e.volume, 0);
  const since = daysSinceLastTraining();

  $("trWeek").textContent = thisWeek + " / " + goal;
  $("trWeekSub").textContent = thisWeek >= goal ? "Wochenziel erreicht 🎯" : "Einheiten diese Woche";
  $("trVolume").textContent = fmtVolume(vol7);
  $("trStreak").textContent = weeklyGoalStreak();
  $("trLast").textContent = since === null ? "–" : since === 0 ? "Heute" : since === 1 ? "Gestern" : since + " Tage";
  $("trPRs").textContent = personalRecords().length;
}

function renderWeekPlan(){
  const box = $("weekPlan"); if(!box) return;
  const start = dateFromKey(weekKey());
  const dates = trainingDates();
  const tk = todayKey();
  let html = "";
  for(let i=0;i<7;i++){
    const d = addDays(start, i);
    const k = todayKey(d);
    const wd = d.getDay();
    const planned = plannedDaysFor(wd);
    const trained = dates.has(k);
    const isToday = k === tk;
    const isPast = k < tk;
    html += `<div class="wp-day ${isToday?"today":""} ${trained?"done":""} ${isPast&&!trained&&planned.length?"missed":""}">
      <span class="wp-wd">${WD_SHORT[wd]}</span>
      <span class="wp-date">${d.getDate()}.</span>
      <div class="wp-body">
        ${planned.length
          ? planned.map(p=>`<span class="wp-tag">${p.icon} ${esc(p.name)}</span>`).join("")
          : `<span class="wp-rest">Ruhetag</span>`}
      </div>
      <span class="wp-mark">${trained ? "✓" : ""}</span>
    </div>`;
  }
  box.innerHTML = html;
}

/* Startkarte (kein Training aktiv) oder Live-Session */
function renderSessionCard(){
  const mount = $("sessionMount"); if(!mount) return;
  if(S.activeSession){ mount.innerHTML = sessionHTML(); startSessionClock(); tickRest(); }
  else { mount.innerHTML = startCardHTML(); stopSessionClock(); stopRest(); }
}

function startCardHTML(){
  const wd = new Date().getDay();
  const planned = plannedDaysFor(wd);
  const days = S.trainingDays || [];
  const suggestion = planned.length ? planned : [];
  const otherDays = days.filter(d=>!suggestion.some(s=>s.id===d.id));

  const bigBtn = (d, primary)=>{
    const lastDone = (S.sessions||[]).find(s=>s.dayId===d.id);
    return `<button class="day-start ${primary?"primary":""}" data-act="tr-start" data-id="${d.id}">
      <span class="ds-icon">${d.icon||"🏋️"}</span>
      <span class="ds-text">
        <b>${esc(d.name)}</b>
        <small>${esc(d.focus||"")} · ${d.exercises.length} Übungen</small>
      </span>
      <span class="ds-meta">${lastDone ? "zuletzt " + fmtShort(lastDone.date) : "neu"}</span>
      <span class="ds-go">▶</span>
    </button>`;
  };

  return `<div class="card session-start">
    <div class="ss-head">
      <div>
        <div class="ss-kicker">${WD_LONG[wd]}</div>
        <h3 style="margin:0">${suggestion.length ? "Heute steht an: " + esc(suggestion.map(s=>s.name).join(" / ")) : "Heute ist Ruhetag"}</h3>
        <p class="sub" style="margin:6px 0 0">${suggestion.length
          ? "Tippe auf den Trainingstag, um die Einheit live mitzuloggen — Satz für Satz."
          : "Kein Training geplant. Erholung ist Teil des Plans — du kannst aber jederzeit trotzdem starten."}</p>
      </div>
    </div>
    <div class="day-start-list">
      ${suggestion.map(d=>bigBtn(d, true)).join("")}
      ${otherDays.map(d=>bigBtn(d, false)).join("")}
      <button class="day-start free" data-act="tr-start" data-id="free">
        <span class="ds-icon">⚡</span>
        <span class="ds-text"><b>Freies Training</b><small>Übungen unterwegs zusammenstellen</small></span>
        <span class="ds-go">▶</span>
      </button>
    </div>
  </div>`;
}

function sessionHTML(){
  const sess = S.activeSession;
  const totalSets = sess.exercises.reduce((a,e)=>a+e.sets.length, 0);
  const doneSets  = sess.exercises.reduce((a,e)=>a+e.sets.filter(s=>s.done).length, 0);
  const pct = totalSets ? Math.round(doneSets/totalSets*100) : 0;
  const vol = sessionVolume(sess);

  const exHTML = sess.exercises.map((ex, i)=>{
    const ex0 = exById(ex.exId);
    const isOpen = i === openSessionEx;
    const done = ex.sets.filter(s=>s.done).length;
    const complete = done === ex.sets.length && done > 0;
    const mm = muscleMeta(ex.muscle);
    const last = lastPerformance(ex.exId, ex.name);
    const isTime = ex.unit === "time";

    const setRows = ex.sets.map((s, j)=>{
      const ref = last && last.sets[Math.min(j, last.sets.length-1)];
      return `<div class="set-row ${s.done?"done":""}">
        <span class="set-idx">${j+1}</span>
        <label class="set-field">
          <input type="number" inputmode="decimal" step="${isTime?"0.5":"0.5"}" min="0"
                 data-act="set-kg" data-ex="${i}" data-i="${j}"
                 value="${s.kg === "" || s.kg == null ? "" : s.kg}"
                 placeholder="${ref ? ref.kg : (isTime?"0":"–")}">
          <span>${isTime ? "km" : "kg"}</span>
        </label>
        <label class="set-field">
          <input type="number" inputmode="numeric" step="1" min="0"
                 data-act="set-reps" data-ex="${i}" data-i="${j}"
                 value="${s.reps === "" || s.reps == null ? "" : s.reps}"
                 placeholder="${ref ? ref.reps : (ex.targetReps||"–")}">
          <span>${isTime ? "Min." : "Wdh."}</span>
        </label>
        <button class="set-check ${s.done?"on":""}" data-act="tr-set-done" data-ex="${i}" data-i="${j}"
                aria-label="Satz ${j+1} abhaken">${ICON_CHECK}</button>
      </div>`;
    }).join("");

    return `<div class="sx ${isOpen?"open":""} ${complete?"complete":""}">
      <button class="sx-head" data-act="tr-ex-open" data-ex="${i}">
        <span class="sx-dot" style="background:${mm.color}"></span>
        <span class="sx-title">
          <b>${esc(ex.name)}</b>
          <small>${mm.label} · ${done}/${ex.sets.length} Sätze${ex.targetReps?" · Ziel "+ex.targetReps+(isTime?" Min.":" Wdh."):""}</small>
        </span>
        ${complete ? '<span class="sx-badge">fertig</span>' : ""}
        <svg class="sx-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 9l6 6 6-6"/></svg>
      </button>
      <div class="sx-body">
        ${last ? `<div class="sx-last">📊 Letztes Mal (${fmtShort(last.date)}): ${last.sets.map(s=>`${s.kg?h1(s.kg)+(isTime?" km":" kg")+" × ":""}${s.reps}${isTime?" Min.":""}`).join(" · ")}</div>` : ""}
        ${ex0 && ex0.cue ? `<div class="sx-cue">💡 ${esc(ex0.cue)}</div>` : ""}
        <div class="set-head"><span>Satz</span><span>${isTime?"Distanz":"Gewicht"}</span><span>${isTime?"Dauer":"Wdh."}</span><span></span></div>
        ${setRows}
        <div class="sx-foot">
          <button class="btn ghost sm" data-act="tr-set-add" data-ex="${i}">+ Satz</button>
          <button class="btn ghost sm" data-act="tr-set-del" data-ex="${i}">– Satz</button>
          ${ex.rest ? `<span class="sx-rest">⏱ Pause ${ex.rest}s</span>` : ""}
          <button class="icon-btn del" data-act="tr-ex-del" data-ex="${i}" title="Übung aus der Einheit entfernen">${ICON_X}</button>
        </div>
      </div>
    </div>`;
  }).join("");

  return `<div class="card live-session">
    <div class="ls-head">
      <div class="ls-title">
        <span class="ls-icon">${sess.icon||"🏋️"}</span>
        <div>
          <div class="ls-kicker">Einheit läuft</div>
          <h3 style="margin:0">${esc(sess.name)}</h3>
        </div>
      </div>
      <div class="ls-clock" id="sessionClock">0:00</div>
    </div>

    <div class="ls-bar"><i style="width:${pct}%"></i></div>
    <div class="ls-stats">
      <div><b>${doneSets}/${totalSets}</b><small>Sätze</small></div>
      <div><b>${fmtVolume(vol)}</b><small>Volumen</small></div>
      <div><b>${sess.exercises.filter(e=>e.sets.every(s=>s.done)&&e.sets.length).length}/${sess.exercises.length}</b><small>Übungen</small></div>
      <div><b>${pct}%</b><small>geschafft</small></div>
    </div>

    <div class="sx-list">${exHTML || '<div class="empty">Noch keine Übung — füge unten deine erste hinzu.</div>'}</div>

    <div class="ls-actions">
      <button class="btn ghost" data-act="tr-ex-pick-session">+ Übung hinzufügen</button>
      <button class="btn" data-act="tr-finish">✓ Einheit beenden</button>
      <button class="btn ghost danger-text" data-act="tr-discard">Verwerfen</button>
    </div>
  </div>`;
}

/* Laufzeit der Session */
function startSessionClock(){
  stopSessionClock();
  const tick = ()=>{
    const el = $("sessionClock");
    if(!el || !S.activeSession){ stopSessionClock(); return; }
    const sec = (Date.now() - S.activeSession.startedAt)/1000;
    const h = Math.floor(sec/3600), m = Math.floor(sec%3600/60), s = Math.floor(sec%60);
    el.textContent = h ? `${h}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`
                       : `${m}:${String(s).padStart(2,"0")}`;
  };
  tick();
  sessionInterval = setInterval(tick, 1000);
}
function stopSessionClock(){ clearInterval(sessionInterval); sessionInterval = null; }


/* ============================================================
   4 · TRAININGSPLAN-EDITOR
   ============================================================ */
let planDayIdx = 0;
let pickerMode = "plan";        // "plan" | "session"

function renderPlanEditor(){
  const splitBox = $("splitList");
  if(splitBox){
    splitBox.innerHTML = Object.keys(SPLITS).map(key=>{
      const sp = SPLITS[key];
      const on = S.trainingSplit === key;
      return `<button class="split-card ${on?"on":""}" data-act="plan-split" data-split="${key}">
        <div class="sc-head"><b>${esc(sp.name)}</b><span class="sc-badge">${esc(sp.badge)}</span></div>
        <p>${esc(sp.desc)}</p>
        <div class="sc-days">${sp.days.map(d=>`<span>${d.icon} ${esc(d.name)}</span>`).join("")}</div>
        ${on?'<span class="sc-active">✓ aktiv</span>':'<span class="sc-apply">Plan übernehmen</span>'}
      </button>`;
    }).join("");
  }

  if($("trGoalInput")){
    $("trGoalInput").value = S.trainingGoal || 3;
    $("restDefaultInput").value = S.restDefault != null ? S.restDefault : 90;
    $("restSoundChk").checked = S.restSound !== false;
    $("planSaveHint").textContent = S.updatedAt
      ? "✓ Automatisch gespeichert · " + new Date(S.updatedAt).toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"})
      : "✓ Änderungen werden automatisch gespeichert";
  }

  const days = S.trainingDays || [];
  if(planDayIdx >= days.length) planDayIdx = Math.max(0, days.length-1);

  const tabs = $("planDayTabs");
  if(tabs){
    tabs.innerHTML = days.map((d,i)=>
      `<button class="pd-tab ${i===planDayIdx?"on":""}" data-act="plan-day-sel" data-i="${i}">${d.icon||"🏋️"} ${esc(d.name)}</button>`
    ).join("") + `<button class="pd-tab add" data-act="plan-day-add">+ Tag</button>`;
  }

  const box = $("planDayBody"); if(!box) return;
  const day = days[planDayIdx];
  if(!day){
    box.innerHTML = '<div class="empty">🗓 <b>Kein Trainingstag angelegt.</b><br>Wähle oben eine Vorlage oder lege einen eigenen Tag an.</div>';
    return;
  }

  const wdChips = [1,2,3,4,5,6,0].map(wd=>
    `<button class="wd-chip ${(day.weekdays||[]).includes(wd)?"on":""}" data-act="plan-weekday" data-i="${planDayIdx}" data-wd="${wd}">${WD_SHORT[wd]}</button>`
  ).join("");

  const rows = day.exercises.map((pe, i)=>{
    const ex = exById(pe.exId);
    const name = ex ? ex.name : pe.exId;
    const mm = muscleMeta(ex ? ex.m : muscleOfName(name));
    const isTime = exUnit(ex) === "time";
    return `<div class="pe-row">
      <span class="pe-dot" style="background:${mm.color}"></span>
      <div class="pe-name">
        <b>${esc(name)}</b>
        <small>${mm.label}${ex?" · "+esc(ex.eq):""}</small>
      </div>
      <label class="pe-field"><input type="number" min="1" max="12" value="${pe.sets}" data-act="plan-sets" data-i="${i}"><span>Sätze</span></label>
      <label class="pe-field"><input type="number" min="1" max="120" value="${pe.reps}" data-act="plan-reps" data-i="${i}"><span>${isTime?"Min.":"Wdh."}</span></label>
      <label class="pe-field"><input type="number" min="0" max="600" step="15" value="${pe.rest}" data-act="plan-rest" data-i="${i}"><span>Pause s</span></label>
      <div class="pe-move">
        <button class="icon-btn" data-act="plan-ex-up" data-i="${i}" title="nach oben">▲</button>
        <button class="icon-btn" data-act="plan-ex-down" data-i="${i}" title="nach unten">▼</button>
        <button class="icon-btn del" data-act="plan-ex-del" data-i="${i}" title="entfernen">${ICON_X}</button>
      </div>
    </div>`;
  }).join("");

  const volume = day.exercises.reduce((a,e)=>a+e.sets, 0);
  box.innerHTML = `
    <div class="pd-head">
      <input class="pd-name" value="${esc(day.name)}" data-act="plan-day-name" data-i="${planDayIdx}" maxlength="30">
      <input class="pd-focus" value="${esc(day.focus||"")}" data-act="plan-day-focus" data-i="${planDayIdx}" maxlength="60" placeholder="Fokus, z. B. Brust · Schultern · Trizeps">
      <button class="icon-btn del" data-act="plan-day-del" data-i="${planDayIdx}" title="Trainingstag löschen">${ICON_X}</button>
    </div>
    <div class="pd-meta">
      <span class="pd-meta-lab">Wochentage</span>
      <div class="wd-row">${wdChips}</div>
      <span class="pd-sets">${day.exercises.length} Übungen · ${volume} Sätze</span>
    </div>
    <div class="pe-list">${rows || '<div class="empty">Noch keine Übung in diesem Tag.</div>'}</div>
    <button class="btn ghost sm" data-act="tr-ex-pick-plan" style="margin-top:12px">+ Übung aus der Datenbank</button>`;
}

function applySplit(key){
  const sp = SPLITS[key]; if(!sp) return;
  customConfirm(`„${sp.name}" als Trainingsplan übernehmen? Dein bisheriger Plan wird ersetzt — geloggte Einheiten bleiben erhalten.`,
    {okLabel:"Übernehmen"}).then(ok=>{
    if(!ok) return;
    S.trainingSplit = key;
    S.trainingDays = buildDaysFromSplit(key);
    S.trainingGoal = sp.days.reduce((a,d)=>a+d.weekdays.length, 0);
    planDayIdx = 0;
    save(); renderTraining();
    toast(sp.name + " übernommen — viel Erfolg 💪");
  });
}


/* ============================================================
   5 · ÜBUNGS-PICKER
   ============================================================ */
let pickerMuscle = "alle";
function openExPicker(mode){
  pickerMode = mode;
  pickerMuscle = "alle";
  $("exPickSearch").value = "";
  $("exPickTitle").textContent = mode === "session" ? "Übung zur Einheit hinzufügen" : "Übung zum Trainingstag hinzufügen";
  renderExPicker();
  $("exPickModal").classList.add("open");
  setTimeout(()=>{ try{ $("exPickSearch").focus(); }catch(e){} }, 60);
}
function renderExPicker(){
  const q = ($("exPickSearch").value || "").trim().toLowerCase();
  $("exPickFilters").innerHTML =
    `<button class="mf ${pickerMuscle==="alle"?"on":""}" data-act="pick-muscle" data-m="alle">Alle</button>` +
    Object.keys(MUSCLES).map(k=>
      `<button class="mf ${pickerMuscle===k?"on":""}" data-act="pick-muscle" data-m="${k}" style="--mf:${MUSCLES[k].color}">${MUSCLES[k].label}</button>`
    ).join("");

  const list = EX_DB.filter(e=>{
    if(pickerMuscle !== "alle" && e.m !== pickerMuscle) return false;
    if(!q) return true;
    // Auch englische Bezeichnungen finden ("Preacher Curls" → Scott-Curls)
    const hay = [e.name, e.eq, e.alt||"", muscleMeta(e.m).label].join(" ").toLowerCase();
    return q.split(/\s+/).every(word => hay.includes(word));
  });
  $("exPickList").innerHTML = list.length ? list.map(e=>{
    const mm = muscleMeta(e.m);
    const pr = personalRecords().find(p=>p.name===e.name);
    return `<button class="ep-row" data-act="pick-ex" data-id="${e.id}">
      <span class="ep-dot" style="background:${mm.color}"></span>
      <span class="ep-txt">
        <b>${esc(e.name)}</b>
        <small>${mm.label} · ${esc(e.eq)} · ${e.type==="grund"?"Grundübung":"Isolation"}${
          e.alt ? " · auch: " + esc(e.alt.split(",")[0].trim()) : ""}</small>
      </span>
      ${pr ? `<span class="ep-pr">${h1(pr.kg)} kg × ${pr.reps}</span>` : ""}
    </button>`;
  }).join("") : '<div class="empty">Keine Übung gefunden — versuch einen anderen Suchbegriff.</div>';
}


/* ============================================================
   6 · VERLAUF & REKORDE
   ============================================================ */
let openHistoryId = null;
const FEELINGS = {1:"😵 platt", 2:"😕 zäh", 3:"🙂 solide", 4:"💪 stark", 5:"🚀 Bestform"};

function renderHistory(){
  const box = $("sessionHistory"); if(!box) return;
  const sessions = (S.sessions||[]).slice(0, 20);
  if(!sessions.length){
    box.innerHTML = '<div class="empty">🏋️ <b>Noch keine Einheit abgeschlossen.</b><br>Starte oben deine erste Session — jeder Satz landet hier im Verlauf.</div>';
    return;
  }
  box.innerHTML = sessions.map(s=>{
    const open = openHistoryId === s.id;
    const vol = sessionVolume(s);
    const sets = sessionSets(s);
    return `<div class="hs ${open?"open":""}">
      <button class="hs-head" data-act="hist-open" data-id="${s.id}">
        <span class="hs-icon">${s.icon||"🏋️"}</span>
        <span class="hs-title">
          <b>${esc(s.name)}</b>
          <small>${fmtShort(s.date)} · ${fmtDur(s.durationSec||0)} · ${sets} Sätze</small>
        </span>
        ${(s.prs||[]).length ? `<span class="hs-pr">🏆 ${s.prs.length}</span>` : ""}
        <span class="hs-vol">${fmtVolume(vol)}</span>
        <svg class="hs-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 9l6 6 6-6"/></svg>
      </button>
      <div class="hs-body">
        ${(s.exercises||[]).map(ex=>{
          const mm = muscleMeta(ex.muscle || muscleOfName(ex.name));
          const isTime = ex.unit === "time";
          return `<div class="hs-ex">
            <span class="hs-dot" style="background:${mm.color}"></span>
            <b>${esc(ex.name)}</b>
            <span class="hs-sets">${ex.sets.map(st=>`${st.kg?h1(st.kg)+(isTime?" km":" kg")+"×":""}${st.reps}${isTime?" Min.":""}`).join(" · ")}</span>
          </div>`;
        }).join("")}
        ${s.feeling ? `<div class="hs-feel">Gefühl: ${FEELINGS[s.feeling]||""}</div>` : ""}
        ${s.note ? `<div class="hs-note">📝 ${esc(s.note)}</div>` : ""}
        <div class="hs-foot">
          <button class="btn ghost sm" data-act="hist-repeat" data-id="${s.id}">↻ Einheit wiederholen</button>
          <button class="icon-btn del" data-act="hist-del" data-id="${s.id}">${ICON_X}</button>
        </div>
      </div>
    </div>`;
  }).join("");
}

/* Abgeschlossene Einheit als Vorlage erneut starten */
function repeatSession(id){
  if(S.activeSession){ toast("Beende zuerst die laufende Einheit."); return; }
  const src = (S.sessions||[]).find(s=>s.id===id); if(!src) return;
  S.activeSession = {
    id: uid(), dayId: src.dayId, name: src.name, icon: src.icon,
    startedAt: Date.now(), note: "", restEnd:null, restTotal:0,
    exercises: src.exercises.map(ex=>{
      const dbEx = exById(ex.exId);
      return {
        id: uid(), exId: ex.exId, name: ex.name,
        muscle: ex.muscle || muscleOfName(ex.name), unit: ex.unit || "reps",
        targetSets: ex.sets.length, targetReps: ex.targetReps || 0,
        rest: ex.rest != null ? ex.rest : (S.restDefault||90),
        sets: ex.sets.map(s=>({kg:s.kg, reps:s.reps, done:false})),
        cue: dbEx ? dbEx.cue : null,
      };
    }),
  };
  openSessionEx = 0;
  save(); renderTraining();
  toast(src.name + " erneut gestartet — schlag deine letzten Werte 🔥");
}

function renderPRTable(){
  const box = $("prTable"); if(!box) return;
  const prs = personalRecords().slice(0, 12);
  if(!prs.length){
    box.innerHTML = '<div class="empty">🏆 <b>Noch keine Rekorde.</b><br>Sobald du Sätze mit Gewicht loggst, erscheint hier deine Bestenliste.</div>';
    return;
  }
  box.innerHTML = `<table><thead><tr><th>Übung</th><th>Bester Satz</th><th>e1RM</th><th>Datum</th></tr></thead><tbody>
    ${prs.map(p=>{
      const mm = muscleMeta(p.muscle);
      return `<tr>
        <td><span class="pr-dot" style="background:${mm.color}"></span>${esc(p.name)}</td>
        <td>${h1(p.kg)} kg × ${p.reps}</td>
        <td><b>${h1(p.e1rm)} kg</b></td>
        <td>${fmtShort(p.date)}</td>
      </tr>`;
    }).join("")}
  </tbody></table>`;
}


/* ============================================================
   7 · TRAININGS-CHARTS
   ============================================================ */
function renderTrainingCharts(){
  if(!window.Chart) return;
  const entries = allTrainingEntries();

  /* Volumen pro Woche (8 Wochen) */
  const labels = [], data = [];
  for(let w=7; w>=0; w--){
    const start = addDays(dateFromKey(weekKey()), -7*w);
    const keys = [];
    for(let i=0;i<7;i++) keys.push(todayKey(addDays(start,i)));
    const vol = entries.filter(e=>keys.includes(e.date)).reduce((a,e)=>a+e.volume, 0);
    labels.push("KW " + fmtShort(todayKey(start)));
    data.push(Math.round(vol/1000*10)/10);
  }
  mkChart("chVolume", { type:"bar", plugins:[emptyPlugin],
    data:{ labels, datasets:[{ data, backgroundColor:hexToRgba(cssVar("--ac"),.85), borderRadius:5 }] },
    options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false},
      tooltip:{callbacks:{label:c=>c.parsed.y+" t Gesamtvolumen"}}},
      scales:{x:{grid:{display:false}}, y:{beginAtZero:true, title:{display:true,text:"Tonnage (t)"}}} } });

  /* Satzverteilung nach Muskelgruppe (30 Tage) */
  const last30 = lastNDates(30);
  const byMuscle = {};
  entries.filter(e=>last30.includes(e.date)).forEach(e=>{
    byMuscle[e.muscle] = (byMuscle[e.muscle]||0) + e.sets;
  });
  const mKeys = Object.keys(byMuscle).sort((a,b)=>byMuscle[b]-byMuscle[a]);
  mkChart("chMuscle", { type:"doughnut", plugins:[emptyPlugin],
    data:{ labels: mKeys.map(k=>muscleMeta(k).label),
      datasets:[{ data: mKeys.map(k=>byMuscle[k]),
        backgroundColor: mKeys.map(k=>muscleMeta(k).color), borderWidth:0 }] },
    options:{ responsive:true, maintainAspectRatio:false, cutout:"58%",
      plugins:{ legend:{position:"right", labels:{boxWidth:10, padding:10}},
        tooltip:{callbacks:{label:c=>c.label+": "+c.parsed+" Sätze"}} } } });

  renderMuscleBalance(byMuscle);
}

/* Kurzer Text-Check, ob das Volumen halbwegs ausgewogen verteilt ist */
function renderMuscleBalance(byMuscle){
  const box = $("muscleBalance"); if(!box) return;
  const lift = Object.keys(byMuscle).filter(k=>k!=="cardio" && k!=="mobility");
  const total = lift.reduce((a,k)=>a+byMuscle[k], 0);
  if(total < 10){
    box.innerHTML = '<div class="note">Ab ca. 10 geloggten Sätzen erscheint hier eine Auswertung deiner Balance.</div>';
    return;
  }
  const push = (byMuscle.brust||0) + (byMuscle.schultern||0) + (byMuscle.trizeps||0);
  const pull = (byMuscle.ruecken||0) + (byMuscle.bizeps||0);
  const legs = byMuscle.beine||0;
  const ratio = pull ? push/pull : 99;
  const legPct = Math.round(legs/total*100);
  const msgs = [];
  if(ratio > 1.35) msgs.push("Du drückst deutlich mehr als du ziehst — mehr Rudern und Face Pulls schützen die Schultern.");
  else if(ratio < 0.7) msgs.push("Ziehen dominiert klar. Etwas mehr Druck-Volumen bringt die Balance zurück.");
  else msgs.push("Druck und Zug sind gut ausbalanciert.");
  if(legPct < 20) msgs.push("Beine machen nur " + legPct + " % deiner Sätze aus — hier liegt Potenzial.");
  box.innerHTML = `<div class="bal-row"><span>Drücken</span><div class="bal-bar"><i style="width:${Math.round(push/(push+pull||1)*100)}%"></i></div><span>Ziehen</span></div>
    <div class="note" style="margin-top:10px">${msgs.map(esc).join(" ")}</div>`;
}


/* ============================================================
   8 · TAB-NAVIGATION DER BODY-SEITE
   ============================================================ */
let bodyTab = "train";
function switchBodyTab(tab){
  bodyTab = tab;
  document.querySelectorAll("#bodyTabs button").forEach(b=>b.classList.toggle("on", b.dataset.btab === tab));
  document.querySelectorAll(".body-tab").forEach(el=>el.classList.toggle("active", el.id === "btab-"+tab));
  if(tab === "stats"){ renderTrainingCharts(); renderStrengthSel(); }
  if(tab === "recovery"){ renderBodyCharts(); }
}


/* ============================================================
   9 · INIT & MODAL-VERDRAHTUNG
   ============================================================ */
document.querySelectorAll("#bodyTabs button").forEach(b=>{
  b.addEventListener("click", ()=>switchBodyTab(b.dataset.btab));
});

/* Übungs-Picker */
$("exPickSearch").addEventListener("input", renderExPicker);
$("exPickClose").addEventListener("click", ()=>$("exPickModal").classList.remove("open"));
$("exPickModal").addEventListener("click", e=>{
  if(e.target === $("exPickModal")) $("exPickModal").classList.remove("open");
});

/* Abschluss-Modal */
let finishFeeling = null;
document.querySelectorAll("#finishFeel button").forEach(b=>{
  b.addEventListener("click", ()=>{
    finishFeeling = parseInt(b.dataset.feel);
    document.querySelectorAll("#finishFeel button").forEach(x=>x.classList.toggle("on", x === b));
  });
});
$("finishCancel").addEventListener("click", ()=>$("sessionFinishModal").classList.remove("open"));
$("sessionFinishModal").addEventListener("click", e=>{
  if(e.target === $("sessionFinishModal")) $("sessionFinishModal").classList.remove("open");
});
$("finishSave").addEventListener("click", ()=>{
  finishSession(finishFeeling);
  finishFeeling = null;
});

/* Pausen-Timer */
$("restSkip").addEventListener("click", ()=>{ stopRest(); });
$("restPlus").addEventListener("click", ()=>addRest(30));

/* Trainings-Einstellungen */
$("trGoalInput").addEventListener("change", ()=>{
  S.trainingGoal = Math.max(1, Math.min(14, parseInt($("trGoalInput").value)||3));
  save(); renderTrainingStats(); $("trGoalInput").value = S.trainingGoal;
});
$("restDefaultInput").addEventListener("change", ()=>{
  S.restDefault = Math.max(0, Math.min(600, parseInt($("restDefaultInput").value)||90));
  save(); $("restDefaultInput").value = S.restDefault;
});
$("restSoundChk").addEventListener("change", ()=>{
  S.restSound = $("restSoundChk").checked; save();
  toast(S.restSound ? "Signalton aktiviert." : "Signalton aus.");
});

/* Laufende Pause nach einem Reload weiterlaufen lassen */
if(S.activeSession && S.activeSession.restEnd){
  restInterval = setInterval(tickRest, 250);
  tickRest();
}
