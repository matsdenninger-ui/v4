"use strict";
/* ASCEND goals.js — Ziele, Meilensteine, Aktions-To-Dos, Skill-XP */

/* ============================================================
   GOALS
   ============================================================ */
function renderGoalSkillSel(){
  const opts = ['<option value="">Skill verknüpfen (optional)</option>'];
  S.skills.forEach(c=>c.items.forEach(s=>opts.push(`<option value="${s.id}">${esc(c.cat)} · ${esc(s.name)}</option>`)));
  $("goalSkill").innerHTML = opts.join("");
}
$("goalAdd").addEventListener("click", ()=>{
  const title = $("goalTitle").value.trim();
  if(!title){ toast("Gib deinem Ziel einen Namen."); return; }
  const ms = $("goalMs").value.split(",").map(s=>s.trim()).filter(Boolean).map(text=>({text, done:false}));
  S.goals.push({id:uid(), title, type:$("goalType").value, skillId:$("goalSkill").value||null, ms, progress:0,
    actionTodos:[], skillXPGranted:false, second:$("goalSecond").value.trim(), touched:Date.now()});
  $("goalTitle").value = $("goalMs").value = $("goalSecond").value = "";
  save(); renderGoals(); renderTodayFocusGoals(); renderHero();
  toast("Ziel angelegt: "+title);
});
function goalProgress(g){
  if(g.ms.length) return Math.round(g.ms.filter(m=>m.done).length / g.ms.length * 100);
  return g.progress||0;
}
function grantGoalCompletionXP(g){
  if(g.skillXPGranted) return;
  g.skillXPGranted = true;
  let skillMsg = "";
  if(g.skillId){
    const sk = findSkill(g.skillId);
    if(sk && sk.lvl < 5){ sk.lvl++; skillMsg = " — "+sk.name+" ist jetzt Level "+sk.lvl; renderSkills(); }
  }
  save();
  addXP(50, "Ziel erreicht: "+g.title+"!");
  if(skillMsg) toast("🏆 Skill-Level gestiegen"+skillMsg);
  checkBadges();
  // Arrival Fallacy: Das Hochgefühl verfliegt schnell — darum kurz festhalten,
  // was der Weg gebracht hat und welcher Prozess weiterlaufen soll.
  if(!g.reflection) setTimeout(()=>openReflection(g.id), 900);
}
function renderGoals(){
  const render = (type, elId, emptyMsg)=>{
    const gs = S.goals.filter(g=>g.type===type);
    $(elId).innerHTML = gs.length ? gs.map(g=>{
      const p = goalProgress(g);
      const skill = g.skillId ? findSkill(g.skillId) : null;
      const actionTodos = g.actionTodos || [];
      return `<div class="goal">
        <div class="goal-head">
          <b>${esc(g.title)}</b>
          <span class="goal-type ${g.type==="fokus"?"t-fokus":"t-lang"}">${g.type==="fokus"?"Fokus":"Langfristig"}</span>
          <button class="icon-btn del" data-act="goal-del" data-id="${g.id}">${ICON_X}</button>
        </div>
        <div class="lab" style="display:flex;justify-content:space-between;font-size:12px;color:var(--dim)">
          <span>Fortschritt</span><span>${p} %${p===100?" · Erreicht 🏆":""}</span></div>
        <div class="bar"><i style="width:${p}%"></i></div>
        ${g.ms.length ? `<div class="milestones">${g.ms.map((m,i)=>`
          <div class="ms ${m.done?"done":""}" data-act="ms-toggle" data-id="${g.id}" data-i="${i}">
            <span class="cbx ${m.done?"on":""}">${ICON_CHECK}</span>${esc(m.text)}
          </div>`).join("")}</div>`
        : `<input type="range" min="0" max="100" step="5" value="${g.progress||0}" data-act="goal-range" data-id="${g.id}" style="margin-top:8px">`}
        <div class="goal-second">
          <label>🌳 Und dann? <span>Was ändert sich, wenn du es erreicht hast — und danach?</span></label>
          <input data-act="goal-second" data-id="${g.id}" maxlength="200" placeholder="Folgen der Folgen durchdenken …" value="${esc(g.second||"")}">
        </div>
        ${g.reflection ? `<div class="goal-reflect">
          <div class="goal-todos-lab">🏁 Rückblick</div>
          <div>${esc(REFLECT_FEEL[g.reflection.feel]||"")}${g.reflection.path ? " · " + esc(g.reflection.path) : ""}</div>
          ${g.reflection.next ? `<div class="goal-reflect-next">Weiter mit: <b>${esc(g.reflection.next)}</b></div>` : ""}
        </div>` : (p===100 ? `<button class="btn ghost sm" style="margin-top:8px" data-act="goal-reflect" data-id="${g.id}">🏁 Rückblick schreiben</button>` : "")}
        ${skill ? `<span class="goal-link">⤷ Skill: ${esc(skill.name)} · Level ${skill.lvl}/5${g.skillXPGranted ? " · XP erhalten ✓" : " · bei 100% Level-Up"}</span>` : ""}
        ${beliefBlockHTML(g)}
        <div class="goal-todos">
          <div class="goal-todos-lab">Aufgaben zum Erreichen</div>
          ${actionTodos.length ? actionTodos.map(at=>`
            <div class="ms ${at.done?"done":""}" data-act="goal-todo-toggle" data-id="${g.id}" data-tid="${at.id}">
              <span class="cbx ${at.done?"on":""}">${ICON_CHECK}</span>
              <span style="flex:1">${esc(at.text)}</span>
              <button class="icon-btn del" style="width:18px;height:18px" data-act="goal-todo-del" data-id="${g.id}" data-tid="${at.id}">${ICON_X}</button>
            </div>`).join("") : `<div class="meta" style="margin-bottom:6px">Noch keine Aufgaben.</div>`}
          <div class="row-add" style="margin-top:6px">
            <input type="text" data-act="goal-todo-input" data-id="${g.id}" placeholder="Aufgabe hinzufügen …" maxlength="80" style="font-size:12.5px;padding:6px 9px">
            <button class="btn sm" data-act="goal-todo-add" data-id="${g.id}">+</button>
          </div>
        </div>
      </div>`;
    }).join("") : `<div class="empty">${emptyMsg}</div>`;
  };
  render("fokus","goalsFocus","🎯 <b>Kein aktives Fokus-Ziel.</b><br>Wähle 1–3 Ziele für die nächsten Wochen — weniger ist mehr.");
  render("lang","goalsLong","🧭 <b>Noch kein langfristiges Ziel.</b><br>Wo willst du in einem Jahr stehen?");
}

