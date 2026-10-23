"use strict";
/* ASCEND career.js — Friday Highlights & 4-Punkte-Update
   Beides baut Texte aus Daten, die Ascend ohnehin hat (erledigte Outcomes,
   Fokuszeit, Check-ins, Debrief-Beweise, offene Subtasks). Ergebnis ist ein
   editierbarer Text zum Kopieren — Ascend verschickt nichts selbst. */

/* ---------- Gemeinsames Text-Modal ---------- */
function openShareModal(title, sub, text){
  $("shareTitle").textContent = title;
  $("shareSub").textContent = sub;
  $("shareText").value = text;
  $("shareModal").classList.add("open");
}
function closeShareModal(){ $("shareModal").classList.remove("open"); }
function copyText(text){
  const fallback = ()=>{
    const ta = $("shareText");
    ta.focus(); ta.select();
    let ok = false;
    try{ ok = document.execCommand("copy"); }catch(e){}
    toast(ok ? "Kopiert." : "Markiere den Text und kopiere ihn von Hand.");
  };
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(()=>toast("Kopiert — jetzt in Mail oder Chat einfügen."), fallback);
  } else fallback();
}
$("shareCopy").addEventListener("click", ()=>copyText($("shareText").value));
$("shareClose").addEventListener("click", closeShareModal);
$("shareModal").addEventListener("click", e=>{ if(e.target === $("shareModal")) closeShareModal(); });

/* ---------- Hilfen ---------- */
function isoWeek(d){
  const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = x.getUTCDay() || 7;
  x.setUTCDate(x.getUTCDate() + 4 - day);
  const yStart = new Date(Date.UTC(x.getUTCFullYear(), 0, 1));
  return Math.ceil(((x - yStart) / 864e5 + 1) / 7);
}
/* Wann wurde ein To-Do erledigt? Neu: done_at. Ältere Einträge kennen das Feld
   nicht — dann zählt der zugewiesene Tag. */
function doneWithin(t, startMs, days){
  if(!t.done) return false;
  if(t.done_at) return t.done_at >= startMs;
  return !!t.date && days.includes(t.date);
}
function bullets(list, empty){ return list.length ? list.map(x=>"• " + x).join("\n") : "• " + empty; }

/* ============================================================
   Friday Highlights
   Kurze Mail an Vorgesetzte: was lief, was kommt. Baut Vertrauen,
   macht Fortschritt sichtbar und ist am Jahresende die Vorlage
   fürs Mitarbeitergespräch.
   ============================================================ */
