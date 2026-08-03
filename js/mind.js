"use strict";
/* ASCEND mind.js — Journal, Mood, Learning, Skill Tree, Social Check-ins */

/* ============================================================
   MIND
   ============================================================ */
$("journalDate").textContent = "Eintrag für " + new Date().toLocaleDateString("de-DE",{weekday:"long", day:"numeric", month:"long"});
function loadJournalToday(){
  const j = S.journal[todayKey()] || {m:"", e:""};
  $("jMorning").value = j.m; $("jEvening").value = j.e;
}
$("jSave").addEventListener("click", ()=>{
  const m = $("jMorning").value.trim(), e = $("jEvening").value.trim();
  if(!m && !e){ toast("Schreib zuerst ein paar Zeilen."); return; }
  const isNew = !S.journal[todayKey()];
  S.journal[todayKey()] = {m, e};
  save(); renderJournalHist();
  if(isNew) addXP(10, "Journal-Eintrag gespeichert");
  else toast("Eintrag aktualisiert.");
});
function renderJournalHist(){
  const keys = Object.keys(S.journal).sort().reverse().filter(k=>k!==todayKey()).slice(0,5);
  $("journalHist").innerHTML = keys.length
    ? '<p class="sub" style="margin:4px 0 2px">Letzte Einträge</p>' + keys.map(k=>{
        const j = S.journal[k];
        return `<div class="jh-item"><b>${fmtShort(k)}</b><p>${esc((j.m||"")+(j.m&&j.e?"\n":"")+(j.e||"")).slice(0,300)}</p></div>`;
      }).join("")
    : "";
}

/* ---------- Mood ---------- */
const MOOD_TAGS = ["produktiv","gestresst","dankbar","müde","motiviert","sozial","kreativ","unruhig"];
let selMood = null, selTags = new Set();
$("moodTags").innerHTML = MOOD_TAGS.map(t=>`<button class="tag-chip" data-tag="${t}">${t}</button>`).join("");
$("moodRow").addEventListener("click", e=>{
  const b = e.target.closest(".mood-btn"); if(!b) return;
  selMood = parseInt(b.dataset.m);
  document.querySelectorAll(".mood-btn").forEach(x=>x.classList.toggle("sel", x===b));
});
$("moodTags").addEventListener("click", e=>{
  const b = e.target.closest(".tag-chip"); if(!b) return;
  const t = b.dataset.tag;
  selTags.has(t) ? selTags.delete(t) : selTags.add(t);
  b.classList.toggle("sel");
});
$("energy").addEventListener("input", ()=>{ $("energyVal").textContent = $("energy").value+" / 10"; });
$("moodSave").addEventListener("click", ()=>{
  if(!selMood){ toast("Wähle zuerst eine Stimmung."); return; }
  S.moods.push({ts:Date.now(), date:todayKey(), mood:selMood, energy:parseInt($("energy").value), tags:[...selTags]});
  save(); renderMoodHist();
  addXP(5, "Stimmung geloggt");
  selMood = null; selTags.clear();
  document.querySelectorAll(".mood-btn,.tag-chip").forEach(x=>x.classList.remove("sel"));
});
const MOOD_EMOJI = ["","😞","😕","😐","🙂","🤩"];
function renderMoodHist(){
  const last = S.moods.slice(-4).reverse();
  $("moodHist").innerHTML = last.length
    ? last.map(m=>`<div class="check-item" style="cursor:default">
        <span style="font-size:19px">${MOOD_EMOJI[m.mood]}</span>
        <span class="txt meta">${fmtShort(m.date)} · Energie ${m.energy}/10${m.tags.length?" · "+m.tags.map(esc).join(", "):""}</span>
      </div>`).join("")
    : "";
}

/* ---------- Learning ---------- */
function addLearn(){
  const t = $("learnInput").value.trim();
  if(!t) return;
  S.learning.push({id:uid(), title:t, type:$("learnType").value, progress:0});
  $("learnInput").value = ""; save(); renderLearning();
}
$("learnAdd").addEventListener("click", addLearn);
$("learnInput").addEventListener("keydown", e=>{ if(e.key==="Enter") addLearn(); });
function renderLearning(){
  if(!S.learning.length){
    $("learnList").innerHTML = '<div class="empty">📚 <b>Deine Lernliste ist leer.</b><br>Was willst du als Nächstes verstehen?</div>';
    return;
  }
  $("learnList").innerHTML = S.learning.map(l=>`
    <div class="check-item" style="flex-wrap:wrap;cursor:default">
      <span class="txt"><b style="font-weight:600">${esc(l.type.split(" ")[0])} ${esc(l.title)}</b></span>
      <span class="meta">${l.progress}%</span>
      <button class="icon-btn del" data-act="learn-del" data-id="${l.id}">${ICON_X}</button>
      <input type="range" min="0" max="100" step="5" value="${l.progress}" data-act="learn-range" data-id="${l.id}" style="width:100%">
    </div>`).join("");
}

/* ---------- Skill Tree ---------- */
function renderSkills(){
  $("skillTree").innerHTML = S.skills.map(col=>`
    <div class="skill-col"><h4>${esc(col.cat)}</h4>
      ${col.items.map(sk=>`
        <div class="skill-node">
          <b>${esc(sk.name)}</b>
          <div class="pips">${[0,1,2,3,4].map(i=>`<span class="pip ${i<sk.lvl?"on":""}"></span>`).join("")}</div>
          <small>Level ${sk.lvl} / 5${sk.lvl>=5?" · Gemeistert ✦":""}</small>
        </div>`).join("")}
    </div>`).join("");
  renderGoalSkillSel();
}
function findSkill(id){
  for(const c of S.skills) for(const s of c.items) if(s.id===id) return s;
  return null;
}

/* ---------- Social ---------- */
function addPerson(){
  const n = $("personInput").value.trim();
  if(!n) return;
  S.people.push({id:uid(), name:n, last:null});
  $("personInput").value = ""; save(); renderPeople();
}
$("personAdd").addEventListener("click", addPerson);
$("personInput").addEventListener("keydown", e=>{ if(e.key==="Enter") addPerson(); });
function renderPeople(){
  if(!S.people.length){
    $("personList").innerHTML = '<div class="empty">💬 <b>Noch niemand eingetragen.</b><br>Füge Menschen hinzu, die dir wichtig sind.</div>';
    return;
  }
  $("personList").innerHTML = S.people.map(p=>{
    let info = "Noch nie gemeldet";
    if(p.last){
      const days = Math.round((dateFromKey(todayKey()) - dateFromKey(p.last))/864e5);
      info = days===0 ? "Heute gemeldet ✓" : "Vor "+days+" Tag"+(days===1?"":"en");
    }
    const overdue = p.last && (dateFromKey(todayKey()) - dateFromKey(p.last))/864e5 >= 14;
    return `<div class="check-item" style="cursor:default">
      <span class="txt">${esc(p.name)}</span>
      <span class="meta" style="${overdue?"color:var(--rose)":""}">${info}</span>
      <button class="btn ghost sm" data-act="person-ping" data-id="${p.id}">Gemeldet</button>
      <button class="icon-btn del" data-act="person-del" data-id="${p.id}">${ICON_X}</button>
    </div>`;
  }).join("");
}
