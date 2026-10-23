"use strict";
/* ASCEND knowledge.js — Second Brain
   · Themen nach P.A.R.A. (Projekt · Bereich · Ressource · Archiv), Projekte am Goal
   · Feynman-Feld „In einfachen Worten“ pro Thema
   · Karteikarten mit verteilter Wiederholung (Leitner-Boxen)
   · Denkmodell-Bibliothek (js/models.js) als Startpaket für Karten
   Die alten Notizen und To-Dos je Thema bleiben unverändert erhalten. */

/* ---------- Konstanten ---------- */
const KN_PARA = {
  project:  { label:"Projekt",   plural:"Projekte",   icon:"🎯", hint:"Hat ein Ziel und ein Ende" },
  area:     { label:"Bereich",   plural:"Bereiche",   icon:"🧭", hint:"Wird dauerhaft gepflegt" },
  resource: { label:"Ressource", plural:"Ressourcen", icon:"📚", hint:"Sammlung zu einem Interesse" },
  archive:  { label:"Archiv",    plural:"Archiv",     icon:"🗄", hint:"Inaktiv — Karten pausieren" },
};
/* Abstand in Tagen NACH einer richtigen Antwort, je erreichter Box (Index = neue Box).
   Box 0 = neu oder vergessen. Wachsende Abstände: 1 → 3 → 7 → 30 → 90 Tage. */
const KN_INTERVALS = [0, 1, 3, 7, 30, 90];
const KN_MAX_BOX = KN_INTERVALS.length - 1;
const KN_MODELS_TOPIC_ID = "def-know-models";
const KN_XP_PER_CARD = 1, KN_XP_BONUS = 5;

let knFilter = "all";                 // aktiver PARA-Filter
const knOpenTopics = new Set();       // aufgeklappte Themen (nur in dieser Sitzung)
let knReview = null;                  // laufende Wiederholung {queue, idx, shown, done, known, requeued:Set}

/* ---------- Abfragen ---------- */
function knPara(t){ return KN_PARA[t && t.para] ? t.para : "resource"; }
function knTopic(id){ return S.knowledge.find(t=>t.id===id) || null; }
function knCards(){ return Array.isArray(S.cards) ? S.cards : (S.cards = []); }
function knCardsOf(topicId){ return knCards().filter(c=>c.topic_id===topicId); }

/* Karten eines archivierten Themas pausieren — Archiv heißt „gerade nicht aktiv“. */
function knCardActive(c){
  if(!c.topic_id) return true;
  const t = knTopic(c.topic_id);
  return !!t && knPara(t) !== "archive";
}
function knIsDue(c, tk){ return knCardActive(c) && (c.due || "0000-00-00") <= (tk || todayKey()); }
function knDueCards(){
  const tk = todayKey();
  // Älteste Fälligkeit zuerst, innerhalb gleicher Tage niedrige Boxen (= wackeligeres Wissen) vorn.
  return knCards().filter(c=>knIsDue(c, tk))
    .sort((a,b)=>(a.due||"").localeCompare(b.due||"") || (a.box||0)-(b.box||0));
}
function knNextDue(){
  const tk = todayKey();
  const kommende = knCards().filter(c=>knCardActive(c) && (c.due||"") > tk).map(c=>c.due).sort();
  return kommende[0] || null;
}
function knReviewedToday(){ return (S.reviewByDate||{})[todayKey()] || 0; }
function knStreak(){
  const log = S.reviewByDate || {};
  let d = new Date(), n = 0;
  if(!log[todayKey(d)]) d = addDays(d, -1);       // heute noch nicht gelernt? ab gestern zählen
  while(log[todayKey(d)]){ n++; d = addDays(d, -1); }
  return n;
}
function knDueLabel(c){
  const tk = todayKey();
  if(!knCardActive(c)) return "pausiert";
  if(!c.due || c.due <= tk) return c.reviews ? "fällig" : "neu · fällig";
  const tage = Math.round((dateFromKey(c.due) - dateFromKey(tk)) / 864e5);
  return tage === 1 ? "morgen" : "in " + tage + " Tagen";
}

