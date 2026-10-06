"use strict";
/* ASCEND timer.js — Deep Work Timer + Fokus-Zuordnung */

/* ---------- Deep Work Timer ----------
   Obergrenze für eine einzelne Session. Alles darüber ist kein Fokus mehr,
   sondern ein vergessener Timer: Wer die Session nicht beendet, bekam vorher
   die komplette Laufzeit gutgeschrieben — drei Tage ergaben 4.320 XP und
   63 Stunden "Fokus heute". */
const MAX_FOCUS_MIN = 8 * 60;

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
  const secs = Math.floor((Date.now() - start)/1000);
  const hh = String(Math.floor(secs/3600)).padStart(2,"0"),
        mm = String(Math.floor(secs%3600/60)).padStart(2,"0"),
        ss = String(secs%60).padStart(2,"0");
  $("clock").textContent = hh+":"+mm+":"+ss;
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

async function stopFocusSession(){
  const roh = focusElapsedMin();
  const startMs = S.timerStart;
  clearInterval(timerInterval); timerInterval = null;

  if(roh === null){                      // Session existiert gar nicht (mehr)
    S.timerStart = null; S.timerId = null; save();
    syncTimerUI(); renderFocus();
    return;
  }

  // Hat ein anderes Gerät genau diese Session schon beendet? Dann nur aufräumen.
  if(S.timerId && S.timerId === S.lastFocusId){
    S.timerStart = null; S.timerId = null; save();
    syncTimerUI(); renderFocus();
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
      S.timerStart = null; S.timerId = null; save();
      syncTimerUI(); renderFocus();
      toast("Session verworfen — keine Fokuszeit angerechnet.");
      return;
    }
    mins = MAX_FOCUS_MIN;                 // gekürzt anrechnen
  }

  // Bei gekürzter Session zählen die letzten MAX_FOCUS_MIN Minuten, damit die
  // Zeit auf den Tagen landet, an denen tatsächlich gearbeitet wurde.
  const anrechnungsStart = (mins === roh) ? startMs : (Date.now() - mins*60000);
  if(mins >= 1) creditFocus(anrechnungsStart, mins);
  S.lastFocusId = S.timerId;
  S.timerStart = null; S.timerId = null; save();
  syncTimerUI();
  renderFocus();

  if(mins >= 1){
    const todoId = await pickTodoForFocus(mins);
    if(todoId){
      const t = S.todos.find(x=>x.id===todoId);
      if(t){ t.focusedMinutes = (t.focusedMinutes||0) + mins; t.touched = Date.now(); save(); renderTodos(); }
    }
    addXP(mins, "Deep Work: "+mins+" Min. Fokus"+(roh > MAX_FOCUS_MIN ? " (gekürzt)" : ""));
    renderHero();
  } else {
    toast("Session unter einer Minute — zählt noch nicht.");
  }
}

let timerBtnBusy = false;    // verhindert Doppelklicks während des Dialogs
$("timerBtn").addEventListener("click", async ()=>{
  if(timerBtnBusy) return;
  timerBtnBusy = true;
  try{
    if(focusElapsedMin() !== null){
      await stopFocusSession();
    } else {
      S.timerStart = Date.now(); S.timerId = uid(); save();
      syncTimerUI();
    }
  } finally { timerBtnBusy = false; }
});
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

/* ---------- Weekly Board ---------- */