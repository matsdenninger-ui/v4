"use strict";
/* ASCEND rest.js — 7 Arten von Erholung + Erholungs-Check
   Nach Dr. Saundra Dalton-Smith: Müdigkeit ist nicht immer Schlafmangel.
   Manchmal fehlt Ruhe für den Kopf, für die Sinne oder Zeit mit guten Menschen.
   Das ist eine nützliche Checkliste, keine gemessene Wissenschaft — deshalb
   wertet Ascend nur deine eigenen Daten aus: Was fehlt dir am häufigsten, und
   wie ist deine Energie an diesen Tagen? */

const REST_TYPES = [
  { id:"physical",  icon:"🛌", label:"Körper",     q:"Schlaf, Bewegung, Entspannung",
    tips:["Heute 7+ Stunden Schlaf einplanen","10 Minuten dehnen oder spazieren","Bei Bedarf ein Power-Nap (max. 20 Min.)"] },
  { id:"mental",    icon:"🧠", label:"Kopf",       q:"Pause vom Nachdenken",
    tips:["To-dos aufschreiben statt im Kopf behalten","Feierabend-Ritual machen","5 Minuten nichts tun oder meditieren"] },
  { id:"social",    icon:"👥", label:"Menschen",   q:"Zeit mit Menschen, die Energie geben",
    tips:["Jemanden treffen, bei dem du auftankst","Weniger Zeit mit Energieräubern","Als Introvertierter: bewusst Zeit allein blocken"] },
  { id:"sensory",   icon:"🔇", label:"Reize",      q:"Weniger Bildschirm, Lärm, Benachrichtigungen",
    tips:["Benachrichtigungen für ein paar Stunden aus","Eine Social-Media-Pause einlegen","Abends gedimmtes Licht, ruhige Musik"] },
  { id:"creative",  icon:"🎨", label:"Inspiration", q:"Schönes erleben — Natur oder Kunst",
    tips:["Sonnenauf- oder -untergang anschauen","Ein Spaziergang in der Natur","Musik, ein Buch, ein Museum, eine Doku"] },
  { id:"emotional", icon:"💗", label:"Gefühle",    q:"Echt sein dürfen, nichts vorspielen",
    tips:["Zeit mit Menschen, bei denen du du sein kannst","Abend-Journal: aufschreiben, was belastet","Über Schweres sprechen — Freund oder Therapeut"] },
  { id:"spiritual", icon:"🌌", label:"Sinn",       q:"Teil von etwas Größerem sein",
    tips:["Kurz notieren, wofür deine Arbeit gut ist","Jemandem helfen oder ehrenamtlich etwas tun","Zeit für das, woran du glaubst"] },
];
function restType(id){ return REST_TYPES.find(r=>r.id===id) || null; }

let selRest = new Set();
function renderRestTags(){
  $("restTags").innerHTML = REST_TYPES.map(r=>
    `<button class="tag-chip rest-chip ${selRest.has(r.id)?"sel":""}" data-rest="${r.id}" title="${esc(r.q)}">${r.icon} ${esc(r.label)}</button>`).join("");
}
$("restTags").addEventListener("click", e=>{
  const b = e.target.closest("[data-rest]"); if(!b) return;
  const id = b.dataset.rest;
  selRest.has(id) ? selRest.delete(id) : selRest.add(id);
  b.classList.toggle("sel");
});
/* mind.js ruft das beim Speichern eines Mood-Eintrags auf */
function takeRestSelection(){ const out = [...selRest]; selRest.clear(); renderRestTags(); return out; }

/* ---------- Erholungs-Check (Auswertung) ---------- */
function renderRestCheck(){
  const box = $("restCheck"); if(!box) return;
  const days = lastNDates(14);
  const logs = S.moods.filter(m=>days.includes(m.date));
  const mitRest = logs.filter(m=>Array.isArray(m.rest));
  if(!mitRest.length){
    box.innerHTML = `<div class="empty">🔋 <b>Noch keine Daten.</b><br>Wähle beim Mood Log aus, welche Erholung dir gerade fehlt —<br>nach ein paar Tagen siehst du hier dein Muster.</div>`;
    return;
  }
  const avg = arr => arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : null;
  const gesamtEnergie = avg(logs.map(m=>m.energy));
  const stats = REST_TYPES.map(r=>{
    const fehlt = mitRest.filter(m=>m.rest.includes(r.id));
    return { r, n: fehlt.length, energie: avg(fehlt.map(m=>m.energy)) };
  }).sort((a,b)=>b.n - a.n);
  const max = Math.max(1, ...stats.map(s=>s.n));
  const top = stats[0].n ? stats[0] : null;

  box.innerHTML = `
    <div class="rest-bars">
      ${stats.map(s=>`
        <div class="rest-bar-row ${s.n?"":"zero"}">
          <span class="rest-bar-lab">${s.r.icon} ${esc(s.r.label)}</span>
          <div class="bar"><i style="width:${Math.round(s.n/max*100)}%"></i></div>
          <span class="rest-bar-n">${s.n}×</span>
        </div>`).join("")}
    </div>
    ${top ? `<div class="rest-top">
      <div class="rev-lab">Fehlt dir am häufigsten: ${top.r.icon} ${esc(top.r.label)}</div>
      <p class="rest-top-q">${esc(top.r.q)}${top.energie != null && gesamtEnergie != null ? ` · Energie an diesen Tagen Ø <b>${h1(top.energie)}</b> (sonst Ø ${h1(gesamtEnergie)})` : ""}</p>
      <ul class="rest-tips">${top.r.tips.map(t=>`<li>${esc(t)}</li>`).join("")}</ul>
    </div>` : `<div class="kn-done-note">✓ In den letzten 14 Tagen hat dir keine Erholungsart gefehlt.</div>`}
    <div class="meta" style="margin-top:10px">${mitRest.length} Einträge der letzten 14 Tage</div>`;
}

renderRestTags();
