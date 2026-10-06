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

    S.timerStart = null; S.timerId = null;

    if(mins >= 1 && !schonAngerechnet){
      const ok = await customConfirm(
        "Beim letzten Mal lief noch eine Session. Bis die App geschlossen wurde, sind "
        + mins + " Min. zusammengekommen — die Zeit danach zählt nicht mit.",
        { title:"Nicht beendete Session", okLabel:mins+" Min. anrechnen" });
      if(ok){
        creditFocus(startMs, mins);
        S.lastFocusId = id || S.lastFocusId;
        save(); syncTimerUI(); renderFocus();
        addXP(mins, "Deep Work: "+mins+" Min. Fokus (nachgetragen)");
        renderHero();
        return true;
      }
    }
    S.lastFocusId = id || S.lastFocusId;
    save(); syncTimerUI(); renderFocus();
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
      S.timerStart = Date.now(); S.timerId = uid(); save();
      markSeen();                 // Startpunkt der Lebenszeichen
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