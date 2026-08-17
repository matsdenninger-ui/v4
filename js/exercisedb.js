"use strict";
/* ASCEND exercisedb.js — Übungsdatenbank, Muskelgruppen & Trainingsplan-Vorlagen */

/* ============================================================
   MUSKELGRUPPEN
   Farben werden für Charts, Chips und Übungs-Icons genutzt.
   ============================================================ */
const MUSCLES = {
  brust:     { label:"Brust",     color:"#F15A29", icon:"🫀" },
  ruecken:   { label:"Rücken",    color:"#9B5DE5", icon:"🦅" },
  beine:     { label:"Beine",     color:"#34D399", icon:"🦵" },
  schultern: { label:"Schultern", color:"#60A5FA", icon:"🪖" },
  bizeps:    { label:"Bizeps",    color:"#FBBF24", icon:"💪" },
  trizeps:   { label:"Trizeps",   color:"#F472B6", icon:"🔱" },
  rumpf:     { label:"Rumpf",     color:"#22D3EE", icon:"🧱" },
  cardio:    { label:"Cardio",    color:"#A3E635", icon:"🫁" },
  mobility:  { label:"Mobility",  color:"#94A3B8", icon:"🧘" },
};

/* ============================================================
   ÜBUNGSDATENBANK
   id      — stabiler Schlüssel
   m       — Muskelgruppe (Key aus MUSCLES)
   eq      — Equipment
   type    — "grund" (mehrgelenkig) | "iso" (isoliert)
   unit    — "reps" (kg × Wdh.) | "time" (Minuten × km/Intensität)
   cue     — Ausführungs-Hinweis, wird in der Session eingeblendet
   ============================================================ */
