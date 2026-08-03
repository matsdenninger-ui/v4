"use strict";
/* ASCEND theme.js — Tageszeit-Farbverlauf */

/* ---------- Tageszeit-Theme: Lila/Orange (morgens) -> Blau/Grün (tags) -> Dunkelblau/Mondgelb (abends) ---------- */
function currentDaytimePeriod(){
  const h = new Date().getHours();
  if(h >= 5 && h < 11) return "morning";
  if(h >= 11 && h < 18) return "day";
  return "evening";
}
function applyDaytimeTheme(){
  document.documentElement.setAttribute("data-period", currentDaytimePeriod());
}
applyDaytimeTheme();
setInterval(applyDaytimeTheme, 5*60*1000); // bei langer Sitzung alle 5 Min. neu prüfen
