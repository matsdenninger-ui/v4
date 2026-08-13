"use strict";
/* ASCEND knowledge.js — Wissens-Themen: Notizen/Taktiken + To-Dos je Thema */

function renderKnowledge(){
  const topics = S.knowledge;
  $("knowledgeList").innerHTML = topics.length ? topics.map(t=>{
    const todos = t.todos || [];
    return `<div class="goal">
      <div class="goal-head">
        <b>${esc(t.title)}</b>
        <button class="icon-btn del" data-act="know-del" data-id="${t.id}">${ICON_X}</button>
      </div>
      <textarea data-act="know-notes-input" data-id="${t.id}" placeholder="Wissen, Taktiken, Learnings …">${esc(t.notes||"")}</textarea>
      <div class="goal-todos">
        <div class="goal-todos-lab">To-Dos</div>
        ${todos.length ? todos.map(td=>`
          <div class="ms ${td.done?"done":""}" data-act="know-todo-toggle" data-id="${t.id}" data-tid="${td.id}">
            <span class="cbx ${td.done?"on":""}">${ICON_CHECK}</span>
            <span style="flex:1">${esc(td.text)}</span>
            <button class="icon-btn del" style="width:18px;height:18px" data-act="know-todo-del" data-id="${t.id}" data-tid="${td.id}">${ICON_X}</button>
          </div>`).join("") : `<div class="meta" style="margin-bottom:6px">Noch keine To-Dos.</div>`}
        <div class="row-add" style="margin-top:6px">
          <input type="text" data-act="know-todo-input" data-id="${t.id}" placeholder="To-Do hinzufügen …" maxlength="80" style="font-size:12.5px;padding:6px 9px">
          <button class="btn sm" data-act="know-todo-add" data-id="${t.id}">+</button>
        </div>
      </div>
    </div>`;
  }).join("") : `<div class="empty">📚 <b>Noch kein Thema angelegt.</b><br>Leg oben ein Thema an und sammle Wissen, Taktiken und offene Aufgaben dazu.</div>`;
}

$("knowTopicAdd").addEventListener("click", ()=>{
  const title = $("knowTopicTitle").value.trim();
  if(!title){ toast("Gib dem Thema einen Namen."); return; }
  S.knowledge.push({id:uid(), title, notes:"", todos:[]});
  $("knowTopicTitle").value = "";
  save(); renderKnowledge();
  toast("Thema angelegt: "+title);
});
$("knowTopicTitle").addEventListener("keydown", e=>{ if(e.key==="Enter") $("knowTopicAdd").click(); });
