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
  updateFavicon();
}

/* Browser-Tab-Icon im Logo „Gipfel“ — in den aktuellen Tageszeit-Farben.
   (Das Homescreen-Icon ist ein festes Bild: Betriebssysteme speichern es
   beim Installieren und laden es nicht neu.) */
var lastFavKey = "";   // var: wird schon beim ersten applyDaytimeTheme() oben gebraucht
function updateFavicon(){
  const link = document.getElementById("favIcon");
  if(!link) return;
  const cs = getComputedStyle(document.documentElement);
  const ac = cs.getPropertyValue("--ac").trim() || "#9B5DE5";
  const sec = cs.getPropertyValue("--sec").trim() || "#F15A29";
  const light = document.documentElement.getAttribute("data-theme") === "light";
  const key = ac + sec + light;
  if(key === lastFavKey) return;
  lastFavKey = key;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">`
    + `<defs><linearGradient id="g" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="${ac}"/><stop offset="1" stop-color="${sec}"/></linearGradient>`
    + `<mask id="m" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100"><rect width="100" height="100" fill="#fff"/>`
    + `<polyline points="30,88 44,70 55,77 67,56" fill="none" stroke="#000" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></mask></defs>`
    + `<rect width="100" height="100" rx="22" fill="${light ? "#F6F4FC" : "#0A090F"}"/>`
    + `<g transform="translate(10 8) scale(.8)"><path d="M50 24 L88 88 L12 88 Z" fill="url(#g)" stroke="url(#g)" stroke-width="7" stroke-linejoin="round" mask="url(#m)"/>`
    + `<circle cx="50" cy="10" r="6.5" fill="${light ? "#211D30" : "#F5F3FA"}"/></g></svg>`;
  link.type = "image/svg+xml";
  link.removeAttribute("sizes");
  link.href = "data:image/svg+xml," + encodeURIComponent(svg);
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
  updateFavicon();
});
updateFavicon();   // nach dem Hell/Dunkel-Start nochmal, damit der Tab-Hintergrund passt