/* ---------- Mutationen ---------- */
function knAddTopic(title, para, goalId){
  const t = { id:uid(), title, notes:"", explain:"", todos:[], para: KN_PARA[para] ? para : "resource",
    goal_id: para === "project" ? (goalId || null) : null, touched:Date.now() };
  S.knowledge.push(t);
  return t;
}
function knAddCard(topicId, front, back, extra){
  const c = Object.assign({ id:uid(), topic_id: topicId || null, front, back,
    box:0, due: todayKey(), reviews:0, lapses:0, last_review:null, touched:Date.now() }, extra || {});
  knCards().push(c);
  return c;
}
/* Leitner: gewusst → eine Box weiter und längerer Abstand; nicht gewusst → zurück auf
   Box 0 und morgen wieder. Die Karte wird in place geändert (Sync per `touched`). */
function knGrade(card, knew){
  const tk = todayKey();
  card.reviews = (card.reviews||0) + 1;
  card.last_review = tk;
  if(knew){
    card.box = Math.min(KN_MAX_BOX, (card.box||0) + 1);
    card.due = todayKey(addDays(new Date(), KN_INTERVALS[card.box]));
  } else {
    card.box = 0;
    card.lapses = (card.lapses||0) + 1;
    card.due = todayKey(addDays(new Date(), 1));
  }
  card.touched = Date.now();
  if(!S.reviewByDate || typeof S.reviewByDate !== "object") S.reviewByDate = {};
  S.reviewByDate[tk] = (S.reviewByDate[tk]||0) + 1;
}
function knDeleteCard(id){
  S.cards = knCards().filter(c=>c.id!==id);
  tombstone(id);
}
/* Wird beim Löschen eines Themas aufgerufen (app.js) — Karten gehen mit. */
function knDeleteCardsOfTopic(topicId){
  knCardsOf(topicId).forEach(c=>tombstone(c.id));
  S.cards = knCards().filter(c=>c.topic_id!==topicId);
}

/* ---------- Denkmodelle ---------- */
/* Feste IDs, damit zwei Geräte, die das Paket vor dem ersten Sync laden, keine
   Dubletten erzeugen. Wurde die feste ID schon einmal gelöscht (Grabstein), käme
   ein Eintrag mit ihr beim Sync nie zurück — dann eine frische ID. */
function knFreeId(stable){ return (S.deletedIds||[]).includes(stable) ? stable + "-" + uid() : stable; }
function knModelsTopic(){
  let t = S.knowledge.find(x=>x.kind === "models");
  if(t){
    // Ein archiviertes Denkmodell-Thema pausiert alle Modellkarten. Wer bewusst eine
    // neue Karte übernimmt, will lernen — also das Thema wieder aktiv machen.
    if(knPara(t) === "archive"){ t.para = "resource"; t.touched = Date.now(); }
    return t;
  }
  t = { id: knFreeId(KN_MODELS_TOPIC_ID), kind:"models", title:"Denkmodelle", para:"resource", goal_id:null,
    notes:"Aus der Denkmodell-Bibliothek. Die Kurzfassungen und die Einordnung der Beweislage stehen unten in der Bibliothek.",
    explain:"", todos:[], touched:Date.now() };
  S.knowledge.push(t);
  return t;
}
function knModelCard(modelId){ return knCards().find(c=>c.model_id===modelId) || null; }
function knAddModelCard(modelId){
  const m = modelById(modelId);
  if(!m || knModelCard(m.id)) return null;
  const topic = knModelsTopic();
  return knAddCard(topic.id, m.front, m.back, { id: knFreeId("mm-" + m.id), model_id: m.id });
}

/* ============================================================
   Rendering
   ============================================================ */
function renderKnowledge(){
  renderKnowReview();
  renderKnowParaTabs();
  renderKnowTopics();
  renderKnowModels();
}

