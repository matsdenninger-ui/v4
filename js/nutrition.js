"use strict";
/* ASCEND nutrition.js — Makros, Mahlzeitenplan, Hydration, Supplement-Stack */

/* ============================================================
   NUTRITION
   ============================================================ */
/* ---------- Makros: automatisch aus abgehaktem Mahlzeitenplan + Extras ---------- */
function checkNutritionDay(){
  if(S.nutrition.date !== todayKey()){
    S.nutrition.extraKcal = S.nutrition.extraPro = S.nutrition.extraCarb = S.nutrition.extraFat = 0;
    S.nutrition.date = todayKey(); save();
  }
}
function computedMacros(){
  const tk = todayKey();
  const eaten = S.mealEaten[tk] || {};
  let kcal=0, pro=0, carb=0, fat=0, mealKcal=0;
  Object.keys(MEALS).forEach(slot=>{
    if(!eaten[slot]) return;
    const st = S.mealSlots[slot] || {idx:0};
    const opt = MEALS[slot].options[Math.min(st.idx, MEALS[slot].options.length-1)];
    kcal += opt.kcal; pro += opt.p; carb += opt.c; fat += opt.f; mealKcal += opt.kcal;
  });
  const n = S.nutrition;
  return {
    kcal: kcal + (n.extraKcal||0), pro: pro + (n.extraPro||0),
    carb: carb + (n.extraCarb||0), fat: fat + (n.extraFat||0),
    mealKcal, extraKcal: n.extraKcal||0
  };
}
function renderMacros(){
  checkNutritionDay();
  const n = S.nutrition;
  const c = computedMacros();
  const rows = [
    ["Kalorien", c.kcal, n.tKcal, "kcal", "kcal"],
    ["Protein",  c.pro,  n.tPro,  "g",    "pro"],
    ["Carbs",    c.carb, n.tCarb, "g",    "carb"],
    ["Fette",    c.fat,  n.tFat,  "g",    "fat"],
  ];
  $("macroBars").innerHTML = rows.map(([lab,val,tgt,unit,cls])=>{
    const pct = tgt>0 ? Math.min(100, val/tgt*100) : 0;
    return `<div class="macro">
      <div class="lab"><b>${lab}</b><span>${val} / ${tgt} ${unit}</span></div>
      <div class="bar"><i class="${cls}" style="width:${pct}%"></i></div>
    </div>`;
  }).join("");
  $("macroSub").textContent = c.mealKcal
    ? `${c.mealKcal} kcal aus ${Object.values(S.mealEaten[todayKey()]||{}).filter(Boolean).length} abgehakten Mahlzeiten${c.extraKcal?" + "+c.extraKcal+" kcal Extras":""}.`
    : "Noch keine Mahlzeit heute abgehakt — hake unten ab, was du gegessen hast.";
  $("inKcal").value = n.extraKcal||""; $("tKcal").value = n.tKcal;
  $("inPro").value  = n.extraPro||"";  $("tPro").value  = n.tPro;
  $("inCarb").value = n.extraCarb||""; $("tCarb").value = n.tCarb;
  $("inFat").value  = n.extraFat||"";  $("tFat").value  = n.tFat;
}
[["inKcal","extraKcal"],["tKcal","tKcal"],["inPro","extraPro"],["tPro","tPro"],
 ["inCarb","extraCarb"],["tCarb","tCarb"],["inFat","extraFat"],["tFat","tFat"]].forEach(([id,key])=>{
  $(id).addEventListener("change", ()=>{
    S.nutrition[key] = Math.max(0, parseInt($(id).value)||0);
    save(); renderMacros();
  });
});

/* ---------- Mahlzeitenplan ---------- */
const MEAL_TAG_CLASS = { g:"mg", b:"mb", a:"ma", p:"mp" };
let openMealSlot = null;
function renderMealPlan(){
  const tk = todayKey();
  const eatenMap = S.mealEaten[tk] || {};
  $("mealPlanList").innerHTML = Object.keys(MEALS).map(slot=>{
    const sd = MEALS[slot];
    const st = S.mealSlots[slot];
    const idx = Math.min(st.idx, sd.options.length-1);
    const opt = sd.options[idx];
    const isEaten = !!eatenMap[slot];
    const isOpen = openMealSlot === slot;
    const rows = opt.items.map(([name,detail])=>`
      <div class="food-row2"><div class="food-dot2"></div><div class="food-name2">${esc(name)}</div><div class="food-detail2">${esc(detail)}</div></div>`).join("");
    const tags = (opt.tags||[]).map(([label,c])=>`<span class="mtag ${MEAL_TAG_CLASS[c]||"mg"}">${esc(label)}</span>`).join("");
    const dots = sd.options.map((_,i)=>`<span class="vdot ${i===idx?"on":""}"></span>`).join("");
    return `<div class="meal-card2 ${isOpen?"open":""} ${isEaten?"eaten":""}" data-slot="${slot}">
      <div class="meal-card2-head" data-act="meal-open" data-slot="${slot}">
        <div class="meal-icon2" style="background:${sd.color}">${opt.icon}</div>
        <div class="meal-card2-title">
          <b>${esc(opt.name)}<span class="meal-slot-badge2">${esc(sd.label)}</span></b>
          <small>🕐 ${esc(st.time)} Uhr</small>
        </div>
        <div class="meal-kcal2">~${opt.kcal} kcal</div>
        <svg class="meal-chevron2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 9l6 6 6-6"/></svg>
      </div>
      <div class="meal-card2-body">
        ${rows}
        <div class="tagrow2">${tags}</div>
        <div class="meal-macro-row2">
          <span>Protein: <b>${opt.p}g</b></span><span>Carbs: <b>${opt.c}g</b></span><span>Fette: <b>${opt.f}g</b></span>
        </div>
        <div class="meal-foot2">
          <button class="meal-shuffle-btn" data-act="meal-shuffle" data-slot="${slot}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>
            Andere Option
          </button>
          <div class="time-edit2">
            <input type="time" data-act="meal-time" data-slot="${slot}" value="${st.time}">
          </div>
          <label class="meal-eat-check">
            <input type="checkbox" data-act="meal-eat" data-slot="${slot}" ${isEaten?"checked":""}>
            Gegessen
          </label>
          <div class="variant-dots2">${dots}&nbsp;${idx+1}/${sd.options.length}</div>
        </div>
      </div>
    </div>`;
  }).join("");
}


