"use strict";
/* ASCEND hustle.js — Side-Hustle-Labor
   Für „mehrere Ideen, unentschlossen“: Ideen nach fünf Kriterien bewerten,
   die beste 30 Tage lang testen (als Fokus-Ziel mit vier Wochenschritten)
   und ehrlich messen, was sie pro Stunde bringt. Danach entscheiden:
   weitermachen, anpassen oder stoppen. Nur ein Test gleichzeitig — Fokus. */

const HUSTLE_CRITERIA = [
  ["fun",   "😄 Macht mir Spaß"],
  ["fit",   "💪 Passt zu meinen Stärken"],
  ["money", "💶 Verdienstpotenzial"],
  ["time",  "⏱ Wenig Zeitaufwand"],
  ["cost",  "🪙 Geringe Startkosten"],
];
const HUSTLE_STEPS = [
  "Woche 1: Angebot in einem Satz formulieren und 3 Menschen fragen, ob sie dafür zahlen würden",
  "Woche 2: Erstes Angebot rausbringen (Post, Anzeige, Nachricht, Profil)",
  "Woche 3: Erster zahlender Kunde oder ehrliches Feedback einholen",
  "Woche 4: Zahlen prüfen und entscheiden: weiter, anpassen oder stoppen",
];
const HUSTLE_TEST_DAYS = 30;
const HUSTLE_STATUS = { idea:"Idee", testing:"Im Test", keep:"Weiter ✓", change:"Anpassen ↻", stop:"Gestoppt" };

function hIdeas(){ return Array.isArray(S.hustleIdeas) ? S.hustleIdeas : (S.hustleIdeas = []); }
function hIncome(){ return Array.isArray(S.income) ? S.income : (S.income = []); }
function hScore(i){ return HUSTLE_CRITERIA.reduce((s,[k])=>s + ((i.scores||{})[k] || 3), 0); }
function hActive(){ return hIdeas().find(i=>i.status === "testing") || null; }
function hEuro(n){ return (Math.round((n||0)*100)/100).toLocaleString("de-DE",{style:"currency",currency:"EUR",maximumFractionDigits: n % 1 ? 2 : 0}); }

/* Stunden einer Idee = eingetragene Stunden + Fokus-Sessions am Test-Ziel */
function hHours(idea){
  const manuell = hIncome().filter(e=>e.idea_id===idea.id).reduce((s,e)=>s+(+e.hours||0), 0);
  const fokus = idea.goal_id ? (S.focusSessions||[]).filter(s=>s.goal_id===idea.goal_id && s.ended_at)
    .reduce((s,x)=>s + Math.max(0, Math.round((x.ended_at - x.started_at)/60000)), 0) / 60 : 0;
  return { manuell, fokus, gesamt: manuell + fokus };
}
function hEarned(idea){ return hIncome().filter(e=>e.idea_id===idea.id).reduce((s,e)=>s+(+e.amount||0), 0); }
function hMonthKey(k){ return String(k).slice(0,7); }

/* ---------- Rendering ---------- */
function renderHustle(){
  if(!$("page-hustle")) return;
  renderHustleStats();
  renderHustleActive();
  renderHustleIdeas();
  renderIncome();
}

function renderHustleStats(){
  const mk = hMonthKey(todayKey());
  const monat = hIncome().filter(e=>hMonthKey(e.date)===mk).reduce((s,e)=>s+(+e.amount||0), 0);
  const gesamt = hIncome().reduce((s,e)=>s+(+e.amount||0), 0);
  const stunden = hIdeas().reduce((s,i)=>s+hHours(i).gesamt, 0) + hIncome().filter(e=>!e.idea_id).reduce((s,e)=>s+(+e.hours||0),0);
  const a = hActive();
  $("hustleStats").innerHTML = `
    <div class="stat"><b>${hEuro(monat)}</b><small>Einnahmen diesen Monat</small></div>
    <div class="stat"><b>${hEuro(gesamt)}</b><small>Einnahmen gesamt</small></div>
    <div class="stat"><b>${stunden ? hEuro(gesamt/stunden) : "–"}</b><small>Pro Stunde (gesamt)</small></div>
    <div class="stat"><b>${a ? "Tag " + Math.min(HUSTLE_TEST_DAYS, hTestDay(a)) : "–"}</b><small>${a ? "im 30-Tage-Test" : "kein Test aktiv"}</small></div>`;
}
function hTestDay(i){ return i.started ? Math.round((dateFromKey(todayKey()) - dateFromKey(i.started))/864e5) + 1 : 0; }