/* ---------- Wiederholung ---------- */
function renderKnowReview(){
  const box = $("knowReview");
  if(!box) return;
  if(knReview){ box.innerHTML = knReviewSessionHTML(); return; }

  const due = knDueCards().length;
  const total = knCards().length;
  const streak = knStreak();
  const next = knNextDue();
  const stats = `
    <div class="kn-stats">
      <div class="stat"><b>${due}</b><small>Heute fällig</small></div>
      <div class="stat"><b>${knReviewedToday()}</b><small>Heute wiederholt</small></div>
      <div class="stat"><b>${streak}</b><small>Lern-Streak (Tage)</small></div>
      <div class="stat"><b>${total}</b><small>Karten gesamt</small></div>
    </div>`;
  let action;
  if(!total){
    action = `<div class="empty">🧠 <b>Noch keine Karteikarten.</b><br>Lege an einem Thema eine Karte an — oder übernimm unten Denkmodelle aus der Bibliothek.</div>`;
  } else if(due){
    action = `<button class="btn violet kn-start" data-act="kn-review-start">▶ Wiederholung starten · ${due} Karte${due===1?"":"n"}</button>`;
  } else {
    action = `<div class="kn-done-note">✓ Alles wiederholt.${next ? " Nächste Karte fällig am <b>" + fmtShort(next) + "</b>." : ""}</div>`;
  }
  box.innerHTML = stats + action;
}

function knReviewSessionHTML(){
  const r = knReview;
  const c = knCards().find(x=>x.id===r.queue[r.idx]);
  if(!c) return "";
  const t = c.topic_id ? knTopic(c.topic_id) : null;
  const pct = Math.round(r.idx / r.queue.length * 100);
  return `
    <div class="kn-session">
      <div class="kn-session-top">
        <span>Karte ${r.idx + 1} von ${r.queue.length}${t ? " · " + esc(t.title) : ""}</span>
        <button class="btn ghost sm" data-act="kn-review-stop">Beenden</button>
      </div>
      <div class="bar kn-session-bar"><i style="width:${pct}%"></i></div>
      <div class="kn-flash">
        <div class="kn-flash-lab">Frage</div>
        <div class="kn-flash-front">${esc(c.front)}</div>
        ${r.shown ? `<div class="kn-flash-lab">Antwort</div><div class="kn-flash-back">${esc(c.back || "—")}</div>` : ""}
      </div>
      ${r.shown
        ? `<div class="kn-grade">
            <button class="btn ghost" data-act="kn-grade" data-v="0">✗ Noch nicht <small>morgen wieder</small></button>
            <button class="btn" data-act="kn-grade" data-v="1">✓ Gewusst <small>${knNextIntervalLabel(c)}</small></button>
          </div>`
        : `<button class="btn violet kn-start" data-act="kn-reveal">Antwort zeigen</button>
           <div class="kn-keyhint">Erst selbst beantworten, dann aufdecken — das Abrufen ist der Lerneffekt.</div>`}
    </div>`;
}
function knNextIntervalLabel(c){
  const tage = KN_INTERVALS[Math.min(KN_MAX_BOX, (c.box||0) + 1)];
  return tage === 1 ? "in 1 Tag" : "in " + tage + " Tagen";
}

