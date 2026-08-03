"use strict";
/* ASCEND hero.js — Begrüßung, Avatar, Tagesfortschritt, Weekly Board Render, Glance-Chips */

/* ---------- Hero card: Begrüßung, Avatar, Tagesfortschritt, Glance-Chips ---------- */
const AVATAR_OPTIONS = ["🔥","🚀","⚡","🌟","🦁","🐺","🌊","🎯","💪","🧠","🌱","👑"];
let editingName = false;
let dayCelebratedFor = null; // verhindert wiederholtes Feiern bei jedem Render desselben Tages

function greetingWord(){
  const h = new Date().getHours();
  if(h < 5) return "Noch wach";
  if(h < 11) return "Guten Morgen";
  if(h < 17) return "Guten Tag";
  if(h < 22) return "Guten Abend";
  return "Noch wach";
}

function dayProgress(){
  const tk = todayKey();
  const checks = S.routineChecks[tk] || {};
  const todos = S.todos.filter(t=>t.date===tk);
  let total = 0, done = 0;
  total += todos.length; done += todos.filter(t=>t.done).length;
  total += S.habits.length; done += S.habits.filter(h=>h.dates[tk]).length;
  total += S.routineAM.length; done += S.routineAM.filter(it=>checks[it.id]).length;
  total += S.routinePM.length; done += S.routinePM.filter(it=>checks[it.id]).length;
  return total ? Math.round(done/total*100) : 0;
}

function todayTimeProgress(){
  const tk = todayKey();
  const todos = S.todos.filter(t=>t.date===tk);
  const est = todos.reduce((s,t)=>s+(t.estMinutes||0),0);
  const done = todos.reduce((s,t)=>s+(t.focusedMinutes||0),0);
  return { done, est, pct: est ? Math.min(100, Math.round(done/est*100)) : 0 };
}

function getNextOpenItem(){
  const tk = todayKey();
  const openTodo = S.todos.filter(t=>t.date===tk && !t.done).sort((a,b)=>(a.order??0)-(b.order??0))[0];
  if(openTodo) return {icon:"✅", text:openTodo.text};
  const openHabit = S.habits.find(h=>!h.dates[tk]);
  if(openHabit) return {icon:"🔁", text:openHabit.name};
  const checks = S.routineChecks[tk] || {};
  const hour = new Date().getHours();
  const routines = hour < 14 ? [S.routineAM, S.routinePM] : [S.routinePM, S.routineAM];
  for(const list of routines){
    const openItem = list.find(it=>!checks[it.id]);
    if(openItem) return {icon:"☀️", text:openItem.text};
  }
  const now = new Date();
  const nowMin = now.getHours()*60+now.getMinutes();
  const eatenMap = S.mealEaten[tk] || {};
  const dueMeals = Object.keys(MEALS).filter(slot=>{
    if(eatenMap[slot]) return false;
    const [hh,mm] = (S.mealSlots[slot].time||"00:00").split(":").map(Number);
    return hh*60+mm <= nowMin;
  });
  if(dueMeals.length){
    const slot = dueMeals[0];
    return {icon:"🍽", text:MEALS[slot].label+": "+MEALS[slot].options[S.mealSlots[slot].idx].name};
  }
  return null;
}

function getNextSupplement(){
  const tk = todayKey();
  const open = [...S.supplements].filter(s=>!s.dates[tk]).sort((a,b)=>a.time.localeCompare(b.time));
  return open[0] || null;
}

/* Mission-Callout: zeigt das wichtigste Fokus-Ziel, sonst den nächsten offenen Punkt */
function renderMission(){
  const fokusGoals = S.goals.filter(g=>g.type==="fokus" && goalProgress(g) < 100);
  if(fokusGoals.length){
    const g = fokusGoals[0];
    const p = goalProgress(g);
    $("missionIcon").textContent = "🎯";
    $("missionText").textContent = g.title + " · " + p + "% geschafft";
    return;
  }
  const next = getNextOpenItem();
  if(next){
    $("missionIcon").textContent = next.icon;
    $("missionText").textContent = next.text;
    return;
  }
  $("missionIcon").textContent = "🎉";
  $("missionText").textContent = "Alles erledigt — genieß den Tag!";
}

