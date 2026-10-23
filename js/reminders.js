"use strict";
/* ASCEND reminders.js — Push-Erinnerungen & Deep-Links
   Ascend soll dich finden, nicht umgekehrt. Ablauf:
     1. App als Icon auf den Homescreen (auf dem iPhone Pflicht für Push)
     2. Hier auf „Aktivieren“ — der Browser fragt nach Erlaubnis
     3. Das Gerät meldet sich bei /api/push an (Schutz: dein Sync-Code)
     4. Ein GitHub-Zeitplan ruft alle 15 Min. /api/cron auf; der Server liest
        deinen Sync-Stand und schickt nur, was gerade wirklich ansteht.
   Die Einstellungen (welche Erinnerung, wann) liegen in S.reminders und
   werden mit dem Cloud-Sync zum Server übertragen. */

const REMINDER_ITEMS = [
  ["plan",       "🎯", "Tag planen",          "wenn noch kein Outcome für heute steht"],
  ["cards",      "🧠", "Karteikarten",        "wenn Karten fällig sind"],
  ["shutdown",   "🌙", "Feierabend-Ritual",   "Mo–Fr, wenn noch nicht gemacht"],
  ["habits",     "🔁", "Offene Habits",       "wenn heute noch Habits offen sind"],
  ["friday",     "📨", "Friday Highlights",   "nur freitags"],
  ["comeback",   "👋", "Willkommen zurück",   "nach 2+ Tagen Pause, höchstens alle 2 Tage"],
  ["screentime", "⏱", "Bildschirmzeit eintragen", "nur sonntags"],
];
const REMINDER_TIMES = { plan:"08:00", cards:"18:00", shutdown:"18:30", habits:"20:30", friday:"14:00", comeback:"19:00", screentime:"19:00" };

function remCfg(){
  if(!S.reminders || typeof S.reminders !== "object") S.reminders = { enabled:false, tz:"", items:{} };
  if(!S.reminders.items) S.reminders.items = {};
  return S.reminders;
}
function remItem(id){
  const it = remCfg().items[id] || {};
  return { on: it.on !== false, time: it.time || REMINDER_TIMES[id] };
}
function pushSupported(){ return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window; }
function isStandalone(){
  return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone === true;
}
function isIOS(){ return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1); }

