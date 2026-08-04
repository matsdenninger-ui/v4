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
    actionTodos:[], skillXPGranted:false});
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