/* ============================================================
   GLAUBENSSÄTZE · BEWEISE · EXPERIMENTE

   Kein Friedhof, keine eigene Seite: ein Glaubenssatz hängt an einem Ziel und
   lebt von Beweisen. Erfasst wird er nur von einem Ziel oder aus dem Pre-Flight,
   nie über ein leeres Formular im Nirgendwo — dort würde er nichts ändern.
   ============================================================ */
function beliefsForGoal(goalId){ return (S.beliefs||[]).filter(b=>b.goal_id===goalId); }
function activeBeliefsForGoal(goalId){ return beliefsForGoal(goalId).filter(b=>b.active); }
function evidenceForBelief(beliefId){
  return (S.evidence||[]).filter(e=>e.belief_id===beliefId)
    .sort((a,b)=>(b.created_at||0)-(a.created_at||0));
}
function strengthDots(n){
  let s = "";
  for(let i=1;i<=5;i++) s += `<span class="bdot ${i<=(n||0)?"on":""}"></span>`;
  return `<span class="bdots" title="Stärke ${n||0}/5">${s}</span>`;
}

/* Pro Ziel die höchstens ZWEI aktiven Sätze — mehr wäre wieder eine Liste. */
function beliefBlockHTML(g){
  const list = activeBeliefsForGoal(g.id).slice(0,2);
  const total = beliefsForGoal(g.id).length;
  const kopf = `<div class="belief-head">
    <span class="belief-lab">🧩 Glaubenssatz${list.length===1?"":"e"}</span>
    <button class="btn ghost sm" data-act="belief-add" data-id="${g.id}">+ Satz</button>
  </div>`;
  if(!list.length){
    return `<div class="belief-block">${kopf}
      <div class="belief-empty">Noch kein Satz an diesem Ziel. Was müsste wahr sein, damit dieses Ziel leicht wird?
        <span class="hint-next">Nächster Schritt: „+ Satz“ antippen.</span></div>
    </div>`;
  }
  return `<div class="belief-block">${kopf}
    ${list.map(b=>{
      const ev = evidenceForBelief(b.id);
      const letzte = ev.slice(0,3);
      return `<div class="belief" data-id="${b.id}">
        <div class="belief-old-row"><span class="belief-old">${esc(b.old_statement)}</span>
          <button class="icon-btn del" data-act="belief-del" data-id="${b.id}" aria-label="Satz archivieren">${ICON_X}</button></div>
        <div class="belief-new-row">
          <span class="belief-new">${esc(b.replacement_statement)}</span>
          ${strengthDots(b.strength)}
        </div>
        ${letzte.length ? `<div class="belief-ev">${letzte.map(e=>`
          <div class="ev-row"><span class="ev-dot"></span><span>${esc(e.text)}</span>
            <span class="ev-date">${fmtShort(todayKey(new Date(e.created_at)))}</span></div>`).join("")}</div>`
          : `<div class="belief-ev empty-ev">Noch kein Beweis — starte eine Session zu diesem Ziel, dann kommt der erste.</div>`}
        ${ev.length > 3 ? `<div class="belief-ev-more">+ ${ev.length-3} weitere Beweise</div>` : ""}
        <div class="belief-actions">
          <input data-act="evidence-input" data-id="${b.id}" maxlength="160" placeholder="Beweis-Satz — was hat den neuen Satz bestätigt?">
          <button class="btn sm" data-act="evidence-add" data-id="${b.id}">+</button>
        </div>
      </div>`;
    }).join("")}
    ${total > 2 ? `<div class="belief-more">${total-2} weitere Sätze an diesem Ziel — nicht alle sind gleich wichtig.</div>` : ""}
  </div>`;
}

