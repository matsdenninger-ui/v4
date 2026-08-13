"use strict";
/* ASCEND storage.js — State-Modell, localStorage, Cloud-Sync, Grundinit */

/* ---------- Storage (localStorage mit In-Memory-Fallback) ---------- */
const LS_KEY = "ascend_state_v1";
let memoryFallback = null;

function defaultState(){
  return {
    xp: 0,
    todos: [],                       // {id, text, done, date, estMinutes, focusedMinutes, order}
                                      // date = zugewiesener Tag (YYYY-MM-DD) ODER null = nicht eingeplant
                                      // Weekly Board zeigt To-Dos gruppiert nach date; To-Do-Liste zeigt IMMER alle
    habits: [
      {id: uid(), name: "10 Minuten lesen", dates: {}, note: ""},
      {id: uid(), name: "Bewegung / Training", dates: {}, note: ""},
      {id: uid(), name: "Kein Handy in der ersten Stunde", dates: {}, note: ""},
    ],
    routineAM: [
      {id: uid(), text: "Glas Wasser trinken", note: ""},
      {id: uid(), text: "5 Min. Stretching / Mobility", note: ""},
      {id: uid(), text: "Top-3-Prioritäten festlegen", note: ""},
      {id: uid(), text: "Kalt duschen", note: ""},
    ],
    routinePM: [
      {id: uid(), text: "Bildschirm aus 60 Min. vor dem Schlafen", note: ""},
      {id: uid(), text: "Abendjournal schreiben", note: ""},
      {id: uid(), text: "Morgigen Tag kurz planen", note: ""},
    ],
    routineChecks: {},               // {"2026-07-28": {itemId:true}}
    focusByDate: {},                 // {"date": minutes}
    sessionsByDate: {},              // {"date": count}
    timerStart: null,
    nutrition: { extraKcal:0, extraPro:0, extraCarb:0, extraFat:0, tKcal:2800, tPro:220, tCarb:300, tFat:80, date: todayKey() },
    mealPlan: "",                    // freie Notizen (Ausnahmen, auswärts essen, ...)
    mealSlots: {                     // ausgewählte Variante + Uhrzeit je Slot
      slot1:{idx:0,time:"07:00"}, slot2:{idx:0,time:"10:00"}, slot3:{idx:0,time:"13:00"},
      slot4:{idx:0,time:"16:30"}, slot5:{idx:0,time:"19:30"}, slot6:{idx:0,time:"21:30"},
    },
    mealEaten: {},                   // {"date": {slot1:true, ...}}
    supplements: SUPP_STACK.map(s => ({id: uid(), name:s.name, icon:s.icon, dose:s.dose, when:s.when, body:s.body, time:s.time, dates:{}})),
    hydration: {},                   // {"date": glasses}
    hydroGoal: 8,
    workouts: [],                    // {id, date, name, sets, reps, kg}
    gymPlan: "",
    bodyLog: [],                     // {date, kg, waist, arm}
    sleep: [],                       // {date, hours, quality}
    journal: {},                     // {"date": {m:"", e:""}}
    moods: [],                       // {ts, date, mood, energy, tags:[]}
    learning: [],                    // {id, title, type, progress}
    skills: [
      {cat:"Körper",  items:[{id:uid(),name:"Krafttraining",lvl:0},{id:uid(),name:"Ausdauer",lvl:0},{id:uid(),name:"Mobilität",lvl:0}]},
      {cat:"Geist",   items:[{id:uid(),name:"Fokus",lvl:0},{id:uid(),name:"Meditation",lvl:0},{id:uid(),name:"Schreiben",lvl:0}]},
      {cat:"Karriere",items:[{id:uid(),name:"Programmieren",lvl:0},{id:uid(),name:"Kommunikation",lvl:0},{id:uid(),name:"Finanzen",lvl:0}]},
    ],
    people: [],                      // {id, name, last}
    goals: [],                       // {id, title, type, skillId, ms:[{text,done}], progress, actionTodos:[{id,text,done}], skillXPGranted}
    knowledge: [],                   // {id, title, notes:"", todos:[{id,text,done}]}
    badges: {},                      // {badgeId: dateUnlocked}
    profile: { name: "", avatar: "🔥" },
  };
}

