"use strict";
/* ASCEND minday.js — Minimum-Tag, „Nie zweimal aussetzen“, Willkommen zurück
   Ziel: Freizeit ohne schlechtes Gewissen und Dranbleiben trotz Lücken.
   · Minimum-Tag: Du legst fest, was einen Tag „gewonnen“ macht (z. B. 1 Outcome
     + 2 Habits). Ist das geschafft, ist alles Weitere Bonus.
   · Nie zweimal aussetzen: Ein einzelner verpasster Tag beendet keine Serie —
     erst zwei am Stück. Ein Ausrutscher ist normal, zwei sind ein neues Muster.
   · Willkommen zurück: Nach 2+ Tagen Pause eine freundliche Begrüßung mit
     EINER kleinen Sache statt eines Bergs an Überfälligem. */

/* ---------- Minimum-Tag ---------- */
function minCfg(){
  if(!S.minimumDay || typeof S.minimumDay !== "object") S.minimumDay = { outcomes:1, habits:2 };
  return S.minimumDay;
}
function doneOnDay(t, k){
  if(!t.done) return false;
  if(t.done_at) return todayKey(new Date(t.done_at)) === k;
  return t.date === k;
}
function dayWonStatus(k){
  k = k || todayKey();
  const c = minCfg();
  const outcomes = S.todos.filter(t=>t.is_outcome && !t.parent_id && doneOnDay(t, k)).length;
  const habits = S.habits.filter(h=>(h.dates||{})[k]).length;
  const needH = Math.min(c.habits, S.habits.length);
  return { outcomes, habits, needO:c.outcomes, needH, won: outcomes >= c.outcomes && habits >= needH && (c.outcomes + needH) > 0 };
}
function wonDaysIn(keys){ return keys.filter(k=>(S.wonByDate||{})[k] || dayWonStatus(k).won).length; }

function renderMinDay(){
  const box = $("minDayBanner"); if(!box) return;
  const st = dayWonStatus();
  const tk = todayKey();
  if(st.won && !(S.wonByDate||{})[tk]){
    if(!S.wonByDate || typeof S.wonByDate !== "object") S.wonByDate = {};
    S.wonByDate[tk] = true;
    save();
    addXP(5, "🏆 Tag gewonnen — alles Weitere ist Bonus");
  }
  const c = minCfg();
  const opt = (n, sel) => [0,1,2,3,4,5].slice(0, n).map(v=>`<option value="${v}" ${v===sel?"selected":""}>${v}</option>`).join("");
  box.className = "minday " + (st.won ? "won" : "");
  box.innerHTML = st.won
    ? `<span class="minday-ico">🏆</span><div class="minday-main"><b>Tag gewonnen.</b><small>Dein Minimum ist geschafft — alles Weitere ist Bonus. Freizeit ohne schlechtes Gewissen.</small></div>
       <button class="icon-btn" data-act="minday-edit" aria-label="Minimum-Tag ändern">⚙️</button>`
    : `<span class="minday-ico">🎯</span><div class="minday-main"><b>Minimum-Tag: ${Math.min(st.outcomes, st.needO)}/${st.needO} Outcome${st.needO===1?"":"s"} · ${Math.min(st.habits, st.needH)}/${st.needH} Habits</b>
       <small>Schaffst du das, ist der Tag gewonnen — egal, was sonst liegen bleibt.</small></div>
       <button class="icon-btn" data-act="minday-edit" aria-label="Minimum-Tag ändern">⚙️</button>`;
  if(minEditOpen){
    box.innerHTML += `<div class="minday-edit">Ein Tag ist gewonnen mit
      <select data-act="minday-o">${opt(4, c.outcomes)}</select> Outcome(s) und
      <select data-act="minday-h">${opt(6, c.habits)}</select> Habits.
      <small>Lieber klein ansetzen — an schlechten Tagen soll es machbar sein.</small></div>`;
  }
}
let minEditOpen = false;

/* ---------- Nie zweimal aussetzen ---------- */
/* Serie, die einzelne Lücken verzeiht: Sie zählt erledigte Tage und bricht erst
   bei zwei verpassten Tagen in Folge ab. Heute zählt erst als verpasst, wenn er
   vorbei ist. */
function habitGraceStreak(h){
  let n = 0, miss = 0;
  for(let i=0;i<730;i++){
    const k = todayKey(addDays(new Date(), -i));
    if((h.dates||{})[k]){ n++; miss = 0; }
    else if(i > 0){ miss++; if(miss >= 2) break; }
  }
  return n;
}
/* Gestern verpasst, heute noch offen → heute retten, sonst reißt die Serie */
function habitNeedsRescue(h){
  const heute = todayKey(), gestern = todayKey(addDays(new Date(), -1)), vorgestern = todayKey(addDays(new Date(), -2));
  const d = h.dates || {};
  return !d[heute] && !d[gestern] && !!d[vorgestern];
}

/* ---------- Willkommen zurück ---------- */
const LS_LAST_OPEN = "ascend_last_open";
function checkComeback(){
  let last = 0;
  try{ last = parseInt(localStorage.getItem(LS_LAST_OPEN)) || 0; localStorage.setItem(LS_LAST_OPEN, String(Date.now())); }catch(e){}
  // Auch ein anderes Gerät zählt als „da gewesen“ — der Sync-Stand weiß es.
  const zuletzt = Math.max(last, BOOT_UPDATED_AT);
  if(!last || Date.now() - zuletzt < 2 * 864e5) return;
  const tage = Math.floor((Date.now() - zuletzt) / 864e5);
  $("comebackDays").textContent = tage;
  $("comebackModal").classList.add("open");
}
function closeComeback(){ $("comebackModal").classList.remove("open"); }

document.body.addEventListener("click", e=>{
  const el = e.target.closest("[data-act]");
  if(!el) return;
  switch(el.dataset.act){
    case "minday-edit": minEditOpen = !minEditOpen; renderMinDay(); break;
    case "cb-quick": closeComeback(); quickStart(null); break;
    case "cb-habit": closeComeback(); switchTodayTab("habits"); break;
    case "cb-outcome": closeComeback(); switchTodayTab("day"); openOutcomeModal(); break;
    case "cb-close": closeComeback(); break;
  }
});
document.body.addEventListener("change", e=>{
  const el = e.target;
  if(!el.dataset || (el.dataset.act !== "minday-o" && el.dataset.act !== "minday-h")) return;
  const c = minCfg();
  if(el.dataset.act === "minday-o") c.outcomes = parseInt(el.value) || 0;
  else c.habits = parseInt(el.value) || 0;
  S.minimumDay = Object.assign({}, c);
  save(); renderMinDay();
});
$("comebackModal").addEventListener("click", e=>{ if(e.target === $("comebackModal")) closeComeback(); });