let beliefEditGoalId = null;
function openBeliefModal(goalId){
  beliefEditGoalId = goalId || null;
  $("beliefOld").value = "";
  $("beliefNew").value = "";
  $("beliefStrength").value = 3;
  $("beliefStrengthVal").textContent = "3 / 5";
  $("beliefGoalSel").innerHTML = goalOptionsHTML(goalId);
  $("beliefModal").classList.add("open");
  $("beliefOld").focus();
}
function closeBeliefModal(){ $("beliefModal").classList.remove("open"); }
function saveBelief(){
  const alt = $("beliefOld").value.trim();
  const neu = $("beliefNew").value.trim();
  const goalId = $("beliefGoalSel").value || beliefEditGoalId;
  if(!alt || !neu){ toast("Alter Satz und Ersatzsatz gehören beide dazu."); return; }
  if(!Array.isArray(S.beliefs)) S.beliefs = [];
  S.beliefs.push({ id:uid(), old_statement:alt, replacement_statement:neu,
    strength: parseInt($("beliefStrength").value)||3, goal_id: goalId || null,
    active:true, touched:Date.now() });
  save(); closeBeliefModal(); renderGoals(); renderReview(); renderTodayFocusGoals();
  // Kam der Satz aus dem Pre-Flight, muss der Rahmen ihn sofort zeigen.
  if(typeof pf !== "undefined" && pf){ pf.goalId = goalId || pf.goalId; renderPreflight(); }
  toast("🧩 Glaubenssatz gespeichert — jetzt Beweise sammeln.");
}
function addEvidence(beliefId, text){
  text = String(text||"").trim();
  if(!text) return;
  if(!Array.isArray(S.evidence)) S.evidence = [];
  S.evidence.unshift({ id:uid(), belief_id:beliefId, session_id:null, text,
    created_at:Date.now(), touched:Date.now() });
  const b = (S.beliefs||[]).find(x=>x.id===beliefId);
  if(b){ b.strength = Math.min(5, (b.strength||1)+1); b.touched = Date.now(); }
  save(); renderGoals(); renderReview();
  toast("Beweis notiert — der Ersatzsatz wird stärker.");
}

