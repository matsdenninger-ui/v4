"use strict";
/* ASCEND progress.js — Stats, Charts, Badges, Korrelation, Weekly Report */

/* ============================================================
   PROGRESS
   ============================================================ */
function renderProgressStats(animate){
  const L = levelInfo(S.xp);
  if(animate){ animateNumber($("pXp"), S.xp, 500, v=>v.toLocaleString("de-DE")); }
  else { $("pXp").textContent = S.xp.toLocaleString("de-DE"); }
  $("pLvl").textContent = L.lvl;
  $("pFocusTotal").textContent = h1(Object.values(S.focusByDate).reduce((a,b)=>a+b,0)/60)+" h";
  $("pBadges").textContent = Object.keys(S.badges).length + "/" + BADGES.length;
}

function renderProgressCharts(){
  if(!window.Chart) return;
  const days = lastNDates(14);
  mkChart("chFocus", { type:"bar", plugins:[emptyPlugin],
    data:{ labels:days.map(fmtShort),
      datasets:[{ data:days.map(k=>+( (S.focusByDate[k]||0)/60 ).toFixed(2)),
        backgroundColor:hexToRgba(cssVar("--ac"),.85), borderRadius:5 }] },
    options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}},
      scales:{x:{grid:{display:false}}, y:{beginAtZero:true, title:{display:true,text:"h"}}} } });

  // Habit-Quote pro Woche (8 Wochen)
  const labels = [], data = [];
  for(let w=7; w>=0; w--){
    const start = addDays(dateFromKey(weekKey()), -7*w);
    let done = 0, poss = 0;
    for(let i=0;i<7;i++){
      const d = addDays(start,i);
      if(d > new Date()) break;
      const k = todayKey(d);
      poss += S.habits.length;
      done += S.habits.filter(h=>h.dates[k]).length;
    }
    labels.push("KW "+fmtShort(todayKey(start)));
    data.push(poss ? Math.round(done/poss*100) : 0);
  }
  mkChart("chHabitRate", { type:"line",
    data:{ labels, datasets:[{ data, borderColor:cssVar("--sec"), backgroundColor:hexToRgba(cssVar("--sec"),.14),
      fill:true, tension:.35, pointRadius:3, pointBackgroundColor:cssVar("--sec") }] },
    options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}},
      scales:{x:{grid:{display:false}}, y:{beginAtZero:true, max:100, title:{display:true,text:"%"}}} } });
}


