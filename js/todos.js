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
  S.todos.push({id:uid(), text:v, done:false, date:tk, estMinutes:mins, focusedMinutes:0, order:nextTodoOrder(), touched:Date.now(),
    parent_id:null, is_outcome:false, scheduled_date:tk, status:"open"});
  $("todoInput").value = ""; $("todoMinutes").value = ""; save(); renderTodos(); renderWeek(); renderOutcomes(); renderHero();
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
  // Der Backlog zeigt jeden eigenständigen Punkt — auch einen Aufgabenblock, der
  // gerade nicht auf Heute steht. Ausgeblendet ist nur, was Heute schon als
  // Outcome zeigt (sonst stünde dieselbe Aufgabe zweimal auf dem Schirm) und
  // alles, was selbst ein Subtask ist.
  const todos = S.todos.filter(t=>!t.parent_id && !(t.is_outcome && t.date === tk)).sort((a,b)=>{
    const da = a.date || "9999-99-99", db = b.date || "9999-99-99";
    if(da !== db) return da.localeCompare(db);
    return (a.order??0)-(b.order??0);
  });
  if(!todos.length){
    list.innerHTML = '<div class="empty">✨ <b>Backlog ist leer.</b><br>Lege oben den nächsten Punkt an — oder mach einen davon zum Outcome für heute.</div>';
  } else {
    // Eine Aufgabe MIT Subtasks wird als Block gerendert — dieselbe Darstellung
    // wie auf Heute. Nur so bleiben ihre Subtasks sichtbar, während sie im Backlog
    // liegt. Ohne das verschwanden sie beim Verschieben (oder mussten abgeschnitten
    // werden, was die Definition of Done zerstörte).
    list.innerHTML = todos.map(t=>hasSubtasks(t) ? groupBlockHTML(t, "backlog") : `
      <div class="check-item draggable-item ${t.done?"done":""}" data-id="${t.id}">
        <button class="drag-handle" aria-label="Ziehen zum Umsortieren">${DRAG_ICON}</button>
        <button class="cbx ${t.done?"on":""}" data-act="todo-toggle" data-id="${t.id}" aria-label="Abhaken">${ICON_CHECK}</button>
        <div class="todo-main">
          <span class="txt">${esc(t.text)}</span>
          <span class="meta">${todoDayLabel(t)}${t.estMinutes ? ` · ⏱ ${t.focusedMinutes||0}/${t.estMinutes} Min.` : ""}</span>
        </div>
        <button class="icon-btn promote-btn" data-act="todo-promote" data-id="${t.id}" title="Zum Outcome für heute machen" aria-label="Zum Outcome machen">🎯</button>
        <button class="icon-btn del" data-act="todo-del" data-id="${t.id}" aria-label="Löschen">${ICON_X}</button>
      </div>`).join("");
  }
  const todayTodos = S.todos.filter(t=>t.date===tk && !t.parent_id);
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
async function toggleTodoDone(id){
  const t = S.todos.find(t=>t.id===id); if(!t) return;
  // Einen Block schließt man nicht versehentlich ab, solange er noch offene
  // Subtasks hat — sonst ist ein halbfertiges Ergebnis „erledigt".
  if(!t.parent_id && !t.done && t.is_outcome){
    const offenKinder = outcomeChildren(id).filter(k=>!k.done);
    if(offenKinder.length){
      const ok = await customConfirm(
        `„${t.text}“ hat noch ${offenKinder.length} offene${offenKinder.length===1?"n Subtask":" Subtasks"}. Trotzdem abschließen?`,
        { title:"Block abschließen", okLabel:"Abschließen" });
      if(!ok) return;
    }
  }
  const warOutcome = !!t.is_outcome;
  t.done = !t.done; t.status = t.done ? "done" : "open"; t.touched = Date.now(); save();
  if(t.done) addXP(t.parent_id ? 2 : 5, t.parent_id ? "Subtask erledigt" : "To-Do erledigt");
  renderTodos(); renderWeek(); renderOutcomes(); renderHero();
  // Parent ist erledigt, wenn alle Kinder erledigt sind — aber nur mit Bestätigung.
  if(!t.parent_id && t.is_outcome) renderOutcomes();
  if(t.parent_id && t.done) maybeCompleteParent(t.parent_id);
  if(warOutcome && t.done) renderOutcomes();
}