function renderHustleActive(){
  const box = $("hustleActive");
  const a = hActive();
  if(!a){
    box.innerHTML = `<div class="empty">🧪 <b>Kein Test aktiv.</b><br>Bewerte unten deine Ideen und starte mit der besten einen 30-Tage-Test.<br>
      <span class="hint-next">Ein Test zur Zeit — so bleibt genug Energie, ihn wirklich durchzuziehen.</span></div>`;
    return;
  }
  const tag = hTestDay(a), pct = Math.min(100, Math.round(tag/HUSTLE_TEST_DAYS*100));
  const g = a.goal_id ? S.goals.find(x=>x.id===a.goal_id) : null;
  const h = hHours(a), earned = hEarned(a);
  const fertig = tag >= HUSTLE_TEST_DAYS;
  box.innerHTML = `
    <div class="hs-active-head">
      <div><b>${esc(a.title)}</b><small>Gestartet am ${fmtShort(a.started)} · Tag ${Math.min(tag, HUSTLE_TEST_DAYS)} von ${HUSTLE_TEST_DAYS}</small></div>
      <span class="hs-score">${hScore(a)}/25</span>
    </div>
    <div class="bar hs-days"><i style="width:${pct}%"></i></div>
    <div class="hs-metrics">
      <div><b>${hEuro(earned)}</b><small>eingenommen</small></div>
      <div><b>${h1(h.gesamt)} h</b><small>investiert${h.fokus ? " (davon " + h1(h.fokus) + " h Fokus)" : ""}</small></div>
      <div><b>${h.gesamt ? hEuro(earned/h.gesamt) : "–"}</b><small>pro Stunde</small></div>
    </div>
    ${g ? `<div class="milestones hs-steps">${g.ms.map((m,i)=>`
      <div class="ms ${m.done?"done":""}" data-act="ms-toggle" data-id="${g.id}" data-i="${i}">
        <span class="cbx ${m.done?"on":""}">${ICON_CHECK}</span>${esc(m.text)}
      </div>`).join("")}</div>
      <div class="meta" style="margin-top:8px">Tipp: Starte Fokus-Sessions mit dem Ziel „${esc(g.title)}“ — die Zeit zählt hier automatisch mit.</div>` : ""}
    <div class="hs-decide ${fertig?"due":""}">
      <div class="rev-lab">${fertig ? "30 Tage sind um — Zeit für eine Entscheidung" : "Entscheidung (geht auch früher)"}</div>
      <div class="hs-decide-btns">
        <button class="btn sm" data-act="hs-decide" data-id="${a.id}" data-v="keep">✓ Weitermachen</button>
        <button class="btn ghost sm" data-act="hs-decide" data-id="${a.id}" data-v="change">↻ Anpassen</button>
        <button class="btn ghost sm" data-act="hs-decide" data-id="${a.id}" data-v="stop">✗ Stoppen</button>
      </div>
    </div>`;
}

