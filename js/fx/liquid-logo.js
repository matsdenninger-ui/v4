"use strict";
/* ============================================================
   ASCEND fx/liquid-logo.js — Brand-Mark „A“ als flüssiges Metall
   Port von liquid-logo (paper.design): Die Form wird zu einer
   Höhenkarte (Poisson-Lösung → abgeschrägte Kante) und der
   liquid-Fragment-Shader zeichnet darauf animierte Metallstreifen.
   Ohne WebGL bleibt das bisherige Text-„A“ stehen.
   ============================================================ */
(function(){
  const marks = document.querySelectorAll(".brand-mark[data-liquid]");
  if(!marks.length) return;

  /* Parameter = defaultParams aus liquid-logo/src/hero/params.ts */
  const PARAMS = { patternScale:2, refraction:0.015, edge:0.4, patternBlur:0.005, liquid:0.07, speed:0.3 };

  const VERT = `
attribute vec2 a_position;
varying vec2 vUv;
void main(){ vUv = .5 * (a_position + 1.); gl_Position = vec4(a_position, 0., 1.); }`;

  /* liquid-frag.ts, nach GLSL ES 1.0 übertragen (texture → texture2D); u_tint färbt die dunklen Streifen im Akzentton */
  const FRAG = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D u_image_texture;
uniform float u_time, u_ratio, u_img_ratio, u_patternScale, u_refraction, u_edge, u_patternBlur, u_liquid;
uniform vec3 u_tint;
#define PI 3.14159265358979323846
vec3 mod289(vec3 x){ return x - floor(x * (1. / 289.)) * 289.; }
vec2 mod289(vec2 x){ return x - floor(x * (1. / 289.)) * 289.; }
vec3 permute(vec3 x){ return mod289(((x*34.)+1.)*x); }
float snoise(vec2 v){
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1., 0.) : vec2(0., 1.);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0., i1.y, 1.)) + i.x + vec3(0., i1.x, 1.));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.);
  m = m*m; m = m*m;
  vec3 x = 2. * fract(p * C.www) - 1.;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130. * dot(m, g);
}
vec2 get_img_uv(){
  vec2 img_uv = vUv - .5;
  if(u_ratio > u_img_ratio){ img_uv.x = img_uv.x * u_ratio / u_img_ratio; }
  else { img_uv.y = img_uv.y * u_img_ratio / u_ratio; }
  img_uv += .5;
  img_uv.y = 1. - img_uv.y;
  return img_uv;
}
vec2 rotate(vec2 uv, float th){ return mat2(cos(th), sin(th), -sin(th), cos(th)) * uv; }
float get_color_channel(float c1, float c2, float stripe_p, vec3 w, float extra_blur, float b){
  float ch = c2;
  float border = 0.;
  float blur = u_patternBlur + extra_blur;
  ch = mix(ch, c1, smoothstep(.0, blur, stripe_p));
  border = w[0];
  ch = mix(ch, c2, smoothstep(border - blur, border + blur, stripe_p));
  b = smoothstep(.2, .8, b);
  border = w[0] + .4 * (1. - b) * w[1];
  ch = mix(ch, c1, smoothstep(border - blur, border + blur, stripe_p));
  border = w[0] + .5 * (1. - b) * w[1];
  ch = mix(ch, c2, smoothstep(border - blur, border + blur, stripe_p));
  border = w[0] + w[1];
  ch = mix(ch, c1, smoothstep(border - blur, border + blur, stripe_p));
  float gradient_t = (stripe_p - w[0] - w[1]) / w[2];
  float gradient = mix(c1, c2, smoothstep(0., 1., gradient_t));
  ch = mix(ch, gradient, smoothstep(border - blur, border + blur, stripe_p));
  return ch;
}
float get_img_frame_alpha(vec2 uv, float f){
  float a = smoothstep(0., f, uv.x) * smoothstep(1., 1. - f, uv.x);
  a *= smoothstep(0., f, uv.y) * smoothstep(1., 1. - f, uv.y);
  return a;
}
void main(){
  vec2 uv = vUv;
  uv.y = 1. - uv.y;
  uv.x *= u_ratio;
  float diagonal = uv.x - uv.y;
  float t = .001 * u_time;
  vec2 img_uv = get_img_uv();
  vec4 img = texture2D(u_image_texture, img_uv);
  vec3 color1 = vec3(.98, .98, 1.);
  vec3 color2 = mix(vec3(.1, .1, .1 + .1 * smoothstep(.7, 1.3, uv.x + uv.y)), u_tint, .45);
  float edge = img.r;
  vec2 grad_uv = uv - .5;
  float dist = length(grad_uv + vec2(0., .2 * diagonal));
  grad_uv = rotate(grad_uv, (.25 - .2 * diagonal) * PI);
  float bulge = pow(1.8 * dist, 1.2);
  bulge = 1. - bulge;
  bulge *= pow(uv.y, .3);
  float cycle_width = u_patternScale;
  float thin_strip_1_ratio = .12 / cycle_width * (1. - .4 * bulge);
  float thin_strip_2_ratio = .07 / cycle_width * (1. + .4 * bulge);
  float wide_strip_ratio = (1. - thin_strip_1_ratio - thin_strip_2_ratio);
  float thin_strip_1_width = cycle_width * thin_strip_1_ratio;
  float thin_strip_2_width = cycle_width * thin_strip_2_ratio;
  float opacity = 1. - smoothstep(.9 - .5 * u_edge, 1. - .5 * u_edge, edge);
  opacity *= get_img_frame_alpha(img_uv, 0.01);
  float noise = snoise(uv - t);
  edge += (1. - edge) * u_liquid * noise;
  float refr = clamp(1. - bulge, 0., 1.);
  float dir = grad_uv.x + diagonal;
  dir -= 2. * noise * diagonal * (smoothstep(0., 1., edge) * smoothstep(1., 0., edge));
  bulge *= clamp(pow(uv.y, .1), .3, 1.);
  dir *= (.1 + (1.1 - edge) * bulge);
  dir *= smoothstep(1., .7, edge);
  dir += .18 * (smoothstep(.1, .2, uv.y) * smoothstep(.4, .2, uv.y));
  dir += .03 * (smoothstep(.1, .2, 1. - uv.y) * smoothstep(.4, .2, 1. - uv.y));
  dir *= (.5 + .5 * pow(uv.y, 2.));
  dir *= cycle_width;
  dir -= t;
  float refr_r = refr + .03 * bulge * noise;
  float refr_b = 1.3 * refr;
  refr_r += 5. * (smoothstep(-.1, .2, uv.y) * smoothstep(.5, .1, uv.y)) * (smoothstep(.4, .6, bulge) * smoothstep(1., .4, bulge));
  refr_r -= diagonal;
  refr_b += (smoothstep(0., .4, uv.y) * smoothstep(.8, .1, uv.y)) * (smoothstep(.4, .6, bulge) * smoothstep(.8, .4, bulge));
  refr_b -= .2 * edge;
  refr_r *= u_refraction;
  refr_b *= u_refraction;
  vec3 w = vec3(thin_strip_1_width, thin_strip_2_width, wide_strip_ratio);
  w[1] -= .02 * smoothstep(.0, 1., edge + bulge);
  float r = get_color_channel(color1.r, color2.r, mod(dir + refr_r, 1.), w, 0.02 + .03 * u_refraction * bulge, bulge);
  float g = get_color_channel(color1.g, color2.g, mod(dir, 1.), w, 0.01 / (1. - diagonal), bulge);
  float b = get_color_channel(color1.b, color2.b, mod(dir - refr_b, 1.), w, .01, bulge);
  gl_FragColor = vec4(vec3(r, g, b) * opacity, opacity);
}`;

  /* ---------- Höhenkarte: parse-logo-image.ts (Maske → Rand → Poisson → Remap) ---------- */
  function drawLogoShape(ctx, S){
    /* Ascend-„A“: zwei kräftige Schenkel zur Spitze + Querbalken, runde Enden */
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.strokeStyle = "#000"; ctx.lineWidth = S * .17;
    ctx.beginPath();
    ctx.moveTo(S*.20, S*.84); ctx.lineTo(S*.50, S*.16); ctx.lineTo(S*.80, S*.84);
    ctx.moveTo(S*.34, S*.60); ctx.lineTo(S*.66, S*.60);
    ctx.stroke();
  }
  function buildHeightMap(S){
    const c = document.createElement("canvas"); c.width = c.height = S;
    const ctx = c.getContext("2d");
    drawLogoShape(ctx, S);
    const src = ctx.getImageData(0, 0, S, S).data;
    const N = S * S, mask = new Uint8Array(N), boundary = new Uint8Array(N);
    for(let i = 0; i < N; i++) mask[i] = src[i*4 + 3] > 127 ? 1 : 0;
    const inside = (x, y) => x >= 0 && x < S && y >= 0 && y < S && mask[y*S + x] === 1;
    for(let y = 0; y < S; y++) for(let x = 0; x < S; x++){
      const i = y*S + x; if(!mask[i]) continue;
      outer: for(let ny = y-1; ny <= y+1; ny++) for(let nx = x-1; nx <= x+1; nx++){
        if(!inside(nx, ny)){ boundary[i] = 1; break outer; }
      }
    }
    let u = new Float32Array(N), nu = new Float32Array(N);
    const C = 0.01, ITER = 160;
    const get = (x, y, a) => (x < 0 || x >= S || y < 0 || y >= S || !mask[y*S + x]) ? 0 : a[y*S + x];
    for(let it = 0; it < ITER; it++){
      for(let y = 0; y < S; y++) for(let x = 0; x < S; x++){
        const i = y*S + x;
        nu[i] = (!mask[i] || boundary[i]) ? 0 : (C + get(x+1,y,u) + get(x-1,y,u) + get(x,y+1,u) + get(x,y-1,u)) / 4;
      }
      const tmp = u; u = nu; nu = tmp;
    }
    let max = 0; for(let i = 0; i < N; i++) if(u[i] > max) max = u[i];
    const out = new ImageData(S, S);
    for(let i = 0; i < N; i++){
      const g = mask[i] ? 255 * (1 - Math.pow(u[i] / (max || 1), 2)) : 255;
      out.data[i*4] = out.data[i*4+1] = out.data[i*4+2] = g; out.data[i*4+3] = 255;
    }
    return out;
  }

  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let heightMap = null;

  function hexToRgb(str){
    const m = String(str).trim().match(/^#([0-9a-f]{6})$/i);
    if(!m) return [.6,.4,.9];
    const n = parseInt(m[1], 16); return [(n>>16&255)/255, (n>>8&255)/255, (n&255)/255];
  }

  function mount(mark){
    const canvas = document.createElement("canvas");
    canvas.className = "brand-liquid";
    canvas.setAttribute("aria-hidden", "true");
    const gl = canvas.getContext("webgl", { premultipliedAlpha:true, alpha:true, antialias:true });
    if(!gl) return;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if(!gl.getShaderParameter(s, gl.COMPILE_STATUS)){ console.warn("liquid-logo:", gl.getShaderInfoLog(s)); return null; } return s; };
    const vs = sh(gl.VERTEX_SHADER, VERT), fs = sh(gl.FRAGMENT_SHADER, FRAG);
    if(!vs || !fs) return;
    const prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if(!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "a_position");
    gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = n => gl.getUniformLocation(prog, n);

    if(!heightMap) heightMap = buildHeightMap(128);
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, heightMap.width, heightMap.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, heightMap.data);
    gl.uniform1i(U("u_image_texture"), 0);
    gl.uniform1f(U("u_img_ratio"), 1);
    gl.uniform1f(U("u_ratio"), 1);
    gl.uniform1f(U("u_patternScale"), PARAMS.patternScale);
    gl.uniform1f(U("u_refraction"), PARAMS.refraction);
    gl.uniform1f(U("u_edge"), PARAMS.edge);
    gl.uniform1f(U("u_patternBlur"), PARAMS.patternBlur);
    gl.uniform1f(U("u_liquid"), PARAMS.liquid);
    const uTime = U("u_time"), uTint = U("u_tint");

    function size(){
      const r = mark.getBoundingClientRect();
      const px = Math.max(16, Math.round(Math.max(r.width, 34) * Math.min(devicePixelRatio || 1, 2)));
      if(canvas.width !== px){ canvas.width = canvas.height = px; gl.viewport(0, 0, px, px); }
    }
    mark.appendChild(canvas);
    mark.classList.add("is-liquid");

    /* Zeit wie im Original: u_time in ms × speed, nur animieren solange sichtbar */
    let total = 0, last = 0, raf = 0, visible = false;
    function frame(now){
      raf = 0;
      if(last) total += (now - last) * PARAMS.speed;
      last = now;
      gl.uniform1f(uTime, total);
      gl.uniform3fv(uTint, hexToRgb(getComputedStyle(document.documentElement).getPropertyValue("--ac")));
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if(visible && !document.hidden && !reduceMotion.matches) raf = requestAnimationFrame(frame);
    }
    function kick(){ if(!raf){ last = 0; size(); raf = requestAnimationFrame(frame); } }
    new IntersectionObserver(entries => {
      visible = entries.some(e => e.isIntersecting);
      if(visible) kick();
    }).observe(mark);
    /* Sidebar fährt per transform ein — IntersectionObserver meldet das, zusätzlich beim Öffnen neu anstoßen */
    document.addEventListener("visibilitychange", () => { if(visible) kick(); });
    new MutationObserver(() => { if(visible) kick(); })
      .observe(document.documentElement, { attributes:true, attributeFilter:["data-period","data-theme"] });
    kick();
  }

  /* Höhenkarte erst im Leerlauf berechnen, damit der Seitenstart nicht blockiert */
  const start = () => marks.forEach(mount);
  if("requestIdleCallback" in window) requestIdleCallback(start, { timeout:1500 }); else setTimeout(start, 200);
})();