/* Ein Outcome, dessen Subtasks alle erledigt sind, wird nicht automatisch
   abgeschlossen — der Abschluss ist eine Aussage über das Ergebnis und wird
   deshalb bestätigt. */
let parentConfirmLäuft = false;
async function completeOutcome(parentId, still){
  const parent = S.todos.find(x=>x.id===parentId);
  if(!parent || parent.done) return;
  if(!still){
    const ok = await customConfirm(
      "Alle Subtasks von „" + parent.text + "“ sind erledigt. Aufgabe abschließen?",
      { title:"Aufgabe abschließen", okLabel:"Abschließen" });
    if(!ok) return;
  }
  parent.done = true; parent.status = "done"; parent.touched = Date.now(); save();
  addXP(15, "Ergebnis erreicht: " + parent.text);
  toast("🎯 Abgeschlossen: " + parent.text);
  renderOutcomes(); renderTodos(); renderWeek(); renderHero(); checkBadges();
}
async function maybeCompleteParent(parentId){
  if(parentConfirmLäuft) return;
  const parent = S.todos.find(x=>x.id===parentId);
  if(!parent || parent.done) return;
  const kids = outcomeChildren(parentId);
  if(!kids.length || kids.some(k=>!k.done)) return;
  parentConfirmLäuft = true;
  try { await completeOutcome(parentId, false); }
  finally { parentConfirmLäuft = false; }
}

function deleteTodo(id){
  const t = S.todos.find(x=>x.id===id);
  // Ein Outcome nimmt seine Subtasks mit — sonst bleiben Waisen im Backlog stehen.
  const kinder = t ? outcomeChildren(id) : [];
  const weg = new Set([id, ...kinder.map(k=>k.id)]);
  S.todos = S.todos.filter(x=>!weg.has(x.id));
  weg.forEach(tombstone);
  if(!Array.isArray(S.trash)) S.trash = [];
  kinder.concat(t ? [t] : []).forEach(x=>S.trash.unshift(Object.assign({}, x, {deletedAt: Date.now()})));
  const grenze = Date.now() - 30*864e5;
  S.trash = S.trash.filter(x=>(x.deletedAt||0) > grenze).slice(0, 100);
  save();
  renderTodos(); renderWeek(); renderOutcomes(); renderHero();
  if(t) toast("„"+t.text+"“ gelöscht — im Papierkorb wiederherstellbar.");
}

/* Wiederherstellen: neue ID, damit kein alter Grabstein den Eintrag beim
   nächsten Abgleich gleich wieder entfernt. */
function restoreTodo(text, estMinutes){
  if(!text) return null;
  const t = { id: uid(), text, done:false, date:null,
              estMinutes: estMinutes||0, focusedMinutes:0,
              order: nextTodoOrder(), touched: Date.now(),
              parent_id:null, is_outcome:false, scheduled_date:null, status:"open" };
  S.todos.push(t);
  const key = String(text).trim().toLowerCase();
  S.trash = (S.trash||[]).filter(x=>String(x.text).trim().toLowerCase() !== key);
  return t;
}
/* Nur aus dem Weekly Board entfernen: Datum wird gelöscht (nicht eingeplant), das To-Do selbst bleibt in der Liste erhalten */
function unassignTodo(id){
  const t = S.todos.find(t=>t.id===id); if(!t) return;
  t.date = null; t.touched = Date.now(); save();
  renderWeek(); renderTodos(); renderHero();
  toast("„"+t.text+"“ aus dem Weekly Board entfernt — bleibt in der To-Do-Liste.");
}