/* ---------- Badges ---------- */
const BADGES = [
  {id:"streak7",  ico:"🔥", name:"Woche aus Stahl",  desc:"7-Tage-Streak bei einem Habit", rarity:"selten",
    test:()=>S.habits.some(h=>habitStreak(h)>=7)},
  {id:"streak30", ico:"⚔️", name:"Eisenwille",       desc:"30-Tage-Streak bei einem Habit", rarity:"legendaer",
    test:()=>S.habits.some(h=>habitStreak(h)>=30)},
  {id:"deep4",    ico:"🌊", name:"Tiefseetaucher",   desc:"4 h Deep Work an einem Tag", rarity:"episch",
    test:()=>Object.values(S.focusByDate).some(m=>m>=240)},
  {id:"week20",   ico:"🏔️", name:"Marathon-Woche",  desc:"20 h Fokus in 7 Tagen", rarity:"legendaer",
    test:()=>lastNDates(7).reduce((s,k)=>s+(S.focusByDate[k]||0),0) >= 1200},
  {id:"allhab",   ico:"✅", name:"Perfekter Tag",    desc:"Alle Habits an einem Tag erledigt", rarity:"selten",
    test:()=>S.habits.length>=3 && S.habits.every(h=>h.dates[todayKey()])},
  {id:"hydra",    ico:"💧", name:"Hydra",            desc:"Trink-Ziel an einem Tag erreicht", rarity:"selten",
    test:()=>Object.values(S.hydration).some(g=>g>=S.hydroGoal)},
  {id:"book",     ico:"📚", name:"Bücherwurm",       desc:"Ein Buch oder einen Kurs abgeschlossen", rarity:"selten",
    test:()=>S.learning.some(l=>l.progress>=100)},
  {id:"lift10",   ico:"🏋️", name:"Stammgast",       desc:"10 Workouts geloggt", rarity:"selten",
    test:()=>S.workouts.length>=10},
  {id:"lvl5",     ico:"🌟", name:"Aufsteiger",       desc:"Level 5 erreicht", rarity:"episch",
    test:()=>levelInfo(S.xp).lvl>=5},
  {id:"lvl10",    ico:"👑", name:"Zehnkämpfer",      desc:"Level 10 erreicht", rarity:"legendaer",
    test:()=>levelInfo(S.xp).lvl>=10},
];
function checkBadges(){
  let newOnes = [];
  BADGES.forEach(b=>{
    if(!S.badges[b.id] && b.test()){ S.badges[b.id] = todayKey(); newOnes.push(b); }
  });
  if(newOnes.length){
    save();
    newOnes.forEach(b=>toast("Badge freigeschaltet: "+b.ico+" "+b.name+"!"));
    renderBadges(); renderProgressStats();
    newOnes.forEach(b=>{
      const el = document.querySelector(`.badge[data-id="${b.id}"]`);
      if(el){ el.classList.add("just-unlocked"); setTimeout(()=>el.classList.remove("just-unlocked"), 700); }
    });
  }
}
function renderBadges(){
  $("badgeGrid").innerHTML = BADGES.map(b=>{
    const u = S.badges[b.id];
    return `<div class="badge ${u?"unlocked":""}" data-id="${b.id}">
      <div class="ico">${b.ico}</div>
      <b>${b.name}</b>
      <small>${b.desc}</small>
      <span class="rarity r-${b.rarity}">${b.rarity==="legendaer"?"Legendär":b.rarity==="episch"?"Episch":"Selten"}</span>
      ${u?`<small style="color:var(--sec);margin-top:5px">✓ ${fmtShort(u)}</small>`:""}
    </div>`;
  }).join("");
}

/* ---------- Korrelation ---------- */
function pearson(xs, ys){
  const n = xs.length;
  const mx = xs.reduce((a,b)=>a+b,0)/n, my = ys.reduce((a,b)=>a+b,0)/n;
  let num=0, dx=0, dy=0;
  for(let i=0;i<n;i++){ num += (xs[i]-mx)*(ys[i]-my); dx += (xs[i]-mx)**2; dy += (ys[i]-my)**2; }
  return (dx&&dy) ? num/Math.sqrt(dx*dy) : 0;
}
function renderCorrelation(){
  // Schlaf (Nacht) ↔ Fokus am selben Tag
  const pairs = [];
  S.sleep.forEach(s=>{
    const f = S.focusByDate[s.date];
    if(f != null) pairs.push({x:s.hours, y:+(f/60).toFixed(2)});
  });
  const box = $("corrBox");
  if(pairs.length < 5){
    box.innerHTML = `<div class="empty">🔗 <b>Schlaf ↔ Fokus</b><br>
      Noch ${5-pairs.length} Tage mit Schlaf- <em>und</em> Fokusdaten nötig (${pairs.length}/5).<br>
      Beispiel: Menschen mit 7,5+ h Schlaf berichten oft von deutlich längeren Fokusphasen.</div>`;
  } else {
    const r = pearson(pairs.map(p=>p.x), pairs.map(p=>p.y));
    const cls = r>0.25?"corr-pos": r<-0.25?"corr-neg":"corr-neu";
    const word = r>0.5?"stark positiv": r>0.25?"positiv": r<-0.5?"stark negativ": r<-0.25?"negativ":"schwach";
    box.innerHTML = `<div style="display:flex;align-items:center;gap:16px">
      <span class="corr-val ${cls}">r = ${r.toFixed(2)}</span>
      <span class="note">Zusammenhang <b>Schlafdauer ↔ Fokusstunden</b> ist <b>${word}</b>
      (${pairs.length} Tage). ${r>0.25?"Mehr Schlaf ging bei dir mit mehr Deep Work einher.":"Sammle weiter Daten für ein klareres Bild."}</span></div>`;
  }
  if(window.Chart){
    mkChart("chCorr", { type:"scatter", plugins:[emptyPlugin],
      data:{ datasets:[{ data:pairs, backgroundColor:"#60A5FA", pointRadius:5 }] },
      options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false},
        tooltip:{callbacks:{label:c=>c.parsed.x+" h Schlaf → "+c.parsed.y+" h Fokus"}}},
        scales:{ x:{title:{display:true,text:"Schlaf (h)"}}, y:{title:{display:true,text:"Fokus (h)"},beginAtZero:true} } } });
  }
}

