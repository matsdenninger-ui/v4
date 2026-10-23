"use strict";
/* ASCEND insights.js — Zeit-Check & Monatsrückblick
   Zeit-Check: Wohin gingen deine Stunden in den letzten 7 Tagen? Fokus, Side
   Hustle und Training kommen aus deinen Daten, die Bildschirmzeit trägst du
   einmal pro Woche aus den Handy-Einstellungen ein (eine Web-App kann sie
   nicht selbst auslesen).
   Monatsrückblick: Dieser Monat gegen den letzten — jeweils bis zum gleichen
   Tag, damit der Vergleich fair ist. Dazu eine Frage pro Monat: Wie zufrieden
   bist du mit dir, und was hat sich in deinem Denken verändert? */

/* ---------- gemeinsame Kennzahlen für einen Zeitraum ---------- */
function keysBetween(startKey, endKey){
  const out = [];
  for(let d = dateFromKey(startKey); todayKey(d) <= endKey; d = addDays(d, 1)) out.push(todayKey(d));
  return out;
}
function hustleGoalIds(){ return new Set((S.hustleIdeas||[]).map(i=>i.goal_id).filter(Boolean)); }
function sessionMin(s){ return s.ended_at && s.started_at ? Math.max(0, Math.round((s.ended_at - s.started_at)/60000)) : 0; }
function periodStats(keys){
  const set = new Set(keys);
  const firstMs = dateFromKey(keys[0]).getTime(), lastMs = addDays(dateFromKey(keys[keys.length-1]), 1).getTime();
  const inRange = ms => ms >= firstMs && ms < lastMs;
  const focusMin = keys.reduce((s,k)=>s+(S.focusByDate[k]||0), 0);
  const hg = hustleGoalIds();
  const hustleMin = (S.focusSessions||[]).filter(s=>s.goal_id && hg.has(s.goal_id) && s.ended_at && inRange(s.started_at))
    .reduce((s,x)=>s+sessionMin(x), 0) + (S.income||[]).filter(e=>set.has(e.date)).reduce((s,e)=>s+(+e.hours||0)*60, 0);
  const trainSessions = (S.sessions||[]).filter(s=>set.has(s.date));
  const trainMin = trainSessions.reduce((s,x)=>s+Math.round((x.durationSec||0)/60), 0);
  const trainDays = new Set(typeof allTrainingEntries === "function" ? allTrainingEntries().filter(e=>set.has(e.date)).map(e=>e.date) : trainSessions.map(s=>s.date)).size;
  const sl = (S.sleep||[]).filter(s=>set.has(s.date));
  let hPoss = 0, hDone = 0;
  keys.forEach(k=>{ hPoss += S.habits.length; hDone += S.habits.filter(h=>(h.dates||{})[k]).length; });
  const outcomes = S.todos.filter(t=>t.is_outcome && !t.parent_id && t.done && (t.done_at ? inRange(t.done_at) : set.has(t.date))).length;
  return {
    focusMin, hustleMin, trainMin, trainDays,
    sleepAvg: sl.length ? sl.reduce((a,b)=>a+b.hours,0)/sl.length : null,
    habitPct: hPoss ? Math.round(hDone/hPoss*100) : null,
    cards: keys.reduce((s,k)=>s+((S.reviewByDate||{})[k]||0), 0),
    outcomes,
    evidence: (S.evidence||[]).filter(e=>inRange(e.created_at||0)).length,
    income: (S.income||[]).filter(e=>set.has(e.date)).reduce((s,e)=>s+(+e.amount||0), 0),
    goals: S.goals.filter(g=>g.reflection && inRange(g.reflection.at||0)).length,
    won: typeof wonDaysIn === "function" ? wonDaysIn(keys) : 0,
    shutdowns: keys.filter(k=>(S.shutdownByDate||{})[k]).length,
  };
}

/* ============================================================
   Zeit-Check
   ============================================================ */