/* ---------- Papierkorb: gelöschte To-Dos zurückholen ---------- */
function trashZeitLabel(zeit){
  if(!zeit) return "";
  return new Date(zeit).toLocaleString("de-DE",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"});
}
function renderTrashList(){
  const box = $("trashList");
  const items = recoverableTodos();
  if(!items.length){
    box.innerHTML = '<div class="empty">Nichts wiederherzustellen.<br>Gelöschte To-Dos landen ab jetzt hier und bleiben 30 Tage liegen.</div>';
    $("trashRestoreAll").disabled = true;
    return;
  }
  $("trashRestoreAll").disabled = false;
  box.innerHTML = items.map((it,i)=>`
    <div class="trash-row">
      <div class="trash-info">
        <span class="txt">${esc(it.text)}</span>
        <span class="meta">${esc(it.quelle)}${it.zeit ? " · " + trashZeitLabel(it.zeit) : ""}</span>
      </div>
      <button class="btn ghost sm" data-trash-i="${i}">Zurückholen</button>
    </div>`).join("");
  box.querySelectorAll("button[data-trash-i]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const it = items[parseInt(btn.dataset.trashI)];
      if(!it) return;
      const t = restoreTodo(it.text, it.estMinutes);
      if(t){
        save(); renderTodos(); renderWeek(); renderHero();
        toast("„"+t.text+"“ wiederhergestellt.");
      }
      renderTrashList();
    });
  });
}
function openTrashModal(){ renderTrashList(); $("trashModal").classList.add("open"); }
function closeTrashModal(){ $("trashModal").classList.remove("open"); }
$("trashBtn").addEventListener("click", openTrashModal);
$("trashClose").addEventListener("click", closeTrashModal);
$("trashModal").addEventListener("click", e=>{ if(e.target === $("trashModal")) closeTrashModal(); });
$("trashRestoreAll").addEventListener("click", ()=>{
  const items = recoverableTodos();
  if(!items.length) return;
  items.forEach(it=>restoreTodo(it.text, it.estMinutes));
  save(); renderTodos(); renderWeek(); renderHero();
  toast(items.length + (items.length===1 ? " To-Do wiederhergestellt." : " To-Dos wiederhergestellt."));
  renderTrashList();
});

/* Jeden Tag: überfällige, nicht erledigte To-Dos auf heute nachziehen (Fortschritt bleibt erhalten) */
/* Jeden Tag: überfällige, nicht erledigte To-Dos auf heute nachziehen (Fortschritt bleibt erhalten);
   erledigte To-Dos von vergangenen Tagen verschwinden automatisch (nur To-Dos — Habits/Routinen bleiben unberührt) */
function rolloverTodos(){
  const tk = todayKey();
  let changed = false;
  S.todos.forEach(t=>{
    if(!t.done && t.date && t.date < tk){ t.date = tk; t.scheduled_date = tk; t.touched = Date.now(); changed = true; }
  });
  // Erledigte To-Dos vergangener Tage verschwinden — ein abgeschlossenes Outcome
  // nimmt seine Subtasks mit, sonst blieben sie als Waisen im Backlog stehen.
  const weg = S.todos.filter(t => t.done && t.date && t.date < tk);
  if(weg.length){
    changed = true;
    const ids = new Set();
    weg.forEach(t=>{ ids.add(t.id); if(t.is_outcome) outcomeChildren(t.id).forEach(k=>ids.add(k.id)); });
    S.todos = S.todos.filter(t=>!ids.has(t.id));
  }
  if(changed) save();
}

/* ============================================================
   OUTCOMES & SUBTASKS

   Ein Outcome ist ein Ergebnis mit Definition of Done. Seine Subtasks sind
   KEINE eigenen Backlog-Punkte — sie hängen am Outcome und erscheinen nur dort.
   Ein Outcome ohne offenen Subtask ist unklar und kommt nicht auf Heute:
   dann fehlt der nächste Schritt, nicht die Motivation.
   ============================================================ */
