/* The landing plays the race: the swarm writes the title, scrolling kills it off, the last one left dives into the egg and the game starts. */
(function () {
  'use strict';
  var D = EG.data, doc = document.documentElement;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (id) { return document.getElementById(id); };
  function clamp(v, a, b) { return Math.min(Math.max(v, a), b); }
  function smooth(a, b, v) { var t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function mix(a, b, t) { return a + (b - a) * t; }

  var TUNE = {
    swarm: 3400, swarmPhone: 1500, last: 0.92, sizeLogo: 15, sizeRace: 28, sizeEnd: 235, heroSize: 74, heroEnd: 300,
    scare: 110, tauntEvery: 2.3, tauntNear: 0.9, bubbleLife: 3.4, fadeRate: 8, dive: 1.25
  };
  var GO_KEY = 'only-one-go';

  /* ---------- the same save the game reads ---------- */
  var saved = null;
  try { saved = JSON.parse(window.localStorage.getItem(D.SAVE_KEY)); } catch (e) { saved = null; }
  var playing = !!(saved && (saved.stage > 0 || saved.sugar > 0 || saved.won > 0));
  var sex = saved && saved.sex === 'X' ? 'X' : 'Y';
  if (playing) {
    Array.prototype.forEach.call(document.querySelectorAll('.go'), function (a) { a.textContent = 'Seguir nadando'; });
  }
  if (!window.matchMedia('(hover: hover)').matches) { $('hint').textContent = 'Tócalos. Se lo toman fatal.'; }

  /* ---------- insults: the game's own, dealt from a deck ---------- */
  var deck = [];
  function insult() {
    if (!deck.length) { var own = D['INSULTS_' + sex]; deck = D.INSULTS.concat(own, own); }
    return deck.splice(Math.floor(Math.random() * deck.length), 1)[0];
  }
  function ownInsult() { var own = D['INSULTS_' + sex]; return own[Math.floor(Math.random() * own.length)]; }
  function setSex(next) {
    sex = next;
    deck = [];
    $('pickY').setAttribute('aria-pressed', String(sex === 'Y'));
    $('pickX').setAttribute('aria-pressed', String(sex === 'X'));
    $('pipName').textContent = sex === 'X' ? 'LA ELEGIDA' : 'EL ELEGIDO';
    $('sample').textContent = ownInsult();
    drawPip();
  }
  $('pickY').addEventListener('click', function () { setSex('Y'); });
  $('pickX').addEventListener('click', function () { setSex('X'); });
  $('again').addEventListener('click', function () { $('sample').textContent = ownInsult(); });

  /* ---------- the feed in the corner ---------- */
  var pip = $('pipFace').getContext('2d'), pipMood = 'neutral', pipTime = 0, pipA = '#7a1230', pipB = '#e0505f';
  var STATES = { neutral: 'Concentrado', scared: 'Acojonado', angry: 'Ofendido', smug: 'Sobrado', happy: 'Eufórico' };
  function drawPip() {
    var sheet = (sex === 'X' ? EG.faces.heroX : EG.faces.hero).image, cell = sheet.width / EG.faces.GRID, i = EG.faces.index(pipMood), w = 360, h = 300;
    var g = pip.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, 220);
    g.addColorStop(0, pipB); g.addColorStop(1, pipA);
    pip.fillStyle = g; pip.fillRect(0, 0, w, h);
    pip.fillStyle = '#fff3e4'; pip.strokeStyle = '#120c0b'; pip.lineWidth = 6;
    pip.beginPath(); pip.ellipse(w / 2, h / 2 + 8, 118, 112, 0, 0, 6.3); pip.fill(); pip.stroke();
    pip.drawImage(sheet, i % EG.faces.GRID * cell, Math.floor(i / EG.faces.GRID) * cell, cell, cell, w / 2 - 124, h / 2 - 116, 248, 248);
    $('pipState').textContent = 'Estado: ' + STATES[pipMood];
  }
  function mood(next, seconds) {
    if (next !== pipMood) { pipMood = next; drawPip(); }
    pipTime = seconds;
  }

  /* ---------- scroll: the race clock ---------- */
  var progress = 0, W = window.innerWidth, H = window.innerHeight, zones = [], zoneTick = 0;
  var beats = Array.prototype.map.call(document.querySelectorAll('.beat'), function (el) { return { el: el, stage: +el.dataset.stage }; });
  var ranks = new Intl.NumberFormat('es-ES'), cms = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  var stageNow = 0, zoneName = '';
  function readScroll() {
    var range = Math.max(doc.scrollHeight - H, 1), mid = H / 2;
    progress = clamp(window.scrollY / range, 0, 1);
    var left = D.RIVALS_TOTAL * Math.exp(-Math.log(D.RIVALS_TOTAL) * Math.pow(clamp(progress / TUNE.last, 0, 1), 1.15));
    $('count').textContent = ranks.format(Math.max(1, Math.round(left)));
    $('cm').textContent = cms.format(progress * 18) + ' / 18 cm';
    $('fill').style.transform = 'scaleX(' + progress.toFixed(4) + ')';
    var name = 'La salida';
    beats.forEach(function (b) {
      if (b.el.getBoundingClientRect().top <= mid) { stageNow = b.stage; name = D.STAGES[b.stage].name; }
    });
    if (window.scrollY < H * 0.4) { stageNow = 0; }
    if (progress > 0.97) { name = 'El óvulo'; }
    if (name !== zoneName) { zoneName = name; $('zone').textContent = name; }
    zoneTick = 0;
  }
  function readZones() {
    zones.length = 0;
    document.querySelectorAll('.copy, .pitch, .strap, .last, #rankBox, #topCta, #pip, #bar').forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.width && r.bottom > 0 && r.top < H) { zones.push(r); }
    });
  }
  function hitsZone(x, y, w, h) {
    return zones.some(function (z) { return x < z.right && x + w > z.left && y < z.bottom && y + h > z.top; });
  }
  window.addEventListener('scroll', readScroll, { passive: true });
  readScroll();
  drawPip();

  /* ---------- pressing the button ---------- */
  var diving = 0, dest = null;
  function launch(e) {
    try { window.sessionStorage.setItem(GO_KEY, '1'); } catch (err) { /* the title screen will do */ }
    if (reduced || !gl) { return; }
    e.preventDefault();
    if (diving) { return; }
    dest = e.currentTarget.href;
    diving = 0.0001;
    mood('happy', 9);
    doc.classList.add('diving');
    bubbles.forEach(close);
    EG.audio.unlock();
    EG.audio.tone(55, 1.2, 'sawtooth', 0.2, 320);
  }
  Array.prototype.forEach.call(document.querySelectorAll('.go'), function (a) { a.addEventListener('click', launch); });
  window.addEventListener('pageshow', function (e) { if (e.persisted) { diving = 0; dest = null; doc.classList.remove('diving'); } });

  /* ---------- WebGL ---------- */
  var gl = null;
  if (reduced) { return; }
  try {
    gl = new THREE.WebGLRenderer({ canvas: $('gl'), antialias: false, alpha: false, powerPreference: 'high-performance' });
  } catch (e) { return; }
  doc.classList.add('gl');
  var dpr = Math.min(window.devicePixelRatio || 1, W < 900 ? 1.25 : 1.5), phone = W < 900;
  gl.setPixelRatio(dpr);
  gl.setSize(W, H, false);
  gl.autoClear = false;
  var scene = new THREE.Scene(), camera = new THREE.Camera();

  var U = {
    res: { value: new THREE.Vector2(W * dpr, H * dpr) }, time: { value: 0 }, beat: { value: 0 }, scroll: { value: 0 },
    colA: { value: new THREE.Color(D.STAGES[0].a) }, colB: { value: new THREE.Color(D.STAGES[0].b) },
    hero: { value: new THREE.Vector2() }, ambient: { value: 0.16 },
    egg: { value: new THREE.Vector3(0, 0, 0) }, eggShow: { value: 0 }, dive: { value: 0 }
  };
  /* Living tissue from the game, lit only around the hero: the same fog of war. */
  var floor = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.ShaderMaterial({
    uniforms: U, depthTest: false, depthWrite: false,
    vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: [
      'uniform vec2 res, hero; uniform float time, beat, scroll, ambient, eggShow, dive; uniform vec3 colA, colB, egg;',
      'vec2 hash(vec2 p) { p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return fract(sin(p) * 43758.5453); }',
      'vec3 cells(vec2 p) {',
      '  vec2 g = floor(p), f = fract(p); float d1 = 8.0, d2 = 8.0, id = 0.0;',
      '  for (int y = -1; y <= 1; y++) { for (int x = -1; x <= 1; x++) {',
      '    vec2 o = vec2(float(x), float(y)), h = hash(g + o), r = o + 0.5 + 0.38 * sin(h * 6.283 + time * 0.3) - f;',
      '    float d = dot(r, r);',
      '    if (d < d1) { d2 = d1; d1 = d; id = h.x; } else if (d < d2) { d2 = d; }',
      '  } }',
      '  return vec3(sqrt(d1), sqrt(d2), id);',
      '}',
      'vec3 tissue(vec2 p, vec3 a, vec3 b) {',
      '  vec3 c = cells(p); float gap = c.y - c.x, aa = fwidth(gap) * 1.2;',
      '  float membrane = 1.0 - smoothstep(0.05, 0.05 + aa, gap), nucleus = 1.0 - smoothstep(0.13, 0.13 + fwidth(c.x) * 1.2, c.x);',
      '  vec3 col = mix(a * 1.7, b, 0.3 + c.z * 0.32);',
      '  col = mix(col, b * 1.3, nucleus * 0.7);',
      '  return mix(col, a * 0.34, membrane) * (1.0 + beat * 0.14);',
      '}',
      'void main() {',
      '  vec2 at = gl_FragCoord.xy, centre = egg.xy; float unit = res.y / 7.5;',
      '  float zoom = 1.0 - dive * dive * 0.9;',
      '  vec3 col = tissue((centre + (at - centre) * zoom + vec2(0.0, scroll)) / unit, colA, colB);',
      '  float d = distance(at, hero) / res.y, lit = max(ambient, 1.0 / (1.0 + d * d * 26.0));',
      '  col = mix(vec3(0.03, 0.009, 0.018), col, lit * lit * 0.5 + lit * 0.5);',
      '  float wave = 1.0 + beat * 0.015, r = egg.z * wave, e = distance(at, centre), w = fwidth(e) * 1.5;',
      '  if (eggShow > 0.001) {',
      '    float glow = exp(-max(e - r, 0.0) / (r * 0.34));',
      '    col = mix(col, vec3(1.0, 0.76, 0.34), glow * 0.52 * eggShow);',
      '    vec3 yolk = tissue((at - centre) / (r * 0.3) + 3.0, vec3(0.62, 0.3, 0.1), vec3(1.0, 0.8, 0.42));',
      '    yolk *= 1.15 - 0.42 * smoothstep(0.3, 1.0, e / r);',
      '    yolk = mix(yolk, vec3(1.0, 0.96, 0.82), smoothstep(0.55, 0.0, distance(at, centre + vec2(-r, r) * 0.34) / r) * 0.5);',
      '    float inside = 1.0 - smoothstep(r - w, r + w, e), ink = 1.0 - smoothstep(0.0, r * 0.03 + w, abs(e - r));',
      '    col = mix(col, yolk, inside * eggShow);',
      '    col = mix(col, vec3(0.02, 0.012, 0.012), ink * eggShow);',
      '  }',
      '  col = mix(col, vec3(1.0, 0.95, 0.82), smoothstep(0.72, 1.0, dive));',
      '  vec2 v = (at / res - 0.5) * vec2(1.1, 1.0);',
      '  col *= 1.0 - dot(v, v) * 0.7;',
      '  gl_FragColor = vec4(col + (hash(at + time).x - 0.5) * 0.02, 1.0);',
      '}'
    ].join('\n')
  }));
  floor.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  floor.frustumCulled = false;
  floor.material.extensions = { derivatives: true };
  scene.add(floor);

  /* ---------- the swarm: one quad per sperm, drawn by a distance field ---------- */
  var N = phone ? TUNE.swarmPhone : TUNE.swarm, COUNT = N + 1, HERO = N;
  var px = new Float32Array(COUNT), py = new Float32Array(COUNT), vx = new Float32Array(COUNT), vy = new Float32Array(COUNT);
  var tx = new Float32Array(N), ty = new Float32Array(N), order = new Float32Array(N), pace = new Float32Array(N), life = new Float32Array(COUNT), angry = new Float32Array(N);
  var attrPos = new Float32Array(COUNT * 2), attrAng = new Float32Array(COUNT), attrSize = new Float32Array(COUNT), attrData = new Float32Array(COUNT * 4);
  var i;
  for (i = 0; i < N; i++) {
    order[i] = (i + Math.random()) / N;
    px[i] = Math.random() * W; py[i] = H + Math.random() * H * 0.6;
    tx[i] = px[i]; ty[i] = H * 0.4;
    attrAng[i] = -1.57;
    pace[i] = 0.6 + Math.random() * 0.8;
    attrData[i * 4] = Math.random() * 6.28;
    attrData[i * 4 + 1] = EG.faces.index(i % 3 ? 'neutral' : 'smug') + (i % 2 ? 0 : 16);
    attrData[i * 4 + 3] = 0;
  }
  /* A shuffle: who dies first has nothing to do with where they sit in the title. */
  for (i = N - 1; i > 0; i--) { var k = Math.floor(Math.random() * (i + 1)), o = order[i]; order[i] = order[k]; order[k] = o; }

  var geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1.12, -0.26, 0, 0.2, -0.26, 0, 0.2, 0.26, 0, -1.12, 0.26, 0]), 3));
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  function instanced(data, size) {
    var a = new THREE.InstancedBufferAttribute(data, size);
    a.setUsage(THREE.DynamicDrawUsage);
    return a;
  }
  var bufPos = instanced(attrPos, 2), bufAng = instanced(attrAng, 1), bufSize = instanced(attrSize, 1), bufData = instanced(attrData, 4);
  geo.setAttribute('iPos', bufPos); geo.setAttribute('iAng', bufAng); geo.setAttribute('iSize', bufSize); geo.setAttribute('iData', bufData);
  geo.instanceCount = COUNT;

  function atlas(sheet) {
    var t = new THREE.CanvasTexture(sheet.image);
    t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = true;
    return t;
  }
  var swarm = new THREE.Mesh(geo, new THREE.ShaderMaterial({
    uniforms: { res: { value: new THREE.Vector2(W, H) }, time: U.time, compact: { value: 1 }, face: { value: atlas(EG.faces.rivalSide) }, faceX: { value: atlas(EG.faces.rivalGreenSide) } },
    transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: [
      'attribute vec2 iPos; attribute float iAng, iSize; attribute vec4 iData;',
      'uniform vec2 res; varying vec2 vP; varying vec4 vD; varying float vS;',
      'void main() {',
      '  float c = cos(iAng), s = sin(iAng), up = c < 0.0 ? -1.0 : 1.0;',
      '  vec2 at = iPos + vec2(position.x * c - position.y * s, position.x * s + position.y * c) * iSize;',
      '  vP = vec2(position.x, position.y * up); vD = iData; vS = iSize;',
      '  gl_Position = vec4(at.x / res.x * 2.0 - 1.0, 1.0 - at.y / res.y * 2.0, 0.0, 1.0);',
      '}'
    ].join('\n'),
    fragmentShader: [
      'uniform float time, compact; uniform sampler2D face, faceX;',
      'varying vec2 vP; varying vec4 vD; varying float vS;',
      'void main() {',
      '  float pixel = 1.0 / vS, HEAD = 0.16, reach = vD.z > 0.5 ? 1.06 : mix(1.06, 0.4, compact);',
      '  vec2 p = vP;',
      '  float dh = (length(p / vec2(HEAD, HEAD * 0.86)) - 1.0) * HEAD * 0.9;',
      '  float t = clamp((-p.x - 0.06) / (reach - 0.08), 0.0, 1.0);',
      '  float wag = sin(t * 8.5 - time * 15.0 + vD.x) * 0.075 * smoothstep(0.0, 0.5, t) * reach;',
      '  float dt = max(max(abs(p.y - wag) - mix(0.036, 0.007, t), -p.x - reach), p.x);',
      '  float dist = min(dh, dt), inkWidth = vS > 44.0 ? max(0.013, pixel * 1.5) : 0.0;',
      '  float alpha = 1.0 - smoothstep(inkWidth - pixel, inkWidth + pixel, dist);',
      '  if (alpha < 0.01) { discard; }',
      '  vec3 inkCol = vD.z > 0.5 ? vec3(0.95, 0.62, 0.14) : vec3(0.02, 0.012, 0.012);',
      '  vec3 skin = vec3(1.0, 0.95, 0.88);',
      '  vec3 col = mix(skin, inkCol, inkWidth > 0.0 ? smoothstep(-pixel, pixel, dist) : 0.0);',
      '  if (vS > 44.0 && dh < 0.0) {',
      '    vec2 uv = (p / HEAD) * 0.42 + 0.5;',
      '    float cell = mod(vD.y, 16.0);',
      '    vec2 at = vec2(mod(cell, 4.0) + uv.x, 3.0 - floor(cell / 4.0) + uv.y) / 4.0;',
      '    vec4 art = vD.y >= 16.0 ? texture2D(faceX, at) : texture2D(face, at);',
      '    col = mix(col, art.rgb, art.a);',
      '  }',
      '  gl_FragColor = vec4(col, alpha * vD.w);',
      '}'
    ].join('\n')
  }));
  swarm.frustumCulled = false;
  scene.add(swarm);

  /* ---------- the title, read off the real h1 so the fallback sits underneath it ---------- */
  function readTitle() {
    var c = document.createElement('canvas'), ctx = c.getContext('2d', { willReadFrequently: true }), logo = $('logo'), step = 3;
    var box = logo.getBoundingClientRect(), top = box.top + window.scrollY;
    c.width = Math.ceil(W / step); c.height = Math.ceil((top + box.height + 40) / step);
    ctx.scale(1 / step, 1 / step);
    var size = parseFloat(window.getComputedStyle(logo).fontSize);
    ctx.font = 'italic 800 ' + size + 'px "Barlow Condensed", Impact, sans-serif';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#fff';
    Array.prototype.forEach.call(logo.children, function (span) {
      var range = document.createRange();
      range.selectNodeContents(span);
      var r = range.getBoundingClientRect();
      /* An empty inline block sits exactly on the baseline, whatever the line height does. */
      var probe = document.createElement('i');
      probe.style.display = 'inline-block';
      span.appendChild(probe);
      var baseline = probe.getBoundingClientRect().bottom + window.scrollY;
      span.removeChild(probe);
      ctx.fillText(span.textContent.toUpperCase(), r.left, baseline);
    });
    var data = ctx.getImageData(0, 0, c.width, c.height).data, spots = [];
    for (var y = 0; y < c.height; y++) {
      for (var x = 0; x < c.width; x++) {
        if (data[(x + y * c.width) * 4 + 3] > 128) { spots.push(x * step, y * step); }
      }
    }
    var count = spots.length / 2;
    if (!count) { return; }
    for (var n = 0; n < N; n++) {
      var at = Math.floor(Math.random() * count) * 2;
      tx[n] = spots[at] + (Math.random() - 0.5) * step;
      ty[n] = spots[at + 1] + (Math.random() - 0.5) * step;
    }
  }

  /* ---------- bubbles ---------- */
  var bubbles = Array.prototype.map.call(document.querySelectorAll('.bubble'), function (el) { return { el: el, text: el.firstChild, owner: -1, t: 0, w: 0, h: 0 }; });
  var tauntGap = 1.2, pointerTaunt = 0;
  function say(owner) {
    var free = null;
    bubbles.forEach(function (b) { if (b.owner < 0 && !free) { free = b; } });
    if (!free || (phone && bubbles.filter(function (b) { return b.owner >= 0; }).length >= 2)) { return false; }
    free.text.textContent = insult();
    free.el.hidden = false;
    free.owner = owner;
    free.t = TUNE.bubbleLife;
    free.w = free.el.offsetWidth;
    free.h = free.el.offsetHeight;
    return true;
  }
  function bubbleSpot(b) {
    var x = px[b.owner], y = py[b.owner], size = attrSize[b.owner], gap = 12 + size * 0.14;
    var left = clamp(x - b.w / 2, 12, W - b.w - 12), top = y - gap - b.h, under = top < 76;
    if (under) { top = y + gap; }
    b.left = left; b.top = top; b.under = under; b.tail = clamp(x - left, 16, b.w - 16);
  }
  function close(b) { b.owner = -1; b.el.hidden = true; }
  function hitsBubble(b) {
    return bubbles.some(function (o) {
      return o !== b && o.owner >= 0 && o.left !== undefined && o.settled && b.left < o.left + o.w && b.left + b.w > o.left && b.top < o.top + o.h && b.top + b.h > o.top;
    });
  }
  function updateBubbles(dt) {
    bubbles.forEach(function (b) {
      if (b.owner < 0) { return; }
      b.t -= dt;
      bubbleSpot(b);
      var off = px[b.owner] < -20 || px[b.owner] > W + 20 || py[b.owner] < -20 || py[b.owner] > H + 20;
      if (b.t <= 0 || life[b.owner] < 0.5 || off || hitsZone(b.left, b.top, b.w, b.h) || hitsBubble(b)) { close(b); b.settled = false; return; }
      b.settled = true;
      b.el.classList.toggle('under', b.under);
      b.el.style.setProperty('--tail', b.tail.toFixed(0) + 'px');
      b.el.style.transform = 'translate(' + b.left.toFixed(1) + 'px,' + b.top.toFixed(1) + 'px)';
    });
  }
  /* A rival somewhere clear speaks up by itself, so a still mouse and a phone get insulted too. */
  function idleTaunt() {
    for (var tries = 0; tries < 40; tries++) {
      var n = Math.floor(Math.random() * N);
      if (life[n] < 0.9 || px[n] < 40 || px[n] > W - 40 || py[n] < 100 || py[n] > H - 90) { continue; }
      var probe = { owner: n, w: 170, h: 40 };
      bubbleSpot(probe);
      if (!hitsZone(probe.left, probe.top, probe.w, probe.h)) { say(n); return; }
    }
  }

  /* ---------- pointer ---------- */
  var mx = -1, my = -1, moved = false;
  window.addEventListener('pointermove', function (e) { mx = e.clientX; my = e.clientY; moved = true; }, { passive: true });
  window.addEventListener('pointerdown', function (e) { mx = e.clientX; my = e.clientY; moved = true; }, { passive: true });
  px[HERO] = W * 0.5; py[HERO] = H * 0.74;
  attrData[HERO * 4 + 1] = EG.faces.index('neutral');
  attrData[HERO * 4 + 2] = 1;
  attrData[HERO * 4 + 3] = 1;
  life[HERO] = 1;

  function layoutEgg() {
    return phone ? { x: W * 0.5, y: H * 0.27, r: Math.min(W * 0.36, H * 0.2), hx: W * 0.5, hy: H * 0.5 } : { x: W * 0.72, y: H * 0.47, r: Math.min(W, H) * 0.3, hx: W * 0.46, hy: H * 0.5 };
  }

  /* ---------- the frame ---------- */
  var last = 0, time = 0, beat = 0, beatTimer = 0;
  var colA = new THREE.Color(), colB = new THREE.Color();
  function angleTo(from, to) { return Math.atan2(Math.sin(to - from), Math.cos(to - from)); }

  function stepSwarm(dt, form, alive, size) {
    var scareSq = TUNE.scare * TUNE.scare, closest = -1, closestD = 1e9, hx = px[HERO], hy = py[HERO];
    for (var n = 0; n < N; n++) {
      var wanted = order[n] * N < alive ? 1 : 0;
      life[n] += (wanted - life[n]) * Math.min(1, dt * TUNE.fadeRate);
      if (diving) { life[n] *= 1 - Math.min(1, dt * 5); }
      if (life[n] < 0.01) { attrSize[n] = 0; continue; }
      var drift = Math.sin(time * 0.8 + attrData[n * 4] * 3) * 0.3, speed = 70 * pace[n] * (1 + progress * 2.2);
      var dvx = mix((tx[n] - px[n]) * 4.5 + Math.sin(time * 1.6 + attrData[n * 4]) * 3, Math.cos(drift) * speed, form);
      var dvy = mix((ty[n] - py[n]) * 4.5 + Math.cos(time * 1.3 + attrData[n * 4]) * 3, Math.sin(drift) * speed, form);
      var dx = px[n] - hx, dy = py[n] - hy, dSq = dx * dx + dy * dy;
      if (dSq < scareSq && dSq > 1) {
        var d = Math.sqrt(dSq), push = (1 - d / TUNE.scare) * 900 / d;
        dvx += dx * push; dvy += dy * push;
        if (d < closestD && attrSize[n] > 0 && life[n] > 0.9) { closestD = d; closest = n; }
      }
      var damp = Math.min(1, dt * 6);
      vx[n] += (dvx - vx[n]) * damp;
      vy[n] += (dvy - vy[n]) * damp;
      px[n] += vx[n] * dt;
      py[n] += vy[n] * dt;
      if (form > 0.5) {
        if (px[n] > W + size) { px[n] = -size * 0.2; py[n] = Math.random() * H; }
        if (py[n] < -size) { py[n] = H + size * 0.5; } else if (py[n] > H + size) { py[n] = -size * 0.5; }
      }
      var fast = vx[n] * vx[n] + vy[n] * vy[n] > 400, aim = fast ? Math.atan2(vy[n], vx[n]) : 0;
      attrAng[n] += angleTo(attrAng[n], aim) * Math.min(1, dt * (fast ? 9 : 2));
      attrPos[n * 2] = px[n]; attrPos[n * 2 + 1] = py[n];
      attrSize[n] = size * (form > 0.5 ? 0.82 + pace[n] * 0.3 : 1);
      attrData[n * 4 + 3] = life[n];
      if (angry[n] > 0) {
        angry[n] -= dt;
        if (angry[n] <= 0) { attrData[n * 4 + 1] = EG.faces.index('neutral') + (n % 2 ? 0 : 16); }
      }
    }
    return closest;
  }

  function stepHero(dt, ending, egg) {
    var free = moved ? 1 : 0, wantX = mx, wantY = my;
    if (!moved) { wantX = W * (0.5 + Math.sin(time * 0.35) * 0.3); wantY = H * (0.72 + Math.sin(time * 0.6) * 0.06); free = 1; }
    wantX = mix(wantX, egg.hx, ending); wantY = mix(wantY, egg.hy, ending);
    if (diving) { wantX = U.egg.value.x / dpr; wantY = H - U.egg.value.y / dpr; }
    var rate = Math.min(1, dt * (diving ? 5 : 5 + free));
    var x = px[HERO], y = py[HERO], nx = x + (wantX - x) * rate, ny = y + (wantY - y) * rate;
    var mvx = nx - x, mvy = ny - y;
    if (mvx * mvx + mvy * mvy > 0.15) { attrAng[HERO] += angleTo(attrAng[HERO], Math.atan2(mvy, mvx)) * Math.min(1, dt * 9); }
    if (ending > 0.5) { attrAng[HERO] += angleTo(attrAng[HERO], Math.atan2(egg.y - ny, egg.x - nx)) * Math.min(1, dt * 6); }
    px[HERO] = nx; py[HERO] = ny;
    attrPos[HERO * 2] = nx; attrPos[HERO * 2 + 1] = ny;
    attrSize[HERO] = mix(TUNE.heroSize * (phone ? 0.75 : 1), TUNE.heroEnd * (phone ? 0.6 : 1), ending) * (1 - diving * 0.7);
    attrData[HERO * 4 + 1] = EG.faces.index(ending > 0.5 ? 'smug' : pipMood) + (sex === 'X' ? 16 : 0);
    U.hero.value.set(nx * dpr, (H - ny) * dpr);
  }

  function frame(now) {
    window.requestAnimationFrame(frame);
    if (document.hidden) { last = now; return; }
    var dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    time += dt;
    U.time.value = time;
    zoneTick -= dt;
    if (zoneTick <= 0) { zoneTick = 0.25; readZones(); }

    beatTimer -= dt;
    if (beatTimer <= 0) { beatTimer = mix(1.05, 0.5, progress); beat = 1; }
    beat = Math.max(beat - dt * 3.6, 0);
    U.beat.value = beat;
    U.scroll.value = window.scrollY * dpr * 0.5;

    if (diving) {
      diving = Math.min(diving + dt / TUNE.dive, 1);
      if (diving >= 1 && dest) { var to = dest; dest = null; window.location.href = to; }
    }
    U.dive.value = diving;

    colA.set(D.STAGES[stageNow].a); colB.set(D.STAGES[stageNow].b);
    U.colA.value.lerp(colA, Math.min(1, dt * 3));
    U.colB.value.lerp(colB, Math.min(1, dt * 3));
    U.ambient.value = mix(0.15, 0.26, smooth(0.0, 0.2, progress));

    var story = clamp(progress / TUNE.last, 0, 1), form = smooth(0.012, 0.075, progress);
    var alive = N * Math.pow(1 - story, 2.2) + (story < 1 ? 1 : 0);
    var size = mix(TUNE.sizeLogo * (phone ? 0.68 : 1), mix(TUNE.sizeRace, TUNE.sizeEnd, Math.pow(story, 3.5)) * (phone ? 0.7 : 1), form);
    var ending = smooth(0.91, 0.975, progress), egg = layoutEgg(), show = Math.max(smooth(0.84, 0.96, progress), smooth(0, 0.25, diving));
    var eggX = egg.x, eggY = egg.y, eggR = egg.r;
    if (diving) {
      var grow = smooth(0.1, 0.9, diving);
      eggX = mix(eggX, W / 2, grow); eggY = mix(eggY, H / 2, grow);
      eggR = mix(ending > 0.5 ? egg.r : egg.r * 0.6, Math.hypot(W, H), grow * grow);
    }
    U.egg.value.set(eggX * dpr, (H - eggY) * dpr, eggR * dpr);
    U.eggShow.value = show;

    swarm.material.uniforms.compact.value = 1 - form;
    stepHero(dt, ending, egg);
    var closest = stepSwarm(dt, form, alive, size);

    tauntGap -= dt;
    pointerTaunt -= dt;
    if (!diving && tauntGap <= 0) {
      if (closest >= 0 && moved && pointerTaunt <= 0 && say(closest)) {
        tauntGap = TUNE.tauntNear;
        pointerTaunt = TUNE.tauntNear;
        angry[closest] = 3;
        attrData[closest * 4 + 1] = EG.faces.index('angry') + (closest % 2 ? 0 : 16);
        mood(Math.random() < 0.5 ? 'scared' : 'angry', 2.2);
      } else if (form > 0.5) {
        tauntGap = TUNE.tauntEvery;
        idleTaunt();
      }
    }
    updateBubbles(dt);

    pipTime -= dt;
    if (pipTime <= 0 && !diving) {
      pipTime = 1e9;
      mood(progress > 0.9 ? 'smug' : 'neutral', 1e9);
    }

    bufPos.needsUpdate = bufAng.needsUpdate = bufSize.needsUpdate = bufData.needsUpdate = true;
    gl.clear();
    gl.render(scene, camera);
  }

  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    phone = W < 900;
    gl.setSize(W, H, false);
    U.res.value.set(W * dpr, H * dpr);
    swarm.material.uniforms.res.value.set(W, H);
    readTitle();
    readScroll();
    readZones();
  }
  var widthWas = W;
  window.addEventListener('resize', function () {
    /* A phone's address bar firing resize mid-scroll is not a new layout. */
    if (window.innerWidth === widthWas && window.innerWidth < 900) { H = window.innerHeight; gl.setSize(W, H, false); U.res.value.set(W * dpr, H * dpr); swarm.material.uniforms.res.value.set(W, H); return; }
    widthWas = window.innerWidth;
    resize();
  });

  var fontsReady = document.fonts && document.fonts.load ? document.fonts.load('italic 800 120px "Barlow Condensed"') : Promise.resolve();
  fontsReady.then(readTitle, readTitle).then(function () {
    readZones();
    last = window.performance.now();
    window.requestAnimationFrame(frame);
  });
})();
