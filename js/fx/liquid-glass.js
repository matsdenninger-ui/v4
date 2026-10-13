"use strict";
/* ============================================================
   ASCEND fx/liquid-glass.js — Liquid-Glass-Flächen
   Übernimmt das Prinzip aus liquid-glass-js: Lichtbrechung am Rand
   einer abgerundeten Form (edge/rim-Falloff über die SDF eines
   Rounded-Rect) plus Unschärfe und Tönung. Statt html2canvas-
   Schnappschuss + eigenem WebGL-Kontext pro Element erzeugen wir pro
   Größe eine Displacement-Map und hängen sie als SVG-Filter in
   backdrop-filter — so bricht das Glas den echten, animierten
   Hintergrund. Das kann nur Chromium; andere Browser behalten das
   reine CSS-Glas (Blur + Rim-Licht aus glass.css).
   Dazu: ein Glanzlicht, das dem Zeiger über Karten folgt.
   ============================================================ */
(function(){
  const root = document.documentElement;

  /* ---------- 1) Glanzlicht folgt dem Zeiger (alle Browser) ---------- */
  const SHEEN = ".card,.stat,.mission-card,.hchip,.level-card";
  let sheenEl = null;
  document.addEventListener("pointermove", e => {
    if(e.pointerType !== "mouse") return;
    const el = e.target.closest && e.target.closest(SHEEN);
    if(sheenEl && sheenEl !== el) sheenEl.classList.remove("lg-lit");
    sheenEl = el;
    if(!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", (e.clientX - r.left) + "px");
    el.style.setProperty("--my", (e.clientY - r.top) + "px");
    el.classList.add("lg-lit");
  }, { passive:true });
  document.addEventListener("pointerleave", () => { if(sheenEl) sheenEl.classList.remove("lg-lit"); sheenEl = null; });

  /* ---------- 2) Echte Lichtbrechung (nur Chromium: backdrop-filter mit url()) ---------- */
  const isChromium = !!(window.chrome || (navigator.userAgentData && navigator.userAgentData.brands &&
    navigator.userAgentData.brands.some(b => /Chromium/i.test(b.brand))));
  const reduceTransparency = matchMedia("(prefers-reduced-transparency: reduce)");
  if(!isChromium || reduceTransparency.matches) return;

  /* Parameter angelehnt an die Defaults von liquid-glass-js (edgeIntensity, rimDistance, blurRadius …) */
  const GLASS = { edgeWidth:14, strength:1, scale:26 };

  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("width", "0"); svg.setAttribute("height", "0");
  svg.setAttribute("aria-hidden", "true");
  svg.style.cssText = "position:absolute;width:0;height:0;pointer-events:none";
  document.body.appendChild(svg);

  let seq = 0;
  const filters = new Map(); // Element → { f, im, key }

  /* Displacement-Map: R = x-Versatz, G = y-Versatz (128 = keiner).
     Wie im liquid-glass-js-Shader: Normale aus der SDF des Rounded-Rect,
     Stärke fällt quadratisch vom Rand nach innen ab. */
  function buildMap(w, h, radius){
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    const img = ctx.createImageData(w, h), d = img.data;
    const hw = w / 2, hh = h / 2, r = Math.min(radius, hw, hh), ew = GLASS.edgeWidth;
    for(let y = 0; y < h; y++){
      for(let x = 0; x < w; x++){
        const px = x + .5 - hw, py = y + .5 - hh;
        const qx = Math.abs(px) - (hw - r), qy = Math.abs(py) - (hh - r);
        const ox = Math.max(qx, 0), oy = Math.max(qy, 0);
        const sd = Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - r; // < 0 innen
        let dx = 0, dy = 0;
        const dist = -sd;
        if(dist >= 0 && dist < ew){
          let nx, ny;
          if(qx > 0 && qy > 0){ const l = Math.hypot(ox, oy) || 1; nx = ox / l; ny = oy / l; }
          else if(qx > qy){ nx = 1; ny = 0; } else { nx = 0; ny = 1; }
          nx *= Math.sign(px) || 1; ny *= Math.sign(py) || 1;
          const k = Math.pow(1 - dist / ew, 2) * GLASS.strength;
          /* nach innen ziehen → Hintergrund am Rand wirkt wie durch eine Linse gewölbt */
          dx = -nx * k; dy = -ny * k;
        }
        const i = (y * w + x) * 4;
        d[i] = 128 + dx * 127; d[i+1] = 128 + dy * 127; d[i+2] = 128; d[i+3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c.toDataURL();
  }

  /* Ein Filter pro Element; bei Größenänderung wird nur die Map ersetzt */
  function filterFor(el, w, h, radius){
    let rec = filters.get(el);
    if(!rec){
      const id = "lg-refract-" + (++seq);
      const f = document.createElementNS(svgNS, "filter");
      f.setAttribute("id", id);
      f.setAttribute("x", "0"); f.setAttribute("y", "0");
      f.setAttribute("filterUnits", "userSpaceOnUse");
      f.setAttribute("primitiveUnits", "userSpaceOnUse");
      f.setAttribute("color-interpolation-filters", "sRGB");
      const im = document.createElementNS(svgNS, "feImage");
      im.setAttribute("x", "0"); im.setAttribute("y", "0");
      im.setAttribute("preserveAspectRatio", "none");
      im.setAttribute("result", "map");
      const dm = document.createElementNS(svgNS, "feDisplacementMap");
      dm.setAttribute("in", "SourceGraphic"); dm.setAttribute("in2", "map");
      dm.setAttribute("scale", GLASS.scale);
      dm.setAttribute("xChannelSelector", "R"); dm.setAttribute("yChannelSelector", "G");
      f.append(im, dm);
      svg.appendChild(f);
      rec = { id, f, im, key:"" };
      filters.set(el, rec);
    }
    const key = w + "x" + h + "x" + radius;
    if(rec.key !== key){
      rec.key = key;
      for(const n of [rec.f, rec.im]){ n.setAttribute("width", w); n.setAttribute("height", h); }
      rec.im.setAttribute("href", buildMap(w, h, radius));
    }
    return rec.id;
  }

  /* Nur ausgewählte, eher kleine Flächen bekommen echte Brechung — große Karten
     bleiben beim günstigen CSS-Glas (Performance auf schwachen Geräten). */
  const TARGETS = ".burger,.seg-tabs,.body-tabs,.mission-card,.topbar-badge,.toast";
  function apply(el){
    const r = el.getBoundingClientRect();
    const w = Math.round(r.width), h = Math.round(r.height);
    if(w < 8 || h < 8 || w > 2400 || h > 600) return;
    const radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
    const id = filterFor(el, w, h, Math.round(radius));
    el.style.setProperty("--lg-refract", `url(#${id})`);
    el.classList.add("lg-refract");
  }
  /* Größenänderungen sammeln (Fenster-Resize feuert dutzendfach) */
  const pending = new Set(); let timer = 0;
  const ro = new ResizeObserver(entries => {
    entries.forEach(e => pending.add(e.target));
    clearTimeout(timer);
    timer = setTimeout(() => { pending.forEach(apply); pending.clear(); }, 120);
  });
  const seen = new Set();
  function scan(){
    document.querySelectorAll(TARGETS).forEach(el => { if(!seen.has(el)){ seen.add(el); ro.observe(el); } });
    /* entfernte Elemente (z. B. ausgeblendete Toasts) samt Filter aufräumen */
    seen.forEach(el => {
      if(el.isConnected) return;
      seen.delete(el); ro.unobserve(el);
      const rec = filters.get(el); if(rec){ rec.f.remove(); filters.delete(el); }
    });
  }
  let scanQueued = false;
  const queueScan = () => { if(!scanQueued){ scanQueued = true; requestAnimationFrame(() => { scanQueued = false; scan(); }); } };
  root.classList.add("lg-chromium");
  scan();
  /* Toasts & dynamisch gerenderte Elemente */
  new MutationObserver(queueScan).observe(document.body, { childList:true, subtree:true });
})();