const EX_DB = [
  /* ---------- Brust ---------- */
  {id:"bench-bb",    name:"Bankdrücken (Langhantel)", m:"brust", eq:"Langhantel", type:"grund", cue:"Schulterblätter zusammenziehen, Ellbogen ca. 45° am Körper, Stange zur unteren Brust."},
  {id:"bench-db",    name:"Bankdrücken (Kurzhantel)", m:"brust", eq:"Kurzhantel", type:"grund", cue:"Größere Bewegungsamplitude als mit der Langhantel — unten kurz dehnen lassen."},
  {id:"incline-bb",  name:"Schrägbankdrücken (LH)",   m:"brust", eq:"Langhantel", type:"grund", cue:"30–40° Neigung. Steiler trainiert eher die vordere Schulter."},
  {id:"incline-db",  name:"Schrägbankdrücken (KH)",   m:"brust", eq:"Kurzhantel", type:"grund", cue:"Handflächen leicht zueinander drehen — schont die Schulter."},
  {id:"dips",        name:"Dips",                     m:"brust", eq:"Barren",     type:"grund", cue:"Oberkörper leicht nach vorn neigen = mehr Brust, aufrecht = mehr Trizeps."},
  {id:"pushup",      name:"Liegestütze",              m:"brust", eq:"Körpergewicht", type:"grund", cue:"Körper bleibt eine Linie. Ellbogen nicht ausstellen."},
  {id:"fly-cable",   name:"Kabelzug-Fliegende",       m:"brust", eq:"Kabel",      type:"iso",   cue:"Leichte Ellbogenbeugung halten und diese über die ganze Bewegung nicht verändern."},
  {id:"chest-press", name:"Brustpresse (Maschine)",   m:"brust", eq:"Maschine",   type:"grund", cue:"Griffe auf Brustwarzenhöhe einstellen, Schultern hinten lassen."},

  /* ---------- Rücken ---------- */
  {id:"deadlift",    name:"Kreuzheben",               m:"ruecken", eq:"Langhantel", type:"grund", cue:"Stange am Schienbein entlang, Rücken neutral, Bewegung aus Hüfte und Beinen."},
  {id:"pullup",      name:"Klimmzüge",                m:"ruecken", eq:"Klimmzugstange", type:"grund", cue:"Brust zur Stange führen, Schulterblätter zuerst nach unten ziehen."},
  {id:"latpull",     name:"Latzug",                   m:"ruecken", eq:"Kabel",      type:"grund", cue:"Nicht am Gewicht hängen — kontrolliert bis zum oberen Brustbein ziehen."},
  {id:"row-bb",      name:"Langhantelrudern",         m:"ruecken", eq:"Langhantel", type:"grund", cue:"Oberkörper ca. 45°, Stange zum Bauchnabel, Rücken bleibt fest."},
  {id:"row-db",      name:"Kurzhantelrudern",         m:"ruecken", eq:"Kurzhantel", type:"grund", cue:"Ellbogen eng am Körper nach hinten, oben kurz halten."},
  {id:"row-cable",   name:"Kabelrudern sitzend",      m:"ruecken", eq:"Kabel",      type:"grund", cue:"Brust raus, kein Schwung aus dem unteren Rücken."},
  {id:"tbar",        name:"T-Bar-Rudern",             m:"ruecken", eq:"Langhantel", type:"grund", cue:"Schwerer Rückenaufbau — Bauch anspannen, Hüfte stabil."},
  {id:"facepull",    name:"Face Pulls",               m:"ruecken", eq:"Kabel",      type:"iso",   cue:"Seil zur Stirn ziehen, Daumen nach hinten. Bester Schutz für gesunde Schultern."},
  {id:"pullover",    name:"Überzüge",                 m:"ruecken", eq:"Kurzhantel", type:"iso",   cue:"Nur die Arme bewegen sich, Rippen bleiben unten."},
  {id:"hyperext",    name:"Rückenstrecker (Hyper)",   m:"ruecken", eq:"Bank",       type:"iso",   cue:"Nur bis zur geraden Linie hochkommen, nicht überstrecken."},

  /* ---------- Beine ---------- */
  {id:"squat-bb",    name:"Kniebeugen (Langhantel)",  m:"beine", eq:"Langhantel", type:"grund", cue:"Knie folgen den Fußspitzen, Tiefe mindestens bis Oberschenkel parallel."},
  {id:"frontsquat",  name:"Frontkniebeugen",          m:"beine", eq:"Langhantel", type:"grund", cue:"Ellbogen hoch, Oberkörper aufrecht — starker Quadrizeps-Reiz."},
  {id:"legpress",    name:"Beinpresse",               m:"beine", eq:"Maschine",   type:"grund", cue:"Unterer Rücken bleibt am Polster, Knie nicht durchdrücken."},
  {id:"rdl",         name:"Rumänisches Kreuzheben",   m:"beine", eq:"Langhantel", type:"grund", cue:"Hüfte weit nach hinten, leichte Kniebeugung, Dehnung in den Beinbeugern spüren."},
  {id:"lunge",       name:"Ausfallschritte",          m:"beine", eq:"Kurzhantel", type:"grund", cue:"Großer Schritt, hinteres Knie fast zum Boden, Oberkörper aufrecht."},
  {id:"bulgarian",   name:"Bulgarian Split Squat",    m:"beine", eq:"Kurzhantel", type:"grund", cue:"Hinteres Bein erhöht — brutal effektiv für Beine und Balance."},
  {id:"legext",      name:"Beinstrecker",             m:"beine", eq:"Maschine",   type:"iso",   cue:"Oben 1 Sekunde halten und maximal anspannen."},
  {id:"legcurl",     name:"Beinbeuger",               m:"beine", eq:"Maschine",   type:"iso",   cue:"Langsam ablassen — die exzentrische Phase bringt den Reiz."},
  {id:"hipthrust",   name:"Hip Thrust",               m:"beine", eq:"Langhantel", type:"grund", cue:"Oben Gesäß fest anspannen, Rippen unten lassen, Kinn zur Brust."},
  {id:"calf",        name:"Wadenheben stehend",       m:"beine", eq:"Maschine",   type:"iso",   cue:"Volle Dehnung unten, oben 2 Sekunden halten."},
  {id:"gobletsquat", name:"Goblet Squat",             m:"beine", eq:"Kettlebell", type:"grund", cue:"Gewicht vor der Brust hilft, aufrecht zu bleiben — ideal zum Technik-Lernen."},

  /* ---------- Schultern ---------- */
  {id:"ohp",         name:"Schulterdrücken (LH)",     m:"schultern", eq:"Langhantel", type:"grund", cue:"Gesäß und Bauch fest, Kopf leicht zurück, Stange über Ohrhöhe drücken."},
  {id:"ohp-db",      name:"Schulterdrücken (KH)",     m:"schultern", eq:"Kurzhantel", type:"grund", cue:"Nicht ins Hohlkreuz gehen — Rippen bleiben unten."},
  {id:"arnold",      name:"Arnold Press",             m:"schultern", eq:"Kurzhantel", type:"grund", cue:"Rotation beim Hochdrücken, trifft alle drei Schulterköpfe."},
  {id:"lateral",     name:"Seitheben",                m:"schultern", eq:"Kurzhantel", type:"iso",   cue:"Leicht, sauber, hohes Volumen. Kleiner Finger führt, nicht schwingen."},
  {id:"rearfly",     name:"Reverse Flys",             m:"schultern", eq:"Kurzhantel", type:"iso",   cue:"Hintere Schulter — Gegenspieler zum vielen Drücken."},
  {id:"shrug",       name:"Shrugs",                   m:"schultern", eq:"Kurzhantel", type:"iso",   cue:"Gerade nach oben zucken, oben 1 Sekunde halten, nicht kreisen."},

  /* ---------- Bizeps ---------- */
  {id:"curl-bb",     name:"Langhantel-Curls",         m:"bizeps", eq:"Langhantel", type:"iso", cue:"Ellbogen bleiben am Körper fixiert, kein Schwung aus der Hüfte."},
  {id:"curl-db",     name:"Kurzhantel-Curls",         m:"bizeps", eq:"Kurzhantel", type:"iso", cue:"Oben aussenrotieren (Supination) für maximale Kontraktion."},
  {id:"hammer",      name:"Hammer-Curls",             m:"bizeps", eq:"Kurzhantel", type:"iso", cue:"Neutraler Griff — trainiert Brachialis und macht den Arm dicker."},
  {id:"preacher",    name:"Scott-Curls",              m:"bizeps", eq:"Bank",       type:"iso", cue:"Arm nie ganz durchstrecken, Spannung halten."},
  {id:"cable-curl",  name:"Kabel-Curls",              m:"bizeps", eq:"Kabel",      type:"iso", cue:"Konstante Spannung über die volle Bewegung — perfekt als Abschluss."},

  /* ---------- Trizeps ---------- */
  {id:"pushdown",    name:"Trizepsdrücken am Kabel",  m:"trizeps", eq:"Kabel",      type:"iso",   cue:"Oberarme fixiert, unten kurz halten und maximal anspannen."},
  {id:"skullcrusher",name:"Skullcrusher",             m:"trizeps", eq:"SZ-Stange",  type:"iso",   cue:"Stange hinter die Stirn führen, Ellbogen zeigen konstant nach vorn."},
  {id:"overhead-tri",name:"Überkopf-Trizepsdrücken",  m:"trizeps", eq:"Kabel",      type:"iso",   cue:"Langer Trizepskopf wird nur in der Dehnung über Kopf richtig getroffen."},
  {id:"closegrip",   name:"Enges Bankdrücken",        m:"trizeps", eq:"Langhantel", type:"grund", cue:"Schulterbreiter Griff, Ellbogen eng führen."},
  {id:"benchdip",    name:"Bankdips",                 m:"trizeps", eq:"Körpergewicht", type:"grund", cue:"Schultern unten lassen, nicht zu tief gehen."},

  /* ---------- Rumpf ---------- */
  {id:"plank",       name:"Plank",                    m:"rumpf", eq:"Körpergewicht", type:"iso", unit:"time", cue:"Gesäß anspannen, Becken leicht aufrichten — Zeit in Minuten loggen."},
  {id:"hanging-leg", name:"Hängendes Beinheben",      m:"rumpf", eq:"Klimmzugstange", type:"iso", cue:"Becken am Ende einrollen, nicht nur die Beine heben."},
  {id:"cable-crunch",name:"Kabel-Crunch",             m:"rumpf", eq:"Kabel",      type:"iso", cue:"Wirbel für Wirbel einrollen, Hüfte bleibt still."},
  {id:"abwheel",     name:"Ab Wheel Rollout",         m:"rumpf", eq:"Ab Wheel",   type:"iso", cue:"Nur so weit rollen, wie der untere Rücken neutral bleibt."},
  {id:"russian",     name:"Russian Twists",           m:"rumpf", eq:"Kurzhantel", type:"iso", cue:"Rotation aus dem Rumpf, nicht nur die Arme bewegen."},
  {id:"sideplank",   name:"Seitstütz",                m:"rumpf", eq:"Körpergewicht", type:"iso", unit:"time", cue:"Hüfte hoch, Körper in einer Linie. Zeit pro Seite loggen."},
  {id:"deadbug",     name:"Dead Bug",                 m:"rumpf", eq:"Körpergewicht", type:"iso", cue:"Unterer Rücken bleibt am Boden — langsam und kontrolliert."},

  /* ---------- Cardio ---------- */
  {id:"run",         name:"Laufen",                   m:"cardio", eq:"Outdoor",  type:"grund", unit:"time", cue:"Zone 2: Du kannst dich noch unterhalten. Baut die aerobe Basis."},
  {id:"bike",        name:"Radfahren / Ergometer",    m:"cardio", eq:"Ergometer", type:"grund", unit:"time", cue:"Gelenkschonende Ausdauer — ideal an Beintag-freien Tagen."},
  {id:"rowerg",      name:"Rudergerät",               m:"cardio", eq:"Ergometer", type:"grund", unit:"time", cue:"Reihenfolge: Beine – Rumpf – Arme. Zurück genau umgekehrt."},
  {id:"hiit",        name:"HIIT-Intervalle",          m:"cardio", eq:"Frei",     type:"grund", unit:"time", cue:"z. B. 8 × 30 s Vollgas / 90 s locker. Maximal 2× pro Woche."},
  {id:"walk",        name:"Zügiges Gehen (Zone 1)",   m:"cardio", eq:"Outdoor",  type:"grund", unit:"time", cue:"Unterschätzter Regenerationsbooster — 30–60 Min. nach dem Training."},
  {id:"jumprope",    name:"Seilspringen",             m:"cardio", eq:"Springseil", type:"grund", unit:"time", cue:"Kurze Bodenkontakte, aus den Waden federn."},
  {id:"stairs",      name:"Stepper / Treppen",        m:"cardio", eq:"Maschine",  type:"grund", unit:"time", cue:"Nicht auf die Griffe stützen — sonst halbiert sich der Effekt."},
  {id:"swim",        name:"Schwimmen",                m:"cardio", eq:"Wasser",    type:"grund", unit:"time", cue:"Ganzkörper, null Gelenkbelastung. Perfekt für Deload-Wochen."},

  /* ---------- Mobility ---------- */
  {id:"mobility",    name:"Mobility-Flow",            m:"mobility", eq:"Frei",     type:"iso", unit:"time", cue:"Hüfte, Brustwirbelsäule, Schultern — 8–10 Min. reichen."},
  {id:"foamroll",    name:"Faszienrolle",             m:"mobility", eq:"Blackroll", type:"iso", unit:"time", cue:"Langsam rollen, an harten Stellen 20–30 s verweilen."},
  {id:"stretch",     name:"Dehnen (statisch)",        m:"mobility", eq:"Frei",     type:"iso", unit:"time", cue:"Nach dem Training oder an freien Tagen, je Position 30–60 s."},
];

