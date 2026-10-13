"use strict";
/* ============================================================
   ASCEND fx/shader-gradient.js — lebendige 3D-Flüssigkeit im Hintergrund
   Basis: „Universe“-Preset aus shadergradient (waterPlane, defaults-
   Shader): ein 192×192-Gitter wird per Perlin-Noise zu echten Wellen
   verformt und mit drei Farben eingefärbt. Darüber hinaus:
   - Licht wie auf nasser Seide: Glanzpunkte, Fresnel-Rand und
     schillernde Dünnschicht-Farben (Idee aus dem cosmic-Shader)
   - Kamera schwebt langsam, folgt sanft Maus und Scrollen (Parallaxe)
   - XP-Gewinn lässt die Wellen kurz anschwellen und leuchten,
     ein Level-Up löst eine große Welle aus
   Reines WebGL, kein three.js. Farben folgen --ac/--sec und Hell/Dunkel.
   ============================================================ */
(function(){
  const canvas = document.getElementById("bgGradient");
  if(!canvas) return;
  const gl = canvas.getContext("webgl", { antialias:true, alpha:false, premultipliedAlpha:false, powerPreference:"low-power" });
  if(!gl){ canvas.remove(); return; }
  const root = document.documentElement;
  root.classList.add("has-shader-bg");

  /* ---------- Vertex: Verformung wie shadergradient + Normale per Differenzen ---------- */
  const VERT = `
precision highp float;
attribute vec3 aPos;
uniform mat4 uProj, uView, uModel;
uniform float uTime, uSpeed, uNoiseDensity, uNoiseStrength, uSurge;
varying vec3 vPos;
varying vec3 vWorld;
varying vec3 vNormal;

vec3 mod289(vec3 x){ return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x){ return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x){ return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }
vec3 fade(vec3 t){ return t*t*t*(t*(t*6.0-15.0)+10.0); }
float cnoise(vec3 P){
  vec3 Pi0 = floor(P); vec3 Pi1 = Pi0 + vec3(1.0);
  Pi0 = mod289(Pi0); Pi1 = mod289(Pi1);
  vec3 Pf0 = fract(P); vec3 Pf1 = Pf0 - vec3(1.0);
  vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
  vec4 iy = vec4(Pi0.yy, Pi1.yy);
  vec4 iz0 = Pi0.zzzz; vec4 iz1 = Pi1.zzzz;
  vec4 ixy = permute(permute(ix) + iy);
  vec4 ixy0 = permute(ixy + iz0); vec4 ixy1 = permute(ixy + iz1);
  vec4 gx0 = ixy0 * (1.0 / 7.0);
  vec4 gy0 = fract(floor(gx0) * (1.0 / 7.0)) - 0.5;
  gx0 = fract(gx0);
  vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
  vec4 sz0 = step(gz0, vec4(0.0));
  gx0 -= sz0 * (step(0.0, gx0) - 0.5);
  gy0 -= sz0 * (step(0.0, gy0) - 0.5);
  vec4 gx1 = ixy1 * (1.0 / 7.0);
  vec4 gy1 = fract(floor(gx1) * (1.0 / 7.0)) - 0.5;
  gx1 = fract(gx1);
  vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
  vec4 sz1 = step(gz1, vec4(0.0));
  gx1 -= sz1 * (step(0.0, gx1) - 0.5);
  gy1 -= sz1 * (step(0.0, gy1) - 0.5);
  vec3 g000 = vec3(gx0.x,gy0.x,gz0.x); vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);
  vec3 g010 = vec3(gx0.z,gy0.z,gz0.z); vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);
  vec3 g001 = vec3(gx1.x,gy1.x,gz1.x); vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);
  vec3 g011 = vec3(gx1.z,gy1.z,gz1.z); vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);
  vec4 norm0 = taylorInvSqrt(vec4(dot(g000,g000), dot(g010,g010), dot(g100,g100), dot(g110,g110)));
  g000 *= norm0.x; g010 *= norm0.y; g100 *= norm0.z; g110 *= norm0.w;
  vec4 norm1 = taylorInvSqrt(vec4(dot(g001,g001), dot(g011,g011), dot(g101,g101), dot(g111,g111)));
  g001 *= norm1.x; g011 *= norm1.y; g101 *= norm1.z; g111 *= norm1.w;
  float n000 = dot(g000, Pf0);
  float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));
  float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));
  float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));
  float n001 = dot(g001, vec3(Pf0.xy, Pf1.z));
  float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));
  float n011 = dot(g011, vec3(Pf0.x, Pf1.yz));
  float n111 = dot(g111, Pf1);
  vec3 fade_xyz = fade(Pf0);
  vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);
  vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);
  return 2.2 * mix(n_yz.x, n_yz.y, fade_xyz.x);
}

/* Höhe an Punkt p: Formel aus shadergradient defaults (0.75 · cnoise(0.43 · p · density + t)) */
float height(vec2 p, float t){
  return 0.75 * cnoise(vec3(0.43 * p * uNoiseDensity, 0.0) + t) * uNoiseStrength * (1.0 + 0.35 * uSurge);
}

void main(){
  float t = uTime * uSpeed;
  vec2 p = aPos.xy;
  float h = height(p, t);
  float e = 0.06;
  vec3 dx = vec3(e, 0.0, height(p + vec2(e, 0.0), t) - h);
  vec3 dy = vec3(0.0, e, height(p + vec2(0.0, e), t) - h);
  vec3 pos = vec3(p, h);
  vPos = pos;
  vec4 world = uModel * vec4(pos, 1.0);
  vWorld = world.xyz;
  vNormal = mat3(uModel) * normalize(cross(dx, dy));
  gl_Position = uProj * uView * world;
}`;

  const FRAG = `
precision highp float;
uniform vec3 uC1, uC2, uC3, uEye;
uniform float uBrightness, uLift, uTime, uSurge, uSurgePos, uGloss;
varying vec3 vPos;
varying vec3 vWorld;
varying vec3 vNormal;
void main(){
  /* Grundfarbe identisch zu shadergradient defaults/waterPlane */
  vec3 base = clamp(mix(mix(uC1, uC2, smoothstep(-3.0, 3.0, vPos.x)), uC3, vPos.z), 0.0, 1.0);

  vec3 N = normalize(vNormal);
  vec3 V = normalize(uEye - vWorld);
  if(dot(N, V) < 0.0) N = -N;                       // beidseitig beleuchten
  vec3 L = normalize(vec3(-0.45 + 0.15 * sin(uTime * 0.07), 0.65, 0.6));
  float ndl = max(dot(N, L), 0.0);
  float ndv = max(dot(N, V), 0.0);

  /* Dünnschicht-Schimmer (cosmic-Shader): Farbe kippt mit Blickwinkel und Höhe */
  float fres = pow(1.0 - ndv, 3.0);
  vec3 irid = 0.5 + 0.5 * cos(6.2831 * (fres * 1.4 + vPos.z * 0.22 + uTime * 0.02 + vec3(0.0, 0.33, 0.67)));

  vec3 col = base * (0.62 + 0.48 * ndl) * uBrightness;
  float spec = pow(max(dot(N, normalize(L + V)), 0.0), 70.0) * uGloss;
  col += spec * mix(vec3(1.0), irid, 0.6);
  col += fres * 0.28 * mix(uC2, irid, 0.7) * uGloss;
  /* Sättigung anheben, damit die Akzentfarben satt statt grau wirken */
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(lum), col, 1.35);

  /* XP-Welle: leuchtendes Band, das über die Fläche läuft */
  float band = exp(-pow((vPos.y + vPos.x * 0.35 - uSurgePos) * 0.9, 2.0));
  col += mix(uC1, uC2, 0.5 + 0.5 * sin(vPos.x)) * band * uSurge * 0.55;
  col += base * uSurge * 0.18;

  col = mix(col, pow(clamp(col, 0.0, 1.0), vec3(1.0 / 2.2)), uLift);
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

  function compile(type, src){
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if(!gl.getShaderParameter(s, gl.COMPILE_STATUS)){ console.warn("shader-gradient:", gl.getShaderInfoLog(s)); return null; }
    return s;
  }
  const bail = () => { canvas.remove(); root.classList.remove("has-shader-bg"); };
  const vs = compile(gl.VERTEX_SHADER, VERT), fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if(!vs || !fs){ bail(); return; }
  const prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if(!gl.getProgramParameter(prog, gl.LINK_STATUS)){ bail(); return; }
  gl.useProgram(prog);

  /* ---------- Geometrie: planeGeometry(10, 10, n, n) wie waterPlane; schwächere Geräte bekommen weniger Gitter ---------- */
  const small = Math.min(screen.width, screen.height) < 600 || (navigator.hardwareConcurrency || 8) <= 4;
  const SEG = small ? 120 : 192, SIZE = 10;
  const verts = new Float32Array((SEG + 1) * (SEG + 1) * 3);
  let vi = 0;
  for(let iy = 0; iy <= SEG; iy++) for(let ix = 0; ix <= SEG; ix++){
    verts[vi++] = ix / SEG * SIZE - SIZE / 2; verts[vi++] = SIZE / 2 - iy / SEG * SIZE; verts[vi++] = 0;
  }
  const idx = new Uint16Array(SEG * SEG * 6);
  let ii = 0;
  for(let iy = 0; iy < SEG; iy++) for(let ix = 0; ix < SEG; ix++){
    const a = iy * (SEG + 1) + ix, b = a + SEG + 1, c = b + 1, d = a + 1;
    idx[ii++] = a; idx[ii++] = b; idx[ii++] = d; idx[ii++] = b; idx[ii++] = c; idx[ii++] = d;
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, "aPos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);
  gl.enable(gl.DEPTH_TEST);

  const U = {};
  ["uProj","uView","uModel","uTime","uSpeed","uNoiseDensity","uNoiseStrength","uC1","uC2","uC3","uEye",
   "uBrightness","uLift","uSurge","uSurgePos","uGloss"].forEach(n => U[n] = gl.getUniformLocation(prog, n));

  /* ---------- Matrizen (spaltenweise) ---------- */
  const DEG = Math.PI / 180;
  function mul(a, b){
    const o = new Float32Array(16);
    for(let c = 0; c < 4; c++) for(let r = 0; r < 4; r++){
      let s = 0; for(let k = 0; k < 4; k++) s += a[k*4 + r] * b[c*4 + k];
      o[c*4 + r] = s;
    }
    return o;
  }
  function perspective(fov, aspect, near, far){
    const f = 1 / Math.tan(fov / 2), nf = 1 / (near - far);
    return new Float32Array([f/aspect,0,0,0, 0,f,0,0, 0,0,(far+near)*nf,-1, 0,0,2*far*near*nf,0]);
  }
  function lookAt(eye, target, up){
    let zx = eye[0]-target[0], zy = eye[1]-target[1], zz = eye[2]-target[2];
    let l = Math.hypot(zx, zy, zz); zx/=l; zy/=l; zz/=l;
    let xx = up[1]*zz - up[2]*zy, xy = up[2]*zx - up[0]*zz, xz = up[0]*zy - up[1]*zx;
    l = Math.hypot(xx, xy, xz); xx/=l; xy/=l; xz/=l;
    const yx = zy*xz - zz*xy, yy = zz*xx - zx*xz, yz = zx*xy - zy*xx;
    return new Float32Array([
      xx,yx,zx,0, xy,yy,zy,0, xz,yz,zz,0,
      -(xx*eye[0]+xy*eye[1]+xz*eye[2]), -(yx*eye[0]+yy*eye[1]+yz*eye[2]), -(zx*eye[0]+zy*eye[1]+zz*eye[2]), 1
    ]);
  }
  function rotZ(a){ const c=Math.cos(a), s=Math.sin(a); return new Float32Array([c,s,0,0, -s,c,0,0, 0,0,1,0, 0,0,0,1]); }
  function translate(x, y, z){ return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, x,y,z,1]); }

  /* Universe-Preset (position −0.5/0.1/0, rotationZ 235°, Kamera Azimut 180° / Polar 115° / Abstand 3.9),
     etwas schneller und kräftiger, damit es lebt */
  const PRESET = { density:1.1, speed:0.16, strength:2.6, azimuth:180, polar:115, distance:3.9, fov:45 };
  gl.uniformMatrix4fv(U.uModel, false, mul(translate(-0.5, 0.1, 0), rotZ(235 * DEG)));
  gl.uniform1f(U.uSpeed, PRESET.speed);
  gl.uniform1f(U.uNoiseDensity, PRESET.density);
  gl.uniform1f(U.uNoiseStrength, PRESET.strength);

  /* ---------- Farben aus den Theme-Tokens, weich überblendet ---------- */
  function toRgb(str){
    const s = String(str).trim();
    let m = s.match(/^#([0-9a-f]{6})$/i);
    if(m){ const n = parseInt(m[1], 16); return [(n>>16&255)/255, (n>>8&255)/255, (n&255)/255]; }
    m = s.match(/^#([0-9a-f]{3})$/i);
    if(m) return m[1].split("").map(h => parseInt(h+h, 16)/255);
    m = s.match(/rgba?\(([^)]+)\)/);
    if(m){ const p = m[1].split(/[ ,/]+/).map(Number); return [p[0]/255, p[1]/255, p[2]/255]; }
    return [.5, .5, .5];
  }
  const mixRgb = (a, b, t) => [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t];
  function readTarget(){
    const cs = getComputedStyle(root);
    const v = n => toRgb(cs.getPropertyValue(n));
    if(root.getAttribute("data-theme") === "light"){
      return { c1: mixRgb(v("--ac-light"), [1,1,1], .1), c2: mixRgb(v("--sec-light"), [1,1,1], .2), c3: [.93,.91,.99], bright: 1.0, lift: 1, gloss: .55 };
    }
    /* dunkel: Akzentfarben gleiten in Schwarz — wie das Universe-Preset (#5606ff → #fe8989 → #000) */
    return { c1: v("--ac"), c2: v("--sec"), c3: [0,0,0], bright: .85, lift: 0, gloss: 1 };
  }
  let from = readTarget(), to = from, blendStart = -1e9;
  const BLEND_MS = 1400;
  function current(now){
    const k = Math.min(1, (now - blendStart) / BLEND_MS);
    const e = k < .5 ? 2*k*k : 1 - Math.pow(-2*k + 2, 2) / 2;
    const o = { done: k >= 1 };
    for(const key of ["c1","c2","c3"]) o[key] = mixRgb(from[key], to[key], e);
    for(const key of ["bright","lift","gloss"]) o[key] = from[key] + (to[key] - from[key]) * e;
    return o;
  }
  new MutationObserver(() => { from = current(performance.now()); to = readTarget(); blendStart = performance.now(); wake(); })
    .observe(root, { attributes:true, attributeFilter:["data-theme","data-period"] });

  /* ---------- Interaktion: Maus-/Scroll-Parallaxe ---------- */
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let mx = 0, my = 0, sx = 0, smx = 0, smy = 0, ssx = 0;
  addEventListener("pointermove", e => {
    if(e.pointerType !== "mouse") return;
    mx = e.clientX / innerWidth - .5; my = e.clientY / innerHeight - .5; wake();
  }, { passive:true });
  addEventListener("scroll", () => {
    const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    sx = Math.min(1, scrollY / max); wake();
  }, { passive:true });

  /* ---------- XP-Reaktion: Funktionen aus xp.js sanft umhüllen ---------- */
  let surge = 0, surgeTarget = 0, surgePos = -8;
  function pulse(amount){
    if(reduceMotion.matches) return;
    surgeTarget = Math.min(1.6, surgeTarget + amount);
    surgePos = -8; wake();
  }
  if(typeof window.addXP === "function"){
    const orig = window.addXP;
    window.addXP = function(n){ if(n > 0) pulse(Math.min(.9, .35 + n / 60)); return orig.apply(this, arguments); };
  }
  if(typeof window.showLevelUp === "function"){
    const orig = window.showLevelUp;
    window.showLevelUp = function(){ pulse(1.4); return orig.apply(this, arguments); };
  }

  /* ---------- Größe ---------- */
  const SCALE = small ? .5 : .6;
  let aspect = 1;
  function resize(){
    const w = Math.max(1, Math.round(innerWidth * SCALE)), h = Math.max(1, Math.round(innerHeight * SCALE));
    if(canvas.width !== w || canvas.height !== h){ canvas.width = w; canvas.height = h; }
    gl.viewport(0, 0, w, h);
    aspect = w / h;
    /* Hochkant: FOV vergrößern, damit die Wellen nicht zu einem Streifen werden */
    const fov = aspect < 1 ? 2 * Math.atan(Math.tan(PRESET.fov * DEG / 2) / Math.max(aspect, .5)) : PRESET.fov * DEG;
    gl.uniformMatrix4fv(U.uProj, false, perspective(Math.min(fov, 110 * DEG), aspect, .1, 100));
    wake();
  }
  addEventListener("resize", resize);

  /* ---------- Render-Loop ---------- */
  let raf = 0, last = 0, elapsed = 11;
  function draw(now){
    raf = 0;
    const dt = last ? Math.min(.1, (now - last) / 1000) : 0; last = now;
    const still = reduceMotion.matches;
    if(!still) elapsed += dt;

    /* Kamera: langsames Schweben + gedämpftes Nachziehen von Maus und Scroll */
    const k = 1 - Math.exp(-dt * 2.5);
    smx += (mx - smx) * k; smy += (my - smy) * k; ssx += (sx - ssx) * k;
    const az = (PRESET.azimuth + (still ? 0 : Math.sin(elapsed * .045) * 9 + smx * 14)) * DEG;
    const po = (PRESET.polar + (still ? 0 : Math.sin(elapsed * .031) * 4 + smy * 8 - ssx * 10)) * DEG;
    const dist = PRESET.distance - ssx * .5;
    const eye = [dist*Math.sin(po)*Math.sin(az), dist*Math.cos(po), dist*Math.sin(po)*Math.cos(az)];
    gl.uniformMatrix4fv(U.uView, false, lookAt(eye, [0, 0, 0], [0, 1, 0]));
    gl.uniform3fv(U.uEye, eye);

    /* XP-Welle: schnell an, langsam ab; das Leuchtband läuft quer über die Fläche */
    surge += (surgeTarget - surge) * (1 - Math.exp(-dt * 6));
    surgeTarget *= Math.exp(-dt * 1.1);
    surgePos += dt * 9;
    gl.uniform1f(U.uSurge, surge);
    gl.uniform1f(U.uSurgePos, surgePos);

    const c = current(now);
    gl.uniform1f(U.uTime, elapsed);
    gl.uniform3fv(U.uC1, c.c1); gl.uniform3fv(U.uC2, c.c2); gl.uniform3fv(U.uC3, c.c3);
    gl.uniform1f(U.uBrightness, c.bright); gl.uniform1f(U.uLift, c.lift); gl.uniform1f(U.uGloss, c.gloss);
    gl.clearColor(c.c3[0], c.c3[1], c.c3[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.drawElements(gl.TRIANGLES, idx.length, gl.UNSIGNED_SHORT, 0);
    canvas.classList.add("ready");

    const settling = Math.abs(mx - smx) + Math.abs(my - smy) + Math.abs(sx - ssx) > .001 || surge > .002 || !c.done;
    if(!document.hidden && (!still || settling)) raf = requestAnimationFrame(draw);
  }
  function wake(){ if(!raf && !document.hidden){ last = 0; raf = requestAnimationFrame(draw); } }
  document.addEventListener("visibilitychange", wake);
  reduceMotion.addEventListener && reduceMotion.addEventListener("change", wake);
  canvas.addEventListener("webglcontextlost", e => { e.preventDefault(); cancelAnimationFrame(raf); raf = 0; canvas.classList.remove("ready"); });
  resize();
})();
