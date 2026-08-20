"use strict";
/* ASCEND todos.js — To-Do-Liste, Drag&Drop, Rollover, Weekly-Board-Logik */

/* ---------- To-Dos ---------- */
function nextTodoOrder(){
  if(!S.todos.length) return 0;
  return Math.max(...S.todos.map(t=>t.order ?? 0)) + 1;
}

function addTodo(){
  const v = $("todoInput").value.trim();
  if(!v) return;
  const mins = parseInt($("todoMinutes").value) || null;
  const tk = todayKey();
  S.todos.push({id:uid(), text:v, done:false, date:tk, estMinutes:mins, focusedMinutes:0, order:nextTodoOrder(), touched:Date.now()});
  $("todoInput").value = ""; $("todoMinutes").value = ""; save(); renderTodos(); renderWeek(); renderHero();
}
$("todoAdd").addEventListener("click", addTodo);
$("todoInput").addEventListener("keydown", e=>{ if(e.key==="Enter") addTodo(); });

const DRAG_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="6" r="1.3" fill="currentColor" stroke="none"/><circle cx="15" cy="6" r="1.3" fill="currentColor" stroke="none"/><circle cx="9" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="9" cy="18" r="1.3" fill="currentColor" stroke="none"/><circle cx="15" cy="18" r="1.3" fill="currentColor" stroke="none"/></svg>';

function todoDayLabel(t){
  if(!t.date) return "Nicht eingeplant";
  const tk = todayKey();
  if(t.date === tk) return "Heute";
  if(t.date === todayKey(addDays(new Date(),1))) return "Morgen";
  if(t.date < tk) return "Überfällig";
  return fmtShort(t.date);
}

function renderTodos(){
  const list = $("todoList");
  const tk = todayKey();
  const todos = [...S.todos].sort((a,b)=>{
    const da = a.date || "9999-99-99", db = b.date || "9999-99-99";
    if(da !== db) return da.localeCompare(db);
    return (a.order??0)-(b.order??0);
  });
  if(!todos.length){
    list.innerHTML = '<div class="empty">✨ <b>Alles frei.</b><br>Füge oben deine erste Aufgabe hinzu — kleine Schritte zählen.</div>';
  } else {
    list.innerHTML = todos.map(t=>`
      <div class="check-item draggable-item ${t.done?"done":""}" data-id="${t.id}">
        <button class="drag-handle" aria-label="Ziehen zum Umsortieren">${DRAG_ICON}</button>
        <button class="cbx ${t.done?"on":""}" data-act="todo-toggle" data-id="${t.id}" aria-label="Abhaken">${ICON_CHECK}</button>
        <span class="txt">${esc(t.text)}</span>
        <span class="meta">${todoDayLabel(t)}${t.estMinutes ? ` · ⏱ ${t.focusedMinutes||0}/${t.estMinutes} Min.` : ""}</span>
        <button class="icon-btn del" data-act="todo-del" data-id="${t.id}" aria-label="Löschen">${ICON_X}</button>
      </div>`).join("");
  }
  const todayTodos = S.todos.filter(t=>t.date===tk);
  $("stTodos").textContent = todayTodos.filter(t=>t.done).length + "/" + todayTodos.length;
}

/* ---------- Drag & Drop: To-Do-Reihenfolge per Ziehen ändern (Maus + Touch) ---------- */
let dragState = null;
function initDragReorder(listId, onReorder){
  const list = $(listId);
  list.addEventListener("pointerdown", e=>{
    const handle = e.target.closest(".drag-handle");
    if(!handle) return;
    const row = handle.closest(".draggable-item");
    if(!row) return;
    e.preventDefault();
    dragState = { row, pointerId: e.pointerId, startY: e.clientY, offsetTop: row.offsetTop };
    row.classList.add("dragging");
    if(row.setPointerCapture){ try{ row.setPointerCapture(e.pointerId); }catch(err){ /* nicht überall unterstützt */ } }
  });
  list.addEventListener("pointermove", e=>{
    if(!dragState || e.pointerId !== dragState.pointerId) return;
    const dy = e.clientY - dragState.startY;
    dragState.row.style.transform = `translateY(${dy}px)`;
    const siblings = [...list.querySelectorAll(".draggable-item")].filter(x=>x!==dragState.row);
    for(const sib of siblings){
      const r = sib.getBoundingClientRect();
      const mid = r.top + r.height/2;
      const movingDown = sib.compareDocumentPosition(dragState.row) & Node.DOCUMENT_POSITION_PRECEDING;
      if(movingDown && e.clientY > mid){
        list.insertBefore(dragState.row, sib.nextSibling);
        dragState.startY = e.clientY; dragState.row.style.transform = "";
        break;
      } else if(!movingDown && e.clientY < mid){
        list.insertBefore(dragState.row, sib);
        dragState.startY = e.clientY; dragState.row.style.transform = "";
        break;
      }
    }
  });
  function endDrag(e){
    if(!dragState || (e && e.pointerId !== dragState.pointerId)) return;
    dragState.row.classList.remove("dragging");
    dragState.row.style.transform = "";
    const orderedIds = [...list.querySelectorAll(".draggable-item")].map(x=>x.dataset.id);
    onReorder(orderedIds);
    dragState = null;
  }
  list.addEventListener("pointerup", endDrag);
  list.addEventListener("pointercancel", endDrag);
}
function initTodoDrag(){
  initDragReorder("todoList", orderedIds=>{
    const now = Date.now();
    orderedIds.forEach((tid, idx)=>{
      const t = S.todos.find(x=>x.id===tid);
      if(t){ t.order = idx; t.touched = now; }
    });
    save();
    renderHero();
  });
  initDragReorder("routineAM", orderedIds=>{
    const map = new Map(S.routineAM.map(it=>[it.id, it]));
    S.routineAM = orderedIds.map(rid=>map.get(rid)).filter(Boolean);
    S.routineAM.forEach(it=>it.touched=Date.now());
    save();
  });
  initDragReorder("routinePM", orderedIds=>{
    const map = new Map(S.routinePM.map(it=>[it.id, it]));
    S.routinePM = orderedIds.map(rid=>map.get(rid)).filter(Boolean);
    S.routinePM.forEach(it=>it.touched=Date.now());
    save();
  });
}


