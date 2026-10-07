"use strict";
/* ASCEND timer.js — Deep Work Timer + Fokus-Zuordnung */

/* ---------- Deep Work Timer ----------
   Obergrenze für eine einzelne Session. Alles darüber ist kein Fokus mehr,
   sondern ein vergessener Timer: Wer die Session nicht beendet, bekam vorher
   die komplette Laufzeit gutgeschrieben — drei Tage ergaben 4.320 XP und
   63 Stunden "Fokus heute". */
const MAX_FOCUS_MIN = 8 * 60;

/* Lebenszeichen der geöffneten App. Der Timer rechnete bisher reine Uhrzeit ab
   dem Start — auch die Zeit, in der die App gar nicht offen war. Zwei Stunden
   geschlossene App ergaben beim nächsten Öffnen "02:00:00" und 120 XP.
   Dieser Zeitstempel bleibt bewusst GERÄTELOKAL (eigener localStorage-Schlüssel,
   nicht in S): wann diese App zuletzt lief, geht das andere Gerät nichts an. */
const LS_SEEN_KEY = "ascend_timer_seen";
const SEEN_GRACE_MS = 3 * 60000;   // kurzes Wegklicken zählt weiter mit
function markSeen(){ try{ localStorage.setItem(LS_SEEN_KEY, String(Date.now())); }catch(e){} }
function lastSeenMs(){
  try{ const v = parseInt(localStorage.getItem(LS_SEEN_KEY)); return isFinite(v) ? v : 0; }
  catch(e){ return 0; }
}

let timerInterval = null;

/* Laufzeit der aktuellen Session in Minuten. Liefert null, wenn kein
   brauchbarer Startzeitpunkt vorliegt (Feld leer, kaputt oder in der Zukunft —
   z. B. weil ein anderes Gerät die Session beendet hat oder die Uhren
   auseinanderlaufen). */
function focusElapsedMin(){
  const start = S.timerStart;
  if(typeof start !== "number" || !isFinite(start) || start <= 0) return null;
  const diff = Date.now() - start;
  if(diff < 0) return null;
  return Math.floor(diff/60000);
}

function tickTimer(){
  const start = S.timerStart;
  if(typeof start !== "number" || !isFinite(start) || start <= 0 || Date.now() < start){
    // Startzeitpunkt ist weg oder unbrauchbar -> Uhr sauber anhalten statt
    // "497583:21:27" anzuzeigen (Date.now() - null ergibt Date.now()).
    syncTimerUI();
    return;
  }
  heartbeat();
  const secs = Math.floor((Date.now() - start)/1000);
  const hh = String(Math.floor(secs/3600)).padStart(2,"0"),
        mm = String(Math.floor(secs%3600/60)).padStart(2,"0"),
        ss = String(secs%60).padStart(2,"0");
  $("clock").textContent = hh+":"+mm+":"+ss;
}

/* Alle 30 s ein Lebenszeichen schreiben. Reicht als Auflösung und belastet
   weder localStorage noch den Cloud-Abgleich (bewusst kein save()).
   NUR im sichtbaren Zustand: läuft die Seite im Hintergrund weiter, würde das
   Lebenszeichen mitwandern und genau die Zeit beglaubigen, die nicht zählen
   soll. */
let letztesLebenszeichen = 0;
function heartbeat(){
  if(document.visibilityState !== "visible") return;
  const now = Date.now();
  if(now - letztesLebenszeichen < 30000) return;
  letztesLebenszeichen = now;
  markSeen();
}

/* Einzige Stelle, die das Aussehen des Timers festlegt — aus S.timerStart
   abgeleitet. Wird auch aus renderAll() aufgerufen, damit Knopf und Uhr nach
   einem Cloud-Abgleich nicht etwas anderes behaupten als der Zustand hergibt. */
function syncTimerUI(){
  const laeuft = focusElapsedMin() !== null;
  clearInterval(timerInterval); timerInterval = null;
  $("clock").classList.toggle("running", laeuft);
  $("timerState").textContent = laeuft ? "Fokus läuft …" : "Bereit";
  $("timerBtn").textContent = laeuft ? "■ Session beenden" : "▶ Session starten";
  $("timerBtn").classList.toggle("ghost", laeuft);
  $("timerBtn").classList.toggle("violet", !laeuft);
  if(laeuft){
    timerInterval = setInterval(tickTimer, 500);
    tickTimer();
  } else {
    $("clock").textContent = "00:00:00";
  }
  // Das Wenn-dann der letzten Session steht als Erinnerung in der Karte — der
  // Text kommt aus dem letzten Experiment im Deep-Work-Kontext.
  const note = $("lastIfThen");
  if(note){
    const exp = lastExperimentIf("deep_work");
    note.innerHTML = exp && !laeuft
      ? `<div class="if-then-lab">Dein Wenn-dann</div>
         <div class="if-then-text"><b>Wenn</b> ${esc(ohneCue(exp.if_text))}
         <b>dann</b> ${esc(ohneCue(exp.then_text))}</div>`
      : "";
  }
  renderFocusOverlay();
}
/* Minuten auf die Kalendertage verteilen, über die die Session gelaufen ist.
   Vorher landete bei einer Session über Mitternacht die GESAMTE Restzeit auf
   dem heutigen Tag — daraus wurden "1.014,7 h Fokus heute". */
