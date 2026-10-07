"use strict";
/* ASCEND data.js — Mahlzeiten- & Supplement-Datenbank */

/* ============================================================
   MAHLZEITEN- & SUPPLEMENT-DATENBANK
   ============================================================ */
// ═══════════════════════════════════════════════════════
// MAHLZEITEN-DATENBANK — 2800 kcal · 220g P · 300g C · 80g F
// Slot-Ziele:
//  Slot 1 (Frühstück):      ~660–700 kcal · 45–50g P · 75–80g C · 20–24g F
//  Slot 2 (Snack 10h):      ~350–380 kcal · 25–30g P · 28–35g C · 14–18g F
//  Slot 3 (Mittagessen):    ~750–790 kcal · 60–68g P · 70–80g C · 20–25g F
//  Slot 4 (Pre/Post WO):    ~380–420 kcal · 32–38g P · 48–58g C · 8–12g F
//  Slot 5 (Abendessen):     ~490–530 kcal · 45–52g P · 30–38g C · 16–20g F
//  Slot 6 (Abend-Snack):    ~220–250 kcal · 24–28g P · 18–25g C · 4–6g F
// ═══════════════════════════════════════════════════════

const MEALS = {

  slot1: {
    label: "Frühstück", time: "07:00 Uhr", color: "rgba(74,222,128,0.1)",
    options: [
      { name:"Power-Rührei & Haferbrei", icon:"🌅", kcal:685, p:48, c:78, f:22,
        items:[["5 Freiland-Eier (Rührei mit Spinat)","300 kcal · 35g P · Zink, Vit. A, Cholin"],["100g Haferflocken + 250ml Hafermilch","385 kcal · 13g P · 67g C · Ballaststoffe"],["100g Blaubeeren","57 kcal · Anthocyane, Antioxidantien"],["1 TL Chiasamen","Omega-3, Ballaststoffe"],["200ml grüner Tee","L-Theanin + Koffein · Fokus"]],
        tags:[["Testosteron ↑","g"],["Fokus","b"],["Haut & Haar","a"],["Muskelaufbau","g"]] },
      { name:"Protein-Pancakes deluxe", icon:"🥞", kcal:675, p:50, c:76, f:18,
        items:[["3 Eier + 40g Whey + 80g Hafermehl (Teig)","450 kcal · 50g P"],["150g Magerquark als Topping","85 kcal · 14g P"],["100g Erdbeeren + 1 EL Ahornsirup","80 kcal · Vit. C"],["200ml schwarzer Kaffee","Fokus, Antioxidantien"]],
        tags:[["Muskelaufbau","g"],["Energie","b"],["Haut","a"],["Darm","p"]] },
      { name:"Overnight Oats & Eier", icon:"🌾", kcal:680, p:46, c:80, f:20,
        items:[["110g Haferflocken (über Nacht in 250ml Kefir)","455 kcal · 17g P · Probiotika"],["3 hartgekochte Eier","225 kcal · 19g P · Cholin"],["1 große Banane (Scheiben drauf)","90 kcal · Kalium, B6"],["1 EL Leinsamen + 1 TL Zimt","Omega-3, Blutzucker"]],
        tags:[["Darmgesundheit","b"],["Energie","g"],["Testosteron","g"],["Haut","a"]] },
      { name:"Joghurt-Power-Bowl", icon:"🫙", kcal:690, p:47, c:77, f:22,
        items:[["350g griechischer Joghurt (2%)","250 kcal · 35g P"],["50g Walnüsse","325 kcal · Omega-3, Gehirn"],["90g Haferflocken (roh, eingeweicht)","345 kcal · 12g P"],["100g Heidelbeeren","Anthocyane, Antioxidantien"],["1 EL Honig + Zimt","Blutzucker-Regulation"]],
        tags:[["Darm","b"],["Gehirn","b"],["Haut","a"],["Testosteron","g"]] },
      { name:"Vollkornbrot, Avocado & Eier", icon:"🍳", kcal:665, p:44, c:72, f:24,
        items:[["4 Spiegeleier (in Kokosöl)","300 kcal · 28g P · Vit. D"],["4 Scheiben Vollkornbrot (Roggen)","265 kcal · 12g P · 48g C"],["1 ganze Avocado","240 kcal · gesunde Fette"],["5 Cherrytomaten + Kräuter","Lycopin, Vit. C"],["1 Kiwi","Vit. C, K1"]],
        tags:[["Haut","a"],["Herz","b"],["Testosteron","g"],["Fokus","b"]] },
      { name:"Lachs-Scramble & Süßkartoffel", icon:"🐟", kcal:700, p:50, c:70, f:24,
        items:[["100g Räucherlachs + 4 Eier (Scramble)","410 kcal · 46g P · Omega-3"],["200g Süßkartoffel (gebacken)","175 kcal · Beta-Carotin"],["Handvoll Spinat + Rucola","Eisen, Folat, Lutein"],["200ml grüner Tee","L-Theanin"]],
        tags:[["Omega-3","b"],["Haut","a"],["Muskelaufbau","g"],["Augen","p"]] },
      { name:"Quark-Bowl & Granola", icon:"🥣", kcal:670, p:48, c:76, f:18,
        items:[["300g Magerquark","240 kcal · 36g P"],["60g Granola (Hafer + Kürbiskerne + Honig)","265 kcal · 8g P"],["120g gemischte Beeren","Antioxidantien, Vit. C"],["1 EL Flohsamenschalen","Ballaststoffe, Darm"],["200ml schwarzer Kaffee","Fokus, Antioxidantien"]],
        tags:[["Darm","b"],["Muskelaufbau","g"],["Haut","a"],["Energie","g"]] },
      { name:"Tofu-Scramble & Haferbrei", icon:"🌱", kcal:660, p:46, c:78, f:20,
        items:[["250g fester Tofu (Kurkuma, Knoblauch, gewürzt)","220 kcal · 24g P"],["100g Haferflocken mit 250ml Mandelmilch","385 kcal · 12g P"],["Schwarzer Pfeffer (Piperin erhöht Curcumin-Aufnahme 20×)","Anti-Entzündung"],["100g Blaubeeren","Anthocyane"],["1 TL Leinöl","Omega-3, ALA"]],
        tags:[["Anti-Entzündung","a"],["Haut","a"],["Darm","b"],["Langlebigkeit","p"]] },
      { name:"Eiweiß-Omelette & Buchweizen", icon:"🍽", kcal:675, p:52, c:74, f:18,
        items:[["6 Eiweiß + 2 Vollei (Omelette mit Paprika, Zwiebel, Feta)","310 kcal · 44g P"],["100g Buchweizen (gekocht)","290 kcal · 10g P · vollständige AS"],["120g Magerquark (daneben)","80 kcal · 14g P"],["1 große Orange","Vit. C, Flavonoide"]],
        tags:[["Muskelaufbau","g"],["Haut","a"],["Immunsystem","b"],["Testosteron","g"]] },
      { name:"Chia-Pudding & Spiegeleier", icon:"🫐", kcal:670, p:46, c:76, f:22,
        items:[["60g Chiasamen + 300ml Kokosmilch-light (über Nacht)","370 kcal · 12g P · Omega-3"],["4 Spiegeleier (Kokosöl)","300 kcal · 28g P · Vit. D"],["100g Mango + 1 TL Kakaopulver (roh)","Beta-Carotin, Vit. C, Flavonoide"],["200ml grüner Tee","L-Theanin"]],
        tags:[["Omega-3","b"],["Haut","a"],["Gehirn","b"],["Testosteron","g"]] }
    ]
  },

  slot2: {
    label: "Snack (10:00)", time: "10:00 Uhr", color: "rgba(34,211,238,0.1)",
    options: [
      { name:"Joghurt, Walnüsse & Kiwi", icon:"🥗", kcal:365, p:27, c:30, f:17,
        items:[["250g griechischer Joghurt (0%)","145 kcal · 24g P"],["35g Walnüsse","228 kcal · Omega-3"],["2 Kiwis","84 kcal · Vit. C, K1"],["1 Prise Zimt","Blutzucker-Regulation"]],
        tags:[["Darm","b"],["Gehirn","b"],["Immunsystem","g"],["Stress ↓","p"]] },
      { name:"Hüttenkäse, Mandeln & Apfel", icon:"🧀", kcal:355, p:30, c:28, f:15,
        items:[["250g Hüttenkäse","175 kcal · 28g P"],["30g Mandeln","180 kcal · Vit. E, Magnesium"],["1 großer Apfel","90 kcal · Ballaststoffe, Quercetin"],["Prise Zimt & Muskat","anti-diabetisch"]],
        tags:[["Muskelaufbau","g"],["Haut","a"],["Gehirn","b"],["Knochen","p"]] },
      { name:"Edamame & Hummus-Platte", icon:"🫛", kcal:360, p:26, c:34, f:16,
        items:[["180g Edamame (gegart)","228 kcal · 20g P · Isoflavone"],["80g Hummus","155 kcal · 5g P"],["Gemüsesticks: Paprika, Gurke, Karotte (200g)","Vit. C, Beta-Carotin"]],
        tags:[["Darm","b"],["Haut","a"],["Energie","g"],["Herz","b"]] },
      { name:"Proteinshake & Nüsse & Banane", icon:"🥤", kcal:370, p:36, c:32, f:14,
        items:[["35g Whey-Protein + 300ml Vollmilch","290 kcal · 36g P"],["20g Cashews","115 kcal · Zink, Magnesium"],["1 kleine Banane","75 kcal · Kalium, B6"]],
        tags:[["Muskelaufbau","g"],["Energie","g"],["Testosteron","g"],["Fokus","b"]] },
      { name:"Quark & Beeren-Kompott", icon:"🫙", kcal:355, p:29, c:32, f:12,
        items:[["280g Magerquark","225 kcal · 32g P"],["150g gemischte Beeren (warm od. kalt)","75 kcal · Antioxidantien"],["2 EL Kürbiskerne","140 kcal · Zink"],["Spritzer Zitronensaft","Vit. C"]],
        tags:[["Haut","a"],["Muskelaufbau","g"],["Antioxidantien","p"],["Testosteron","g"]] },
      { name:"Eier & Avocado-Toast", icon:"🥑", kcal:375, p:26, c:28, f:20,
        items:[["3 hartgekochte Eier","225 kcal · 19g P · Cholin"],["½ Avocado auf 2 Scheiben Vollkornbrot","310 kcal · gesunde Fette"],["Prise Meersalz + Paprikapulver","Elektrolyte"],["5 Cherrytomaten","Lycopin"]],
        tags:[["Testosteron","g"],["Gehirn","b"],["Haut","a"],["Energie","g"]] },
      { name:"Kefir-Smoothie & Mandeln", icon:"🥛", kcal:360, p:26, c:36, f:15,
        items:[["350ml Kefir","175 kcal · 12g P · Probiotika"],["1 Banane + Handvoll Spinat + 1 TL Ingwer","110 kcal · Kalium, Eisen"],["25g Hanfsamen (einrühren)","138 kcal · 8g P · Omega-3"],["20g Mandeln","120 kcal · Vit. E"]],
        tags:[["Darm","b"],["Anti-Entzündung","a"],["Haut","a"],["Energie","g"]] },
      { name:"Thunfisch-Vollkornbrot", icon:"🥪", kcal:365, p:34, c:32, f:12,
        items:[["1,5 Dosen Thunfisch (Wasser, abgetropft)","195 kcal · 40g P · Omega-3"],["2 Scheiben Vollkornbrot","140 kcal · 6g P"],["1 TL Olivenöl + Zitrone","Polyphenole"],["Salatblätter, Tomate, Gurke","Vit. K, Lycopin"]],
        tags:[["Muskelaufbau","g"],["Omega-3","b"],["Herz","b"],["Haut","a"]] },
      { name:"Reiswaffeln & Mandelmus & Quark", icon:"🌰", kcal:355, p:28, c:36, f:14,
        items:[["5 Reiswaffeln (Vollkorn)","150 kcal"],["2 EL Mandelmus (naturell)","190 kcal · Vit. E, Magnesium"],["200g Magerquark","135 kcal · 20g P"],["1 TL Honig","schnelle Energie"]],
        tags:[["Energie","g"],["Muskelaufbau","g"],["Haut","a"],["Knochen","p"]] },
      { name:"Cottage Cheese & Paranüsse & Birne", icon:"🥜", kcal:360, p:28, c:28, f:17,
        items:[["250g Cottage Cheese","175 kcal · 28g P"],["5 Paranüsse","55 kcal · Selen ↑↑ Schilddrüse!"],["1 große Birne","90 kcal · Ballaststoffe, Quercetin"],["1 EL Leinöl","Omega-3, ALA"]],
        tags:[["Schilddrüse","a"],["Testosteron","g"],["Haut","a"],["Darm","b"]] }
    ]
  },

  slot3: {
    label: "Mittagessen", time: "13:00 Uhr", color: "rgba(245,158,11,0.1)",
    options: [
      { name:"Hähnchen, Süßkartoffel & Brokkoli", icon:"🍗", kcal:770, p:65, c:75, f:22,
        items:[["220g Hähnchenbrustfilet (gegrillt)","348 kcal · 65g P"],["200g Süßkartoffel (gebacken)","175 kcal · Beta-Carotin"],["200g Brokkoli (gedämpft)","Sulforaphan, Vit. C"],["½ Avocado","120 kcal · gesunde Fette"],["1 EL Olivenöl + Knoblauch","Polyphenole, Allicin"],["2 EL Kürbiskerne","140 kcal · Zink"]],
        tags:[["Muskelaufbau","g"],["Anti-Entzündung","a"],["Herz","b"],["Testosteron","g"]] },
      { name:"Lachs-Bowl mit Quinoa & Spinat", icon:"🐠", kcal:780, p:62, c:70, f:26,
        items:[["200g Lachsfilet (gebacken)","415 kcal · 44g P · Omega-3, Vit. D"],["150g Quinoa (gekocht)","180 kcal · 7g P · vollständige AS"],["Großer Spinat-Salat + Rucola","Folat, Eisen, Lutein"],["1 ganze Avocado","240 kcal"],["5 Paranüsse","Selen"],["Zitronendressing","Vit. C"]],
        tags:[["Omega-3","b"],["Haut","a"],["Gehirn","b"],["Langlebigkeit","p"]] },
      { name:"Rindfleisch, Vollkornreis & Gemüse", icon:"🥩", kcal:775, p:64, c:74, f:22,
        items:[["200g Rinderhüfte (mager, angebraten)","365 kcal · 54g P · Zink, Eisen, Kreatin"],["150g Vollkornreis (gekocht)","210 kcal · 5g P"],["250g Paprika, Zucchini, Zwiebeln (gedünstet)","Vit. C, Antioxidantien"],["1 EL Olivenöl + Rosmarin","Polyphenole"],["2 EL Kürbiskerne","Zink, Magnesium"]],
        tags:[["Muskelaufbau","g"],["Testosteron","g"],["Eisen","a"],["Energie","g"]] },
      { name:"Putenbrust-Wrap deluxe", icon:"🌯", kcal:760, p:63, c:76, f:20,
        items:[["220g Putenbrustfilet (gewürzt, gebraten)","305 kcal · 60g P"],["3 Vollkorn-Wraps","300 kcal · 12g P"],["Rucola, Tomate, Gurke, Paprika (reichlich)","Vit. C, K, Beta-Carotin"],["3 EL Hummus","113 kcal · Ballaststoffe"],["Kurkuma + Zitrone","Anti-Entzündung"]],
        tags:[["Muskelaufbau","g"],["Darm","b"],["Immunsystem","g"],["Haut","a"]] },
      { name:"Linsen-Dal, Hähnchen & Reis", icon:"🍛", kcal:775, p:62, c:80, f:18,
        items:[["180g rote Linsen (gekocht)","225 kcal · 16g P · Eisen, Folat"],["180g Hähnchenbrustfilet (gewürzt)","285 kcal · 53g P"],["Kokosmilch, Kurkuma, Ingwer, Kreuzkümmel","Anti-Entzündung"],["100g Basmati-Reis","130 kcal"],["Spinat + Zitrone","Eisen, Lutein, Vit. C"]],
        tags:[["Anti-Entzündung","a"],["Darm","b"],["Muskelaufbau","g"],["Herz","b"]] },
      { name:"Thunfisch-Vollkorn-Pasta", icon:"🍝", kcal:765, p:60, c:78, f:18,
        items:[["150g Vollkorn-Pasta (trocken)","535 kcal · 20g P"],["2 Dosen Thunfisch (Wasser)","260 kcal · 56g P"],["200g Kirschtomaten + Knoblauch + Basilikum","Lycopin"],["1 EL Olivenöl","Polyphenole"],["Rucola roh darüber","Nitrate, Vit. K"]],
        tags:[["Herz","b"],["Omega-3","b"],["Energie","g"],["Muskelaufbau","g"]] },
      { name:"Tofu-Reisnudeln (asiatisch)", icon:"🍜", kcal:755, p:46, c:84, f:20,
        items:[["250g Tofu (fest, kross gebraten)","225 kcal · 28g P"],["150g Reisnudeln (trocken)","540 kcal"],["Pak Choi, Brokkoli, Karotten, Ingwer (je 100g)","Sulforaphan, Beta-Carotin"],["2 EL Tamari + 1 EL Sesamöl","Aminosäuren, Phytosterole"],["Sesamsamen + Frühlingszwiebeln","Kalzium, Antioxidantien"]],
        tags:[["Anti-Entzündung","a"],["Darm","b"],["Knochen","p"],["Langlebigkeit","p"]] },
      { name:"Lachs-Burger & Süßkartoffel-Fries", icon:"🍔", kcal:785, p:58, c:72, f:26,
        items:[["200g Lachsfilet (zu Patty geformt, gebraten)","415 kcal · 44g P · Omega-3"],["2 Vollkorn-Burgerbrötchen","280 kcal"],["200g Süßkartoffel-Fries (im Ofen)","175 kcal · Beta-Carotin"],["Spinat, Tomate, Avocado-Scheibe","Nährstoffdichte"],["Senf + Zitrone","0 kcal"]],
        tags:[["Omega-3","b"],["Haut","a"],["Energie","g"],["Muskelaufbau","g"]] },
      { name:"Hähnchen-Pfanne & Hirse", icon:"🥘", kcal:760, p:62, c:76, f:18,
        items:[["220g Hähnchenbrustfilet (gewürzt)","348 kcal · 65g P"],["130g Hirse (gekocht)","195 kcal · Eisen, Magnesium"],["Paprika, Zucchini, Erbsen (je 100g)","Vit. C, Ballaststoffe"],["Kurkuma + Cayenne + Knoblauch","Anti-Entzündung, Allicin"],["1 EL Olivenöl","Polyphenole"]],
        tags:[["Muskelaufbau","g"],["Anti-Entzündung","a"],["Energie","g"],["Haut","a"]] },
      { name:"Kichererbsen-Bowl mit Feta & Quinoa", icon:"🥙", kcal:760, p:46, c:86, f:22,
        items:[["250g Kichererbsen (gekocht)","325 kcal · 18g P · Ballaststoffe"],["100g Feta (Schafskäse)","265 kcal · 14g P · Kalzium"],["100g Quinoa (gekocht)","120 kcal · 5g P"],["Spinat, Gurke, Tomate, Rote Bete","Antioxidantien"],["Tahini-Dressing + 1 EL Olivenöl","Kalzium, Polyphenole"]],
        tags:[["Darm","b"],["Knochen","p"],["Herz","b"],["Langlebigkeit","p"]] }
    ]
  },

  slot4: {
    label: "Pre/Post-Workout", time: "16:30 Uhr", color: "rgba(192,132,252,0.1)",
    options: [
      { name:"Whey-Shake, Banane & Erdnussbutter", icon:"⚡", kcal:400, p:36, c:52, f:10,
        items:[["35g Whey-Protein + 300ml Vollmilch","290 kcal · 36g P"],["1 große Banane","105 kcal · 27g C · B6"],["1 EL Erdnussbutter (naturell)","95 kcal · gesunde Fette"],["5g Kreatin (im Shake)","Performance ↑"]],
        tags:[["Schnelle Energie","p"],["Muskel-Synthese","g"],["Regeneration","b"],["Stimmung","a"]] },
      { name:"Reiskuchen, Quark & Beeren", icon:"🍚", kcal:385, p:34, c:50, f:8,
        items:[["5 Reiskuchen (Vollkorn)","175 kcal"],["250g Magerquark","170 kcal · 25g P"],["1 EL Honig","68 kcal · schnelle Glukose"],["150g Beeren","75 kcal · Antioxidantien"],["5g Kreatin","Kraft ↑"]],
        tags:[["Energie","g"],["Muskelaufbau","g"],["Regeneration","b"],["Haut","a"]] },
      { name:"Eiersandwich & Apfel", icon:"🥚", kcal:395, p:33, c:48, f:12,
        items:[["4 hartgekochte Eier","300 kcal · 26g P"],["3 Scheiben Vollkornbrot","210 kcal · 9g P"],["1 großer Apfel","90 kcal · Ballaststoffe"],["Senf + Kräuter (fettarm)","Antioxidantien"]],
        tags:[["Ausdauerleistung","g"],["Energie","g"],["Muskelaufbau","g"],["Darm","b"]] },
      { name:"Haferbrei-Shake mit Whey", icon:"🍌", kcal:405, p:38, c:54, f:9,
        items:[["35g Whey + 1 große Banane + 50g Haferflocken + 300ml Mandelmilch","405 kcal · 38g P"],["1 TL Zimt","Blutzucker-Regulation"],["5g Kreatin","Performance ↑"]],
        tags:[["Energie","g"],["Muskelaufbau","g"],["Regeneration","b"],["Fokus","b"]] },
      { name:"Griechischer Joghurt & Granola", icon:"🍯", kcal:390, p:34, c:48, f:11,
        items:[["300g griechischer Joghurt (2%)","175 kcal · 21g P"],["50g Hafer-Granola","200 kcal · 5g P"],["1 EL Honig","68 kcal · schnelle Glukose"],["30g Walnüsse","Omega-3"],["5g Kreatin","Kraft ↑"]],
        tags:[["Energie","g"],["Darm","b"],["Muskelaufbau","g"],["Regeneration","b"]] },
      { name:"Thunfisch, Cracker & Orange", icon:"🐟", kcal:385, p:36, c:46, f:9,
        items:[["1,5 Dosen Thunfisch (Wasser)","195 kcal · 42g P · Omega-3"],["8 Vollkorncracker","160 kcal"],["1 EL Avocado-Aufstrich","50 kcal"],["1 große Orange","90 kcal · Vit. C"],["5g Kreatin","Kraft ↑"]],
        tags:[["Omega-3","b"],["Muskelaufbau","g"],["Energie","g"],["Haut","a"]] },
      { name:"Süßkartoffel-Purée & Proteinshake", icon:"🍠", kcal:400, p:36, c:54, f:8,
        items:[["250g Süßkartoffel (gedämpft, zerdrückt)","220 kcal · Beta-Carotin"],["35g Whey-Protein + 250ml Wasser","140 kcal · 30g P"],["1 TL Kokosöl","MCT-Fette"],["Prise Zimt + Meersalz","Blutzucker, Elektrolyte"],["5g Kreatin","Performance ↑"]],
        tags:[["Langzeitenergie","a"],["Muskelaufbau","g"],["Haut","a"],["Augen","p"]] },
      { name:"Kasein-Pudding & Haferflocken", icon:"🍮", kcal:390, p:38, c:50, f:8,
        items:[["35g Kasein-Protein + 200ml Wasser (zu Pudding)","140 kcal · 30g P"],["90g Haferflocken (roh, unterrühren)","345 kcal · 12g P"],["100g Himbeeren","54 kcal · Quercetin"],["5g Kreatin","Kraft ↑"]],
        tags:[["Langanhaltende Energie","p"],["Muskelaufbau","g"],["Regeneration","b"],["Haut","a"]] },
      { name:"Protein-Milchreis", icon:"🍚", kcal:410, p:35, c:56, f:9,
        items:[["100g Milchreis (trocken, in 400ml Vollmilch gekocht)","410 kcal · 16g P"],["25g Whey (einrühren nach Kochen)","100 kcal · 22g P"],["1 TL Zimt + 1 EL Honig","Blutzucker"],["5g Kreatin","Kraft ↑"]],
        tags:[["Energie","g"],["Muskelaufbau","g"],["Knochen","p"],["Regeneration","b"]] },
      { name:"Edamame & Whey-Shake", icon:"🫛", kcal:390, p:38, c:44, f:11,
        items:[["180g Edamame (gekocht, gesalzen)","228 kcal · 20g P · Isoflavone"],["30g Whey + 250ml Mandelmilch","150 kcal · 26g P"],["1 große Banane","105 kcal · B6, Kalium"],["5g Kreatin","Kraft ↑"]],
        tags:[["Muskelaufbau","g"],["Energie","g"],["Herz","b"],["Haut","a"]] }
    ]
  },

  slot5: {
    label: "Abendessen", time: "19:30 Uhr", color: "rgba(99,102,241,0.1)",
    options: [
      { name:"Lachs, Quinoa & Spinatsalat", icon:"🌙", kcal:510, p:48, c:36, f:19,
        items:[["180g Lachs (gebacken)","375 kcal · 40g P · Omega-3, Vit. D"],["120g Quinoa (gekocht)","145 kcal · 5g P"],["Großer Spinat-Rucola-Salat","Folat, Lutein, Lycopin"],["5 Paranüsse","Selen — Schilddrüse"],["1 EL Leinöl als Dressing","Omega-3, ALA"]],
        tags:[["Omega-3","b"],["Schlaf","p"],["Selen","a"],["Anti-Aging","p"]] },
      { name:"Hähnchenkeule & Brokkoli", icon:"🍗", kcal:520, p:50, c:38, f:18,
        items:[["230g Hähnchenkeule (ohne Haut, gebacken)","322 kcal · 43g P · Zink"],["180g Süßkartoffel (gegrillt)","158 kcal · Beta-Carotin"],["200g Brokkoli (gedämpft)","Sulforaphan, Vit. C, K"],["1 EL Olivenöl + Zitrone + Knoblauch","Polyphenole, Allicin"]],
        tags:[["Testosteron","g"],["Schlaf","p"],["Anti-Entzündung","a"],["Muskelaufbau","g"]] },
      { name:"Kabeljau & Gemüse-Ratatouille", icon:"🐟", kcal:495, p:52, c:34, f:14,
        items:[["250g Kabeljaufilet (gedämpft)","225 kcal · 50g P · Jod, Selen"],["Ratatouille: Zucchini, Aubergine, Tomate, Paprika","150 kcal · Antioxidantien"],["100g Vollkorncouscous","120 kcal"],["1 EL Olivenöl + Thymian, Rosmarin","Polyphenole"]],
        tags:[["Jod","b"],["Schilddrüse","a"],["Herz","b"],["Langlebigkeit","p"]] },
      { name:"Rinder-Gemüse-Eintopf", icon:"🍲", kcal:525, p:52, c:38, f:18,
        items:[["180g Rinderhüfte (geschmort)","295 kcal · 46g P · Zink, Eisen"],["Möhren, Sellerie, Zwiebeln, Tomaten (je 80g)","Beta-Carotin, Antioxidantien"],["120g Hülsenfrüchte (Linsen o. weiße Bohnen)","145 kcal · Ballaststoffe"],["Rosmarin, Knoblauch, Lorbeer","Anti-Entzündung, Allicin"]],
        tags:[["Eisen","a"],["Testosteron","g"],["Darm","b"],["Schlaf","p"]] },
      { name:"Sardinen & Ofengemüse", icon:"🐟", kcal:505, p:46, c:30, f:22,
        items:[["2 Dosen Sardinen in Olivenöl (abgetropft)","400 kcal · 46g P · Omega-3, Kalzium"],["Ofengemüse: Brokkoli, Karotten, rote Zwiebeln","150 kcal · Sulforaphan"],["2 Scheiben Vollkornbrot (geröstet)","140 kcal"],["Zitronensaft + Petersilie","Vit. C"]],
        tags:[["Omega-3","b"],["Knochen","p"],["Herz","b"],["Haut","a"]] },
      { name:"Garnelen-Stir-Fry & Reisnudeln", icon:"🦐", kcal:505, p:46, c:50, f:14,
        items:[["250g Garnelen (gebraten)","265 kcal · 50g P · Jod, Selen"],["100g Reisnudeln (trocken)","350 kcal"],["Pak Choi, Brokkoli, Ingwer (je 100g)","Sulforaphan, Antioxidantien"],["1 EL Tamari + 1 TL Sesamöl","Umami, gesunde Fette"]],
        tags:[["Jod","b"],["Schilddrüse","a"],["Schlaf","p"],["Haut","a"]] },
      { name:"Puten-Hack & Zucchini-Pasta", icon:"🫑", kcal:515, p:55, c:28, f:20,
        items:[["250g Putenhackfleisch (angebraten)","360 kcal · 55g P"],["2 große Zucchini (Spiralnudeln)","66 kcal · Vit. C"],["Tomatensauce: Knoblauch, Tomate, Basilikum","80 kcal · Lycopin"],["1 EL Olivenöl","Polyphenole"],["3 EL Parmesan","Kalzium"]],
        tags:[["Muskelaufbau","g"],["Haut","a"],["Schlaf","p"],["Anti-Entzündung","a"]] },
      { name:"Frittata & Großer Salat", icon:"🥚", kcal:495, p:50, c:24, f:22,
        items:[["5 Eier + 100g Hüttenkäse + Feta (im Ofen)","450 kcal · 46g P"],["Spinat, Paprika, Oliven, Tomaten (drin)","Kalzium, Eisen, Vit. C"],["Großer grüner Beilagensalat","Vit. K, Ballaststoffe"],["1 EL Olivenöl","Polyphenole"]],
        tags:[["Testosteron","g"],["Haut","a"],["Knochen","p"],["Schlaf","p"]] },
      { name:"Forelle & Spargel & Kartoffel", icon:"🐡", kcal:505, p:50, c:36, f:19,
        items:[["200g Forellenfilet (gebacken)","280 kcal · 42g P · Omega-3, Vit. D"],["300g Spargel (gegrillt)","66 kcal · Präbiotika, Folat"],["150g Kartoffeln (gekocht)","128 kcal · Kalium"],["1 EL Mandeln + Zitronenbutter","Vit. E, gesunde Fette"]],
        tags:[["Omega-3","b"],["Darm","b"],["Schlaf","p"],["Langlebigkeit","p"]] },
      { name:"Hähnchen & Blumenkohlreis", icon:"🥦", kcal:500, p:54, c:30, f:17,
        items:[["250g Hähnchenbrustfilet (mariniert, gegrillt)","395 kcal · 74g P"],["350g Blumenkohl (gerieben, angebraten)","105 kcal · Sulforaphan"],["Erbsen + Karotten (je 80g)","Ballaststoffe, Beta-Carotin"],["Kurkuma + Kreuzkümmel + Koriander","Anti-Entzündung"],["1 EL Olivenöl","Polyphenole"]],
        tags:[["Muskelaufbau","g"],["Anti-Entzündung","a"],["Schlaf","p"],["Krebsprävention","p"]] }
    ]
  },

  slot6: {
    label: "Abend-Snack", time: "21:30 Uhr", color: "rgba(74,222,128,0.06)",
    options: [
      { name:"Hüttenkäse & Honig-Zimt", icon:"🌙", kcal:235, p:28, c:22, f:5,
        items:[["250g Hüttenkäse (mager)","175 kcal · 26g P · langsames Kasein"],["1 EL Honig + reichlich Zimt","68 kcal · Melatonin-Vorläufer"],["5 Paranüsse","55 kcal · Selen"]],
        tags:[["Muskelschutz","g"],["Schlaf ↑","p"],["Schilddrüse","a"]] },
      { name:"Magerquark & Beeren", icon:"🫙", kcal:225, p:30, c:18, f:3,
        items:[["250g Magerquark","170 kcal · 30g P · Kasein"],["100g Heidelbeeren","57 kcal · Anthocyane"],["1 TL Leinöl","Omega-3, ALA"],["Prise Muskat","entspannend"]],
        tags:[["Muskelschutz","g"],["Schlaf ↑","p"],["Anti-Aging","p"]] },
      { name:"Kasein-Shake", icon:"🥛", kcal:230, p:32, c:20, f:4,
        items:[["35g Kasein-Protein + 300ml Wasser oder Mandelmilch","150 kcal · 32g P"],["1 TL Kakao (roh) darin","Magnesium, Flavonoide"],["Prise Salz + Eiswürfel","lecker + Elektrolyte"]],
        tags:[["Muskelschutz","g"],["Schlaf ↑","p"],["Regeneration","b"]] },
      { name:"Griechischer Joghurt & Walnüsse", icon:"🥣", kcal:240, p:25, c:20, f:10,
        items:[["250g griechischer Joghurt (0%)","145 kcal · 21g P · Probiotika"],["20g Walnüsse","130 kcal · Omega-3, Melatonin"],["1 TL Honig + Zimt","Blutzucker-Regulation"]],
        tags:[["Darm","b"],["Schlaf ↑","p"],["Gehirn","b"]] },
      { name:"Erdnussbutter-Quark", icon:"🥜", kcal:245, p:28, c:18, f:8,
        items:[["200g Magerquark","135 kcal · 24g P"],["1 EL Erdnussbutter (naturell)","95 kcal · gesunde Fette"],["1 kleine Banane (halb)","53 kcal · Tryptophan — Schlaf!"],["1 TL Honig","schnelle Energie"]],
        tags:[["Schlaf ↑","p"],["Muskelschutz","g"],["Stimmung","b"]] },
      { name:"Hühnerbrühe & Hüttenkäse", icon:"🍵", kcal:220, p:30, c:16, f:5,
        items:[["250g Hüttenkäse","175 kcal · 26g P"],["300ml selbstgemachte Hühnerbrühe","Kollagen, Glycin — Schlaf!"],["1 EL Chiasamen (in Brühe)","Omega-3, Ballaststoffe"]],
        tags:[["Schlaf ↑","p"],["Muskelschutz","g"],["Darm","b"]] },
      { name:"Eiweißmousse au Chocolat", icon:"🍫", kcal:235, p:30, c:20, f:5,
        items:[["35g Kasein-Protein (Schokolade) + 100ml Wasser zu Mousse","140 kcal · 30g P"],["1 TL roher Kakao","Magnesium, Flavonoide"],["100g Magerquark druntermischen","68 kcal · 12g P"],["Prise Meersalz","Elektrolyte"]],
        tags:[["Schlaf ↑","p"],["Muskelschutz","g"],["Stimmung","b"]] },
      { name:"Milch & Mandeln", icon:"🥛", kcal:240, p:26, c:22, f:9,
        items:[["300ml Vollmilch (warm)","193 kcal · 10g P · Tryptophan — fördert Schlaf"],["30g Whey (einrühren)","120 kcal · 26g P"],["10g Mandeln","60 kcal · Magnesium"]],
        tags:[["Schlaf ↑","p"],["Muskelschutz","g"],["Knochen","b"]] },
      { name:"Lachs-Avocado-Cracker", icon:"🐟", kcal:245, p:26, c:18, f:11,
        items:[["80g Räucherlachs","130 kcal · 20g P · Omega-3"],["4 Vollkorncracker","80 kcal"],["¼ Avocado","60 kcal · gesunde Fette"],["Zitrone + Dill","Vit. C, Antioxidantien"]],
        tags:[["Omega-3","b"],["Schlaf ↑","p"],["Haut","a"]] },
      { name:"Cottage Cheese & Kürbiskerne", icon:"🎃", kcal:230, p:29, c:16, f:8,
        items:[["250g Cottage Cheese","175 kcal · 28g P"],["20g Kürbiskerne","115 kcal · Zink, Tryptophan — Schlaf!"],["1 TL Honig","Energie, Antioxidantien"],["Prise Ingwerpulver","verdauungsfördernd"]],
        tags:[["Schlaf ↑","p"],["Testosteron","g"],["Muskelschutz","g"]] }
    ]
  }
};