/* ---------- Wochen-Review: eine Karte, kein Tagesjournal ---------- */
function renderReview(){
  const box = $("reviewEvidence");
  if(!box) return;
  const seit = todayKey(addDays(new Date(), -6));
  const woche = (S.evidence||[]).filter(e=>todayKey(new Date(e.created_at||0)) >= seit);
  const proBelief = new Map();
  woche.forEach(e=>proBelief.set(e.belief_id, (proBelief.get(e.belief_id)||0) + 1));
  const mitBeweis = [...proBelief.entries()].map(([bid, n])=>{
    const b = (S.beliefs||[]).find(x=>x.id===bid);
    const g = b && b.goal_id ? S.goals.find(x=>x.id===b.goal_id) : null;
    return { b, g, n };
  }).filter(x=>x.b);

  box.innerHTML = mitBeweis.length
    ? `<div class="rev-lab">Diese Woche bewiesen</div>` + mitBeweis.map(({b,g,n})=>`
        <div class="rev-row">
          <div class="rev-main"><b>${esc(b.replacement_statement)}</b>
            <small>${g ? esc(g.title)+" · " : ""}${n} Beweis${n===1?"":"e"} diese Woche</small></div>
          ${strengthDots(b.strength)}
        </div>`).join("")
    : `<div class="empty">🧩 <b>Diese Woche noch kein Beweis.</b><br>Starte eine Session zu einem Ziel mit Glaubenssatz — der Beweis-Satz am Ende landet hier.</div>`;

  const expBox = $("reviewExperiments");
  const aktive = (S.experiments||[]).filter(e=>e.status==="active");
  const entschieden = (S.experiments||[]).filter(e=>e.status!=="active")
    .sort((a,b)=>(b.touched||0)-(a.touched||0)).slice(0,5);
  expBox.innerHTML = `
    <div class="rev-lab">Wenn-dann-Experimente</div>
    ${aktive.length ? aktive.map(e=>`
      <div class="rev-exp">
        <div class="rev-exp-text"><b>Wenn</b> ${esc(ohneCue(e.if_text)||"—")}<br><b>dann</b> ${esc(ohneCue(e.then_text)||"—")}</div>
        <div class="rev-exp-meta">${e.context==="workout"?"Training":"Deep Work"} · seit ${fmtShort(e.started_on)} · ${e.duration_days||7} Tage</div>
        <div class="rev-exp-actions">
          <button class="btn sm" data-act="experiment-set" data-id="${e.id}" data-v="kept">✓ behalten</button>
          <button class="btn ghost sm" data-act="experiment-set" data-id="${e.id}" data-v="dropped">✗ fallenlassen</button>
        </div>
      </div>`).join("")
      : `<div class="empty">🧪 <b>Kein laufendes Experiment.</b><br>Im Pre-Flight legst du mit dem Wenn-dann-Satz eines an.</div>`}
    ${entschieden.length ? `<div class="rev-lab" style="margin-top:14px">Entschieden</div>` + entschieden.map(e=>`
      <div class="rev-exp done ${e.status}">
        <div class="rev-exp-text"><b>Wenn</b> ${esc(ohneCue(e.if_text)||"—")} <b>dann</b> ${esc(ohneCue(e.then_text)||"—")}</div>
        <div class="rev-exp-meta">${e.status==="kept"?"✓ behalten":"✗ fallengelassen"}</div>
      </div>`).join("") : ""}`;
}


/* ============================================================
   RÜCKBLICK NACH DEM ZIEL (gegen die Arrival Fallacy)
   ============================================================ */