const hOpen = new Set();
function renderHustleIdeas(){
  const list = $("hustleIdeaList");
  const strengths = (S.swot && S.swot.s || "").trim();
  $("hustleSwotHint").innerHTML = strengths
    ? `💪 <b>Deine Stärken laut SWOT:</b> ${esc(strengths.slice(0,160))}${strengths.length>160?"…":""}`
    : `💡 Tipp: Füll unter Goals deine SWOT aus — dann siehst du hier deine Stärken beim Bewerten.`;
  const ideas = hIdeas().slice().sort((a,b)=>{
    const rank = s => s==="testing"?0 : s==="keep"?1 : s==="idea"||s==="change"?2 : 3;
    return rank(a.status)-rank(b.status) || hScore(b)-hScore(a);
  });
  if(!ideas.length){
    list.innerHTML = `<div class="empty">💡 <b>Noch keine Ideen.</b><br>Schreib alle auf, auch die verrückten — bewerten kommt danach.</div>`;
    return;
  }
  const offen = ideas.filter(i=>i.status==="idea"||i.status==="change");
  const best = offen.length ? offen.reduce((m,i)=>hScore(i)>hScore(m)?i:m) : null;
  const aktiv = hActive();
  list.innerHTML = ideas.map(i=>{
    const sc = hScore(i), open = hOpen.has(i.id);
    const earned = hEarned(i);
    return `<div class="hs-idea ${i.status}">
      <div class="hs-idea-head" data-act="hs-open" data-id="${i.id}">
        <div class="hs-idea-title"><b>${esc(i.title)}</b>
          <small>${HUSTLE_STATUS[i.status]||""}${best && best.id===i.id ? " · ⭐ beste Bewertung" : ""}${earned ? " · " + hEuro(earned) : ""}</small></div>
        <div class="hs-idea-score"><div class="bar"><i style="width:${Math.round(sc/25*100)}%"></i></div><span>${sc}/25</span></div>
        <button class="icon-btn del" data-act="hs-del" data-id="${i.id}" aria-label="Idee löschen">${ICON_X}</button>
      </div>
      ${open ? `<div class="hs-idea-body">
        ${HUSTLE_CRITERIA.map(([k,lab])=>`
          <label class="hs-crit"><span>${lab}</span>
            <input type="range" min="1" max="5" step="1" value="${(i.scores||{})[k]||3}" data-act="hs-score" data-id="${i.id}" data-k="${k}">
            <b data-score-val="${i.id}-${k}">${(i.scores||{})[k]||3}</b></label>`).join("")}
        <input class="hs-note" data-act="hs-note" data-id="${i.id}" maxlength="160" placeholder="Notiz: Für wen? Was genau? Erster Schritt?" value="${esc(i.note||"")}">
        ${(i.status==="idea"||i.status==="change") ? (aktiv
          ? `<div class="meta">Es läuft schon ein Test („${esc(aktiv.title)}“). Erst entscheiden, dann den nächsten starten.</div>`
          : `<button class="btn violet sm" data-act="hs-start" data-id="${i.id}">🧪 30-Tage-Test starten</button>`) : ""}
      </div>` : ""}
    </div>`;
  }).join("");
}

function renderIncome(){
  const sel = $("incIdea");
  const cur = sel.value;
  sel.innerHTML = `<option value="">Sonstiges</option>` + hIdeas().filter(i=>i.status!=="stop").map(i=>`<option value="${i.id}">${esc(i.title)}</option>`).join("");
  if(cur) sel.value = cur;
  else { const a = hActive(); if(a) sel.value = a.id; }
  if(!$("incDate").value) $("incDate").value = todayKey();

  // Letzte 6 Monate als Balken
  const months = [];
  const d = new Date(); d.setDate(1);
  for(let k=5;k>=0;k--){ const x = new Date(d.getFullYear(), d.getMonth()-k, 1); months.push(todayKey(x).slice(0,7)); }
  const sums = months.map(m=>hIncome().filter(e=>hMonthKey(e.date)===m).reduce((s,e)=>s+(+e.amount||0),0));
  const max = Math.max(1, ...sums);
  $("incomeBars").innerHTML = hIncome().length ? months.map((m,i)=>`
    <div class="inc-bar"><div class="inc-bar-col"><i style="height:${Math.round(sums[i]/max*100)}%"></i></div>
      <b>${sums[i] ? hEuro(sums[i]) : "–"}</b><small>${new Date(m+"-01T12:00:00").toLocaleDateString("de-DE",{month:"short"})}</small></div>`).join("") : "";

  const rows = hIncome().slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,8);
  $("incomeList").innerHTML = rows.length ? rows.map(e=>{
    const idea = e.idea_id ? hIdeas().find(i=>i.id===e.idea_id) : null;
    return `<div class="check-item" style="cursor:default">
      <span class="txt"><b style="font-weight:600">${hEuro(+e.amount||0)}</b> · ${esc(idea ? idea.title : "Sonstiges")}${e.note ? " · " + esc(e.note) : ""}</span>
      <span class="meta">${fmtShort(e.date)}${e.hours ? " · " + h1(+e.hours) + " h" : ""}</span>
      <button class="icon-btn del" data-act="inc-del" data-id="${e.id}">${ICON_X}</button>
    </div>`;
  }).join("") : `<div class="empty">💶 <b>Noch keine Einnahme.</b><br>Auch 5 € zählen — der erste Euro ist der schwerste.</div>`;
}

