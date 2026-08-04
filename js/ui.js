"use strict";
/* ASCEND ui.js — Toast, Confirm-Modal, Navigation, Sidebar/Burger, Icons */

/* ---------- Toast ---------- */
function toast(msg, xp){
  const t = document.createElement("div");
  t.className = "toast";
  t.innerHTML = (xp ? '<span class="xp">+'+xp+' XP</span>' : '') + esc(msg);
  $("toasts").appendChild(t);
  setTimeout(()=>{ t.classList.add("out"); setTimeout(()=>t.remove(), 320); }, 2600);
}


/* ---------- Custom confirm modal ----------
   Native window.confirm()/prompt() are blocked or silently no-op in many
   sandboxed webviews (e.g. embedded previews), which made destructive
   actions and the weekly board silently fail. This in-app modal replaces
   them everywhere so confirmations always work reliably. */
function customConfirm(message, opts){
  opts = opts || {};
  return new Promise(resolve=>{
    $("confirmTitle").textContent = opts.title || "Bist du sicher?";
    $("confirmText").textContent = message;
    const okBtn = $("confirmOk");
    okBtn.textContent = opts.okLabel || "Bestätigen";
    okBtn.className = "btn" + (opts.danger ? " danger" : "");
    $("confirmModal").classList.add("open");
    function cleanup(result){
      $("confirmModal").classList.remove("open");
      okBtn.removeEventListener("click", onOk);
      $("confirmCancel").removeEventListener("click", onCancel);
      resolve(result);
    }
    function onOk(){ cleanup(true); }
    function onCancel(){ cleanup(false); }
    okBtn.addEventListener("click", onOk);
    $("confirmCancel").addEventListener("click", onCancel);
  });
}
$("confirmModal").addEventListener("click", e=>{
  if(e.target === $("confirmModal")) $("confirmCancel").click();
});


/* ---------- Navigation ---------- */
const PAGE_TITLES = { today:"Today", nutrition:"Nutrition & Supplements", body:"Body", mind:"Mind", progress:"Progress", goals:"Goals" };
document.querySelectorAll("#nav button").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    document.querySelectorAll("#nav button").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    const p = btn.dataset.page;
    document.querySelectorAll(".page").forEach(pg=>pg.classList.remove("active"));
    $("page-"+p).classList.add("active");
    $("pageTitle").textContent = PAGE_TITLES[p];
    if(p==="body") renderBodyCharts();
    if(p==="progress"){ renderProgressStats(); renderProgressCharts(); renderBadges(); renderCorrelation(); }
    closeSidebar();
    try{ window.scrollTo({top:0, behavior:"smooth"}); }catch(e){}
  });
});
function closeSidebar(){ $("sidebar").classList.remove("open"); $("scrim").classList.remove("show"); }
$("burger").addEventListener("click", ()=>{ $("sidebar").classList.add("open"); $("scrim").classList.add("show"); });

/* Burger: verschwindet als Layer über dem Inhalt während des Scrollens, taucht wieder auf, sobald man stehen bleibt */
let burgerIdleTimer = null;
window.addEventListener("scroll", ()=>{
  $("burger").classList.add("burger-hidden");
  clearTimeout(burgerIdleTimer);
  burgerIdleTimer = setTimeout(()=>{ $("burger").classList.remove("burger-hidden"); }, 500);
}, { passive:true });
$("scrim").addEventListener("click", closeSidebar);

/* ---------- Einklappbarer "Mehr anzeigen"-Bereich (Phase 1/3) ---------- */
$("moreToggle").addEventListener("click", ()=>{
  const box = $("moreCollapsible");
  const open = box.classList.toggle("open");
  $("moreToggleLabel").textContent = open ? "Weniger anzeigen" : "Mehr anzeigen";
});

$("dateLabel").textContent = new Date().toLocaleDateString("de-DE",{weekday:"long", day:"numeric", month:"long", year:"numeric"});

/* ---------- SVG icons ---------- */
const ICON_CHECK = '<svg viewBox="0 0 24 24" fill="none"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>';
const ICON_X = '<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path stroke-linecap="round" d="M6 6l12 12M18 6L6 18"/></svg>';