function renderHero(){
  const p = S.profile;
  $("heroAvatarBtn").textContent = p.avatar || "🔥";
  $("heroGreetWord").textContent = greetingWord();
  $("heroDate").textContent = new Date().toLocaleDateString("de-DE",{weekday:"long", day:"numeric", month:"long"});

  if(editingName){
    $("heroGreetRow").querySelectorAll(".hero-name, .hero-name-edit-btn").forEach(el=>el.style.display="none");
    if(!$("heroNameInput")){
      const input = document.createElement("input");
      input.id = "heroNameInput"; input.className = "hero-name-input";
      input.maxLength = 24; input.placeholder = "Dein Name";
      input.value = p.name || "";
      $("heroGreetRow").insertBefore(input, $("heroGreetRow").children[1]);
      input.focus(); input.select();
      const commit = ()=>{
        S.profile.name = input.value.trim(); save();
        editingName = false; renderHero();
      };
      input.addEventListener("blur", commit);
      input.addEventListener("keydown", e=>{ if(e.key==="Enter") commit(); if(e.key==="Escape"){ editingName=false; renderHero(); } });
    }
  } else {
    const oldInput = $("heroNameInput"); if(oldInput) oldInput.remove();
    $("heroGreetRow").querySelectorAll(".hero-name, .hero-name-edit-btn").forEach(el=>el.style.display="");
    $("heroNameDisplay").textContent = p.name || "dir";
  }

  const pct = dayProgress();
  $("dayRingPct").textContent = pct + "%";
  $("dayRingBar").style.strokeDashoffset = 157 * (1 - pct/100);
  const dayRing = $("dayRingPct").closest(".ring");
  if(pct === 100){
    if(dayRing) dayRing.classList.add("day-complete");
    const tk = todayKey();
    if(dayCelebratedFor !== tk){
      dayCelebratedFor = tk;
      const mission = $("missionCard");
      if(mission){
        mission.classList.remove("day-complete"); void mission.offsetWidth;
        mission.classList.add("day-complete");
      }
      toast("🎉 Tag komplett — alles erledigt!", 0);
    }
  } else if(dayRing){
    dayRing.classList.remove("day-complete");
  }

  const timeP = todayTimeProgress();
  const timeEl = $("heroTime");
  if(timeP.est > 0){
    timeEl.classList.add("show");
    $("heroTimeNums").textContent = timeP.done + " / " + timeP.est + " Min.";
    $("heroTimeBar").style.width = timeP.pct + "%";
  } else {
    timeEl.classList.remove("show");
  }

  const chips = [];
  const next = getNextOpenItem();
  chips.push(next
    ? `<div class="hchip">${next.icon} Als Nächstes: <b>${esc(next.text)}</b></div>`
    : `<div class="hchip">🎉 <b>Alles erledigt für heute!</b></div>`);
  const nextSupp = getNextSupplement();
  chips.push(nextSupp
    ? `<div class="hchip">💊 ${esc(nextSupp.name)} um <b>${esc(nextSupp.time)}</b></div>`
    : `<div class="hchip">💊 Alle Supplements genommen ✓</div>`);
  const streak = S.habits.reduce((m,h)=>Math.max(m,habitStreak(h)),0);
  chips.push(`<div class="hchip">🔥 Streak: <b>${streak} Tag${streak===1?"":"e"}</b></div>`);
  $("heroChips").innerHTML = chips.join("");

  renderMission();
}

function renderTodayFocusGoals(){
  const gs = S.goals.filter(g=>g.type==="fokus");
  if(!gs.length){
    $("todayFocusGoals").innerHTML = `<div class="empty">🎯 <b>Noch kein Fokus-Ziel.</b><br>
      <span class="hchip clickable" data-act="goto-goals" style="margin-top:8px;display:inline-flex">Jetzt auf der Goals-Seite anlegen →</span></div>`;
    return;
  }
  $("todayFocusGoals").innerHTML = gs.map(g=>{
    const p = goalProgress(g);
    return `<div class="goal" data-act="goto-goals" style="cursor:pointer">
      <div class="goal-head"><b>${esc(g.title)}</b><span class="goal-type t-fokus">Fokus</span></div>
      <div class="lab" style="display:flex;justify-content:space-between;font-size:12px;color:var(--dim)">
        <span>Fortschritt</span><span>${p} %${p===100?" · Erreicht 🏆":""}</span></div>
      <div class="bar"><i style="width:${p}%"></i></div>
    </div>`;
  }).join("");
}