function creditFocus(startMs, mins){
  let rest = mins, cursor = startMs;
  while(rest > 0){
    const d = new Date(cursor);
    const key = todayKey(d);
    const mitternacht = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
    const bisMitternacht = Math.ceil((mitternacht - cursor)/60000);
    const anteil = Math.min(rest, bisMitternacht);
    S.focusByDate[key] = (S.focusByDate[key]||0) + anteil;
    rest -= anteil;
    cursor = mitternacht;
  }
  const startKey = todayKey(new Date(startMs));
  S.sessionsByDate[startKey] = (S.sessionsByDate[startKey]||0) + 1;
}

/* Session beenden: messen, Vergessens-Schutz, dann PFLICHT-Debrief.
   Angerechnet wird erst im Debrief (saveDebrief) — so gibt es genau eine
   Stelle, die Fokuszeit, XP und Beweis schreibt. */
async function stopFocusSession(){
  const roh = focusElapsedMin();
  clearInterval(timerInterval); timerInterval = null;
  clearInterval(focusTick); focusTick = null;
  const sess = activeFocusSession();

  if(roh === null){                      // Session existiert gar nicht (mehr)
    S.timerStart = null; S.timerId = null; save();
    syncTimerUI(); renderFocus();
    return;
  }

  // Hat ein anderes Gerät genau diese Session schon beendet? Dann nur aufräumen.
  if(S.timerId && S.timerId === S.lastFocusId){
    S.timerStart = null; S.timerId = null; save();
    syncTimerUI(); renderFocusOverlay(); renderFocus();
    toast("Diese Session wurde bereits auf einem anderen Gerät beendet.");
    return;
  }

  let mins = roh;
  if(roh > MAX_FOCUS_MIN){
    // Vergessener Timer: nicht stillschweigend gutschreiben, sondern fragen.
    const stunden = (roh/60).toFixed(1).replace(".", ",");
    // "Abbrechen" (auch Escape und Klick daneben) verwirft — das ist die
    // harmlose Antwort, falls der Dialog einfach weggeklickt wird.
    const anrechnen = await customConfirm(
      "Die Session läuft seit " + stunden + " h — das sieht nach einem vergessenen Timer aus. "
      + "Höchstens " + (MAX_FOCUS_MIN/60) + " h können als Fokuszeit angerechnet werden.",
      { title:"Session sehr lang", okLabel:(MAX_FOCUS_MIN/60)+" h anrechnen" });
    if(!anrechnen){
      S.lastFocusId = S.timerId;
      if(sess){ sess.ended_at = Date.now(); sess.touched = Date.now(); }
      S.timerStart = null; S.timerId = null; save();
      syncTimerUI(); renderFocusOverlay(); renderFocus();
      toast("Session verworfen — keine Fokuszeit angerechnet.");
      return;
    }
    mins = MAX_FOCUS_MIN;                 // gekürzt anrechnen
  }

  if(mins < 1){
    // Unter einer Minute: nichts anzurechnen, keine 20 Sekunden Debrief nötig.
    if(sess){ sess.ended_at = Date.now(); sess.flow_score = null; sess.touched = Date.now(); }
    S.lastFocusId = S.timerId;
    S.timerStart = null; S.timerId = null; save();
    syncTimerUI(); renderFocusOverlay(); renderFocus();
    toast("Session unter einer Minute — zählt noch nicht.");
    return;
  }

  // Ab hier: Debrief. Die Session läuft aus Sicht der Uhr nicht mehr weiter,
  // damit ein Abbruch des Debriefs keine Zeit mehr anhängt.
  S.timerStart = null;
  save();
  $("focusClock").textContent = "00:00";
  openDebrief(sess || { id:S.timerId, context:"deep_work", duration_min:50, belief_id:null, outcome_task_id:null }, mins);
}

/* War die App zu, während eine Session lief? Dann darf der Timer beim Öffnen
   NICHT einfach weiterlaufen: gezählt wird nur bis zum letzten Lebenszeichen,
   und ob diese Zeit überhaupt zählt, entscheidest du. Ohne das bekam man für
   eine über Nacht geschlossene App Fokuszeit und XP geschenkt. */
/* Stand der Lebenszeichen beim Laden der Seite — MUSS hier festgehalten werden,
   bevor der erste Heartbeat ihn auf "jetzt" schiebt. */
const SEEN_AT_BOOT = lastSeenMs();