function loadState(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    if(raw){ return Object.assign(defaultState(), JSON.parse(raw)); }
  }catch(e){ /* localStorage nicht verfügbar (z. B. Sandbox) */ }
  return memoryFallback ? memoryFallback : defaultState();
}
function save(){
  try{ localStorage.setItem(LS_KEY, JSON.stringify(S)); }
  catch(e){ memoryFallback = S; }
  cloudSave();
}


/* ============================================================
   Cloud-Sync (optional) — synchronisiert S über /api/state,
   sobald die Datei auf Vercel gehostet ist und ein Sync-Code
   gesetzt wurde. Läuft rein additiv: ohne Verbindung verhält
   sich alles exakt wie vorher (nur localStorage).
   ============================================================ */
const CLOUD_TOKEN_KEY = "ascend_sync_code";
let cloudSaveTimer = null;
let cloudSyncing = false;

function getCloudToken(){
  try{ return localStorage.getItem(CLOUD_TOKEN_KEY) || ""; }catch(e){ return ""; }
}
function setSyncStatus(text, cls){
  const el = $("syncStatus");
  if(!el) return;
  el.textContent = text;
  el.className = "sync-status" + (cls ? " "+cls : "");
}

function cloudSave(){
  const token = getCloudToken();
  if(!token) return;
  clearTimeout(cloudSaveTimer);
  cloudSaveTimer = setTimeout(async ()=>{
    try{
      const res = await fetch("/api/state", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
        body: JSON.stringify(S)
      });
      if(!res.ok) throw new Error("HTTP "+res.status);
      setSyncStatus("☁️ Synchronisiert · " + new Date().toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"}), "ok");
    }catch(e){
      setSyncStatus("☁️ Sync fehlgeschlagen — offline gespeichert", "err");
    }
  }, 900); // gebündelt, damit nicht bei jedem Tastendruck gesendet wird
}

async function cloudLoad(silent){
  const token = getCloudToken();
  if(!token) return;
  if(!silent) setSyncStatus("☁️ Verbinde …");
  try{
    const res = await fetch("/api/state", { headers: { "Authorization": "Bearer " + token } });
    if(res.status === 401){ setSyncStatus("☁️ Falscher Sync-Code", "err"); return; }
    if(!res.ok) throw new Error("HTTP "+res.status);
    const json = await res.json();
    if(json.data){
      S = Object.assign(defaultState(), json.data);
      save0(); // nur lokal cachen, kein erneutes Hochladen auslösen
      openMealSlot = null;
      renderAll();
      checkBadges();
    }
    setSyncStatus("☁️ Verbunden · " + new Date().toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"}), "ok");
  }catch(e){
    setSyncStatus("☁️ Verbindung fehlgeschlagen", "err");
  }
}
function save0(){
  try{ localStorage.setItem(LS_KEY, JSON.stringify(S)); }catch(e){ memoryFallback = S; }
}

function initCloudSync(){
  const token = getCloudToken();
  if($("syncCode")) $("syncCode").value = token ? "••••••••" : "";
  if(token){ cloudLoad(); }
  $("syncConnect").addEventListener("click", async ()=>{
    const val = $("syncCode").value.trim();
    if(!val || val === "••••••••") return;
    try{ localStorage.setItem(CLOUD_TOKEN_KEY, val); }catch(e){}
    $("syncCode").value = "••••••••";
    await cloudLoad();
    cloudSave(); // eigenen Stand direkt spiegeln, falls Cloud noch leer war
    toast("Sync-Code gespeichert.");
  });
}


let S = loadState();
const $ = id => document.getElementById(id);