/* ---------- Weekly Board: Drag & Drop zwischen den Tagen ---------- */
let weekDragState = null;
function initWeekDragReorder(){
  const board = $("weekBoard");
  board.addEventListener("pointerdown", e=>{
    const handle = e.target.closest(".wb-drag-handle");
    if(!handle) return;
    const item = handle.closest(".wb-item");
    if(!item) return;
    e.preventDefault();
    weekDragState = { item, pointerId: e.pointerId, startY: e.clientY };
    item.classList.add("dragging");
    if(item.setPointerCapture){ try{ item.setPointerCapture(e.pointerId); }catch(err){} }
  });
  board.addEventListener("pointermove", e=>{
    if(!weekDragState || e.pointerId !== weekDragState.pointerId) return;
    const dy = e.clientY - weekDragState.startY;
    weekDragState.item.style.transform = `translateY(${dy}px)`;

    const days = [...board.querySelectorAll(".wb-day")];
    days.forEach(d=>d.classList.remove("drag-over"));
    let targetDay = null;
    for(const day of days){
      const r = day.getBoundingClientRect();
      if(e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom){
        targetDay = day; break;
      }
    }
    if(!targetDay) return;
    targetDay.classList.add("drag-over");

    const addBtn = targetDay.querySelector(".wb-add");
    const siblings = [...targetDay.querySelectorAll(".wb-item")].filter(x=>x!==weekDragState.item);
    let inserted = false;
    for(const sib of siblings){
      const r = sib.getBoundingClientRect();
      const mid = r.top + r.height/2;
      if(e.clientY < mid){
        targetDay.insertBefore(weekDragState.item, sib);
        inserted = true; break;
      }
    }
    if(!inserted && targetDay !== weekDragState.item.closest(".wb-day")){
      targetDay.insertBefore(weekDragState.item, addBtn);
    } else if(!inserted && addBtn){
      targetDay.insertBefore(weekDragState.item, addBtn);
    }
    weekDragState.item.style.transform = "";
    weekDragState.startY = e.clientY;
  });
  function endDrag(e){
    if(!weekDragState || (e && e.pointerId !== weekDragState.pointerId)) return;
    const item = weekDragState.item;
    item.classList.remove("dragging");
    item.style.transform = "";
    board.querySelectorAll(".wb-day").forEach(d=>d.classList.remove("drag-over"));

    const dayEl = item.closest(".wb-day");
    const dayIndex = dayEl ? parseInt(dayEl.dataset.day) : null;
    const todoId = item.dataset.id;
    if(dayIndex !== null && !isNaN(dayIndex)){
      const dateKey = weekDates()[dayIndex];
      const t = S.todos.find(x=>x.id===todoId);
      if(t && t.date !== dateKey){
        t.date = dateKey; t.touched = Date.now(); save();
        renderTodos(); renderHero();
        toast("„"+t.text+"“ auf "+WD[dayIndex]+" verschoben");
      }
    }
    weekDragState = null;
    renderWeek();
  }
  board.addEventListener("pointerup", endDrag);
  board.addEventListener("pointercancel", endDrag);
}

// Geteilte Logik für Today-Liste UND Weekly Board (beide arbeiten auf S.todos)
function toggleTodoDone(id){
  const t = S.todos.find(t=>t.id===id); if(!t) return;
  t.done = !t.done; t.touched = Date.now(); save();
  if(t.done) addXP(5, "To-Do erledigt");
  renderTodos(); renderWeek(); renderHero();
}
function deleteTodo(id){
  S.todos = S.todos.filter(t=>t.id!==id); tombstone(id); save();
  renderTodos(); renderWeek(); renderHero();
}
/* Nur aus dem Weekly Board entfernen: Datum wird gelöscht (nicht eingeplant), das To-Do selbst bleibt in der Liste erhalten */
function unassignTodo(id){
  const t = S.todos.find(t=>t.id===id); if(!t) return;
  t.date = null; t.touched = Date.now(); save();
  renderWeek(); renderTodos(); renderHero();
  toast("„"+t.text+"“ aus dem Weekly Board entfernt — bleibt in der To-Do-Liste.");
}

/* Jeden Tag: überfällige, nicht erledigte To-Dos auf heute nachziehen (Fortschritt bleibt erhalten) */
/* Jeden Tag: überfällige, nicht erledigte To-Dos auf heute nachziehen (Fortschritt bleibt erhalten);
   erledigte To-Dos von vergangenen Tagen verschwinden automatisch (nur To-Dos — Habits/Routinen bleiben unberührt) */
function rolloverTodos(){
  const tk = todayKey();
  let changed = false;
  S.todos.forEach(t=>{
    if(!t.done && t.date && t.date < tk){ t.date = tk; t.touched = Date.now(); changed = true; }
  });
  const before = S.todos.length;
  S.todos = S.todos.filter(t => !(t.done && t.date && t.date < tk));
  if(S.todos.length !== before) changed = true;
  if(changed) save();
}