let settling = false;
async function settleAbandonedSession(gesehenMs){
  if(settling) return false;
  if(focusElapsedMin() === null) return false;

  // Ohne Lebenszeichen (anderes Gerät, gelöschter Speicher) gilt der Start:
  // dann gibt es keinen Beleg dafür, dass die App überhaupt offen war.
  const gesehen = Math.max(gesehenMs || 0, S.timerStart);
  if(Date.now() - gesehen <= SEEN_GRACE_MS) return false;   // nur kurz weg

  settling = true;
  try{
    clearInterval(timerInterval); timerInterval = null;
    const gemessen = Math.max(0, Math.floor((gesehen - S.timerStart)/60000));
    const mins = Math.min(gemessen, MAX_FOCUS_MIN);
    const startMs = S.timerStart, id = S.timerId;
    const schonAngerechnet = id && id === S.lastFocusId;
    // Auch die Session-Akte schließen — sonst bliebe das Fullscreen-Overlay nach
    // einem Neustart für immer über dem Dashboard liegen.
    const sess = activeFocusSession();

    S.timerStart = null; S.timerId = null;

    if(mins >= 1 && !schonAngerechnet){
      const ok = await customConfirm(
        "Beim letzten Mal lief noch eine Session. Bis die App geschlossen wurde, sind "
        + mins + " Min. zusammengekommen — die Zeit danach zählt nicht mit.",
        { title:"Nicht beendete Session", okLabel:mins+" Min. anrechnen" });
      if(ok){
        creditFocus(startMs, mins);
        if(sess){
          sess.ended_at = startMs + mins*60000; sess.touched = Date.now();
          if(sess.outcome_task_id){
            const o = S.todos.find(t=>t.id===sess.outcome_task_id);
            if(o){ o.focusedMinutes = (o.focusedMinutes||0) + mins; o.touched = Date.now(); }
          }
        }
        S.lastFocusId = id || S.lastFocusId;
        save(); syncTimerUI(); renderFocus(); renderOutcomes();
        addXP(mins, "Deep Work: "+mins+" Min. Fokus (nachgetragen)");
        renderHero();
        return true;
      }
    }
    if(sess){ sess.ended_at = gesehen; sess.touched = Date.now(); }
    S.lastFocusId = id || S.lastFocusId;
    save(); syncTimerUI(); renderFocus(); renderFocusOverlay();
    if(mins >= 1 && !schonAngerechnet) toast("Session verworfen — keine Fokuszeit angerechnet.");
    return true;
  } finally { settling = false; }
}

/* Lebenszeichen festhalten, sobald die App in den Hintergrund geht, und beim
   Zurückkommen prüfen, ob die Pause zu lang war. */
document.addEventListener("visibilitychange", ()=>{
  if(document.visibilityState === "hidden"){ markSeen(); }
  else { settleAbandonedSession(lastSeenMs()); }   // Stand vom Wegklicken
});
window.addEventListener("pagehide", markSeen);

let timerBtnBusy = false;    // verhindert Doppelklicks während des Dialogs
$("timerBtn").addEventListener("click", async ()=>{
  if(timerBtnBusy) return;
  timerBtnBusy = true;
  try{
    if(focusElapsedMin() !== null){
      await stopFocusSession();
    } else {
      // Kein Timer ohne Tor: erst Pre-Flight (Outcome, Umgebung, Wenn-dann, Zeitbox).
      openPreflight("deep_work", null);
    }
  } finally { timerBtnBusy = false; }
});

/* ---------- Pre-Flight-Interaktionen ---------- */
$("pfCancel").addEventListener("click", closePreflight);
$("preflightModal").addEventListener("click", e=>{ if(e.target === $("preflightModal")) closePreflight(); });
$("pfStart").addEventListener("click", startFocusSession);
$("pfOutcome").addEventListener("input", ()=>{
  if(!pf) return;
  pf.outcomeText = $("pfOutcome").value;
  pf.outcomeId = null;                  // eigener Text = neues Outcome
  gatePreflight();
  $("pfOutcomeReq").textContent = pf.outcomeText.trim() ? "✓ benannt" : "Pflicht";
});
$("pfGoal").addEventListener("change", ()=>{ if(pf){ pf.goalId = $("pfGoal").value; renderPreflight(); } });
$("preflightModal").addEventListener("click", e=>{
  const pick = e.target.closest("[data-pf-pick]");
  if(pick && pf){
    if(pick.dataset.pfPick === "outcome"){
      const o = S.todos.find(t=>t.id===pick.dataset.v);
      if(o){ pf.outcomeId = o.id; pf.outcomeText = o.text; $("pfOutcome").value = o.text; if(o.goal_id) pf.goalId = o.goal_id; }
    } else {
      pf.dayId = pick.dataset.v;
      const d = S.trainingDays.find(x=>x.id===pick.dataset.v);
      if(d){ pf.outcomeText = d.name; $("pfOutcome").value = d.name; }
    }
    renderPreflight();
    return;
  }
  const opt = e.target.closest("[data-pf]");
  if(opt && pf){
    if(opt.dataset.pf === "challenge") pf.challenge = opt.dataset.v;
    if(opt.dataset.pf === "timebox") pf.duration = parseInt(opt.dataset.v);
    renderPreflight();
  }
});
$("pfIfThen").addEventListener("input", ()=>{ if(pf) pf.distraction = $("pfIfThen").value; });
$("pfToggles").addEventListener("click", e=>{
  const b = e.target.closest("[data-act=pf-toggle]");
  if(!b || !pf) return;
  pf.toggles[b.dataset.k] = !pf.toggles[b.dataset.k];
  renderPreflight();
});
$("focusEndBtn").addEventListener("click", ()=>{ if(!timerBtnBusy){ timerBtnBusy = true; stopFocusSession().finally(()=>timerBtnBusy=false); } });
$("focusAbortBtn").addEventListener("click", abortFocusSession);
$("debriefFlow").addEventListener("input", ()=>{ $("debriefFlowVal").textContent = $("debriefFlow").value + " / 10"; });
$("debriefSave").addEventListener("click", saveDebrief);
function renderFocus(){
  const tk = todayKey();
  const today = (S.focusByDate[tk]||0)/60;
  $("focusToday").textContent = h1(today)+" h";
  $("stFocus").textContent = h1(today)+" h";
  // "Diese Woche" = laufende Kalenderwoche ab Montag. Vorher lief hier ein
  // rollierendes 7-Tage-Fenster (lastNDates), das montags nie auf 0 zurückging.
  const wk = weekDates().reduce((s,k)=>s+(S.focusByDate[k]||0),0)/60;
  $("focusWeek").textContent = h1(wk)+" h";
  $("focusSessions").textContent = S.sessionsByDate[tk]||0;
}

