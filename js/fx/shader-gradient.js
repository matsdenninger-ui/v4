"use strict";
/* ============================================================
   ASCEND fx/shader-gradient.js — animierter 3D-Verlauf im Hintergrund
   Port des „Halo“-Presets aus shadergradient (defaults/plane-Shader):
   eine 10×10-Ebene mit 1×192 Segmenten wird per Perlin-Noise entlang
   ihrer Normalen verformt und mit drei Farben eingefärbt. Statt
   three.js/React läuft hier reines WebGL — gleiche Mathematik, kein
   Bundle. Farben folgen den Theme-Tokens (--ac/--sec, Hell/Dunkel).
   ============================================================ */
(function(){
  const canvas = document.getElementById("bgGradient");
  if(!canvas) return;
  const gl = canvas.getContext("webgl", { antialias:true, alpha:false, premultipliedAlpha:false, powerPreference:"low-power" });
  if(!gl){ canvas.remove(); return; }
  document.documentElement.classList.add("has-shader-bg");

  /* ---------- Shader: Vertex = shadergradient defaults/plane (cnoise-Verformung) ---------- */
  const VERT = `
precision highp float;
attribute vec3 aPos;
uniform mat4 uProj, uView, uModel;
uniform float uTime, uSpeed, uNoiseDensity, uNoiseStrength;
varying vec3 vPos;

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

void main(){
  float t = uTime * uSpeed;
  vec3 noisePos = 0.43 * aPos * uNoiseDensity;
  float distortion = 0.75 * cnoise(noisePos + t);
  vec3 pos = aPos + vec3(0.0, 0.0, 1.0) * distortion * uNoiseStrength;
  vPos = pos;
  gl_Position = uProj * uView * uModel * vec4(pos, 1.0);
}`;

  /* ---------- Fragment: Farbmischung wie im Original, Licht vereinfacht ---------- */
  const FRAG = `
precision highp float;
uniform vec3 uC1, uC2, uC3;
uniform float uBrightness, uLift;
varying vec3 vPos;
void main(){
  /* identisch zu shadergradient defaults/plane/fragment.glsl */
  vec3 col = mix(mix(uC1, uC2, smoothstep(-3.0, 3.0, vPos.x)), uC3, vPos.z);
  /* Ersatz für Ambient-Licht + Clearcoat: weicher Glanz auf den Wellenkämmen */
  col = clamp(col, 0.0, 1.0) * uBrightness;
  col += smoothstep(0.4, 1.6, vPos.z) * 0.05;
  /* uLift > 0 entspricht der sRGB-Ausgabe von three.js (pastelliger, hell) */
  col = mix(col, pow(clamp(col, 0.0, 1.0), vec3(1.0 / 2.2)), uLift);
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

  function compile(type, src){
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if(!gl.getShaderParameter(s, gl.COMPILE_STATUS)){ console.warn("shader-gradient:", gl.getShaderInfoLog(s)); return null; }
    return s;
  }
  const vs = compile(gl.VERTEX_SHADER, VERT), fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if(!vs || !fs){ canvas.remove(); document.documentElement.classList.remove("has-shader-bg"); return; }
  const prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if(!gl.getProgramParameter(prog, gl.LINK_STATUS)){ canvas.remove(); document.documentElement.classList.remove("has-shader-bg"); return; }
  gl.useProgram(prog);

  /* ---------- Geometrie: planeGeometry(10, 10, 1, 192) als Triangle-Strip-Liste ---------- */
  const SEG_X = 1, SEG_Y = 192, SIZE = 10;
  const verts = [];
  for(let iy = 0; iy <= SEG_Y; iy++){
    for(let ix = 0; ix <= SEG_X; ix++){
      verts.push(ix / SEG_X * SIZE - SIZE / 2, SIZE / 2 - iy / SEG_Y * SIZE, 0);
    }
  }
  const idx = [];
  for(let iy = 0; iy < SEG_Y; iy++){
    for(let ix = 0; ix < SEG_X; ix++){
      const a = iy * (SEG_X + 1) + ix, b = a + SEG_X + 1, c = b + 1, d = a + 1;
      idx.push(a, b, d, b, c, d);
    }
  }
  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);
  const ibo = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, "aPos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);

  const U = {};
  ["uProj","uView","uModel","uTime","uSpeed","uNoiseDensity","uNoiseStrength","uC1","uC2","uC3","uBrightness","uLift"]
    .forEach(n => U[n] = gl.getUniformLocation(prog, n));

  /* ---------- Matrizen (spaltenweise, wie WebGL sie erwartet) ---------- */
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
  function rotX(a){ const c=Math.cos(a), s=Math.sin(a); return new Float32Array([1,0,0,0, 0,c,s,0, 0,-s,c,0, 0,0,0,1]); }
  function rotY(a){ const c=Math.cos(a), s=Math.sin(a); return new Float32Array([c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,0,1]); }
  function rotZ(a){ const c=Math.cos(a), s=Math.sin(a); return new Float32Array([c,s,0,0, -s,c,0,0, 0,0,1,0, 0,0,0,1]); }
  function translate(x, y, z){ return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, x,y,z,1]); }

  /* Halo-Preset: position(-1.4,0,0), rotation(0°,10°,50°), Kamera Azimut 180° / Polar 90° / Abstand 3.6, FOV 45° */
  const PRESET = { density:1.3, speed:0.4, strength:4, posX:-1.4, rotX:0, rotY:10, rotZ:50, azimuth:180, polar:90, distance:3.6, fov:45 };
  const model = mul(translate(PRESET.posX, 0, 0), mul(rotX(PRESET.rotX*DEG), mul(rotY(PRESET.rotY*DEG), rotZ(PRESET.rotZ*DEG))));
  const th = PRESET.azimuth * DEG, ph = PRESET.polar * DEG;
  const eye = [PRESET.distance*Math.sin(ph)*Math.sin(th), PRESET.distance*Math.cos(ph), PRESET.distance*Math.sin(ph)*Math.cos(th)];
  gl.uniformMatrix4fv(U.uView, false, lookAt(eye, [0,0,0], [0,1,0]));
  gl.uniformMatrix4fv(U.uModel, false, model);
  gl.uniform1f(U.uSpeed, PRESET.speed);
  gl.uniform1f(U.uNoiseDensity, PRESET.density);
  gl.uniform1f(U.uNoiseStrength, PRESET.strength);

  /* ---------- Farben aus den Theme-Tokens, weich überblendet ---------- */
  function hexToRgb(str){
    const s = String(str).trim();
    let m = s.match(/^#([0-9a-f]{6})$/i);
    if(m){ const n = parseInt(m[1], 16); return [(n>>16&255)/255, (n>>8&255)/255, (n&255)/255]; }
    m = s.match(/^#([0-9a-f]{3})$/i);
    if(m){ return m[1].split("").map(h => parseInt(h+h, 16)/255); }
    m = s.match(/rgba?\(([^)]+)\)/);
    if(m){ const p = m[1].split(/[ ,/]+/).map(Number); return [p[0]/255, p[1]/255, p[2]/255]; }
    return [0.5, 0.5, 0.5];
  }
  function mixRgb(a, b, t){ return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t]; }
  function readTarget(){
    const cs = getComputedStyle(document.documentElement);
    const light = document.documentElement.getAttribute("data-theme") === "light";
    const ac = hexToRgb(cs.getPropertyValue("--ac")), sec = hexToRgb(cs.getPropertyValue("--sec"));
    const acL = hexToRgb(cs.getPropertyValue("--ac-light")), secL = hexToRgb(cs.getPropertyValue("--sec-light"));
    if(light){
      /* hell: pastellig wie das Original-Preset (Lift = sRGB-Ausgabe) */
      return { c1: mixRgb(secL, [1,1,1], .15), c2: mixRgb(acL, [1,1,1], .25), c3: [.86,.84,.95], bright: 1.05, lift: 1 };
    }
    /* dunkel: satte Akzentfarben, die in tiefes Fast-Schwarz auslaufen */
    return { c1: mixRgb(sec, [0,0,0], .25), c2: mixRgb(ac, [0,0,0], .15), c3: [.02,.018,.04], bright: .62, lift: 0 };
  }
  let cur = readTarget(), from = cur, to = cur, blendStart = 0;
  const BLEND_MS = 1400;
  function retarget(){ from = current(performance.now()); to = readTarget(); blendStart = performance.now(); requestFrame(); }
  function current(now){
    const k = Math.min(1, (now - blendStart) / BLEND_MS);
    const e = k < .5 ? 2*k*k : 1 - Math.pow(-2*k + 2, 2) / 2;
    return {
      c1: mixRgb(from.c1, to.c1, e), c2: mixRgb(from.c2, to.c2, e), c3: mixRgb(from.c3, to.c3, e),
      bright: from.bright + (to.bright - from.bright) * e, lift: from.lift + (to.lift - from.lift) * e, done: k >= 1
    };
  }
  new MutationObserver(retarget).observe(document.documentElement, { attributes:true, attributeFilter:["data-theme","data-period"] });

  /* ---------- Größe: Verlauf ist weich, halbe Auflösung reicht und spart GPU ---------- */
  const SCALE = 0.5;
  function resize(){
    const w = Math.max(1, Math.round(innerWidth * SCALE)), h = Math.max(1, Math.round(innerHeight * SCALE));
    if(canvas.width !== w || canvas.height !== h){ canvas.width = w; canvas.height = h; }
    gl.viewport(0, 0, w, h);
    /* Hochkant (Handy): FOV vergrößern, damit der Verlauf nicht zu einem Streifen wird */
    const aspect = w / h;
    const fov = aspect < 1 ? 2 * Math.atan(Math.tan(PRESET.fov * DEG / 2) / Math.max(aspect, .5)) : PRESET.fov * DEG;
    gl.uniformMatrix4fv(U.uProj, false, perspective(Math.min(fov, 110 * DEG), aspect, .1, 100));
    requestFrame();
  }
  addEventListener("resize", resize);

  /* ---------- Render-Loop: pausiert im Hintergrund-Tab, statisch bei reduzierter Bewegung ---------- */
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let raf = 0, last = performance.now(), elapsed = 7; // Startwert ≠ 0: interessantere erste Form
  function draw(now){
    raf = 0;
    const dt = Math.min(.1, (now - last) / 1000); last = now;
    if(!reduceMotion.matches) elapsed += dt;
    cur = current(now);
    gl.uniform1f(U.uTime, elapsed);
    gl.uniform3fv(U.uC1, cur.c1); gl.uniform3fv(U.uC2, cur.c2); gl.uniform3fv(U.uC3, cur.c3);
    gl.uniform1f(U.uBrightness, cur.bright); gl.uniform1f(U.uLift, cur.lift);
    gl.clearColor(cur.c3[0], cur.c3[1], cur.c3[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.drawElements(gl.TRIANGLES, idx.length, gl.UNSIGNED_SHORT, 0);
    canvas.classList.add("ready");
    if(!document.hidden && (!reduceMotion.matches || !cur.done)) raf = requestAnimationFrame(draw);
  }
  /* Neustart aus dem Ruhezustand: Zeitbasis zurücksetzen, damit kein Sprung entsteht */
  function requestFrame(){ if(!raf && !document.hidden){ last = performance.now(); raf = requestAnimationFrame(draw); } }
  document.addEventListener("visibilitychange", requestFrame);
  reduceMotion.addEventListener && reduceMotion.addEventListener("change", requestFrame);
  canvas.addEventListener("webglcontextlost", e => { e.preventDefault(); cancelAnimationFrame(raf); raf = 0; canvas.classList.remove("ready"); });
  resize();
})();
