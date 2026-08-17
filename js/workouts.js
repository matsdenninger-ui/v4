"use strict";
/* ASCEND workouts.js — Workout-Log, Gewicht/Schlaf, Recovery-Score, Body-Charts */

/* ============================================================
   BODY
   ============================================================ */
$("exAdd").addEventListener("click", ()=>{
  const name = $("exName").value.trim();
  const sets = parseInt($("exSets").value)||0, reps = parseInt($("exReps").value)||0, kg = parseFloat($("exKg").value)||0;
  if(!name || !sets || !reps){ toast("Bitte Übung, Sätze und Wiederholungen angeben."); return; }
  // Freitext-Eingabe mit der Übungsdatenbank abgleichen, damit Muskelgruppe und Rekorde stimmen
  const match = EX_DB.find(e=>e.name.toLowerCase() === name.toLowerCase());
  S.workouts.unshift({id:uid(), date:todayKey(), name: match ? match.name : name,
    exId: match ? match.id : null, muscle: match ? match.m : muscleOfName(name), sets, reps, kg});
  $("exName").value = $("exSets").value = $("exReps").value = $("exKg").value = "";
  save(); renderWorkouts(); renderStrengthSel(); renderTraining(); renderTrainingCharts();
  addXP(20, "Training geloggt: "+name);
});
function renderWorkouts(){
  if(!S.workouts.length){
    $("workoutTable").innerHTML = '<div class="empty">🏋️ <b>Noch kein Schnell-Log-Eintrag.</b><br>Für vollständige Einheiten nutze lieber den Live-Modus im Tab „Training“.</div>';
    return;
  }
  const rows = S.workouts.slice(0,12).map(w=>{
    const mm = muscleMeta(w.muscle || muscleOfName(w.name));
    return `<tr><td>${fmtShort(w.date)}</td>
    <td><span class="pr-dot" style="background:${mm.color}"></span>${esc(w.name)}</td>
    <td>${w.sets}×${w.reps}</td><td>${w.kg?h1(w.kg)+" kg":"—"}</td>
    <td>${w.kg?h1((w.kg*w.sets*w.reps)/1000)+" t":"—"}</td>
    <td style="text-align:right"><button class="icon-btn del" data-act="wo-del" data-id="${w.id}">${ICON_X}</button></td></tr>`;
  }).join("");
  $("workoutTable").innerHTML = `<table><thead><tr><th>Datum</th><th>Übung</th><th>Sätze</th><th>Gewicht</th><th>Volumen</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
}

$("bwAdd").addEventListener("click", ()=>{
  const kg = parseFloat($("bwKg").value)||null,
        waist = parseFloat($("bwWaist").value)||null,
        arm = parseFloat($("bwArm").value)||null;
  if(!kg && !waist && !arm){ toast("Mindestens einen Wert eintragen."); return; }
  S.bodyLog = S.bodyLog.filter(b=>b.date!==todayKey());
  S.bodyLog.push({date:todayKey(), kg, waist, arm});
  S.bodyLog.sort((a,b)=>a.date.localeCompare(b.date));
  $("bwKg").value = $("bwWaist").value = $("bwArm").value = "";
  save(); renderBodyCharts(); renderMeasures();
  toast("Messung gespeichert.");
});

$("sleepQ").addEventListener("input", ()=>{ $("sleepQVal").textContent = $("sleepQ").value+" / 10"; });
$("sleepAdd").addEventListener("click", ()=>{
  const hrs = parseFloat($("sleepH").value);
  if(!hrs || hrs<=0){ toast("Bitte Schlafdauer angeben."); return; }
  const q = parseInt($("sleepQ").value);
  S.sleep = S.sleep.filter(s=>s.date!==todayKey());
  S.sleep.push({date:todayKey(), hours:hrs, quality:q});
  S.sleep.sort((a,b)=>a.date.localeCompare(b.date));
  $("sleepH").value = "";
  save(); renderBodyCharts(); renderRecovery();
  addXP(5, "Schlaf geloggt: "+h1(hrs)+" h");
});

function renderRecovery(){
  const last = S.sleep[S.sleep.length-1];
  if(!last){
    $("recVal").textContent = "–";
    $("recRing").style.strokeDashoffset = 239;
    $("recDetail").innerHTML = "<li>Noch keine Schlafdaten — logge deine letzte Nacht.</li>";
    return;
  }
  const sleepScore = Math.min(1, last.hours/8) * 55;
  const qualScore  = last.quality/10 * 35;

  // Trainingslast der letzten 48 h: Anzahl Einheiten + Volumen relativ zum eigenen Schnitt
  const window48 = [todayKey(), todayKey(addDays(new Date(),-1))];
  const entries = allTrainingEntries();
  const recent = entries.filter(e=>window48.includes(e.date));
  const units = new Set(recent.map(e=>e.date)).size;
  const recentVol = recent.reduce((a,e)=>a+e.volume, 0);
  const allDates = [...new Set(entries.map(e=>e.date))];
  const avgVol = allDates.length
    ? entries.reduce((a,e)=>a+e.volume, 0) / allDates.length
    : 0;
  const volFactor = avgVol ? recentVol/avgVol : 0;      // 1 = eine durchschnittliche Einheit
  const loadScore = Math.max(0, 10 - units*3 - Math.min(4, volFactor*2));
  const score = Math.max(0, Math.min(100, Math.round(sleepScore + qualScore + loadScore)));

  $("recVal").textContent = score;
  $("recVal").style.color = score>=75 ? "var(--mint)" : score>=50 ? "var(--sec)" : "var(--rose)";
  $("recRing").style.strokeDashoffset = 239*(1-score/100);
  $("recDetail").innerHTML = `
    <li>Schlaf: <b>${h1(last.hours)} h</b> (${fmtShort(last.date)})</li>
    <li>Qualität: <b>${last.quality} / 10</b></li>
    <li>Trainingslast 48 h: <b>${units} Einheit${units===1?"":"en"}</b>${recentVol?` · ${fmtVolume(recentVol)} Volumen`:""}</li>
    <li>${score>=75?"✅ Bereit für Vollgas — heute darf es schwer werden."
         :score>=50?"⚠️ Moderates Training empfohlen: Volumen halten, Intensität runter."
         :"🛑 Priorität heute: Erholung, Spaziergang, Mobility."}</li>`;
}

function renderMeasures(){
  const withM = S.bodyLog.filter(b=>b.waist||b.arm||b.kg);
  if(!withM.length){ $("measureSummary").textContent = "Noch keine Maße eingetragen."; return; }
  const last = withM[withM.length-1];
  const first = withM[0];
  const d = (a,b)=> (a!=null&&b!=null) ? (a-b>=0?"+":"")+h1(a-b) : "—";
  $("measureSummary").innerHTML = `
    <table><thead><tr><th>Messwert</th><th>Aktuell</th><th>Δ seit Start</th></tr></thead><tbody>
    <tr><td>Gewicht</td><td>${last.kg!=null?h1(last.kg)+" kg":"—"}</td><td>${d(last.kg,first.kg)} kg</td></tr>
    <tr><td>Taille</td><td>${last.waist!=null?h1(last.waist)+" cm":"—"}</td><td>${d(last.waist,first.waist)} cm</td></tr>
    <tr><td>Arm</td><td>${last.arm!=null?h1(last.arm)+" cm":"—"}</td><td>${d(last.arm,first.arm)} cm</td></tr>
    </tbody></table>`;
}
