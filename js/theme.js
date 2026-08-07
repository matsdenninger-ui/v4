"use strict";
/* ASCEND theme.js — Tageszeit-Farbverlauf & Hell/Dunkel-Umschalter */

/* ---------- Tageszeit-Theme: Lila/Orange (morgens) -> Blau/Grün (tags) -> Blau/Mondgelb (abends) ---------- */
/* Steuert nur die Farbakzente (--ac/--sec); Hell/Dunkel wird separat per Button gewählt. */
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

/* ---------- Hell/Dunkel-Umschalter ---------- */
const LIGHT_THEME_KEY = "ascend_theme";
function applyLightDarkTheme(mode){
  document.documentElement.setAttribute("data-theme", mode);
  $("themeToggleBtn").textContent = mode === "light" ? "☀️ Helles Theme" : "🌙 Dunkles Theme";
}
let savedTheme = "dark";
try{ savedTheme = localStorage.getItem(LIGHT_THEME_KEY) === "light" ? "light" : "dark"; }catch(e){}
applyLightDarkTheme(savedTheme);
$("themeToggleBtn").addEventListener("click", ()=>{
  const next = document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
  try{ localStorage.setItem(LIGHT_THEME_KEY, next); }catch(e){}
  applyLightDarkTheme(next);
});