function knStartReview(){
  const queue = knDueCards().map(c=>c.id);
  if(!queue.length){ toast("Gerade ist keine Karte fällig."); return; }
  knReview = { queue, idx:0, shown:false, done:0, known:0, requeued:new Set() };
  renderKnowReview();
  const box = $("knowReview");
  if(box && box.scrollIntoView) box.scrollIntoView({behavior:"smooth", block:"start"});
}
function knAnswer(knew){
  const r = knReview; if(!r) return;
  const c = knCards().find(x=>x.id===r.queue[r.idx]);
  if(c){
    knGrade(c, knew);
    r.done++; if(knew) r.known++;
    // Nicht gewusst: in dieser Runde ein zweites Mal zeigen (der Speicherstand sagt trotzdem „morgen“).
    if(!knew && !r.requeued.has(c.id)){ r.requeued.add(c.id); r.queue.push(c.id); }
    save();
  }
  r.idx++; r.shown = false;
  if(r.idx >= r.queue.length) knFinishReview(true);
  else { renderKnowReview(); renderKnowTopics(); }
}
function knFinishReview(complete){
  const r = knReview; if(!r) return;
  knReview = null;
  const xp = r.done * KN_XP_PER_CARD + (complete && r.done >= 3 ? KN_XP_BONUS : 0);
  renderKnowledge(); renderHero();
  if(r.done){
    const msg = (complete ? "🧠 Wiederholung fertig: " : "Wiederholung beendet: ") + r.done + " Karte" + (r.done===1?"":"n") + ", " + r.known + " gewusst";
    if(xp) addXP(xp, msg); else toast(msg);
  }
}

/* ---------- PARA-Filter ---------- */
function renderKnowParaTabs(){
  const box = $("knParaTabs"); if(!box) return;
  const count = p => S.knowledge.filter(t=>knPara(t)===p).length;
  const alle = S.knowledge.filter(t=>knPara(t)!=="archive").length;
  const tabs = [["all","Alle",alle]].concat(Object.keys(KN_PARA).map(k=>[k, KN_PARA[k].icon + " " + KN_PARA[k].plural, count(k)]));
  box.innerHTML = tabs.map(([k,lab,n])=>
    `<button class="${knFilter===k?"on":""}" data-act="kn-filter" data-v="${k}">${lab}<span class="kn-count">${n}</span></button>`).join("");
}

/* ---------- Themen ---------- */
function knParaSelectHTML(sel, attrs){
  return `<select ${attrs}>${Object.keys(KN_PARA).map(k=>
    `<option value="${k}" ${k===sel?"selected":""}>${KN_PARA[k].icon} ${KN_PARA[k].label}</option>`).join("")}</select>`;
}
function renderKnowTopics(){
  const list = $("knowledgeList"); if(!list) return;
  const topics = S.knowledge.filter(t=> knFilter === "all" ? knPara(t) !== "archive" : knPara(t) === knFilter);
  if(!topics.length){
    list.innerHTML = S.knowledge.length
      ? `<div class="empty">Keine Themen in „${knFilter==="all" ? "Alle" : KN_PARA[knFilter].plural}“.${knFilter==="archive" ? "" : "<br>" + esc(knFilter==="all" ? "Alle Themen liegen im Archiv." : KN_PARA[knFilter].hint) + "."}</div>`
      : `<div class="empty">📚 <b>Noch kein Thema angelegt.</b><br>Leg oben ein Thema an — als Projekt, Bereich oder Ressource — und sammle Wissen, Karten und Aufgaben dazu.</div>`;
    return;
  }
  list.innerHTML = topics.map(knTopicHTML).join("");
}

function knTopicHTML(t){
  const para = knPara(t);
  const open = knOpenTopics.has(t.id);
  const cards = knCardsOf(t.id);
  const due = cards.filter(c=>knIsDue(c)).length;
  const todos = t.todos || [];
  const goal = para === "project" && t.goal_id ? S.goals.find(g=>g.id===t.goal_id) : null;
  const meta = [
    cards.length ? cards.length + " Karte" + (cards.length===1?"":"n") + (due ? ` · <span class="kn-due">${due} fällig</span>` : "") : "keine Karten",
    todos.length ? todos.filter(x=>x.done).length + "/" + todos.length + " To-Dos" : "",
    (t.explain||"").trim() ? "✓ erklärt" : "",
  ].filter(Boolean).join(" · ");

  return `<div class="goal kn-topic ${open?"open":""}">
    <div class="goal-head kn-topic-head" data-act="kn-topic-toggle" data-id="${t.id}">
      <span class="kn-chev" aria-hidden="true">›</span>
      <div class="kn-topic-title">
        <b>${esc(t.title)}</b>
        <small>${meta}${goal ? " · ⤷ " + esc(goal.title) : ""}</small>
      </div>
      <span class="kn-para kn-para-${para}">${KN_PARA[para].icon} ${KN_PARA[para].label}</span>
      <button class="icon-btn del" data-act="know-del" data-id="${t.id}" aria-label="Thema löschen">${ICON_X}</button>
    </div>
    ${open ? knTopicBodyHTML(t, para, cards, todos) : ""}
  </div>`;
}