/* Nach einer Fokus-Session: To-Do auswählen, dem die Zeit gutgeschrieben wird */
function pickTodoForFocus(minutes){
  return new Promise(resolve=>{
    const tk = todayKey();
    const open = S.todos.filter(t=>t.date===tk && !t.done).sort((a,b)=>(a.order??0)-(b.order??0));
    if(!open.length){ resolve(null); return; }
    $("focusPickMinutes").textContent = minutes;
    $("focusPickList").innerHTML = open.map(t=>`
      <button class="btn ghost" data-todo-id="${t.id}" style="justify-content:space-between;width:100%;text-align:left">
        <span>${esc(t.text)}</span>
        ${t.estMinutes ? `<span class="meta">${t.focusedMinutes||0}/${t.estMinutes} Min.</span>` : ""}
      </button>`).join("");
    $("focusPickModal").classList.add("open");
    const buttons = [...$("focusPickList").querySelectorAll("button")];
    function cleanup(result){
      $("focusPickModal").classList.remove("open");
      buttons.forEach(b=>b.removeEventListener("click", onPick));
      $("focusPickSkip").removeEventListener("click", onSkip);
      resolve(result);
    }
    function onPick(e){ cleanup(e.currentTarget.dataset.todoId); }
    function onSkip(){ cleanup(null); }
    buttons.forEach(b=>b.addEventListener("click", onPick));
    $("focusPickSkip").addEventListener("click", onSkip);
  });
}

/* ============================================================
   SESSION-RAHMEN — Pre-Flight, Fullscreen-Fokus, Pflicht-Debrief

   Der Start ist eine Sperre, kein Menüpunkt: erst wenn ein Outcome benannt
   ist, ALLE Umgebungs-Toggles gesetzt sind und eine Zeitbox gewählt ist,
   wird „Session starten" aktiv. Derselbe Rahmen trägt Deep Work und Training.
   ============================================================ */
const PF_TOGGLES = {
  deep_work: [
    ["phone_away", "📵", "Handy weg"],
    ["notifications_off", "🔕", "Notifications aus"],
    ["tabs_closed", "🗂", "Tabs zu"],
    ["water", "💧", "Wasser da"],
    ["bathroom", "🚻", "Toilette"],
    ["start_cue", "🎵", "Start-Cue gesetzt"],
  ],
  workout: [
    ["shoes_on", "👟", "Schuhe an"],
    ["area_clear", "🧹", "Fläche frei"],
    ["timer_visible", "⏱", "Timer sichtbar"],
    ["water", "💧", "Wasser da"],
    ["bathroom", "🚻", "Toilette"],
    ["start_cue", "🎵", "Start-Cue gesetzt"],
  ],
};
const PF_CUE_HINT = {
  deep_work: "Start-Cue — gleicher Platz, gleiche Playlist, gleiches Getränk.",
  workout: "Start-Cue — gleicher Ort, gleiche Playlist, gleiches Warm-up.",
};
const CHALLENGE_LABEL = { too_easy:"zu leicht", matched:"passend", too_hard:"zu schwer" };

let pf = null;                 // Zustand des offenen Pre-Flights
let focusTick = null;
let debriefTimer = null;
let debriefSession = null;

function activeFocusSession(){
  if(!Array.isArray(S.focusSessions)) return null;
  return S.focusSessions.find(s=>!s.ended_at) || null;
}
function lastExperimentIf(context){
  const list = (S.experiments||[]).filter(e=>e.context===context && e.status==="active");
  return list.length ? list[list.length-1] : null;
}
function beliefForGoal(goalId){
  if(!goalId) return null;
  return (S.beliefs||[]).find(b=>b.goal_id===goalId && b.active) || null;
}

/* ---------- Pre-Flight öffnen ---------- */
function openPreflight(context, outcomeId){
  if(focusElapsedMin() !== null){ toast("Es läuft schon eine Session."); return; }
  const toggles = {};
  PF_TOGGLES[context].forEach(([k])=>toggles[k] = false);
  const o = outcomeId ? S.todos.find(t=>t.id===outcomeId) : null;
  const geplant = context === "workout" ? plannedDaysFor(new Date().getDay())[0] : null;
  const lastExp = lastExperimentIf(context);
  pf = {
    context,
    outcomeId: o ? o.id : null,
    outcomeText: o ? o.text : (geplant ? geplant.name : ""),
    dayId: geplant ? geplant.id : null,
    goalId: o && o.goal_id ? o.goal_id : (S.goals.find(g=>g.type==="fokus")||{}).id || "",
    challenge: "matched",
    duration: 50,
    distraction: lastExp ? lastExp.then_text : "",
    toggles,
    toggled: false,
  };
  $("pfTitle").textContent = context === "workout" ? "⚡ Pre-Flight — Workout" : "⚡ Pre-Flight";
  $("pfSub").textContent = context === "workout"
    ? "Erst wenn unten alles grün ist, startet die Einheit."
    : "Erst wenn unten alles grün ist, startet die Session.";
  $("pfOutcome").placeholder = context === "workout"
    ? "Welche Einheit? z. B. Push A — Bankdrücken im Fokus"
    : "Ein Ergebnis in einem Satz — nicht „am Projekt arbeiten“";
  $("pfOutcome").value = pf.outcomeText;
  $("pfIfThen").value = pf.distraction;
  $("preflightModal").classList.add("open");
  renderPreflight();
}

