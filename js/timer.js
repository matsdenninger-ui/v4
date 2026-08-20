"use strict";
/* ASCEND timer.js — Deep Work Timer + Fokus-Zuordnung */

/* ---------- Deep Work Timer ---------- */
let timerInterval = null;
function tickTimer(){
  const secs = Math.floor((Date.now() - S.timerStart)/1000);
  const hh = String(Math.floor(secs/3600)).padStart(2,"0"),
        mm = String(Math.floor(secs%3600/60)).padStart(2,"0"),
        ss = String(secs%60).padStart(2,"0");
  $("clock").textContent = hh+":"+mm+":"+ss;
}
function startTimerUI(){
  $("clock").classList.add("running");
  $("timerState").textContent = "Fokus läuft …";
  $("timerBtn").textContent = "■ Session beenden";
  $("timerBtn").classList.remove("violet"); $("timerBtn").classList.add("ghost");
  timerInterval = setInterval(tickTimer, 500); tickTimer();
}
$("timerBtn").addEventListener("click", async ()=>{
  if(S.timerStart){
    clearInterval(timerInterval); timerInterval = null;
    const mins = Math.floor((Date.now() - S.timerStart)/60000);
    const tk = todayKey();
    S.focusByDate[tk] = (S.focusByDate[tk]||0) + mins;
    S.sessionsByDate[tk] = (S.sessionsByDate[tk]||0) + 1;
    S.timerStart = null; save();
    $("clock").classList.remove("running");
    $("clock").textContent = "00:00:00";
    $("timerState").textContent = "Bereit";
    $("timerBtn").textContent = "▶ Session starten";
    $("timerBtn").classList.add("violet"); $("timerBtn").classList.remove("ghost");
    renderFocus();
    if(mins >= 1){
      const todoId = await pickTodoForFocus(mins);
      if(todoId){
        const t = S.todos.find(x=>x.id===todoId);
        if(t){ t.focusedMinutes = (t.focusedMinutes||0) + mins; t.touched = Date.now(); save(); renderTodos(); }
      }
      addXP(mins, "Deep Work: "+mins+" Min. Fokus");
      renderHero();
    } else {
      toast("Session unter einer Minute — zählt noch nicht.");
    }
  } else {
    S.timerStart = Date.now(); save();
    startTimerUI();
  }
});
function renderFocus(){
  const tk = todayKey();
  const today = (S.focusByDate[tk]||0)/60;
  $("focusToday").textContent = h1(today)+" h";
  $("stFocus").textContent = h1(today)+" h";
  const wk = lastNDates(7).reduce((s,k)=>s+(S.focusByDate[k]||0),0)/60;
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