let swReg = null;
async function registerSW(){
  if(!("serviceWorker" in navigator)) return null;
  try{ swReg = await navigator.serviceWorker.register("/sw.js"); }catch(e){ swReg = null; }
  return swReg;
}
function b64ToUint8(b64){
  const pad = "=".repeat((4 - b64.length % 4) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)));
}
async function pushApi(method, body){
  const token = getCloudToken();
  if(!token) throw new Error("Erst den Cloud-Sync verbinden (Sync-Code in der Seitenleiste).");
  const r = await fetch("/api/push", {
    method, headers: Object.assign({ "Authorization":"Bearer " + token }, body ? {"Content-Type":"application/json"} : {}),
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(data.error || ("Server antwortet mit " + r.status));
  return data;
}
async function currentSubscription(){
  if(!pushSupported()) return null;
  const reg = swReg || await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}

async function enablePush(){
  try{
    if(!pushSupported()) throw new Error(isIOS() && !isStandalone()
      ? "Auf dem iPhone geht Push nur, wenn Ascend auf dem Homescreen liegt (Teilen → „Zum Home-Bildschirm“)."
      : "Dieser Browser unterstützt keine Push-Benachrichtigungen.");
    const perm = await Notification.requestPermission();
    if(perm !== "granted") throw new Error("Benachrichtigungen wurden nicht erlaubt. Das lässt sich in den Browser- bzw. Handy-Einstellungen ändern.");
    const reg = swReg || await registerSW();
    if(!reg) throw new Error("Service Worker konnte nicht starten.");
    await navigator.serviceWorker.ready;
    const { publicKey } = await pushApi("GET");
    let sub = await reg.pushManager.getSubscription();
    if(!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly:true, applicationServerKey: b64ToUint8(publicKey) });
    const device = (isIOS() ? "iPhone/iPad" : /android/i.test(navigator.userAgent) ? "Android" : "Computer") + (isStandalone() ? " · App" : " · Browser");
    await pushApi("POST", { action:"subscribe", subscription: sub.toJSON(), device });
    const cfg = remCfg();
    cfg.enabled = true;
    cfg.tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Berlin";
    save(); cloudSave(true);
    toast("🔔 Erinnerungen auf diesem Gerät aktiv.");
  }catch(e){
    toast("🔔 " + e.message);
  }
  renderReminderModal();
}
async function disablePushHere(){
  try{
    const sub = await currentSubscription();
    if(sub){
      try{ await pushApi("POST", { action:"unsubscribe", endpoint: sub.endpoint }); }catch(e){}
      await sub.unsubscribe();
    }
    toast("Dieses Gerät bekommt keine Erinnerungen mehr.");
  }catch(e){ toast("🔔 " + e.message); }
  renderReminderModal();
}
async function testPush(){
  try{
    const r = await pushApi("POST", { action:"test" });
    toast(r.sent ? "Test verschickt an " + r.sent + " Gerät" + (r.sent===1?"":"e") + "." : "Kein Gerät angemeldet — erst aktivieren.");
  }catch(e){ toast("🔔 " + e.message); }
}

/* ---------- Einstellungs-Modal ---------- */
async function renderReminderModal(){
  const cfg = remCfg();
  const sub = await currentSubscription().catch(()=>null);
  const perm = "Notification" in window ? Notification.permission : "unsupported";
  const row = (ok, text, hint) => `<div class="rem-status ${ok?"ok":""}"><span>${ok?"✓":"○"}</span><div><b>${text}</b>${hint?`<small>${hint}</small>`:""}</div></div>`;
  $("remStatus").innerHTML =
    row(!!getCloudToken(), "Cloud-Sync verbunden", getCloudToken() ? "" : "Sync-Code in der Seitenleiste eintragen — darüber kennt der Server deinen Stand.") +
    row(isStandalone() || !isIOS(), "Als App installiert", isStandalone() ? "" : (isIOS()
      ? "iPhone: in Safari Teilen → „Zum Home-Bildschirm“, dann Ascend vom Homescreen öffnen."
      : "Empfohlen: Browser-Menü → „App installieren“ / „Zum Startbildschirm“.")) +
    row(perm === "granted", "Benachrichtigungen erlaubt", perm === "denied" ? "Blockiert — in den Einstellungen für diese Seite wieder erlauben." : "") +
    row(!!sub, "Dieses Gerät angemeldet", "");
  $("remEnable").textContent = sub ? "Neu anmelden" : "Auf diesem Gerät aktivieren";
  $("remDisable").style.display = sub ? "" : "none";
  $("remTest").disabled = !sub;
  $("remItems").innerHTML = REMINDER_ITEMS.map(([id, ico, lab, hint])=>{
    const it = remItem(id);
    return `<div class="rem-item ${it.on?"":"off"}">
      <button class="cbx ${it.on?"on":""}" data-act="rem-toggle" data-id="${id}" aria-label="${esc(lab)} an/aus">${ICON_CHECK}</button>
      <div class="rem-item-main"><b>${ico} ${esc(lab)}</b><small>${esc(hint)}</small></div>
      <input type="time" data-act="rem-time" data-id="${id}" value="${esc(it.time)}" ${it.on?"":"disabled"}>
    </div>`;
  }).join("");
  $("remMaster").textContent = cfg.enabled ? "Alle Erinnerungen pausieren" : "Erinnerungen wieder einschalten";
  $("remMaster").style.display = sub || cfg.enabled ? "" : "none";
}
function openReminderModal(){ $("reminderModal").classList.add("open"); renderReminderModal(); }
function closeReminderModal(){ $("reminderModal").classList.remove("open"); }

$("remindersBtn").addEventListener("click", ()=>{ openReminderModal(); if(typeof closeSidebar === "function") closeSidebar(); });
$("remClose").addEventListener("click", closeReminderModal);
$("reminderModal").addEventListener("click", e=>{ if(e.target === $("reminderModal")) closeReminderModal(); });
$("remEnable").addEventListener("click", enablePush);
$("remDisable").addEventListener("click", disablePushHere);
$("remTest").addEventListener("click", testPush);
$("remMaster").addEventListener("click", ()=>{
  const cfg = remCfg(); cfg.enabled = !cfg.enabled; save(); cloudSave(true);
  toast(cfg.enabled ? "🔔 Erinnerungen an." : "🔕 Erinnerungen pausiert.");
  renderReminderModal();
});
$("remItems").addEventListener("click", e=>{
  const b = e.target.closest('[data-act="rem-toggle"]'); if(!b) return;
  const cfg = remCfg(), id = b.dataset.id, it = remItem(id);
  cfg.items[id] = { on: !it.on, time: it.time };
  save(); renderReminderModal();
});
$("remItems").addEventListener("change", e=>{
  const el = e.target.closest('[data-act="rem-time"]'); if(!el || !el.value) return;
  const cfg = remCfg(), id = el.dataset.id;
  cfg.items[id] = { on: remItem(id).on, time: el.value };
  save();
});

/* ---------- Deep-Links aus Benachrichtigungen (?go=…) ---------- */
function goTo(target){
  const nav = p => { const b = document.querySelector(`#nav button[data-page="${p}"]`); if(b) b.click(); };
  switch(target){
    case "today":    nav("today"); switchTodayTab("day"); break;
    case "habits":   nav("today"); switchTodayTab("habits"); break;
    case "review":   nav("knowledge"); if(typeof knStartReview === "function" && knDueCards().length) knStartReview(); break;
    case "shutdown": nav("today"); switchTodayTab("day"); if(typeof openShutdown === "function") openShutdown(); break;
    case "friday":   nav("progress"); if(typeof openFridayHighlights === "function") openFridayHighlights(); break;
    case "time":     nav("progress"); setTimeout(()=>{ const c = $("timeCheckCard"); if(c && c.scrollIntoView) c.scrollIntoView({behavior:"smooth"}); }, 200); break;
    case "hustle":   nav("hustle"); break;
  }
}
function handleGoParam(url){
  try{
    const u = new URL(url || location.href);
    const go = u.searchParams.get("go");
    if(!go) return;
    goTo(go);
    u.searchParams.delete("go");
    history.replaceState(null, "", u.pathname + (u.search ? u.search : "") + u.hash);
  }catch(e){}
}
if("serviceWorker" in navigator){
  navigator.serviceWorker.addEventListener("message", e=>{
    if(e.data && e.data.type === "ascend-go") handleGoParam(e.data.url);
  });
}
registerSW();
