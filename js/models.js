"use strict";
/* ASCEND models.js — Denkmodell-Bibliothek fürs Second Brain
   Jedes Modell bringt mit: Kurzfassung in eigenen Worten, wo es in Ascend
   greift, eine ehrliche Einordnung der Beweislage und eine Lernkarte.
   Die Einordnung ist Absicht: Social-Media-Grafiken mischen gut belegte
   Effekte mit Mythen — hier steht dabei, was was ist.
     evidence: "solid"   = gut belegt
               "rule"    = Faustregel / Denkwerkzeug, kein Messergebnis
               "mixed"   = gemischte Befunde, Kern brauchbar
               "myth"    = verbreitet, aber so nicht haltbar */

const MODEL_EVIDENCE = {
  solid: { label: "gut belegt",       cls: "ev-solid" },
  rule:  { label: "Faustregel",       cls: "ev-rule"  },
  mixed: { label: "gemischte Befunde", cls: "ev-mixed" },
  myth:  { label: "Mythos",           cls: "ev-myth"  },
};

const MODEL_GROUPS = [
  ["learn", "📚 Lernen & Wissen"],
  ["focus", "⏱ Fokus & Produktivität"],
  ["mind",  "🧠 Psyche & Entscheidungen"],
  ["talk",  "💬 Kommunikation"],
];