function buildFridayHighlights(){
  const days = lastNDates(7);
  const startMs = dateFromKey(days[0]).getTime();
  const tk = todayKey();
  const name = (S.profile && S.profile.name) || "";

  // Erledigte Ergebnisse (eigenständige Aufgaben, keine Subtasks)
  const erledigt = S.todos.filter(t=>!t.parent_id && doneWithin(t, startMs, days))
    .sort((a,b)=>(b.is_outcome?1:0)-(a.is_outcome?1:0));
  const subsDone = S.todos.filter(t=>t.parent_id && doneWithin(t, startMs, days)).length;
  const highlights = erledigt.slice(0, 8).map(t=>{
    const g = t.goal_id ? S.goals.find(x=>x.id===t.goal_id) : null;
    return t.text + (g ? " (→ " + g.title + ")" : "");
  });
  if(erledigt.length > 8) highlights.push("… und " + (erledigt.length - 8) + " weitere Aufgaben");
  if(subsDone) highlights.push(subsDone + (subsDone===1 ? " Teilschritt" : " Teilschritte") + " abgeschlossen");

  const focusMin = days.reduce((s,k)=>s+(S.focusByDate[k]||0), 0);
  const sessions = days.reduce((s,k)=>s+(S.sessionsByDate[k]||0), 0);
  if(focusMin >= 30) highlights.push(h1(focusMin/60) + " h konzentrierte Arbeit in " + sessions + " Session" + (sessions===1?"":"s"));

  const kontakte = S.people.filter(p=>p.last && days.includes(p.last)).map(p=>p.name);
  const netzwerk = kontakte.length ? ["Austausch mit: " + kontakte.join(", ")] : [];

  // Ausblick: Geplantes der nächsten 7 Tage + offene Outcomes + aktive Fokus-Ziele
  const ab = todayKey(addDays(new Date(), 1)), bis = todayKey(addDays(new Date(), 7));
  const geplant = S.todos.filter(t=>!t.parent_id && !t.done && t.date && t.date >= ab && t.date <= bis)
    .sort((a,b)=>a.date.localeCompare(b.date)).slice(0, 6).map(t=>t.text);
  const offenHeute = S.todos.filter(t=>t.is_outcome && !t.done && t.date === tk).map(t=>t.text + " (weiterführen)");
  const fokus = S.goals.filter(g=>g.type === "fokus" && goalProgress(g) < 100)
    .map(g=>"Weiter an „" + g.title + "“ (" + goalProgress(g) + " %)");
  const ausblick = [...new Set([...offenHeute, ...geplant, ...fokus])].slice(0, 7);

  return [
    "Betreff: Friday Highlights · KW " + isoWeek(new Date()),
    "",
    "Hallo [Name],",
    "",
    "hier mein kurzer Wochenrückblick:",
    "",
    "1) Highlights dieser Woche",
    bullets(highlights.concat(netzwerk), "[hier eintragen — diese Woche ist noch nichts abgehakt]"),
    "",
    "2) Geplant für nächste Woche",
    bullets(ausblick, "[hier eintragen]"),
    "",
    "Wenn du zu einem Punkt mehr wissen willst, sag gern Bescheid.",
    "",
    "Schönes Wochenende" + (name ? "\n" + name : "!"),
  ].join("\n");
}
function openFridayHighlights(){
  openShareModal("📨 Friday Highlights",
    "Aus deinen Daten der letzten 7 Tage vorbereitet. Ergänze, was fehlt, und schick es an deine Führungskraft.",
    buildFridayHighlights());
}
$("fridayBtn").addEventListener("click", openFridayHighlights);

/* Freitag ab Mittag ein Hinweis auf Today (hero.js) */
function fridayChip(){
  const d = new Date();
  if(d.getDay() !== 5 || d.getHours() < 12) return "";
  return `<div class="hchip clickable" data-act="friday-open">📨 <b>Friday Highlights</b> schreiben →</div>`;
}

/* ============================================================
   4-Punkte-Update zu einer Aufgabe
   Wer viel um die Ohren hat, weiß oft nicht mehr, was er angefragt
   hat. Darum immer: Auftrag · erledigt · Risiken · nächste Schritte.
   ============================================================ */
function buildFourBullet(taskId){
  const t = S.todos.find(x=>x.id===taskId);
  if(!t) return "";
  const g = t.goal_id ? S.goals.find(x=>x.id===t.goal_id) : null;
  const kids = outcomeChildren(t.id);
  const fertig = kids.filter(k=>k.done).map(k=>k.text);
  const offen = kids.filter(k=>!k.done).map(k=>k.text);
  const beweise = (S.focusSessions||[]).filter(s=>s.outcome_task_id===t.id && s.evidence_text).map(s=>s.evidence_text);
  const getan = fertig.slice();
  if(t.focusedMinutes) getan.push(t.focusedMinutes + " Min. fokussierte Arbeit");
  beweise.slice(0, 3).forEach(b=>getan.push(b));
  if(t.done) getan.push("Abgeschlossen ✓");
  return [
    "Kurzes Update zu „" + t.text + "“",
    "",
    "• Auftrag: " + t.text + (g ? " (Ziel: " + g.title + ")" : ""),
    "• Erledigt: " + (getan.length ? getan.join("; ") : "[hier eintragen]"),
    "• Risiken / Blocker: [keine bekannt — oder hier eintragen]",
    "• Mit mehr Zeit als Nächstes: " + (offen.length ? offen.slice(0, 3).join("; ") : (t.done ? "nichts offen" : "[nächsten Schritt eintragen]")),
  ].join("\n");
}
function openFourBullet(taskId){
  const t = S.todos.find(x=>x.id===taskId);
  if(!t) return;
  openShareModal("📨 4-Punkte-Update",
    "Auftrag · Erledigt · Risiken · Nächste Schritte — die Risiken weißt nur du, die bitte ergänzen.",
    buildFourBullet(taskId));
}