function renderPreflight(){
  if(!pf) return;
  
  // 1 · Outcome-Vorschläge: heutige Outcomes + geplantes Training
  const heute = openOutcomes().filter(outcomeIsClear);
  if(pf.context === "workout"){
    $("pfOutcomeReq").textContent = "Einheit wählen";
    $("pfOutcomePick").innerHTML = S.trainingDays.map(d=>
      `<button class="pf-chip ${pf.dayId===d.id?"on":""}" data-pf-pick="day" data-v="${d.id}">${d.icon} ${esc(d.name)}</button>`).join("");
  } else {
    $("pfOutcomeReq").textContent = pf.outcomeText.trim() ? "✓ benannt" : "Pflicht";
    $("pfOutcomePick").innerHTML = heute.length
      ? heute.map(o=>`<button class="pf-chip ${pf.outcomeId===o.id?"on":""}" data-pf-pick="outcome" data-v="${o.id}">${esc(o.text)}</button>`).join("")
      : `<span class="pf-hint">Kein Outcome auf Heute — tippe oben eines ein, oder lege auf der Heute-Ansicht eins an.</span>`;
  }

  // 2 · Ziel + Glaubenssatz
  $("pfGoal").innerHTML = goalOptionsHTML(pf.goalId);
  const b = beliefForGoal(pf.goalId);
  $("pfBeliefBox").innerHTML = b
    ? `<div class="belief-inline">
        <div class="belief-old"><small>Alter Satz</small><span>${esc(b.old_statement)}</span></div>
        <input id="pfReplacement" maxlength="140" placeholder="Ersatzsatz" value="${esc(b.replacement_statement)}">
        <button class="btn ghost sm" data-act="pf-adopt-belief">Gespeicherten Ersatzsatz übernehmen</button>
      </div>`
    : `<div class="belief-inline">
        <span class="pf-hint">Kein Glaubenssatz an diesem Ziel.</span>
        <button class="btn ghost sm" data-act="pf-add-belief">+ Satz anlegen</button>
      </div>`;

  // 3 · Anspruch
  $("pfChallenge").querySelectorAll("[data-pf=challenge]").forEach(x=>x.classList.toggle("on", x.dataset.v===pf.challenge));
  const nextSub = pf.outcomeId ? nextOpenSubtask({id:pf.outcomeId}) : null;
  $("pfChallengeHint").innerHTML = pf.challenge === "too_hard"
    ? `<div class="pf-warn">Zu schwer ist ein gutes Signal: der nächste Subtask wird halbiert, bevor der Timer startet.
        ${nextSub ? `<div class="pf-split"><span>${esc(nextSub.text)}</span><button class="btn sm" data-act="subtask-split" data-id="${nextSub.id}">✂️ Halbieren</button></div>` : `<div class="pf-hint">Trage unten einen kleineren Subtask ein.</div>`}</div>`
    : pf.challenge === "too_easy"
      ? `<span class="pf-hint">Zu leicht? Dann erhöhe die Zeitbox oder nimm das nächste echte Ergebnis.</span>`
      : `<span class="pf-hint">Passend heißt: es darf anstrengend werden, bleibt aber machbar.</span>`;

  // 4 · Toggles — alle Pflicht
  const gesetzt = PF_TOGGLES[pf.context].filter(([k])=>pf.toggles[k]).length;
  $("pfToggleCount").textContent = gesetzt + " / " + PF_TOGGLES[pf.context].length;
  $("pfToggles").innerHTML = PF_TOGGLES[pf.context].map(([k, ico, lab])=>`
    <button class="pf-toggle ${pf.toggles[k]?"on":""}" data-act="pf-toggle" data-k="${k}"
      title="${esc(k==="start_cue" ? PF_CUE_HINT[pf.context] : lab)}">
      <span class="pf-toggle-ico">${pf.toggles[k] ? "✓" : ico}</span>${esc(lab)}
    </button>`).join("");

  // 6 · Zeitbox
  $("pfTimebox").querySelectorAll("[data-pf=timebox]").forEach(x=>x.classList.toggle("on", parseInt(x.dataset.v)===pf.duration));

  gatePreflight();
}

/* Das Tor: Outcome benannt + alle Toggles gesetzt. Sonst bleibt der Knopf aus. */
function gatePreflight(){
  if(!pf) return;
  const alleToggles = PF_TOGGLES[pf.context].every(([k])=>pf.toggles[k]);
  const outcomeOk = pf.context === "workout" ? !!pf.dayId : !!pf.outcomeText.trim();
  const gründe = [];
  if(!outcomeOk) gründe.push(pf.context === "workout" ? "Einheit wählen" : "Outcome benennen");
  if(!alleToggles) gründe.push("alle " + PF_TOGGLES[pf.context].length + " Toggles setzen");
  const btn = $("pfStart");
  btn.disabled = gründe.length > 0;
  btn.textContent = gründe.length ? "Es fehlt: " + gründe.join(" + ") : "Session starten";
}

function closePreflight(){
  $("preflightModal").classList.remove("open");
  pf = null;
}