const WD = ["Mo","Di","Mi","Do","Fr","Sa","So"];
function weekDates(){
  const monday = dateFromKey(weekKey());
  return WD.map((_,i)=>todayKey(addDays(monday, i)));
}
function renderWeek(){
  const dates = weekDates();
  const tk = todayKey();
  $("weekBoard").innerHTML = WD.map((name,i)=>{
    const dateKey = dates[i];
    const items = S.todos.filter(t=>t.date===dateKey).sort((a,b)=>(a.order??0)-(b.order??0));
    return `<div class="wb-day ${dateKey===tk?"today":""}" data-day="${i}">
      <h5>${name}</h5>
      <div class="wb-date">${fmtShort(dateKey)}</div>
      ${items.map(it=>{
        return `<div class="wb-item ${it.done?"done":""}" data-id="${it.id}">
          <div class="wb-item-row">
            <button class="wb-drag-handle" aria-label="Ziehen">${DRAG_ICON}</button>
            <span class="wb-txt" data-act="wb-toggle" data-id="${it.id}">${esc(it.text)}</span>
            <button class="wb-del" data-act="wb-unassign" data-id="${it.id}" aria-label="Aus Board entfernen">${ICON_X}</button>
          </div>
          ${it.estMinutes ? `<span class="wb-time">⏱ ${it.focusedMinutes||0}/${it.estMinutes} Min.</span>` : ""}
        </div>`;
      }).join("")}
      <button class="wb-add" data-act="wb-assign" data-day="${i}" aria-label="To-Do zuweisen">+</button>
    </div>`;
  }).join("");
}

/* To-Do zuweisen: bestehende Einträge aus der Liste auswählen (Alternative zum Ziehen) */
function openTodoAssignPicker(day){
  const dateKey = weekDates()[day];
  const available = [...S.todos].filter(t=>t.date!==dateKey).sort((a,b)=>{
    const da = a.date || "9999-99-99", db = b.date || "9999-99-99";
    return da.localeCompare(db);
  });
  $("assignDayLabel").textContent = WD[day] + ", " + fmtShort(dateKey);
  if(!available.length){
    $("assignTodoList").innerHTML = '<div class="empty">Keine weiteren To-Dos vorhanden.<br>Leg zuerst in der To-Do-Liste eins an.</div>';
  } else {
    $("assignTodoList").innerHTML = available.map(t=>`
      <button class="btn ghost" data-todo-id="${t.id}" style="justify-content:space-between;width:100%;text-align:left">
        <span>${t.done?"✓ ":""}${esc(t.text)}</span>
        <span class="meta">${t.date ? fmtShort(t.date) : "Nicht eingeplant"}</span>
      </button>`).join("");
  }
  $("assignTodoModal").classList.add("open");
  const buttons = [...$("assignTodoList").querySelectorAll("button[data-todo-id]")];
  function cleanup(){
    $("assignTodoModal").classList.remove("open");
    buttons.forEach(b=>b.removeEventListener("click", onPick));
    $("assignTodoCancel").removeEventListener("click", onCancel);
  }
  function onPick(e){
    const t = S.todos.find(x=>x.id===e.currentTarget.dataset.todoId);
    if(t){
      t.date = dateKey;
      t.order = nextTodoOrder();
      save(); renderWeek(); renderTodos(); renderHero();
      toast("„"+t.text+"“ auf "+WD[day]+" gelegt");
    }
    cleanup();
  }
  function onCancel(){ cleanup(); }
  buttons.forEach(b=>b.addEventListener("click", onPick));
  $("assignTodoCancel").addEventListener("click", onCancel);
}
$("assignTodoModal").addEventListener("click", e=>{
  if(e.target === $("assignTodoModal")) $("assignTodoCancel").click();
});

document.body.addEventListener("keydown", e=>{
  if(e.target && e.target.dataset && e.target.dataset.act === "goal-todo-input" && e.key === "Enter"){
    e.preventDefault();
    document.querySelector(`[data-act="goal-todo-add"][data-id="${e.target.dataset.id}"]`).click();
  }
});
