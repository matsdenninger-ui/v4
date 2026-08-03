"use strict";
/* ASCEND xp.js — XP & Level-System */

/* ---------- XP & Level ---------- */
const LVL_TITLES = ["Novize","Lehrling","Praktiker","Gestalter","Stratege","Meister","Mentor","Virtuose","Architekt","Legende"];
function levelInfo(xp){
  let lvl = 1, need = 100, floor = 0;
  while(xp >= floor + need){ floor += need; lvl++; need = 100 + (lvl-1)*50; }
  return { lvl, into: xp - floor, need,
    title: LVL_TITLES[Math.min(lvl-1, LVL_TITLES.length-1)] + (lvl > LVL_TITLES.length ? " "+lvl : "") };
}
function addXP(n, msg){
  const beforeLvl = levelInfo(S.xp).lvl;
  S.xp += n; save();
  toast(msg || "", n);
  const afterInfo = levelInfo(S.xp);
  renderLevel(true); renderProgressStats(true); checkBadges();
  if(afterInfo.lvl > beforeLvl) showLevelUp(afterInfo);
}

const raf = (typeof requestAnimationFrame === "function")
  ? requestAnimationFrame
  : (fn)=>setTimeout(()=>fn(Date.now()), 16);

/* Animiert eine Zahl von ihrem aktuellen Textinhalt zu einem neuen Wert hoch */
function animateNumber(el, to, duration, formatter){
  if(!el) return;
  duration = duration || 500;
  formatter = formatter || (v=>String(v));
  const digitsOnly = el.textContent.replace(/[^\d-]/g, "");
  const from = digitsOnly ? parseInt(digitsOnly) : 0;
  if(!isFinite(from) || from === to){ el.textContent = formatter(to); return; }
  const start = (typeof performance !== "undefined" ? performance.now() : Date.now());
  function step(now){
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    const val = Math.round(from + (to - from) * eased);
    el.textContent = t < 1 ? String(val) : formatter(to);
    if(t < 1) raf(step);
  }
  raf(step);
}

function renderLevel(animate){
  const L = levelInfo(S.xp);
  if(animate){ animateNumber($("ringLvl"), L.lvl, 400); }
  else { $("ringLvl").textContent = L.lvl; }
  $("lvlTitle").textContent = L.title;
  $("lvlXp").textContent = L.into + " / " + L.need + " XP · gesamt " + S.xp;
  const pct = L.into / L.need;
  $("ringBar").style.strokeDashoffset = 157 * (1 - pct);
  $("xpMini").style.width = (pct*100) + "%";
  if(animate){
    const ring = $("ringLvl").closest(".ring");
    if(ring){
      ring.classList.remove("xp-pulse"); void ring.offsetWidth; // Reflow erzwingen, damit die Animation erneut startet
      ring.classList.add("xp-pulse");
    }
  }
}

/* Level-Up-Feier: kurzes Overlay mit neuem Level + Titel */
function showLevelUp(info){
  $("levelupLvl").textContent = info.lvl;
  $("levelupName").textContent = info.title;
  const el = $("levelupBurst");
  el.classList.remove("show"); void el.offsetWidth;
  el.classList.add("show");
  setTimeout(()=>{ el.classList.remove("show"); }, 1800);
}