function renderTimeCheck(){
  const box = $("timeCheck"); if(!box) return;
  const keys = lastNDates(7);
  const st = periodStats(keys);
  const wk = weekKey();
  const screenDay = (S.screenTime||{})[wk];
  const screenWeek = screenDay != null ? screenDay * 7 : null;
  const fokusOhne = Math.max(0, st.focusMin - Math.min(st.focusMin, st.hustleMin)) / 60;
  const rows = [
    ["🎯", "Fokus (Deep Work)", st.focusMin/60, "var(--ac)"],
    ["🧪", "Side Hustle", st.hustleMin/60, "var(--sec)"],
    ["🏋️", "Training", st.trainMin/60, "var(--mint)"],
    ["📱", "Bildschirmzeit Handy", screenWeek, "var(--rose)"],
  ];
  const max = Math.max(1, ...rows.map(r=>r[2]||0));
  const fazit = [];
  if(screenWeek != null && st.focusMin/60 > 0 && screenWeek > st.focusMin/60)
    fazit.push(`📱 Am Handy warst du <b>${h1(screenWeek/(st.focusMin/60))}×</b> so lange wie im Fokus.`);
  if(screenDay != null && screenDay >= 1)
    fazit.push(`💡 Schon <b>30 Min. pro Tag</b> weniger Handy wären <b>3,5 h pro Woche</b> — genug für zwei Side-Hustle-Sessions.`);
  if(screenWeek == null) fazit.push(`⏱ Trag unten deine Bildschirmzeit ein, dann siehst du das ganze Bild.`);
  if(st.focusMin === 0) fazit.push(`🎯 Diese Woche noch keine Fokus-Session — ein ⚡ 5-Minuten-Start reicht für den Anfang.`);

  // Verlauf Bildschirmzeit (letzte 6 Wochen)
  const weeks = [];
  for(let i=5;i>=0;i--) weeks.push(weekKey(addDays(new Date(), -7*i)));
  const vals = weeks.map(w=>(S.screenTime||{})[w]);
  const vmax = Math.max(1, ...vals.map(v=>v||0));

  box.innerHTML = `
    <div class="tc-rows">${rows.map(([ico, lab, h, col])=>`
      <div class="tc-row ${h==null?"missing":""}">
        <span class="tc-lab">${ico} ${lab}</span>
        <div class="bar"><i style="width:${h==null?0:Math.round(h/max*100)}%;background:${col}"></i></div>
        <span class="tc-val">${h==null ? "?" : h1(h) + " h"}</span>
      </div>`).join("")}
    </div>
    <div class="tc-sub">Schlaf Ø ${st.sleepAvg ? h1(st.sleepAvg) + " h/Nacht" : "–"} · ${st.cards} Karteikarten wiederholt · Fokus ohne Side Hustle ${h1(fokusOhne)} h</div>
    ${fazit.length ? `<div class="tc-fazit">${fazit.map(f=>`<div>${f}</div>`).join("")}</div>` : ""}
    <div class="tc-screen">
      <label>📱 Bildschirmzeit diese Woche — Ø Stunden pro Tag <small>(iPhone: Einstellungen → Bildschirmzeit · Android: Digital Wellbeing)</small></label>
      <div class="row-add" style="margin:6px 0 0">
        <input type="number" id="screenInput" min="0" max="24" step="0.25" placeholder="z. B. 3,5" value="${screenDay != null ? screenDay : ""}">
        <button class="btn sm" id="screenSave">Speichern</button>
      </div>
      ${vals.some(v=>v!=null) ? `<div class="tc-trend">${weeks.map((w,i)=>`
        <div class="tc-trend-col"><div class="tc-trend-bar"><i style="height:${vals[i]==null?0:Math.round(vals[i]/vmax*100)}%"></i></div>
          <b>${vals[i]==null?"–":h1(vals[i])}</b><small>${fmtShort(w)}</small></div>`).join("")}</div>` : ""}
    </div>`;
  $("screenSave").addEventListener("click", ()=>{
    const v = parseFloat(String($("screenInput").value).replace(",", "."));
    if(!isFinite(v) || v < 0 || v > 24){ toast("Gib die Stunden pro Tag ein, z. B. 3,5."); return; }
    const vorher = (S.screenTime||{})[weekKey(addDays(new Date(), -7))];
    S.screenTime = Object.assign({}, S.screenTime, {[weekKey()]: v});
    save(); renderTimeCheck();
    toast(vorher != null && v < vorher ? "📉 " + h1(vorher - v) + " h pro Tag weniger als letzte Woche — stark!" : "Bildschirmzeit gespeichert.");
  });
}

/* ============================================================
   Monatsrückblick & Zufriedenheit
   ============================================================ */