function knTopicBodyHTML(t, para, cards, todos){
  const explain = (t.explain||"").trim();
  const words = explain ? explain.split(/\s+/).length : 0;
  return `<div class="kn-body">
    <div class="kn-row">
      <label class="kn-field-lab">Kategorie</label>
      ${knParaSelectHTML(para, `data-act="kn-para" data-id="${t.id}"`)}
      ${para === "project" ? `<select data-act="kn-goal" data-id="${t.id}">${goalOptionsHTML(t.goal_id||null)}</select>` : ""}
    </div>

    <label class="kn-field-lab">Notizen</label>
    <textarea data-act="know-notes-input" data-id="${t.id}" placeholder="Wissen, Taktiken, Learnings …">${esc(t.notes||"")}</textarea>

    <label class="kn-field-lab">🧒 In einfachen Worten <span class="kn-lab-hint">Feynman — so, dass es ein 12-Jähriger versteht</span></label>
    <textarea data-act="kn-explain-input" data-id="${t.id}" rows="3" placeholder="Erklär das Thema ohne Fachwörter. Wo du stockst, ist die Lücke.">${esc(t.explain||"")}</textarea>
    <div class="kn-explain-meta" data-explain-meta="${t.id}">${words ? words + " Wörter" + (words > 120 ? " · geht es kürzer?" : "") : "Noch nicht erklärt"}</div>

    <div class="goal-todos">
      <div class="goal-todos-lab">Karteikarten</div>
      ${cards.length ? cards.map(c=>`
        <div class="kn-card">
          <div class="kn-card-main">
            <b>${esc(c.front)}</b>
            <span>${esc(c.back||"")}</span>
          </div>
          <div class="kn-card-side">
            <span class="kn-box" title="Box ${c.box||0} von ${KN_MAX_BOX}">${[1,2,3,4,5].map(i=>`<i class="${i<=(c.box||0)?"on":""}"></i>`).join("")}</span>
            <small class="${knIsDue(c)?"kn-due":""}">${knDueLabel(c)}</small>
          </div>
          <button class="icon-btn del" data-act="kn-card-del" data-id="${c.id}" aria-label="Karte löschen">${ICON_X}</button>
        </div>`).join("") : `<div class="meta" style="margin-bottom:6px">Noch keine Karten. Eine gute Karte stellt eine Frage, die du aus dem Kopf beantworten musst.</div>`}
      <div class="kn-card-add">
        <input type="text" data-act="kn-card-front" data-id="${t.id}" placeholder="Frage" maxlength="200">
        <input type="text" data-act="kn-card-back" data-id="${t.id}" placeholder="Antwort" maxlength="400">
        <button class="btn sm" data-act="kn-card-add" data-id="${t.id}">+ Karte</button>
      </div>
    </div>

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
}

/* ---------- Denkmodell-Bibliothek ---------- */
function renderKnowModels(){
  const box = $("knowModels"); if(!box) return;
  const offen = MENTAL_MODELS.filter(m=>!knModelCard(m.id)).length;
  $("knModelsAll").disabled = !offen;
  $("knModelsAll").textContent = offen ? "Alle " + offen + " als Karten übernehmen" : "✓ Alle Modelle als Karten vorhanden";
  box.innerHTML = MODEL_GROUPS.map(([g, lab])=>{
    const ms = MENTAL_MODELS.filter(m=>m.group===g);
    return `<div class="kn-model-group">
      <div class="rev-lab">${lab}</div>
      ${ms.map(m=>{
        const ev = MODEL_EVIDENCE[m.evidence];
        const hat = !!knModelCard(m.id);
        return `<details class="kn-model">
          <summary>
            <span class="kn-model-ico">${m.icon}</span>
            <span class="kn-model-title">${esc(m.title)}</span>
            <span class="kn-ev ${ev.cls}">${ev.label}</span>
            ${hat ? `<span class="kn-model-has" title="Als Karte vorhanden">✓</span>` : ""}
          </summary>
          <div class="kn-model-body">
            <p>${esc(m.summary)}</p>
            <p class="kn-model-apply"><b>In Ascend:</b> ${esc(m.apply)}</p>
            ${hat
              ? `<span class="kn-model-note">✓ Lernst du bereits als Karte</span>`
              : `<button class="btn ghost sm" data-act="kn-model-add" data-id="${m.id}">+ Als Karte lernen</button>`}
          </div>
        </details>`;
      }).join("")}
    </div>`;
  }).join("");
}

/* ---------- Today-Chip (hero.js) ---------- */
function knowledgeChip(){
  const n = knDueCards().length;
  if(!n) return "";
  return `<div class="hchip clickable" data-act="kn-goto-review">🧠 <b>${n} Karte${n===1?"":"n"}</b> zu wiederholen →</div>`;
}

/* ============================================================
   Events
   ============================================================ */
function knCreateTopicFromForm(){
  const title = $("knowTopicTitle").value.trim();
  if(!title){ toast("Gib dem Thema einen Namen."); return; }
  const para = $("knowTopicPara").value;
  const t = knAddTopic(title, para, $("knowTopicGoal").value || null);
  $("knowTopicTitle").value = "";
  knOpenTopics.add(t.id);
  if(knFilter !== "all" && knFilter !== para) knFilter = para;
  save(); renderKnowledge();
  toast(KN_PARA[t.para].icon + " " + KN_PARA[t.para].label + " angelegt: " + title);
}
function knSyncNewTopicGoal(){
  const isProject = $("knowTopicPara").value === "project";
  $("knowTopicGoal").style.display = isProject ? "" : "none";
  if(isProject) $("knowTopicGoal").innerHTML = goalOptionsHTML($("knowTopicGoal").value || null);
}
$("knowTopicAdd").addEventListener("click", knCreateTopicFromForm);
$("knowTopicTitle").addEventListener("keydown", e=>{ if(e.key==="Enter") knCreateTopicFromForm(); });
$("knowTopicPara").addEventListener("change", knSyncNewTopicGoal);
$("knModelsAll").addEventListener("click", ()=>{
  const neu = MENTAL_MODELS.filter(m=>!knModelCard(m.id)).map(m=>knAddModelCard(m.id)).filter(Boolean);
  if(!neu.length) return;
  save(); renderKnowledge(); renderHero();
  toast("🧠 " + neu.length + " Denkmodelle als Karten übernommen — sie sind ab heute fällig.");
});

function knAddCardFromInputs(topicId){
  const f = document.querySelector(`[data-act="kn-card-front"][data-id="${topicId}"]`);
  const b = document.querySelector(`[data-act="kn-card-back"][data-id="${topicId}"]`);
  const front = f ? f.value.trim() : "", back = b ? b.value.trim() : "";
  if(!front){ toast("Eine Karte braucht eine Frage."); if(f) f.focus(); return; }
  if(!back){ toast("Und die Antwort dazu?"); if(b) b.focus(); return; }
  knAddCard(topicId, front, back);
  const t = knTopic(topicId); if(t) t.touched = Date.now();
  save(); renderKnowledge(); renderHero();
  const again = document.querySelector(`[data-act="kn-card-front"][data-id="${topicId}"]`);
  if(again) again.focus();
}

document.body.addEventListener("click", e=>{
  const el = e.target.closest("[data-act]");
  if(!el || !String(el.dataset.act).startsWith("kn-")) return;
  const act = el.dataset.act, id = el.dataset.id;
  switch(act){
    case "kn-filter":
      knFilter = el.dataset.v; renderKnowParaTabs(); renderKnowTopics();
      break;
    case "kn-topic-toggle":
      // Klicks auf Löschen o. Ä. im Kopf sollen nicht auf-/zuklappen
      if(e.target.closest(".del")) break;
      if(knOpenTopics.has(id)) knOpenTopics.delete(id); else knOpenTopics.add(id);
      renderKnowTopics();
      break;
    case "kn-card-add":
      knAddCardFromInputs(id);
      break;
    case "kn-card-del":
      customConfirm("Diese Karte löschen? Ihr Lernstand geht verloren.", {okLabel:"Löschen", danger:true}).then(ok=>{
        if(!ok) return;
        knDeleteCard(id); save(); renderKnowledge(); renderHero();
      });
      break;
    case "kn-model-add": {
      const c = knAddModelCard(id);
      if(c){ save(); renderKnowledge(); renderHero(); toast("🧠 Karte angelegt: " + modelById(id).title); }
      break; }
    case "kn-review-start":
      knStartReview();
      break;
    case "kn-reveal":
      if(knReview){ knReview.shown = true; renderKnowReview(); }
      break;
    case "kn-grade":
      knAnswer(el.dataset.v === "1");
      break;
    case "kn-review-stop":
      knFinishReview(false);
      break;
    case "kn-goto-review":
      document.querySelector('#nav button[data-page="knowledge"]').click();
      knStartReview();
      break;
  }
});

document.body.addEventListener("change", e=>{
  const el = e.target.closest("[data-act]");
  if(!el) return;
  const t = knTopic(el.dataset.id);
  if(el.dataset.act === "kn-para" && t){
    const vorher = knPara(t);
    t.para = el.value;
    if(t.para !== "project") t.goal_id = null;
    t.touched = Date.now(); save();
    renderKnowledge(); renderHero();
    if(t.para === "archive" && vorher !== "archive") toast("🗄 Archiviert — die Karten dieses Themas pausieren.");
  }
  if(el.dataset.act === "kn-goal" && t){
    t.goal_id = el.value || null; t.touched = Date.now(); save(); renderKnowTopics();
  }
});

document.body.addEventListener("input", e=>{
  const el = e.target;
  if(!el.dataset || el.dataset.act !== "kn-explain-input") return;
  const t = knTopic(el.dataset.id); if(!t) return;
  t.explain = el.value; t.touched = Date.now(); save();
  // Kein Re-Render (Cursor springt sonst) — nur die Wortzahl nachziehen.
  const meta = document.querySelector(`[data-explain-meta="${t.id}"]`);
  const words = el.value.trim() ? el.value.trim().split(/\s+/).length : 0;
  if(meta) meta.textContent = words ? words + " Wörter" + (words > 120 ? " · geht es kürzer?" : "") : "Noch nicht erklärt";
});

document.body.addEventListener("keydown", e=>{
  const el = e.target;
  // Enter in Frage → Antwort, Enter in Antwort → Karte speichern
  if(e.key === "Enter" && el.dataset && el.dataset.act === "kn-card-front"){
    e.preventDefault();
    const b = document.querySelector(`[data-act="kn-card-back"][data-id="${el.dataset.id}"]`);
    if(b) b.focus();
    return;
  }
  if(e.key === "Enter" && el.dataset && el.dataset.act === "kn-card-back"){
    e.preventDefault(); knAddCardFromInputs(el.dataset.id); return;
  }
  // Tastatur in der Wiederholung: Leertaste = aufdecken, 1 = noch nicht, 2 = gewusst
  if(!knReview || !$("page-knowledge").classList.contains("active")) return;
  if(/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
  if(!knReview.shown && (e.key === " " || e.key === "Enter")){ e.preventDefault(); knReview.shown = true; renderKnowReview(); }
  else if(knReview.shown && e.key === "1"){ knAnswer(false); }
  else if(knReview.shown && e.key === "2"){ knAnswer(true); }
});