/* ---------- Hydration ---------- */
function renderHydro(){
  const tk = todayKey();
  const cur = S.hydration[tk]||0, goal = S.hydroGoal;
  $("hydroSub").textContent = cur + " von " + goal + " Gläsern" + (cur>=goal ? " — Ziel erreicht! 💧" : "");
  let html = "";
  for(let i=0;i<goal;i++){
    html += `<button class="glass ${i<cur?"full":""}" data-act="glass" data-i="${i}" aria-label="Glas ${i+1}"></button>`;
  }
  $("glasses").innerHTML = html;
}
$("hydroReset").addEventListener("click", ()=>{ S.hydration[todayKey()] = 0; save(); renderHydro(); });

/* ---------- Supplement-Stack ---------- */
function addSupp(){
  const n = $("suppName").value.trim();
  if(!n) return;
  S.supplements.push({id:uid(), name:n, icon:"💊", dose:"Individuell", when:"Eigene Einnahme",
    body:"", time:$("suppTime").value||"08:00", dates:{}, touched:Date.now()});
  $("suppName").value = ""; save(); renderSupps(); renderHero();
}
$("suppAdd").addEventListener("click", addSupp);
$("suppName").addEventListener("keydown", e=>{ if(e.key==="Enter") addSupp(); });

$("suppLoadStack").addEventListener("click", ()=>{
  const existing = new Set(S.supplements.map(s=>s.name.toLowerCase()));
  let added = 0;
  SUPP_STACK.forEach(s=>{
    if(!existing.has(s.name.toLowerCase())){
      S.supplements.push({id:uid(), name:s.name, icon:s.icon, dose:s.dose, when:s.when, body:s.body, time:s.time, dates:{}, touched:Date.now()});
      added++;
    }
  });
  save(); renderSupps();
  toast(added ? added+" Supplement(e) ergänzt." : "Basis-Stack ist bereits vollständig.");
});

function renderSupps(){
  const tk = todayKey();
  const sorted = [...S.supplements].sort((a,b)=>a.time.localeCompare(b.time));
  if(!sorted.length){
    $("suppList").innerHTML = '<div class="empty">💊 <b>Keine Supplements angelegt.</b><br>Lade den Basis-Stack oder füge oben ein eigenes hinzu.</div>';
    return;
  }
  $("suppList").innerHTML = sorted.map(s=>{
    const on = !!s.dates[tk];
    return `<div class="supp-card2 ${on?"taken":""}">
      <div class="supp-head2">
        <div class="supp-ico2" style="background:${on?"var(--mint-soft)":"var(--ac-soft)"}">${s.icon||"💊"}</div>
        <div style="flex:1;min-width:0">
          <div class="supp-name2">${esc(s.name)}</div>
          <div class="supp-dose2">${esc(s.dose||"")}</div>
        </div>
        <button class="icon-btn del supp-del2" data-act="supp-del" data-id="${s.id}">${ICON_X}</button>
      </div>
      ${s.when ? `<div class="supp-when2">⏱ ${esc(s.when)}</div>` : ""}
      ${s.body ? `<div class="supp-body2">${esc(s.body)}</div>` : ""}
      <div class="supp-foot2">
        <label class="supp-take-check">
          <input type="checkbox" data-act="supp-toggle" data-id="${s.id}" ${on?"checked":""}>
          ${on ? "Heute genommen ✓" : "Heute genommen?"}
        </label>
        <div class="supp-time-edit">🕐 <input type="time" data-act="supp-time" data-id="${s.id}" value="${s.time}"></div>
      </div>
    </div>`;
  }).join("");
}

$("mealPlan").addEventListener("input", ()=>{ S.mealPlan = $("mealPlan").value; save(); });
$("gymPlan").addEventListener("input",  ()=>{ S.gymPlan  = $("gymPlan").value;  save(); });