const EX_BY_ID = {};
EX_DB.forEach(e => { EX_BY_ID[e.id] = e; });

function exById(id){ return EX_BY_ID[id] || null; }
function exUnit(ex){ return (ex && ex.unit) || "reps"; }
function muscleMeta(key){ return MUSCLES[key] || {label:"Sonstiges", color:"#8b8398", icon:"🏋️"}; }

/* Freitext-Übungen (Schnell-Log) einer Muskelgruppe zuordnen, damit die
   Verteilungs-Charts auch alte Einträge sinnvoll einsortieren. */
function muscleOfName(name){
  const hit = EX_DB.find(e => e.name.toLowerCase() === String(name).toLowerCase());
  if(hit) return hit.m;
  const n = String(name).toLowerCase();
  const map = [
    [/bank|brust|flie|dip|liege|push.?up|press/, "brust"],
    [/rücken|rudern|latz|klimm|kreuzheb|row|pull|überzug/, "ruecken"],
    [/bein|knie|squat|hocke|wade|hip ?thrust|lunge|ausfall|rdl/, "beine"],
    [/schulter|seitheb|press|delt|nacken|shrug|arnold/, "schultern"],
    [/bizeps|curl/, "bizeps"],
    [/trizeps|skull|pushdown/, "trizeps"],
    [/bauch|core|plank|crunch|rumpf/, "rumpf"],
    [/lauf|cardio|rad|row|hiit|schwimm|seilspring|geh/, "cardio"],
    [/mobil|dehn|stretch|faszien/, "mobility"],
  ];
  for(const [re, key] of map){ if(re.test(n)) return key; }
  return "brust";
}