/* ---------- Weekly Report ---------- */
$("reportBtn").addEventListener("click", ()=>{
  const days = lastNDates(7);
  const todos = S.todos.filter(t=>days.includes(t.date));
  const tDone = todos.filter(t=>t.done).length;
  let hPoss=0, hDone=0;
  days.forEach(k=>{ hPoss+=S.habits.length; hDone+=S.habits.filter(h=>h.dates[k]).length; });
  const focus = days.reduce((s,k)=>s+(S.focusByDate[k]||0),0)/60;
  const wos = S.workouts.filter(w=>days.includes(w.date));
  const sl = S.sleep.filter(s=>days.includes(s.date));
  const avgSleep = sl.length ? sl.reduce((a,b)=>a+b.hours,0)/sl.length : null;
  const mo = S.moods.filter(m=>days.includes(m.date));
  const avgMood = mo.length ? mo.reduce((a,b)=>a+b.mood,0)/mo.length : null;
  const bestHabit = S.habits.reduce((m,h)=>Math.max(m,habitStreak(h)),0);

  const lines = [];
  lines.push("✅ To-Dos: "+tDone+" von "+todos.length+" erledigt"+(todos.length&&tDone===todos.length?" — alles abgehakt!":""));
  lines.push("🔁 Habits: "+(hPoss?Math.round(hDone/hPoss*100):0)+" % Konsistenz ("+hDone+"/"+hPoss+") · längste Streak: "+bestHabit+" Tage");
  lines.push("🎯 Deep Work: "+h1(focus)+" h Fokuszeit"+(focus>=10?" — starke Woche!":focus>0?"":" — nächste Woche eine Session einplanen."));
  lines.push("🏋️ Training: "+wos.length+" Einträge im Workout Log");
  lines.push("😴 Schlaf: "+(avgSleep?("Ø "+h1(avgSleep)+" h über "+sl.length+" Nächte"):"keine Daten geloggt"));
  lines.push("🙂 Stimmung: "+(avgMood?("Ø "+h1(avgMood)+" / 5 über "+mo.length+" Logs"):"keine Daten geloggt"));
  lines.push("");
  const wins = [];
  if(hPoss && hDone/hPoss>=0.7) wins.push("hohe Habit-Konsistenz");
  if(focus>=8) wins.push("solide Fokuszeit");
  if(wos.length>=3) wins.push("regelmäßiges Training");
  if(avgSleep && avgSleep>=7.5) wins.push("guter Schlaf");
  lines.push(wins.length ? "💪 Stärken der Woche: "+wins.join(", ")+"."
                         : "💡 Impuls: Wähle für nächste Woche EINEN Bereich und mach ihn zur Priorität.");
  const weak = [];
  if(!focus) weak.push("Deep Work");
  if(!sl.length) weak.push("Schlaf-Tracking");
  if(hPoss && hDone/hPoss<0.4) weak.push("Habits");
  if(weak.length) lines.push("⚠️ Blinde Flecken: "+weak.join(", ")+".");

  const end = new Date(), start = addDays(end,-6);
  $("reportRange").textContent = start.toLocaleDateString("de-DE")+" – "+end.toLocaleDateString("de-DE");
  $("reportBody").textContent = lines.join("\n");
  $("reportModal").classList.add("open");
});
$("reportClose").addEventListener("click", ()=>$("reportModal").classList.remove("open"));
$("reportModal").addEventListener("click", e=>{ if(e.target===$("reportModal")) $("reportModal").classList.remove("open"); });
$("reportCopy").addEventListener("click", ()=>{
  navigator.clipboard?.writeText($("reportBody").textContent).then(()=>toast("Report kopiert."));
});