const MAX_OUTCOMES = 3;
const expandedGroups = new Set();   // ids der aufgeklappten Aufgabenblücke (nur Anzeige)

/* Kinder EINES Aufgabenblocks — egal, ob er gerade auf Heute als Outcome steht
   oder im Backlog liegt. Der Block ist der Ort, an dem sie sichtbar sind. */
function outcomeChildren(id){ return S.todos.filter(t=>t.parent_id===id).sort((a,b)=>(a.order??0)-(b.order??0)); }
function hasSubtasks(t){ return !t.parent_id && S.todos.some(x=>x.parent_id===t.id); }
function outcomeProgress(o){
  const kids = outcomeChildren(o.id);
  const done = kids.filter(k=>k.done).length;
  return { done, total:kids.length, pct: kids.length ? Math.round(done/kids.length*100) : 0 };
}
function nextOpenSubtask(o){ return outcomeChildren(o.id).find(k=>!k.done) || null; }
/* „Klar" = mindestens ein Subtask ist noch offen. Alles andere ist eine Absicht,
   kein Ergebnis — solche Outcomes gehören in den Backlog, nicht auf Heute. */
function outcomeIsClear(o){ return !!nextOpenSubtask(o); }
function outcomeGoal(o){ return S.goals.find(g=>g.id===o.goal_id) || null; }

function todayOutcomes(){ return S.todos.filter(t=>t.is_outcome && t.date===todayKey()); }
function openOutcomes(){ return todayOutcomes().filter(o=>!o.done); }
function clearTodayOutcomes(){ return openOutcomes().filter(outcomeIsClear); }
/* Der Deckel zählt ALLE offenen Outcomes des Tages — auch ein noch unklares
   besetzt einen Platz, sonst wären vier Outcomes über die Hintertür möglich. */
function outcomeSlotsLeft(){ return Math.max(0, MAX_OUTCOMES - openOutcomes().length); }

function addSubtask(parentId, text, opts){
  text = String(text||"").trim();
  if(!text) return null;
  const parent = S.todos.find(t=>t.id===parentId);
  // Jede eigenständige Aufgabe darf Subtasks haben — auch eine im Backlog.
  // Nur ein Subtask selbst kann keine eigenen Subtasks bekommen (keine zweite Ebene).
  if(!parent || parent.parent_id) return null;
  const kind = { id:uid(), text, done:false, date:null, scheduled_date:null,
    estMinutes:0, focusedMinutes:0, order:nextTodoOrder(), touched:Date.now(),
    parent_id:parentId, is_outcome:false, status:"open" };
  if(opts && opts.beforeId){
    const anker = S.todos.find(t=>t.id===opts.beforeId);
    if(anker) kind.order = anker.order - 0.5;
  }
  if(opts && opts.afterId){
    const anker = S.todos.find(t=>t.id===opts.afterId);
    if(anker) kind.order = (anker.order ?? 0) + 0.5;
  }
  S.todos.push(kind);
  parent.touched = Date.now();
  return kind;
}

/* ============================================================
   EIN Renderer für jede Aufgabe mit Subtasks

   Der Block sieht auf Heute und im Backlog identisch aus — nur die Aktionen
   unterscheiden sich („in den Backlog“ gibt es nur auf Heute, den Zieh-Griff
   und „🎯 auf Heute“ nur im Backlog). Vorher gab es zwei getrennte Renderer,
   und genau dadurch wurden Subtasks beim Verschieben unsichtbar: der Backlog
   blendet alles mit parent_id aus, hatte aber keinen Weg, sie zu zeigen.
   ============================================================ */