const MENTAL_MODELS = [
  /* ---------- Lernen & Wissen ---------- */
  { id:"spaced", group:"learn", icon:"🔁", title:"Spaced Repetition", evidence:"solid",
    summary:"Wissen bleibt hängen, wenn du es in wachsenden Abständen wiederholst — jeweils kurz bevor du es vergessen würdest. Das aktive Abrufen ist dabei der eigentliche Lerneffekt, nicht das erneute Lesen.",
    apply:"Genau dafür sind die Karteikarten hier: Wer eine Karte weiß, sieht sie erst nach 1, 3, 7, 30 und 90 Tagen wieder.",
    front:"Warum wirkt Spaced Repetition — und was ist dabei der eigentliche Lerneffekt?",
    back:"Wiederholen in wachsenden Abständen, kurz vor dem Vergessen. Der Effekt kommt vom aktiven Abrufen aus dem Gedächtnis, nicht vom erneuten Lesen." },
  { id:"feynman", group:"learn", icon:"🧒", title:"Feynman-Technik", evidence:"solid",
    summary:"Erkläre ein Thema so, dass es ein Kind versteht. Wo du stockst oder Fachwörter brauchst, liegt eine Verständnislücke — zurück zur Quelle, vereinfachen, nochmal erklären.",
    apply:"Jedes Thema hat das Feld „In einfachen Worten“. Bleibt es leer oder klingt es nach Lehrbuch, ist das Thema noch nicht verstanden.",
    front:"Welche vier Schritte hat die Feynman-Technik?",
    back:"1. Thema lernen · 2. in einfachen Worten erklären · 3. Lücken finden, wo du stockst · 4. zurück zur Quelle, vereinfachen und wiederholen." },
  { id:"palace", group:"learn", icon:"🏛", title:"Gedächtnispalast", evidence:"solid",
    summary:"Bilder an Orten merkt sich das Gehirn besser als nackte Wörter. Du gehst im Kopf eine bekannte Route ab und legst an jeder Station ein übertriebenes Bild für einen Punkt ab.",
    apply:"Für Listen und Reihenfolgen (Rede, Prüfungsstoff, Einkauf). Schreib die Route als Notiz an ein Thema und mach aus den Stationen Karten.",
    front:"Wie funktioniert ein Gedächtnispalast in vier Schritten?",
    back:"Bekannten Ort wählen → feste Route festlegen → die Punkte auflisten → jedem Punkt ein übertriebenes Bild an einer Station der Route geben." },
  { id:"para", group:"learn", icon:"🗂", title:"P.A.R.A.", evidence:"rule",
    summary:"Ordnung nach Handlungsnähe statt nach Fachgebiet: Projekte haben Ziel und Ende, Bereiche brauchen dauerhafte Pflege, Ressourcen sind Interessensammlungen, das Archiv ist alles Inaktive.",
    apply:"Jedes Knowledge-Thema trägt eine PARA-Kategorie. Projekte lassen sich an ein Goal hängen, archivierte Themen pausieren ihre Karten.",
    front:"Wofür stehen die vier Buchstaben von P.A.R.A. — und was unterscheidet Projekt von Bereich?",
    back:"Projects, Areas, Resources, Archive. Ein Projekt hat ein Ziel und ein Ende; ein Bereich (z. B. Gesundheit, Finanzen) wird dauerhaft gepflegt und ist nie „fertig“." },
  { id:"cogload", group:"learn", icon:"🧩", title:"Cognitive Load Theory", evidence:"solid",
    summary:"Das Arbeitsgedächtnis ist klein. Belastung entsteht aus der Schwierigkeit des Stoffs selbst (intrinsisch), aus Störendem drumherum (extrinsisch) und aus dem Verknüpfen mit Bekanntem (lernwirksam).",
    apply:"Beim Lernen extrinsische Last streichen: eine Quelle, Ablenkung weg. Neues bewusst an ein bestehendes Thema hängen statt isoliert ablegen.",
    front:"Welche drei Arten kognitiver Belastung unterscheidet die Cognitive Load Theory?",
    back:"Intrinsisch (Komplexität des Stoffs), extrinsisch (unnötige, ablenkende Infos — reduzieren!) und lernwirksam/germane (Verknüpfen mit vorhandenem Wissen — fördern)." },

  /* ---------- Fokus & Produktivität ---------- */
  { id:"residue", group:"focus", icon:"🔀", title:"Attention Residue", evidence:"solid",
    summary:"Nach einem Aufgabenwechsel hängt ein Teil der Aufmerksamkeit noch an der vorherigen Aufgabe — vor allem, wenn sie unfertig war. Häufiges Springen macht jede Aufgabe schlechter.",
    apply:"Deep-Work-Blöcke statt Hin-und-Her. Vor dem Wechsel den nächsten Schritt notieren — das macht der Debrief nach jeder Session.",
    front:"Was ist Attention Residue und was hilft dagegen?",
    back:"Aufmerksamkeitsreste der vorherigen Aufgabe nach einem Wechsel. Gegenmittel: weniger wechseln (Blöcke), und vor dem Wechsel den nächsten Schritt aufschreiben." },
  { id:"pareto", group:"focus", icon:"⚖️", title:"Pareto-Prinzip (80/20)", evidence:"rule",
    summary:"Ein kleiner Teil der Ursachen erzeugt oft den Großteil der Wirkung. Die Zahlen sind eine Faustregel, kein Gesetz — der Wert liegt in der Frage, welche wenigen Dinge wirklich zählen.",
    apply:"Höchstens drei Outcomes am Tag. Frag vor jedem: Ist das der Hebel — oder nur beschäftigt sein?",
    front:"Was besagt das Pareto-Prinzip, und wie ernst sind die Zahlen 80/20 zu nehmen?",
    back:"Wenige Ursachen erzeugen einen Großteil der Wirkung. 80/20 ist eine Faustregel zur Priorisierung, keine feste Verteilung." },
  { id:"parkinson", group:"focus", icon:"⏳", title:"Parkinsonsches Gesetz", evidence:"rule",
    summary:"Arbeit dehnt sich auf die Zeit aus, die man ihr gibt. Ein Aphorismus, kein Messergebnis — aber feste, knappe Zeitboxen helfen nachweislich gegen Aufschieben.",
    apply:"Im Pre-Flight eine Zeitbox wählen, die eher kürzer ist als deine Schätzung. Große Aufgaben in Subtasks mit eigenen Mini-Deadlines teilen.",
    front:"Was sagt das Parkinsonsche Gesetz, und wie nutzt man es praktisch?",
    back:"Arbeit füllt die verfügbare Zeit. Praktisch: knappe Zeitboxen und künstliche Deadlines für kleine Teilschritte setzen." },
  { id:"zeigarnik", group:"focus", icon:"🧷", title:"Zeigarnik-Effekt", evidence:"mixed",
    summary:"Unerledigtes soll präsenter im Kopf bleiben als Erledigtes. Die Originalbefunde replizieren nur wechselhaft. Gut belegt ist dagegen: Ein konkreter Plan für den nächsten Schritt beruhigt offene Gedanken, auch ohne die Aufgabe zu beenden.",
    apply:"Darum fragt der Debrief nach dem nächsten Subtask, und „Fertig für heute“ schiebt Offenes sauber auf morgen.",
    front:"Was hilft gegen kreisende Gedanken an unerledigte Aufgaben — auch wenn man sie nicht fertig machen kann?",
    back:"Den nächsten konkreten Schritt aufschreiben und einplanen. Der Plan allein entlastet; der klassische Zeigarnik-Effekt selbst ist empirisch wackelig." },
  { id:"friction", group:"focus", icon:"🧗", title:"Starthürde („Limbic Friction“)", evidence:"mixed",
    summary:"„Limbic Friction“ ist ein Pop-Neuro-Begriff für den Widerstand zwischen kurzfristigem Komfort und langfristigem Ziel. Die Hirnbilder dazu sind stark vereinfacht; nützlich ist der Kern: Je kleiner der erste Schritt, desto leichter der Start.",
    apply:"Im Pre-Flight „zu schwer“ wählen — dann wird der nächste Subtask halbiert, bevor der Timer läuft.",
    front:"Was ist der brauchbare Kern hinter dem Begriff „Limbic Friction“?",
    back:"Es gibt Widerstand zwischen Komfort jetzt und Ziel später. Gegenmittel: den ersten Schritt so klein machen, dass Starten leichter ist als Ausweichen." },

  /* ---------- Psyche & Entscheidungen ---------- */
  { id:"second", group:"mind", icon:"🌳", title:"Second-Order Thinking", evidence:"rule",
    summary:"Nicht nur fragen, was eine Entscheidung sofort bewirkt, sondern: „Und was passiert dann?“ Was kurzfristig gut aussieht, kann eine Ebene tiefer schaden — und umgekehrt.",
    apply:"Bei neuen Goals und größeren Entscheidungen zwei Ebenen weiterdenken und das Ergebnis als Notiz am Thema festhalten.",
    front:"Was ist Second-Order Thinking, und welche Frage steht im Zentrum?",
    back:"Über die direkten Folgen hinaus die Folgen der Folgen durchdenken. Kernfrage: „Und was passiert dann?“" },
  { id:"arrival", group:"mind", icon:"🏁", title:"Arrival Fallacy", evidence:"solid",
    summary:"Der Glaube, ein erreichtes Ziel mache dauerhaft glücklich. Durch Gewöhnung (hedonische Anpassung) verfliegt das Hochgefühl schnell — das nächste „Wenn ich erst …“ wartet schon.",
    apply:"Den Weg belohnen, nicht nur das Ziel: Habits, Sessions und Beweise zählen in Ascend genauso wie erreichte Meilensteine.",
    front:"Was ist die Arrival Fallacy und welcher Mechanismus steckt dahinter?",
    back:"Die Erwartung, ein Ziel mache dauerhaft glücklich. Hedonische Anpassung lässt das Hochgefühl schnell verfliegen — deshalb den Prozess wertschätzen." },
  { id:"negbias", group:"mind", icon:"🪨", title:"Negativity Bias", evidence:"solid",
    summary:"Negative Erlebnisse wiegen schwerer und bleiben länger haften als gleich starke positive. Ohne Gegengewicht wirkt der eigene Fortschritt kleiner, als er ist.",
    apply:"Das Abend-Journal fragt zuerst „Was lief gut?“. Beweise an Glaubenssätzen sind ein gezieltes Gegengewicht.",
    front:"Was ist der Negativity Bias und wie gleicht man ihn bewusst aus?",
    back:"Negatives wiegt stärker als gleich starkes Positives. Ausgleich: Erfolge aktiv festhalten (Journal, Beweise sammeln)." },
  { id:"egodep", group:"mind", icon:"🔋", title:"Ego Depletion", evidence:"myth",
    summary:"Die Idee, Willenskraft sei ein Akku, der sich über den Tag leert. Große, vorab registrierte Replikationsstudien fanden den Effekt kaum oder gar nicht. Verlässlicher als Willenskraft ist eine Umgebung, die Versuchung gar nicht erst anbietet.",
    apply:"Statt auf Disziplin zu setzen: die Pre-Flight-Toggles (Handy weg, Tabs zu) nehmen dir die Entscheidung ab.",
    front:"Stimmt die Theorie, Willenskraft sei ein Akku, der sich leert (Ego Depletion)?",
    back:"Kaum haltbar — große Replikationsstudien fanden den Effekt nicht oder nur minimal. Besser: Umgebung so gestalten, dass weniger Willenskraft nötig ist." },

  /* ---------- Kommunikation ---------- */
  { id:"shr", group:"talk", icon:"🤝", title:"Seen · Heard · Remembered", evidence:"rule",
    summary:"Menschen fühlen sich wichtig, wenn sie gesehen (Blickkontakt, konkretes Kompliment), gehört (gute Fragen, echtes Interesse) und erinnert werden (Namen, frühere Gesprächsthemen).",
    apply:"Bei den Social Check-ins vor dem Melden kurz überlegen: Was hat die Person beim letzten Mal erzählt?",
    front:"Was bedeutet die SHR-Methode für Charisma?",
    back:"Seen (Blickkontakt, konkretes Kompliment), Heard (gute Fragen, interessiert statt interessant), Remembered (Namen und frühere Themen wieder aufgreifen)." },
  { id:"mehrabian", group:"talk", icon:"📊", title:"Die 7-38-55-Regel", evidence:"myth",
    summary:"Oft behauptet: Kommunikation bestehe zu 7 % aus Worten, 38 % Tonfall und 55 % Körpersprache. Mehrabians Studien galten nur für einzelne Wörter mit Gefühlsbedeutung, bei denen Wort und Tonfall sich widersprachen — nicht für Gespräche allgemein.",
    apply:"Körpersprache und Tonfall sind wichtig, aber Inhalt zählt. Bei Präsentationen beides üben — z. B. eigene Aufnahmen anhören.",
    front:"Gilt die 7-38-55-Regel (Worte / Tonfall / Körpersprache) für Kommunikation allgemein?",
    back:"Nein. Mehrabians Befund betraf nur widersprüchliche Gefühlsbotschaften einzelner Wörter. Als allgemeine Regel ist sie eine Fehlinterpretation." },
];

function modelById(id){ return MENTAL_MODELS.find(m=>m.id===id) || null; }