/* ---------- Session starten ---------- */
async function startFocusSession(){
  if(!pf) return;
  gatePreflight();
  if($("pfStart").disabled) return;
  const kontext = pf.context;
  const toggles = Object.assign({}, pf.toggles);
  const distraction = $("pfIfThen").value.trim() || pf.distraction;
  const outcomeText = $("pfOutcome").value.trim();
  const goalId = $("pfGoal").value || null;
  const bel = beliefForGoal(goalId);
  const replacement = $("pfReplacement") ? $("pfReplacement").value.trim() : "";
  if(bel && replacement) bel.replacement_statement = replacement;

  // Ein Outcome, das es noch nicht gibt, wird hier angelegt — mit dem Text als
  // Titel und ohne Subtasks; den nächsten Schritt benennt der Debrief.
  let outcomeId = pf.outcomeId;
  if(kontext === "deep_work" && !outcomeId && outcomeText){
    const neu = addOutcome(outcomeText, "", goalId);
    outcomeId = neu ? neu.id : null;
  }

  const sess = {
    id: uid(), context: kontext, outcome_task_id: outcomeId,
    goal_id: goalId, belief_id: bel ? bel.id : null,
    challenge: pf.challenge, duration_min: pf.duration,
    distraction_plan: distraction, preflight: toggles,
    started_at: Date.now(), ended_at: null,
    flow_score: null, evidence_text: null, next_subtask_text: null,
    touched: Date.now(),
  };
  if(!Array.isArray(S.focusSessions)) S.focusSessions = [];
  S.focusSessions.unshift(sess);

  // Wenn-dann als Experiment festhalten — daraus wird im Wochen-Review kept/dropped.
  if(distraction){
    if(!Array.isArray(S.experiments)) S.experiments = [];
    S.experiments.push({
      id: uid(), if_text: outcomeText, then_text: distraction, context: kontext,
      started_on: todayKey(), duration_days: 7, status: "active",
      session_id: sess.id, touched: Date.now(),
    });
  }

  // Der Tag steht VOR dem Schließen fest — closePreflight setzt pf auf null.
  const dayId = pf.dayId;
  S.timerStart = Date.now(); S.timerId = sess.id;
  save();
  markSeen();
  closePreflight();

  // Beim Workout gleichzeitig die echte Einheit starten — kein zweites Ritual.
  if(kontext === "workout" && !S.activeSession){
    startSession(dayId);
    document.querySelector('#nav button[data-page="body"]').click();
  }

  syncTimerUI();
  renderFocusOverlay();
  renderFocus();
  toast(kontext === "workout" ? "Einheit läuft — fokussiert bleiben 💪" : "Session läuft — alles andere ist ausgeblendet.");
}

/* ---------- Fullscreen-Fokus ----------
   Während der Session gibt es nur Outcome, Timer und Wenn-dann. Nav, Sidebar
   und alle anderen Todos sind per CSS ausgeblendet — nicht nur versteckt. */
function renderFocusOverlay(){
  const sess = activeFocusSession();
  const overlay = $("focusOverlay");
  const laeuft = focusElapsedMin() !== null && !!sess;
  overlay.classList.toggle("open", laeuft);
  document.body.classList.toggle("focus-mode", laeuft);
  overlay.setAttribute("aria-hidden", laeuft ? "false" : "true");
  clearInterval(focusTick); focusTick = null;
  if(!laeuft) return;
  const o = sess.outcome_task_id ? S.todos.find(t=>t.id===sess.outcome_task_id) : null;
  $("focusOutcomeText").innerHTML = esc(sess.context === "workout" && S.activeSession ? S.activeSession.name : (o ? o.text : pfOutcomeTextFallback(sess)));
  $("focusIfThen").innerHTML = sess.distraction_plan
    ? `<span class="focus-if-lab">Wenn-dann</span> <span>${esc(ohneCue(sess.distraction_plan))}</span>`
    : `<span class="focus-noif">Kein Wenn-dann gesetzt</span>`;
  tickFocusOverlay();
  renderFocusFlow();
  focusTick = setInterval(tickFocusOverlay, 500);
}

/* ---------- Der Ablauf der Aufgabe im Fokus ---------
   Beim Start blendet die Session das Dashboard aus — und damit auch die Subtasks,
   die man gerade erst geschrieben hat. Genau dann braucht man sie aber. Deshalb
   zeigt das Overlay den Block als Ablauf: erledigte Schritte abgehakt, der
   aktuelle hervorgehoben, die nächsten gedämpft. Der aktuelle Schritt lässt sich
   hier direkt abhaken, ohne die Session zu verlassen. */