function groupBlockHTML(t, mode){
  const imBacklog = mode === "backlog";
  const p = outcomeProgress(t);
  const next = nextOpenSubtask(t);
  const kids = outcomeChildren(t.id);
  const offen = expandedGroups.has(t.id);
  const goal = outcomeGoal(t);
  // Drei verschiedene Zustände, die vorher zwei waren: keine Definition of Done
  // (gelb), alle Subtasks fertig aber noch nicht abgeschlossen (grün, ein Klick),
  // oder ein nächster Schritt steht an. Vorher galt „alle fertig" fälschlich als
  // „Subtask fehlt" und beschuldigte den Nutzer für getane Arbeit.
  const alleKinderFertig = p.total > 0 && p.done === p.total;
  const unklar = !t.done && p.total === 0;
  return `<div class="outcome ${imBacklog?"in-backlog draggable-item":""} ${t.done?"done":""} ${unklar?"unclear":""}" data-id="${t.id}">
    <div class="outcome-head">
      ${imBacklog ? `<button class="drag-handle" aria-label="Ziehen zum Umsortieren">${DRAG_ICON}</button>` : ""}
      <button class="cbx ${t.done?"on":""}" data-act="todo-toggle" data-id="${t.id}" aria-label="Abhaken">${ICON_CHECK}</button>
      <div class="outcome-main">
        <div class="outcome-title">${esc(t.text)}</div>
        <div class="outcome-meta">
          ${p.total ? `<b>${p.done}/${p.total}</b> Subtasks` : "<b>0 Subtasks</b> — Definition of Done fehlt"}
          ${imBacklog ? ` · <span class="no-wrap">${todoDayLabel(t)}</span>` : ""}
          ${t.focusedMinutes ? ` · ⏱ ${t.focusedMinutes} Min.` : ""}
          ${goal ? `<span class="goal-here">🎯 ${esc(goal.title)}</span>` : ""}
        </div>
      </div>
      <button class="icon-btn outcome-more" data-act="group-expand" data-id="${t.id}" aria-label="Subtasks anzeigen">${offen?"▲":"▼"}</button>
      ${imBacklog ? `<button class="icon-btn promote-btn" data-act="todo-promote" data-id="${t.id}" title="Auf Heute als Outcome" aria-label="Auf Heute setzen">🎯</button>` : ""}
      <button class="icon-btn del" data-act="todo-del" data-id="${t.id}" aria-label="Löschen">${ICON_X}</button>
    </div>
    ${p.total ? `<div class="outcome-bar"><div class="bar"><i style="width:${p.pct}%"></i></div><span class="outcome-pct">${p.pct}%</span></div>` : ""}
    ${t.done ? `<div class="outcome-next done">✓ ${imBacklog ? "Abgeschlossen" : "Outcome abgeschlossen"}</div>`
      : next ? `<div class="outcome-next">
          <button class="cbx" data-act="todo-toggle" data-id="${next.id}" aria-label="Subtask abhaken">${ICON_CHECK}</button>
          <div class="outcome-next-text"><small>Nächster offener Subtask</small><span>${esc(next.text)}</span></div>
        </div>`
      : alleKinderFertig ? `<div class="outcome-next ready">
          <span class="ready-text">✓ <b>Alle ${p.total} Subtasks erledigt.</b> Ergebnis abschließen?</span>
          <button class="btn agree sm" data-act="outcome-complete" data-id="${t.id}">Abschließen</button>
        </div>`
      : `<div class="outcome-next unclear">⚠️ <b>Subtask fehlt.</b> Ohne nächsten Schritt ist das eine Absicht — benenne ihn unten.</div>`}
    ${offen ? `<div class="outcome-subtasks">${kids.map(k=>`
        <div class="check-item subtask ${k.done?"done":""}" data-id="${k.id}">
          <span class="sub-dot"></span>
          <button class="cbx ${k.done?"on":""}" data-act="todo-toggle" data-id="${k.id}" aria-label="Abhaken">${ICON_CHECK}</button>
          <span class="txt">${esc(k.text)}</span>
          <button class="icon-btn del" data-act="todo-del" data-id="${k.id}" aria-label="Löschen">${ICON_X}</button>
        </div>`).join("")}</div>` : ""}
    <div class="row-add outcome-add ${offen?"":"collapsed"}">
      <input data-act="subtask-input" data-id="${t.id}" placeholder="Nächster Subtask — klein genug für 25 Min." maxlength="120">
      <button class="btn sm" data-act="subtask-add" data-id="${t.id}">+</button>
    </div>
    ${!t.done ? `<div class="outcome-actions">
      ${next ? `<button class="btn violet sm" data-act="session-preflight" data-id="${t.id}">▶ Session zu diesem ${imBacklog?"Ergebnis":"Outcome"}</button>` : ""}
      ${imBacklog ? "" : `<button class="btn ghost sm" data-act="outcome-to-backlog" data-id="${t.id}">→ in den Backlog</button>`}
    </div>` : ""}
  </div>`;
}