// Kuratierter Supplement-Stack — evidenzbasiert, mit Standard-Einnahmezeit.
const SUPP_STACK = [
  { name:"Kreatin Monohydrat", icon:"⚡", dose:"5g täglich — kein Laden nötig", when:"Post-Workout oder morgens (Timing egal)", time:"16:30",
    body:"Kraft ↑ 10–15%, Muskelmasse ↑, Gehirnleistung ↑, Regeneration ↑. Das sicherste und wirksamste Bodybuilding-Supplement überhaupt. Pflicht." },
  { name:"Vitamin D3 + K2", icon:"🟡", dose:"3.000–5.000 IE D3 + 100µg K2 (MK-7)", when:"Morgens mit fetthaltiger Mahlzeit", time:"07:00",
    body:"Testosteron ↑, Immunsystem, Knochen, Stimmung, Schlaf. #1-Mangel in Deutschland — besonders im Winter." },
  { name:"Omega-3 Fischöl", icon:"🔵", dose:"2–3g EPA+DHA täglich", when:"Zum Abendessen", time:"19:30",
    body:"Anti-Entzündung, Gehirn & Fokus, Haut (Akne ↓), Gelenke, Stimmung, Cortisol ↓, Testosteron-Support, Herz." },
  { name:"Magnesium Glycinat", icon:"🟤", dose:"300–400mg täglich", when:"Abends 30–60 Min vor Schlaf", time:"21:30",
    body:"Schlaf ↑↑, Cortisol ↓, Muskelrelaxation, Testosteron-Support, Insulinsensitivität. Bei Training hoher Bedarf!" },
  { name:"Ashwagandha KSM-66", icon:"🌿", dose:"300–600mg täglich", when:"Morgens oder abends", time:"08:00",
    body:"Cortisol ↓ 30%, Testosteron ↑, Bürostress ↓, Schlaf ↑, Ausdauer ↑. Ideal für Kombination Bürojob + Training." },
  { name:"Vitamin C (gepuffert)", icon:"🍊", dose:"500–1000mg täglich", when:"Morgens", time:"07:00",
    body:"Kollagen-Synthese (Haut + Gelenke!), Immunsystem, Antioxidans, Eisenaufnahme ↑, Cortisol ↓ nach Training." },
  { name:"Zink Bisglycinat", icon:"🌊", dose:"15–25mg täglich", when:"Abends (nicht mit Eisen)", time:"21:00",
    body:"Testosteron-Synthese ↑, Immunsystem, Hautgesundheit (Akne ↓!), Haarwachstum, Wundheilung." },
  { name:"Vitamin B-Komplex (Methyl)", icon:"🔴", dose:"1 Kapsel täglich", when:"Morgens", time:"07:00",
    body:"Energie ↑, Nervensystem, B6 für Testosteron & Stimmung, Folat DNA-Schutz, Biotin für Haut/Haar/Nägel." },
  { name:"Probiotikum (Multi-Strain)", icon:"🧫", dose:"10–50 Mrd. KBE täglich", when:"Morgens nüchtern", time:"06:45",
    body:"Darmgesundheit, Haut-Darm-Achse (weniger Akne!), Immunsystem, Stimmung via Darm-Hirn-Achse." },
  { name:"Collagen-Peptide Typ I & III", icon:"💎", dose:"10g täglich + Vitamin C", when:"Morgens oder nach Training", time:"07:00",
    body:"Haut-Elastizität ↑, Gelenke schützen (wichtig mit zunehmendem Trainingsvolumen!), Haare & Nägel, Anti-Aging Prävention." },
  { name:"Rhodiola Rosea", icon:"🌱", dose:"200–400mg täglich", when:"Morgens oder vor Training (nicht abends)", time:"08:00",
    body:"Mentale Energie im Büro ↑, Fatigue ↓, Cortisol-Regulation, sportliche Performance ↑. Perfekt für Büro + Training-Doppelbelastung." }
];