const REFLECT_FEEL = { more:"😃 besser als erwartet", same:"🙂 wie erwartet", less:"😐 weniger als erwartet" };
let reflectGoalId = null, reflectFeel = null;
function openReflection(goalId){
  const g = S.goals.find(x=>x.id===goalId); if(!g) return;
  reflectGoalId = goalId; reflectFeel = g.reflection ? g.reflection.feel : null;
  $("reflectGoalName").textContent = g.title;
  $("reflectPath").value = g.reflection ? g.reflection.path || "" : "";
  $("reflectNext").value = g.reflection ? g.reflection.next || "" : "";
  $("reflectHabit").checked = false;
  renderReflectFeel();
  $("reflectModal").classList.add("open");
}
function renderReflectFeel(){
  $("reflectFeel").innerHTML = Object.keys(REFLECT_FEEL).map(k=>
    `<button class="pf-chip ${reflectFeel===k?"on":""}" data-feel="${k}">${REFLECT_FEEL[k]}</button>`).join("");
}
$("reflectFeel").addEventListener("click", e=>{
  const b = e.target.closest("[data-feel]"); if(!b) return;
  reflectFeel = b.dataset.feel; renderReflectFeel();
});
$("reflectCancel").addEventListener("click", ()=>$("reflectModal").classList.remove("open"));
$("reflectSave").addEventListener("click", ()=>{
  const g = S.goals.find(x=>x.id===reflectGoalId); if(!g) return;
  const next = $("reflectNext").value.trim();
  g.reflection = { feel: reflectFeel || "same", path: $("reflectPath").value.trim(), next, at: Date.now() };
  g.touched = Date.now();
  let msg = "🏁 Rückblick gespeichert.";
  if(next && $("reflectHabit").checked && !S.habits.some(h=>h.name.toLowerCase()===next.toLowerCase())){
    S.habits.push({id:uid(), name:next.slice(0,60), dates:{}, note:"", touched:Date.now()});
    renderHabits(); renderHeatmap();
    msg += " Neuer Habit: " + next;
  }
  save(); renderGoals(); renderHero();
  $("reflectModal").classList.remove("open");
  toast(msg);
});

/* ============================================================
   PERSÖNLICHE SWOT
   Stärken & Schwächen = in dir. Chancen & Risiken = um dich herum.
   Einmal im Quartal ausfüllen und daraus Ziele ableiten.
   ============================================================ */
const SWOT_FIELDS = [
  ["s","💪 Stärken","Was kannst du besonders gut? Worum bitten dich andere?"],
  ["w","🧱 Schwächen","Was hält dich zurück? Welche Fähigkeit fehlt?"],
  ["o","🌱 Chancen","Welche Trends, Kontakte oder Gelegenheiten kannst du nutzen?"],
  ["t","⚠️ Risiken","Was könnte dir Probleme machen? Worauf solltest du vorbereitet sein?"],
];
function renderSwot(){
  const box = $("swotGrid"); if(!box) return;
  if(!S.swot || typeof S.swot !== "object") S.swot = {s:"",w:"",o:"",t:"",updated:0};
  box.innerHTML = SWOT_FIELDS.map(([k, lab, ph])=>`
    <div class="swot-cell swot-${k}">
      <label>${lab}</label>
      <textarea data-act="swot-input" data-k="${k}" rows="4" placeholder="${esc(ph)}">${esc(S.swot[k]||"")}</textarea>
    </div>`).join("");
  renderSwotMeta();
}
function renderSwotMeta(){
  const el = $("swotMeta"); if(!el) return;
  const u = S.swot && S.swot.updated;
  if(!u){ el.textContent = "Noch nicht ausgefüllt — nimm dir 10 Minuten."; return; }
  const tage = Math.round((Date.now() - u) / 864e5);
  el.innerHTML = "Zuletzt aktualisiert: " + new Date(u).toLocaleDateString("de-DE") +
    (tage >= 90 ? ' · <b style="color:var(--sec)">Zeit für ein Quartals-Update</b>' : "");
}
document.body.addEventListener("input", e=>{
  const el = e.target;
  if(el.dataset && el.dataset.act === "swot-input"){
    S.swot[el.dataset.k] = el.value; S.swot.updated = Date.now(); save(); renderSwotMeta();
  }
  if(el.dataset && el.dataset.act === "goal-second"){
    const g = S.goals.find(x=>x.id===el.dataset.id);
    if(g){ g.second = el.value; g.touched = Date.now(); save(); }
  }
});