function renderFocusFlow(){
  const box = $("focusFlow");
  if(!box) return;
  const sess = activeFocusSession();
  const o = sess && sess.outcome_task_id ? S.todos.find(t=>t.id===sess.outcome_task_id) : null;
  const schritte = [];
  if(o){
    outcomeChildren(o.id).forEach(k=>schritte.push({ id:k.id, text:k.text, done:!!k.done }));
  } else if(sess && sess.context === "workout" && S.activeSession){
    // Eine Einheit hat Subtasks derselben Bauart: die geplanten Übungen.
    (S.activeSession.exercises||[]).forEach(ex=>{
      const ziel = ex.targetSets || 0;
      const fertig = (ex.sets||[]).filter(s=>s.done).length;
      schritte.push({ id:null, text:ex.name, done: ziel > 0 && fertig >= ziel,
        hint: ziel ? fertig + "/" + ziel + " Sätze" : "" });
    });
  }
  if(!schritte.length){ box.innerHTML = ""; box.classList.remove("show"); return; }
  const alleFertig = schritte.every(s=>s.done);
  const aktuell = schritte.find(s=>!s.done);
  const erledigt = schritte.filter(s=>s.done).length;
  // Ist der Block selbst schon abgeschlossen, ist „abschließen?" ein sinnloser
  // Zuruf — dann ist der Ablauf einfach fertig.
  const blockZu = !!(o && o.done);
  const hinweis = blockZu ? `<span class="ff-done">✓ Ergebnis abgeschlossen</span>`
    : alleFertig ? `<span class="ff-done">alles erledigt — abschließen?</span>`
    : `<span class="ff-now">jetzt: ${esc(aktuell.text)}</span>`;
  box.classList.add("show");
  box.innerHTML = `
    <div class="ff-head">
      <span>${erledigt}/${schritte.length} erledigt</span>
      ${hinweis}
    </div>
    <ol class="ff-list">${schritte.map(s=>`
      <li class="ff-step ${s.done?"done":""} ${aktuell&&s.id&&s.id===aktuell.id?"current":""}">
        ${s.id ? `<button class="ff-cbx" data-act="ff-toggle" data-id="${s.id}" aria-label="${s.done?"Wieder öffnen":"Als erledigt markieren"}">${s.done?"✓":""}</button>`
               : `<span class="ff-cbx ff-cbx-read">${s.done?"✓":""}</span>`}
        <span class="ff-text">${esc(s.text)}${s.hint ? ` <small class="ff-hint">${s.hint}</small>` : ""}</span>
      </li>`).join("")}</ol>`;
  // Bei langen Ketten scrollt die Liste — der aktuelle Schritt muss dabei im
  // Bild sein, sonst steht man während der Arbeit vor einer Liste ohne „hier".
  const jetztEl = box.querySelector(".ff-step.current");
  if(jetztEl && jetztEl.scrollIntoView) jetztEl.scrollIntoView({ block:"nearest" });
}

/* Einen Schritt aus dem Overlay heraus abhaken — dieselbe Funktion wie im Dashboard,
   damit Fortschritt, XP und Auto-Abschluss überall gleich laufen. */
async function toggleFocusFlowStep(id){
  await toggleTodoDone(id);
  renderFocusFlow();
}
function pfOutcomeTextFallback(sess){
  const exp = (S.experiments||[]).find(e=>e.session_id===sess.id);
  return exp ? exp.if_text : "Session";
}
function tickFocusOverlay(){
  const sess = activeFocusSession();
  if(!sess || focusElapsedMin() === null){ clearInterval(focusTick); focusTick = null; return; }
  const gesamt = (sess.duration_min || 50) * 60;
  const vergangen = Math.floor((Date.now() - sess.started_at)/1000);
  const rest = gesamt - vergangen;
  const mm = String(Math.floor(Math.abs(rest)/60)).padStart(2,"0");
  const ss = String(Math.abs(rest)%60).padStart(2,"0");
  $("focusClock").textContent = (rest < 0 ? "+" : "") + mm + ":" + ss;
  $("focusClock").classList.toggle("over", rest < 0);
  $("focusState").textContent = rest > 0
    ? "Zeitbox " + sess.duration_min + " Min. · " + CHALLENGE_LABEL[sess.challenge]
    : "Zeitbox erreicht — weitermachen oder beenden";
  $("focusClock").classList.toggle("running", rest > 0);
}

/* Session ohne Bewertung abbrechen — landläufig ein Versehen, kein Ergebnis. */
async function abortFocusSession(){
  const ok = await customConfirm("Session abbrechen? Es wird keine Fokuszeit angerechnet und kein Beweis gespeichert.",
    { title:"Session abbrechen", okLabel:"Abbrechen", danger:true });
  if(!ok) return;
  const sess = activeFocusSession();
  clearInterval(timerInterval); timerInterval = null;
  clearInterval(focusTick); focusTick = null;
  if(sess){ S.focusSessions = S.focusSessions.filter(s=>s.id!==sess.id); tombstone(sess.id); }
  S.timerStart = null; S.timerId = null;
  save();
  $("focusOverlay").classList.remove("open");
  document.body.classList.remove("focus-mode");
  syncTimerUI(); renderFocus(); renderOutcomes();
  toast("Session abgebrochen — nichts angerechnet.");
}

/* ---------- Debrief: 20 Sekunden Pflicht ----------
   Flow, ein Beweis-Satz und der nächste Subtask. Das ist die Stelle, an der
   Verhalten zu Beweisen wird — deshalb geht der Speichern-Knopf erst auf,
   wenn die Zeit abgelaufen ist. */