function monthKeyOf(d){ return todayKey(d).slice(0,7); }
function renderMonthReview(){
  const box = $("monthReview"); if(!box) return;
  const now = new Date();
  const tag = now.getDate();
  const startCur = todayKey(new Date(now.getFullYear(), now.getMonth(), 1));
  const prevFirst = new Date(now.getFullYear(), now.getMonth()-1, 1);
  const prevLast = new Date(now.getFullYear(), now.getMonth(), 0);
  const endPrev = todayKey(new Date(prevFirst.getFullYear(), prevFirst.getMonth(), Math.min(tag, prevLast.getDate())));
  const cur = periodStats(keysBetween(startCur, todayKey()));
  const prev = periodStats(keysBetween(todayKey(prevFirst), endPrev));

  const metric = (ico, lab, a, b, fmt, invert) => {
    const d = (a ?? 0) - (b ?? 0);
    const cls = a == null || b == null || Math.abs(d) < 1e-9 ? "eq" : ((d > 0) !== !!invert ? "up" : "down");
    return `<div class="mr-metric ${cls}">
      <span class="mr-ico">${ico}</span>
      <div class="mr-main"><small>${lab}</small><b>${a == null ? "–" : fmt(a)}</b></div>
      <span class="mr-delta">${a == null || b == null ? "" : cls === "eq" ? "=" : (d > 0 ? "▲" : "▼") + " " + fmt(Math.abs(d))}</span>
    </div>`;
  };
  const h = v => h1(v/60) + " h", n = v => String(Math.round(v)), pct = v => v + " %", eur = v => (Math.round(v)).toLocaleString("de-DE") + " €";
  const monatName = now.toLocaleDateString("de-DE", {month:"long"});
  const vormonat = prevFirst.toLocaleDateString("de-DE", {month:"long"});

  // Glaubenssätze: Mindset sichtbar machen
  const beliefs = (S.beliefs||[]).filter(b=>b.active);
  const avgStrength = beliefs.length ? beliefs.reduce((s,b)=>s+(b.strength||1),0)/beliefs.length : null;

  const mk = monthKeyOf(now);
  const rating = (S.selfRating||{})[mk] || null;
  const months = [];
  for(let i=5;i>=0;i--) months.push(monthKeyOf(new Date(now.getFullYear(), now.getMonth()-i, 1)));
  const scores = months.map(m=>((S.selfRating||{})[m]||{}).score || null);
  const notes = months.slice().reverse().map(m=>[m, ((S.selfRating||{})[m]||{}).note]).filter(([,t])=>t).slice(0,3);

  box.innerHTML = `
    <div class="mr-head">${monatName} bis zum ${tag}. — verglichen mit ${vormonat} bis zum gleichen Tag</div>
    <div class="mr-grid">
      ${metric("🏆", "Tage gewonnen", cur.won, prev.won, n)}
      ${metric("🔁", "Habit-Konsistenz", cur.habitPct, prev.habitPct, pct)}
      ${metric("🎯", "Fokuszeit", cur.focusMin, prev.focusMin, h)}
      ${metric("✅", "Outcomes erreicht", cur.outcomes, prev.outcomes, n)}
      ${metric("🏋️", "Trainingstage", cur.trainDays, prev.trainDays, n)}
      ${metric("🧠", "Karten wiederholt", cur.cards, prev.cards, n)}
      ${metric("🧩", "Beweise gesammelt", cur.evidence, prev.evidence, n)}
      ${metric("💶", "Nebeneinkommen", cur.income, prev.income, eur)}
    </div>
    ${avgStrength != null ? `<div class="mr-mindset">🧩 Deine ${beliefs.length} aktiven Glaubenssätze haben im Schnitt Stärke <b>${h1(avgStrength)} / 5</b> — jeder Beweis aus einer Session macht sie stärker.</div>` : ""}
    <div class="mr-rate">
      <div class="pf-lab">Wie zufrieden bist du gerade mit dir? <span class="pf-req sd-opt">einmal im Monat</span></div>
      <div class="slider-lab"><span>1 = gar nicht · 10 = sehr</span><span id="selfRateVal">${rating ? rating.score : 6} / 10</span></div>
      <input type="range" id="selfRate" min="1" max="10" value="${rating ? rating.score : 6}">
      <input id="selfNote" maxlength="200" placeholder="Was hat sich diesen Monat in deinem Denken verändert?" value="${esc(rating && rating.note || "")}">
      <button class="btn sm" id="selfSave" style="margin-top:9px">${rating ? "Aktualisieren" : "Speichern"}</button>
      ${scores.some(Boolean) ? `<div class="tc-trend mr-trend">${months.map((m,i)=>`
        <div class="tc-trend-col"><div class="tc-trend-bar"><i style="height:${scores[i] ? scores[i]*10 : 0}%"></i></div>
          <b>${scores[i] || "–"}</b><small>${new Date(m+"-01T12:00:00").toLocaleDateString("de-DE",{month:"short"})}</small></div>`).join("")}</div>` : ""}
      ${notes.length ? `<div class="mr-notes">${notes.map(([m,t])=>`<div><small>${new Date(m+"-01T12:00:00").toLocaleDateString("de-DE",{month:"long"})}</small> ${esc(t)}</div>`).join("")}</div>` : ""}
    </div>`;
  $("selfRate").addEventListener("input", ()=>{ $("selfRateVal").textContent = $("selfRate").value + " / 10"; });
  $("selfSave").addEventListener("click", ()=>{
    const neu = !((S.selfRating||{})[mk]);
    S.selfRating = Object.assign({}, S.selfRating, {[mk]: { score: parseInt($("selfRate").value), note: $("selfNote").value.trim(), at: Date.now() }});
    save(); renderMonthReview();
    if(neu) addXP(10, "🪞 Monatsrückblick gespeichert"); else toast("Rückblick aktualisiert.");
  });
}
