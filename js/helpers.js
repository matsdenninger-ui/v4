"use strict";
/* ASCEND helpers.js — Datums-/Formatierungs-Hilfsfunktionen */

/* ---------- Helpers ---------- */
function uid(){
  if(window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID().slice(0,12);
  return Math.random().toString(36).slice(2,10);
}
function todayKey(d){ d = d || new Date(); 
  return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); }
function dateFromKey(k){ const [y,m,dd]=k.split("-").map(Number); return new Date(y,m-1,dd); }
function addDays(d,n){ const x=new Date(d); x.setDate(x.getDate()+n); return x; }
function fmtShort(k){ const d=dateFromKey(k); return d.getDate()+"."+(d.getMonth()+1)+"."; }
function esc(s){ return String(s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function h1(n){ return (Math.round(n*10)/10).toLocaleString("de-DE",{minimumFractionDigits:1,maximumFractionDigits:1}); }
function weekKey(d){ d=d||new Date(); const x=new Date(d); const day=(x.getDay()+6)%7; x.setDate(x.getDate()-day);
  return todayKey(x); }
function lastNDates(n){ const out=[]; for(let i=n-1;i>=0;i--) out.push(todayKey(addDays(new Date(),-i))); return out; }