const DEBRIEF_SECONDS = 20;
function openDebrief(sess, minutes){
  debriefSession = { sess, minutes };
  // Overlay zuerst schließen: das Debrief tritt an seine Stelle und beide
  // gleichzeitig offen wäre nur Unruhe. Der Timer der Session steht bereits.
  $("focusOverlay").classList.remove("open");
  document.body.classList.remove("focus-mode");
  $("debriefEvidence").value = "";
  $("debriefNext").value = "";
  $("debriefFlow").value = 7;
  $("debriefFlowVal").textContent = "7 / 10";
  const bel = sess.belief_id ? (S.beliefs||[]).find(b=>b.id===sess.belief_id) : null;
  $("debriefSub").innerHTML = bel
    ? `<b>${esc(bel.replacement_statement)}</b><br>Was hat gerade bewiesen, dass dieser Satz stimmt?`
    : "Das ist der Teil, der Verhalten zu Beweisen macht.";
  // Modal zuerst öffnen: der Debrief ist Pflicht, und nichts am Zähler darf
  // verhindern können, dass er überhaupt erscheint.
  $("debriefModal").classList.add("open");

  // Der Zähler lebt in einem eigenen Wrapper. Früher stand hier
  // $("debriefSave").textContent = "Speichern" — das löschte das <span
  // id="debriefCount"> mitsamt dem Button-Text und jeder weitere Debrief flog
  // mit einer TypeError raus, ohne dass einer erschien. Jetzt wird nur die
  // Klammer ausgeblendet, das Span bleibt für immer stehen.
  const countWrap = $("debriefCountWrap");
  const countEl = $("debriefCount");
  const saveBtn = $("debriefSave");
  if(countWrap) countWrap.style.display = "";
  let rest = DEBRIEF_SECONDS;
  if(countEl) countEl.textContent = rest;
  saveBtn.disabled = true;
  clearInterval(debriefTimer);
  if(countEl){
    debriefTimer = setInterval(()=>{
      rest--;
      countEl.textContent = Math.max(0, rest);
      if(rest <= 0){
        clearInterval(debriefTimer); debriefTimer = null;
        saveBtn.disabled = false;
        if(countWrap) countWrap.style.display = "none";
      }
    }, 1000);
  } else {
    // Ist der Zähler nicht da, darf der Pflicht-Debrief trotzdem nicht blockieren.
    saveBtn.disabled = false;
  }
}

/* Den Speichern-Knopf in den Ausgangszustand bringen, ohne sein DOM zu zerstören. */
function resetDebriefButton(){
  const saveBtn = $("debriefSave");
  if(saveBtn) saveBtn.disabled = true;
  const countWrap = $("debriefCountWrap");
  if(countWrap) countWrap.style.display = "";
  const countEl = $("debriefCount");
  if(countEl) countEl.textContent = DEBRIEF_SECONDS;
}

function saveDebrief(){
  if(!debriefSession) return;
  const { sess, minutes } = debriefSession;
  const flow = parseInt($("debriefFlow").value);
  const evidenceText = $("debriefEvidence").value.trim();
  const nextText = $("debriefNext").value.trim();

  sess.ended_at = Date.now();
  sess.flow_score = flow;
  sess.evidence_text = evidenceText || null;
  sess.next_subtask_text = nextText || null;
  sess.touched = Date.now();

  // 1) Beweis landet am Glaubenssatz — nur wenn einer gewählt war.
  if(evidenceText && sess.belief_id){
    if(!Array.isArray(S.evidence)) S.evidence = [];
    S.evidence.unshift({ id: uid(), belief_id: sess.belief_id, session_id: sess.id,
      text: evidenceText, created_at: Date.now(), touched: Date.now() });
    const bel = S.beliefs.find(b=>b.id===sess.belief_id);
    if(bel){
      bel.strength = Math.min(5, (bel.strength||1) + 1);
      bel.touched = Date.now();
      toast("🧩 Beweis gespeichert — „" + bel.replacement_statement.slice(0,40) + (bel.replacement_statement.length>40?"…":"") + "“ wird stärker.");
    }
  } else if(evidenceText){
    toast("Beweis notiert — verknüpfe ihn mit einem Glaubenssatz an deinem Ziel.");
  }

  // 2) Nächster Subtask am Outcome anlegen, wenn er noch nicht existiert.
  if(nextText && sess.outcome_task_id){
    const vorhanden = outcomeChildren(sess.outcome_task_id).some(k=>k.text.toLowerCase()===nextText.toLowerCase());
    if(!vorhanden) addSubtask(sess.outcome_task_id, nextText);
  }

  // 3) Fokuszeit dem Outcome gutschreiben (und dem Tag).
  if(minutes >= 1){
    creditFocus(Date.now() - minutes*60000, minutes);
    if(sess.outcome_task_id){
      const o = S.todos.find(t=>t.id===sess.outcome_task_id);
      if(o){ o.focusedMinutes = (o.focusedMinutes||0) + minutes; o.touched = Date.now(); }
    }
  }
  S.lastFocusId = sess.id;
  S.timerStart = null; S.timerId = null;
  save();
  clearInterval(debriefTimer); debriefTimer = null;
  $("debriefModal").classList.remove("open");
  // Zurückstellen für den nächsten Debrief — über die Spans, NIE über
  // $("debriefSave").textContent: das löschte #debriefCount mit und ließ den
  // folgenden Debrief stumm mit einer TypeError ausfallen.
  resetDebriefButton();
  debriefSession = null;
  $("focusOverlay").classList.remove("open");
  document.body.classList.remove("focus-mode");
  syncTimerUI(); renderFocus(); renderOutcomes(); renderTodos(); renderHero();
  renderReview(); renderGoals();
  if(minutes >= 1) addXP(minutes, "Deep Work: " + minutes + " Min. am Outcome");
  checkBadges();
}

/* ---------- Weekly Board ---------- */