function renderOutcomes(){
  const box = $("outcomeList");
  if(!box) return;
  const alle = todayOutcomes();
  const offen = alle.filter(o=>!o.done);
  // Über dem Deckel (kommt nur nach Cloud-Merge oder Import vor) wäre „5 / 3"
  // schlicht falsch zu lesen — dort nennt das Label die Zahl und die Grenze.
  $("outcomeCount").textContent = offen.length > MAX_OUTCOMES
    ? offen.length + " offen · max. " + MAX_OUTCOMES
    : offen.length + " / " + MAX_OUTCOMES + " Outcomes";

  if(!alle.length){
    box.innerHTML = `<div class="empty outcome-empty">🎯 <b>Noch kein Outcome für heute.</b><br>
      Wähle das eine Ergebnis, das den Tag gewonnen macht — nicht zehn Aufgaben.<br>
      <span class="hint-next">Nächster Schritt: „Outcome für heute“ antippen.</span></div>`;
    return;
  }

  box.innerHTML = alle.map(o=>groupBlockHTML(o, "today")).join("") + renderOutcomeOverflow(alle);
}

/* Der Deckel ist hart: mehr als 3 offene Outcomes sind keine Priorisierung mehr,
   sondern eine Liste. Der Rest bleibt sichtbar, damit nichts verloren geht. */
function renderOutcomeOverflow(alle){
  const zuviel = alle.filter(o=>!o.done).slice(MAX_OUTCOMES);
  if(!zuviel.length) return "";
  return `<div class="outcome-overflow">
    <div class="pf-lab">Über dem Deckel — erst wenn oben eines abgeschlossen ist (max. ${MAX_OUTCOMES})</div>
    ${zuviel.map(o=>`<div class="outcome-waiting">
      <span>${esc(o.text)}</span>
      <button class="btn ghost sm" data-act="outcome-to-backlog" data-id="${o.id}">→ Backlog</button>
    </div>`).join("")}
  </div>`;
}

function goalOptionsHTML(selected){
  return ['<option value="">Kein Ziel</option>'].concat(
    S.goals.map(g=>`<option value="${g.id}" ${g.id===selected?"selected":""}>${esc(g.title)}</option>`)
  ).join("");
}

function addOutcome(title, subtaskTexts, goalId){
  title = String(title||"").trim();
  if(!title){ toast("Ein Outcome braucht einen Namen."); return null; }
  if(!outcomeSlotsLeft()){
    toast("Es sind schon " + MAX_OUTCOMES + " offene Outcomes auf Heute — schließe erst eines ab, oder nutze den Backlog.");
    return null;
  }
  const o = { id:uid(), text:title, done:false, date:todayKey(), scheduled_date:todayKey(),
    estMinutes:0, focusedMinutes:0, order:nextTodoOrder(), touched:Date.now(),
    parent_id:null, is_outcome:true, status:"open", goal_id: goalId || null };
  S.todos.push(o);
  String(subtaskTexts||"").split(",").map(s=>s.trim()).filter(Boolean)
    .forEach(s=>addSubtask(o.id, s));
  save(); renderOutcomes(); renderTodos(); renderWeek(); renderHero();
  toast("🎯 Outcome für heute: " + title);
  return o;
}