/* ---------- Aktionen ---------- */
function hAddIdea(){
  const title = $("hustleIdeaInput").value.trim();
  if(!title){ toast("Wie heißt die Idee?"); return; }
  const i = { id:uid(), title, scores:{fun:3,fit:3,money:3,time:3,cost:3}, status:"idea", started:null, goal_id:null, note:"", touched:Date.now() };
  hIdeas().push(i); hOpen.add(i.id);
  $("hustleIdeaInput").value = "";
  save(); renderHustle();
  toast("💡 Idee notiert — jetzt mit den Reglern bewerten.");
}
function hStartTest(id){
  const i = hIdeas().find(x=>x.id===id); if(!i || hActive()) return;
  const g = { id:uid(), title:"Side Hustle testen: " + i.title, type:"fokus", skillId:null,
    ms: HUSTLE_STEPS.map(text=>({text, done:false})), progress:0, actionTodos:[], skillXPGranted:false,
    second:"Wenn es klappt: zusätzliches Einkommen und der Beweis, dass ich etwas Eigenes aufbauen kann.", touched:Date.now() };
  S.goals.push(g);
  i.status = "testing"; i.started = todayKey(); i.goal_id = g.id; i.touched = Date.now();
  save(); renderHustle(); renderGoals(); renderTodayFocusGoals(); renderHero();
  addXP(10, "🧪 30-Tage-Test gestartet: " + i.title);
}
function hDecide(id, v){
  const i = hIdeas().find(x=>x.id===id); if(!i) return;
  i.status = v; i.decided = todayKey(); i.touched = Date.now();
  save(); renderHustle();
  toast(v==="keep" ? "✓ Weiter geht's — mach daraus ein langfristiges Ziel unter Goals."
      : v==="change" ? "↻ Anpassen: passe die Idee an und starte bei Bedarf einen neuen Test."
      : "✗ Gestoppt. Auch das ist ein Ergebnis — jetzt ist Platz für die nächste Idee.");
}
function hAddIncome(){
  const amount = parseFloat(String($("incAmount").value).replace(",", "."));
  if(!isFinite(amount) || amount <= 0){ toast("Gib einen Betrag ein."); return; }
  const hours = parseFloat(String($("incHours").value).replace(",", ".")) || 0;
  hIncome().push({ id:uid(), date:$("incDate").value || todayKey(), idea_id:$("incIdea").value || null,
    amount, hours, note:$("incNote").value.trim(), touched:Date.now() });
  $("incAmount").value = ""; $("incHours").value = ""; $("incNote").value = "";
  save(); renderHustle();
  addXP(5, "💶 Einnahme eingetragen: " + hEuro(amount));
  checkBadges();
}

$("hustleIdeaAdd").addEventListener("click", hAddIdea);
$("hustleIdeaInput").addEventListener("keydown", e=>{ if(e.key==="Enter") hAddIdea(); });
$("incAdd").addEventListener("click", hAddIncome);

document.body.addEventListener("click", e=>{
  const el = e.target.closest("[data-act]");
  if(!el) return;
  const id = el.dataset.id;
  switch(el.dataset.act){
    case "hs-open":
      if(e.target.closest(".del")) break;
      if(hOpen.has(id)) hOpen.delete(id); else hOpen.add(id);
      renderHustleIdeas();
      break;
    case "hs-start": hStartTest(id); break;
    case "hs-decide": hDecide(id, el.dataset.v); break;
    case "hs-del":
      customConfirm("Diese Idee löschen? Ein zugehöriges Test-Ziel bleibt unter Goals erhalten.", {okLabel:"Löschen", danger:true}).then(ok=>{
        if(!ok) return;
        S.hustleIdeas = hIdeas().filter(i=>i.id!==id); tombstone(id); save(); renderHustle();
      });
      break;
    case "inc-del":
      S.income = hIncome().filter(x=>x.id!==id); tombstone(id); save(); renderHustle();
      break;
    case "ms-toggle":
      // Wochenschritte des Tests sind Meilensteine des Test-Ziels (Goals-Logik in app.js)
      setTimeout(renderHustle, 0);
      break;
  }
});
document.body.addEventListener("input", e=>{
  const el = e.target;
  if(!el.dataset) return;
  if(el.dataset.act === "hs-score"){
    const i = hIdeas().find(x=>x.id===el.dataset.id); if(!i) return;
    i.scores = Object.assign({}, i.scores, {[el.dataset.k]: parseInt(el.value)}); i.touched = Date.now(); save();
    const v = document.querySelector(`[data-score-val="${i.id}-${el.dataset.k}"]`); if(v) v.textContent = el.value;
  }
  if(el.dataset.act === "hs-note"){
    const i = hIdeas().find(x=>x.id===el.dataset.id); if(!i) return;
    i.note = el.value; i.touched = Date.now(); save();
  }
});
/* Gesamtpunkte erst beim Loslassen neu sortieren — sonst springt die Liste unterm Finger */
document.body.addEventListener("change", e=>{
  if(e.target.dataset && e.target.dataset.act === "hs-score"){ renderHustleIdeas(); renderHustleStats(); }
});
