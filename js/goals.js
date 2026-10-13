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
    actionTodos:[], skillXPGranted:false, touched:Date.now()});
  $("goalTitle").value = $("goalMs").value = "";
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
