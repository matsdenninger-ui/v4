"use strict";
/* ASCEND charts.js — Chart.js-Hilfsfunktionen (gemeinsam für Body & Progress) */

/* ---------- Charts (Body) ---------- */
const charts = {};
function mkChart(id, cfg){
  if(charts[id]) charts[id].destroy();
  charts[id] = new Chart($(id).getContext("2d"), cfg);
}
if(window.Chart){
  Chart.defaults.color = "#A79FC4";
  Chart.defaults.borderColor = "rgba(51,47,69,.7)";
  Chart.defaults.font.family = "Inter, system-ui, sans-serif";
  Chart.defaults.font.size = 11;
}
/* Liest die aktuell aktive Theme-Farbe (abhängig von Tageszeit) für Chart.js, das keine CSS-Variablen versteht */
function cssVar(name){
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
function hexToRgba(hex, alpha){
  hex = hex.replace("#","");
  if(hex.length===3) hex = hex.split("").map(c=>c+c).join("");
  const r = parseInt(hex.substring(0,2),16), g = parseInt(hex.substring(2,4),16), b = parseInt(hex.substring(4,6),16);
  return `rgba(${r},${g},${b},${alpha})`;
}
const emptyPlugin = {
  id:"emptyMsg",
  afterDraw(c){
    if(c.data.datasets.every(d=>!d.data.length)){
      const {ctx, width, height} = c;
      ctx.save(); ctx.textAlign="center"; ctx.fillStyle="#6f6785"; ctx.font="12px Inter";
      ctx.fillText("Noch keine Daten — trage Werte ein oder lade Demo-Daten.", width/2, height/2);
      ctx.restore();
    }
  }
};
function lineOpts(unit){
  return { responsive:true, maintainAspectRatio:false,
    plugins:{ legend:{display:false}, tooltip:{callbacks:{label:c=>c.parsed.y+" "+unit}} },
    scales:{ x:{grid:{display:false}}, y:{beginAtZero:false} } };
}

function renderBodyCharts(){
  // Recovery & Maße hängen nicht an Chart.js — immer zuerst zeichnen
  renderRecovery(); renderMeasures();
  if(!window.Chart) return;
  const wl = S.bodyLog.filter(b=>b.kg!=null);
  mkChart("chWeight", { type:"line", plugins:[emptyPlugin],
    data:{ labels:wl.map(b=>fmtShort(b.date)),
      datasets:[{ data:wl.map(b=>b.kg), borderColor:cssVar("--ac"), backgroundColor:hexToRgba(cssVar("--ac"),.12),
        fill:true, tension:.35, pointRadius:3, pointBackgroundColor:cssVar("--ac") }] },
    options: lineOpts("kg") });

  renderStrengthSel();
  const sl = S.sleep.slice(-14);
  mkChart("chSleep", { type:"bar", plugins:[emptyPlugin],
    data:{ labels:sl.map(s=>fmtShort(s.date)),
      datasets:[
        { label:"Stunden", data:sl.map(s=>s.hours), backgroundColor:"rgba(91,192,235,.75)", borderRadius:5, yAxisID:"y" },
        { label:"Qualität", data:sl.map(s=>s.quality), type:"line", borderColor:cssVar("--sec"),
          pointBackgroundColor:cssVar("--sec"), tension:.35, yAxisID:"y1" } ] },
    options:{ responsive:true, maintainAspectRatio:false,
      plugins:{legend:{labels:{boxWidth:10}}},
      scales:{ x:{grid:{display:false}},
        y:{beginAtZero:true, max:12, title:{display:true,text:"h"}},
        y1:{beginAtZero:true, max:10, position:"right", grid:{display:false}, title:{display:true,text:"Q"}} } } });
}

/* Übungsauswahl der Kraftkurve — speist sich aus Sessions UND Schnell-Log,
   die häufigste Übung steht oben. */
function renderStrengthSel(){
  const entries = allTrainingEntries().filter(e=>e.unit !== "time" && e.kg);
  const count = {};
  entries.forEach(e=>{ count[e.name] = (count[e.name]||0) + 1; });
  const names = Object.keys(count).sort((a,b)=>count[b]-count[a]);
  const sel = $("strengthSel");
  const cur = sel.value;
  sel.innerHTML = names.length
    ? names.map(n=>`<option ${n===cur?"selected":""}>${esc(n)}</option>`).join("")
    : '<option value="">— Erst Training loggen —</option>';
  renderStrengthChart();
}
$("strengthSel").addEventListener("change", renderStrengthChart);
function renderStrengthChart(){
  if(!window.Chart) return;
  const name = $("strengthSel").value;
  const entries = allTrainingEntries().filter(e=>e.name===name && e.bestKg);
  const topKg = {}, e1 = {};
  entries.forEach(e=>{
    topKg[e.date] = Math.max(topKg[e.date]||0, e.bestKg);
    e1[e.date]    = Math.max(e1[e.date]||0, e.bestE1rm);
  });
  const keys = Object.keys(topKg).sort();
  mkChart("chStrength", { type:"line", plugins:[emptyPlugin],
    data:{ labels:keys.map(fmtShort),
      datasets:[
        { label:"Bestes Satzgewicht", data:keys.map(k=>topKg[k]), borderColor:"#34D399",
          backgroundColor:"rgba(52,211,153,.12)", fill:true, tension:.3, pointRadius:3, pointBackgroundColor:"#34D399" },
        { label:"geschätztes 1RM", data:keys.map(k=>e1[k]), borderColor:cssVar("--ac"),
          borderDash:[5,4], fill:false, tension:.3, pointRadius:0 } ] },
    options:{ responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{labels:{boxWidth:10}}, tooltip:{callbacks:{label:c=>c.dataset.label+": "+c.parsed.y+" kg"}} },
      scales:{ x:{grid:{display:false}}, y:{beginAtZero:false, title:{display:true,text:"kg"}} } } });
}