/* ============================================================
   TRAININGSPLAN-VORLAGEN
   ex: [Übungs-ID, Sätze, Ziel-Wiederholungen, Pause in Sekunden]
   days: Wochentage (0 = Sonntag … 6 = Samstag)
   ============================================================ */
const SPLITS = {
  ppl: {
    name: "Push / Pull / Legs",
    badge: "3–6× pro Woche",
    desc: "Der Klassiker für Fortgeschrittene: Drücken, Ziehen, Beine. Funktioniert als 3er- oder als 6er-Woche.",
    days: [
      { name:"Push", icon:"🔥", focus:"Brust · Schultern · Trizeps", weekdays:[1,4], ex:[
        ["bench-bb",4,6,150],["incline-db",3,10,120],["ohp-db",3,10,120],
        ["lateral",4,15,60],["pushdown",3,12,60],["overhead-tri",3,12,60]]},
      { name:"Pull", icon:"🦅", focus:"Rücken · Bizeps · hintere Schulter", weekdays:[2,5], ex:[
        ["deadlift",3,5,180],["pullup",4,8,120],["row-bb",3,10,120],
        ["facepull",3,15,60],["curl-bb",3,10,60],["hammer",3,12,60]]},
      { name:"Legs", icon:"🦵", focus:"Beine · Rumpf", weekdays:[3,6], ex:[
        ["squat-bb",4,6,180],["rdl",3,10,120],["legpress",3,12,120],
        ["legcurl",3,12,60],["calf",4,15,45],["hanging-leg",3,12,60]]},
    ]
  },
  ul: {
    name: "Upper / Lower",
    badge: "4× pro Woche",
    desc: "Bester Kompromiss aus Frequenz und Erholung. Jede Muskelgruppe wird zweimal pro Woche getroffen.",
    days: [
      { name:"Oberkörper A", icon:"💪", focus:"schwer drücken & ziehen", weekdays:[1], ex:[
        ["bench-bb",4,6,150],["row-bb",4,8,120],["ohp",3,8,120],
        ["latpull",3,10,90],["curl-db",3,12,60],["pushdown",3,12,60]]},
      { name:"Unterkörper A", icon:"🦵", focus:"Kniebeuge-Fokus", weekdays:[2], ex:[
        ["squat-bb",4,6,180],["rdl",3,10,120],["legext",3,12,60],
        ["calf",4,15,45],["abwheel",3,10,60]]},
      { name:"Oberkörper B", icon:"🏹", focus:"Volumen & Details", weekdays:[4], ex:[
        ["incline-db",4,10,120],["pullup",4,8,120],["chest-press",3,12,90],
        ["row-cable",3,12,90],["lateral",4,15,60],["hammer",3,12,60]]},
      { name:"Unterkörper B", icon:"⚡", focus:"Hüfte & hintere Kette", weekdays:[5], ex:[
        ["deadlift",3,5,180],["hipthrust",4,10,120],["bulgarian",3,10,90],
        ["legcurl",3,12,60],["hanging-leg",3,12,60]]},
    ]
  },
  fullbody: {
    name: "Ganzkörper 3×",
    badge: "3× pro Woche",
    desc: "Ideal für Einsteiger und Vielbeschäftigte: wenige Grundübungen, jede Einheit trainiert den ganzen Körper.",
    days: [
      { name:"Ganzkörper A", icon:"🅰️", focus:"Kniebeuge & Bankdrücken", weekdays:[1], ex:[
        ["squat-bb",3,8,150],["bench-bb",3,8,150],["row-bb",3,10,120],
        ["lateral",3,15,60],["plank",3,1,45]]},
      { name:"Ganzkörper B", icon:"🅱️", focus:"Kreuzheben & Schulterdrücken", weekdays:[3], ex:[
        ["deadlift",3,5,180],["ohp",3,8,150],["latpull",3,10,120],
        ["legcurl",3,12,60],["curl-db",3,12,60]]},
      { name:"Ganzkörper C", icon:"🅲", focus:"Beinpresse & Dips", weekdays:[5], ex:[
        ["legpress",3,12,120],["dips",3,10,120],["row-cable",3,12,90],
        ["facepull",3,15,60],["hanging-leg",3,12,60]]},
    ]
  },
  bro: {
    name: "5er-Split",
    badge: "5× pro Woche",
    desc: "Eine Muskelgruppe pro Tag mit hohem Volumen. Für Fortgeschrittene mit viel Zeit im Gym.",
    days: [
      { name:"Brust", icon:"🫀", focus:"Brust komplett", weekdays:[1], ex:[
        ["bench-bb",4,8,150],["incline-db",4,10,120],["chest-press",3,12,90],["fly-cable",3,15,60],["dips",3,10,90]]},
      { name:"Rücken", icon:"🦅", focus:"Breite & Dicke", weekdays:[2], ex:[
        ["pullup",4,8,120],["row-bb",4,10,120],["latpull",3,12,90],["row-cable",3,12,90],["facepull",3,15,60]]},
      { name:"Beine", icon:"🦵", focus:"Quadrizeps & hintere Kette", weekdays:[3], ex:[
        ["squat-bb",4,8,180],["legpress",4,12,120],["rdl",3,10,120],["legcurl",3,12,60],["calf",4,15,45]]},
      { name:"Schultern", icon:"🪖", focus:"alle drei Köpfe", weekdays:[4], ex:[
        ["ohp",4,8,150],["lateral",4,15,60],["rearfly",4,15,60],["arnold",3,10,90],["shrug",3,12,60]]},
      { name:"Arme", icon:"💪", focus:"Bizeps & Trizeps", weekdays:[5], ex:[
        ["curl-bb",4,10,60],["skullcrusher",4,10,60],["hammer",3,12,60],["pushdown",3,12,60],["cable-curl",3,15,45]]},
    ]
  },
  home: {
    name: "Home / Körpergewicht",
    badge: "3–4× pro Woche · ohne Gym",
    desc: "Ohne Geräte trainierbar. Steigerung läuft über Wiederholungen, Tempo und schwierigere Varianten.",
    days: [
      { name:"Push zuhause", icon:"🏠", focus:"Brust · Schultern · Trizeps", weekdays:[1,4], ex:[
        ["pushup",4,15,90],["benchdip",3,12,60],["plank",3,1,45],["mobility",1,8,0]]},
      { name:"Pull & Core", icon:"🎒", focus:"Rücken · Rumpf", weekdays:[2], ex:[
        ["pullup",4,6,120],["row-db",3,12,90],["deadbug",3,12,45],["sideplank",3,1,45]]},
      { name:"Beine & Cardio", icon:"👟", focus:"Beine · Ausdauer", weekdays:[5], ex:[
        ["gobletsquat",4,15,90],["lunge",3,12,60],["run",1,25,0],["stretch",1,8,0]]},
    ]
  },
};

/* Baut aus einer Vorlage konkrete Trainingstage für den State. */
function buildDaysFromSplit(splitId){
  const sp = SPLITS[splitId] || SPLITS.ppl;
  return sp.days.map(d => ({
    id: uid(),
    name: d.name,
    icon: d.icon,
    focus: d.focus,
    weekdays: d.weekdays.slice(),
    exercises: d.ex.map(([exId, sets, reps, rest]) => ({
      id: uid(), exId, sets, reps, rest
    })),
  }));
}