function openOutcomeModal(){
  $("outcomeTitleInput").value = "";
  $("outcomeSubtasks").value = "";
  $("outcomeGoal").innerHTML = goalOptionsHTML(null);
  $("outcomeModal").classList.add("open");
  $("outcomeTitleInput").focus();
}
function closeOutcomeModal(){ $("outcomeModal").classList.remove("open"); }

/* Einen bestehenden Backlog-Punkt zum Outcome machen (statt doppelt zu tippen) */
function promoteTodoToOutcome(id){
  const t = S.todos.find(x=>x.id===id);
  if(!t) return;
  if(!outcomeSlotsLeft()){
    toast("Es sind schon " + MAX_OUTCOMES + " offene Outcomes auf Heute — schließe erst eines ab.");
    return;
  }
  const kinder = outcomeChildren(id);
  t.is_outcome = true; t.parent_id = null;
  t.date = todayKey(); t.scheduled_date = todayKey();
  t.done = false; t.status = "open"; t.touched = Date.now();
  save(); renderOutcomes(); renderTodos(); renderWeek(); renderHero();
  toast(kinder.length
    ? "🎯 „" + t.text + "“ steht heute — die " + kinder.length + " Subtasks sind wieder sichtbar."
    : "🎯 „" + t.text + "“ ist jetzt ein Outcome für heute — ergänze die Definition of Done.");
}

/* Outcome zurück in den Backlog: Datum löschen, is_outcome aufheben.
   Die Subtasks bleiben als eigenständige Punkte erhalten — nichts geht verloren. */
function demoteOutcome(id){
  const t = S.todos.find(x=>x.id===id);
  if(!t || !t.is_outcome) return;
  const kinder = outcomeChildren(id);
  // NUR den Bezug zu Heute lösen. Die Subtasks bleiben dran — sie SIND die
  // Definition of Done. Sie einzeln in den Backlog zu streuen würde genau das
  // zerstören, was am Outcome den Wert ausmacht.
  t.is_outcome = false; t.date = null; t.scheduled_date = null; t.touched = Date.now();
  if(kinder.length) expandedGroups.add(id);   // gleich sichtbar, dass nichts verloren ging
  save(); renderOutcomes(); renderTodos(); renderWeek(); renderHero();
  toast("„" + t.text + "“ liegt jetzt im Backlog" + (kinder.length ? " — die " + kinder.length + " Subtasks bleiben dran." : "."));
}

/* „Fertig für heute": offene Outcomes wandern auf morgen. Danach steht hier nichts
   mehr offen — bewusst ohne Schuld-Badge und ohne Reste. */
function finishDay(){
  const offen = openOutcomes();
  if(!offen.length){ toast("Für heute ist nichts mehr offen."); return; }
  const morgen = todayKey(addDays(new Date(),1));
  offen.forEach(o=>{ o.date = morgen; o.scheduled_date = morgen; o.touched = Date.now(); });
  save(); renderOutcomes(); renderTodos(); renderWeek(); renderHero();
  toast("🌙 " + offen.length + (offen.length===1 ? " Outcome" : " Outcomes") + " auf morgen verschoben. Feierabend.");
}

/* To-Do aus dem Backlog einem Tag zuweisen — auch als Outcome (max. 3 offen) */
function openOutcomePicker(){
  const frei = S.todos.filter(t=>!t.is_outcome && !t.parent_id && !t.done);
  $("outcomePickList").innerHTML = frei.length
    ? frei.slice(0,30).map(t=>`<button class="pf-chip" data-pick="${t.id}">${esc(t.text)}</button>`).join("")
    : '<div class="empty">Der Backlog ist leer — lege oben einen Punkt an.</div>';
  $("outcomePickModal").classList.add("open");
  $("outcomePickList").querySelectorAll("[data-pick]").forEach(b=>{
    b.addEventListener("click", ()=>{
      promoteTodoToOutcome(b.dataset.pick);
      $("outcomePickModal").classList.remove("open");
    });
  });
}
