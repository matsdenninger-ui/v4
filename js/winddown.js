"use strict";
/* ASCEND winddown.js — Gedanken-Parkplatz & Feierabend-Ritual
   Parkplatz: Während einer Fokus-Session poppt ein Gedanke auf („Mama anrufen“).
   Statt die Aufgabe zu wechseln (Attention Residue), landet er mit einem Enter
   im Backlog — der Kopf darf ihn loslassen, die Session läuft weiter.
   Feierabend: Ein kurzer, bewusster Abschluss. Offenes wird auf morgen gelegt
   und der wichtigste Punkt für morgen aufgeschrieben — ein konkreter Plan
   beruhigt offene Gedanken, damit der Abend wirklich frei ist. */

/* ---------- Gedanken-Parkplatz ---------- */
function parkThought(text){
  text = String(text||"").trim();
  if(!text) return null;
  const t = { id:uid(), text, done:false, date:null, estMinutes:null, focusedMinutes:0,
    order:nextTodoOrder(), touched:Date.now(), parent_id:null, is_outcome:false,
    scheduled_date:null, status:"open", parked_on: todayKey() };
  S.todos.push(t);
  return t;
}
function parkedToday(){ return S.todos.filter(t=>t.parked_on === todayKey() && !t.done); }
function renderParkList(){
  const n = parkedToday().length;
  $("focusParkCount").textContent = n ? "✓ " + n + " Gedanke" + (n===1?"":"n") + " geparkt — kümmerst du dich beim Feierabend drum" : "";
}
$("focusParkInput").addEventListener("keydown", e=>{
  if(e.key !== "Enter") return;
  e.preventDefault();
  const t = parkThought($("focusParkInput").value);
  if(!t) return;
  $("focusParkInput").value = "";
  save(); renderParkList(); renderTodos();
});

/* ---------- Feierabend-Ritual ---------- */
let sdChecks = {};
const SD_TOGGLES = [
  ["tabs", "🗂", "Tabs & Programme zu"],
  ["desk", "🧹", "Arbeitsplatz kurz aufgeräumt"],
  ["phone", "📵", "Arbeits-Benachrichtigungen aus"],
];
function shutdownDoneToday(){ return !!(S.shutdownByDate||{})[todayKey()]; }

function openShutdown(){
  sdChecks = {};
  $("sdTomorrow").value = "";
  renderShutdown();
  $("shutdownModal").classList.add("open");
}
function closeShutdown(){ $("shutdownModal").classList.remove("open"); }

function renderShutdown(){
  const tk = todayKey();
  const offen = openOutcomes();
  const erledigt = S.todos.filter(t=>!t.parent_id && t.done && (t.done_at ? todayKey(new Date(t.done_at)) === tk : t.date === tk)).length;
  const fokus = (S.focusByDate[tk]||0);
  $("sdSummary").innerHTML = `Heute erledigt: <b>${erledigt}</b> Aufgabe${erledigt===1?"":"n"} · <b>${h1(fokus/60)} h</b> Fokus`;

  $("sdOutcomes").innerHTML = offen.length
    ? offen.map(o=>`<div class="sd-row"><span>→</span><span>${esc(o.text)}</span></div>`).join("") +
      `<div class="sd-hint">Wandern beim Abschließen automatisch auf morgen — ohne Schuldgefühl.</div>`
    : `<div class="sd-row ok"><span>✓</span><span>Kein Outcome mehr offen.</span></div>`;

  const parked = parkedToday();
  $("sdParked").innerHTML = parked.length
    ? parked.map(t=>`<div class="sd-row">
        <span class="sd-txt">${esc(t.text)}</span>
        ${t.date ? `<span class="sd-tag">📅 ${todayKey(addDays(new Date(),1)) === t.date ? "morgen" : fmtShort(t.date)}</span>`
          : `<button class="btn ghost sm" data-act="sd-park-tomorrow" data-id="${t.id}">Morgen</button>`}
        <button class="icon-btn del" data-act="sd-park-del" data-id="${t.id}" aria-label="Verwerfen">${ICON_X}</button>
      </div>`).join("") + `<div class="sd-hint">Was nicht auf morgen kommt, bleibt im Backlog.</div>`
    : `<div class="sd-row ok"><span>✓</span><span>Heute nichts geparkt.</span></div>`;

  $("sdToggles").innerHTML = SD_TOGGLES.map(([k, ico, lab])=>`
    <button class="pf-toggle ${sdChecks[k]?"on":""}" data-act="sd-toggle" data-k="${k}">
      <span class="pf-toggle-ico">${sdChecks[k] ? "✓" : ico}</span>${esc(lab)}
    </button>`).join("");
  $("sdSave").textContent = shutdownDoneToday() ? "Nochmal abschließen ✓" : "Tag abschließen 🌙";
}

function completeShutdown(){
  const tk = todayKey();
  const morgen = todayKey(addDays(new Date(),1));
  const offen = openOutcomes();
  offen.forEach(o=>setTodoDate(o, morgen));
  const wichtig = $("sdTomorrow").value.trim();
  if(wichtig){
    S.todos.push({ id:uid(), text:wichtig, done:false, date:morgen, estMinutes:null, focusedMinutes:0,
      order:-1, touched:Date.now(), parent_id:null, is_outcome:false, scheduled_date:morgen, status:"open" });
  }
  const ersterMal = !shutdownDoneToday();
  if(!S.shutdownByDate || typeof S.shutdownByDate !== "object") S.shutdownByDate = {};
  S.shutdownByDate[tk] = true;
  save();
  closeShutdown();
  renderOutcomes(); renderTodos(); renderWeek(); renderHero();
  const msg = "🌙 Feierabend." + (offen.length ? " " + offen.length + " Outcome" + (offen.length===1?"":"s") + " auf morgen." : "") + (wichtig ? " Morgen zuerst: " + wichtig : "");
  if(ersterMal) addXP(5, msg); else toast(msg);
  checkBadges();
}

$("finishDayBtn").addEventListener("click", openShutdown);
$("sdCancel").addEventListener("click", closeShutdown);
$("sdSave").addEventListener("click", completeShutdown);
$("shutdownModal").addEventListener("click", e=>{ if(e.target === $("shutdownModal")) closeShutdown(); });
$("sdTomorrow").addEventListener("keydown", e=>{ if(e.key === "Enter"){ e.preventDefault(); completeShutdown(); } });

document.body.addEventListener("click", e=>{
  const el = e.target.closest("[data-act]");
  if(!el || !String(el.dataset.act).startsWith("sd-")) return;
  const id = el.dataset.id;
  switch(el.dataset.act){
    case "sd-toggle":
      sdChecks[el.dataset.k] = !sdChecks[el.dataset.k]; renderShutdown();
      break;
    case "sd-park-tomorrow": {
      const t = S.todos.find(x=>x.id===id); if(!t) break;
      const morgen = todayKey(addDays(new Date(),1));
      setTodoDate(t, morgen);
      save(); renderShutdown(); renderTodos(); renderWeek();
      break; }
    case "sd-park-del":
      deleteTodo(id); renderShutdown();
      break;
  }
});
