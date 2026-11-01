/* The living world seen from above: an organic relief built from the maze, cartoon characters and a filmic post pass. */
EG.gfx = (function () {
  'use strict';
  var D = EG.data, STAGES = D.STAGES, TILE = D.TILE;
  var gfx = { quality: 'alta' };
  var host = document.getElementById('stage');

  function col(hex) { return new THREE.Color(hex).convertSRGBToLinear(); }
  function rnd(a, b) { return a + Math.random() * (b - a); }

  var renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  var gl = renderer.getContext();
  gl.getExtension('EXT_color_buffer_float');
  gl.getExtension('EXT_color_buffer_half_float');
  renderer.autoClear = false;
  host.appendChild(renderer.domElement);

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(38, 1, 1, 400);
  gfx.camera = camera;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x9a7880, 1.05));
  var sun = new THREE.DirectionalLight(0xffffff, 0.75);
  sun.position.set(-4, 10, 5);
  scene.add(sun);

  var shared = { time: { value: 0 }, beat: { value: 0 }, noise: { value: null }, heroPos: { value: new THREE.Vector3() }, rimColor: { value: col(0xffffff) }, fog: { value: null }, mapSize: { value: new THREE.Vector2(1, 1) }, swimRate: { value: 15 }, tailBend: { value: 0 } };

  /* Adds the animated touches our cartoon materials need on top of three's own shaders. */
  function shaded(material, opts) {
    opts = opts || {};
    material.onBeforeCompile = function (shader) {
      shader.uniforms.swim = shared.time;
      shader.uniforms.rimColor = shared.rimColor;
      shader.uniforms.swimRate = opts.tailRate || shared.swimRate;
      shader.uniforms.tailBend = opts.tailBend || shared.tailBend;
      var wave = '#include <begin_vertex>\n';
      if (opts.tail) {
        wave += 'float tz = clamp(position.z / 9.0, 0.0, 1.0);' +
          'transformed.x += sin(position.z * 1.25 - swim * swimRate) * 0.9 * tz;' +
          'transformed.y += cos(position.z * 0.9 - swim * swimRate * 0.74) * 0.25 * tz;' +
          'transformed.x += tailBend * tz * tz * 3.0;';
      }
      if (opts.ink) { wave += 'transformed += normal * ' + opts.ink.toFixed(3) + ';'; }
      if (opts.blob) { wave += 'transformed += normal * sin(position.x * 3.1 + swim * 2.0) * sin(position.y * 4.3 - swim * 1.6) * ' + opts.blob.toFixed(3) + ';'; }
      shader.vertexShader = 'uniform float swim; uniform float swimRate; uniform float tailBend;\n' + shader.vertexShader.replace('#include <begin_vertex>', wave);
      if (opts.rim) {
        shader.fragmentShader = 'uniform vec3 rimColor;\n' + shader.fragmentShader.replace('#include <dithering_fragment>',
          '#include <dithering_fragment>\n float fres = pow(1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0), 2.6); gl_FragColor.rgb += rimColor * fres * ' + opts.rim.toFixed(2) + ';');
      }
    };
    material.customProgramCacheKey = function () { return JSON.stringify([opts.tail, opts.blob, opts.rim, opts.ink, material.type]); };
    return material;
  }

  function makeNoise(size) {
    var fields = [new Float32Array(size * size), new Float32Array(size * size), new Float32Array(size * size)];
    function octaves(field, start, ridged) {
      for (var o = 0, cells = start, amp = 1; o < 5; o++, cells *= 2, amp *= 0.54) {
        var grid = new Float32Array(cells * cells);
        for (var g = 0; g < grid.length; g++) { grid[g] = Math.random(); }
        for (var y = 0; y < size; y++) {
          for (var x = 0; x < size; x++) {
            var fx = x / size * cells, fy = y / size * cells, ix = Math.floor(fx), iy = Math.floor(fy);
            var ax = fx - ix, ay = fy - iy;
            ax = ax * ax * (3 - 2 * ax); ay = ay * ay * (3 - 2 * ay);
            var a = grid[ix % cells + (iy % cells) * cells], b = grid[(ix + 1) % cells + (iy % cells) * cells];
            var c = grid[ix % cells + ((iy + 1) % cells) * cells], d = grid[(ix + 1) % cells + ((iy + 1) % cells) * cells];
            var v = a + (b - a) * ax + (c - a) * ay + (a - b - c + d) * ax * ay;
            field[x + y * size] += amp * (ridged ? 1 - Math.abs(v * 2 - 1) : v);
          }
        }
      }
    }
    octaves(fields[0], 5, false);
    octaves(fields[1], 4, true);
    octaves(fields[2], 7, false);
    var data = new Uint8Array(size * size * 4);
    fields.forEach(function (field, channel) {
      var lo = 1e9, hi = -1e9, i;
      for (i = 0; i < field.length; i++) { lo = Math.min(lo, field[i]); hi = Math.max(hi, field[i]); }
      for (i = 0; i < field.length; i++) { data[i * 4 + channel] = (field[i] - lo) / (hi - lo) * 255; }
    });
    for (var i = 3; i < data.length; i += 4) { data[i] = 255; }
    var tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = true;
    tex.needsUpdate = true;
    return tex;
  }
  shared.noise.value = makeNoise(384);

  function softTexture() {
    var c = document.createElement('canvas');
    c.width = c.height = 64;
    var x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.4, 'rgba(255,255,255,.5)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }
  var SOFT = softTexture();

  /* ---------- the relief: one continuous body, no blocks ---------- */
  var groundU = {
    colA: { value: new THREE.Color() }, colB: { value: new THREE.Color() }, colVein: { value: new THREE.Color() }, colFloor: { value: new THREE.Color() },
    veinAmount: { value: 0.5 }, time: shared.time, beat: shared.beat, noise: shared.noise, heroPos: shared.heroPos, fog: shared.fog, mapSize: shared.mapSize
  };
  var ground = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.ShaderMaterial({
    uniforms: groundU,
    vertexShader: [
      'attribute float hgt; uniform float time, beat; varying vec3 vW; varying float vH; varying vec3 vN;',
      'void main() {',
      '  vec3 p = position; vH = hgt;',
      '  p.y += hgt * beat * 0.12;',
      '  vW = p; vN = normal;',
      '  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);',
      '}'
    ].join('\n'),
    fragmentShader: [
      'precision highp float;',
      'uniform vec3 colA, colB, colVein, colFloor, heroPos; uniform float veinAmount, time, beat; uniform sampler2D noise, fog; uniform vec2 mapSize;',
      'varying vec3 vW; varying float vH; varying vec3 vN;',
      'vec2 hash(vec2 p) { p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return fract(sin(p) * 43758.5453); }',
      /* Living tissue drawn as crisp cells, so the floor stays sharp at any distance. */
      'vec3 cells(vec2 p) {',
      '  vec2 g = floor(p), f = fract(p); float d1 = 8.0, d2 = 8.0; float id = 0.0;',
      '  for (int y = -1; y <= 1; y++) { for (int x = -1; x <= 1; x++) {',
      '    vec2 o = vec2(float(x), float(y)), h = hash(g + o);',
      '    vec2 r = o + 0.5 + 0.38 * sin(h * 6.283 + time * 0.25) - f;',
      '    float d = dot(r, r);',
      '    if (d < d1) { d2 = d1; d1 = d; id = h.x; } else if (d < d2) { d2 = d; }',
      '  } }',
      '  return vec3(sqrt(d1), sqrt(d2), id);',
      '}',
      'void main() {',
      '  vec3 c = cells(vW.xz / 5.2);',
      '  float gap = c.y - c.x, aa = fwidth(gap) * 1.2;',
      '  float membrane = 1.0 - smoothstep(0.05, 0.05 + aa, gap);',
      '  float nucleus = 1.0 - smoothstep(0.13, 0.13 + fwidth(c.x) * 1.2, c.x);',
      '  vec3 floorCol = mix(colA * 1.5, colB, 0.34 + c.z * 0.3);',
      '  floorCol = mix(floorCol, colA * 0.62, membrane);',
      '  floorCol = mix(floorCol, colB * 1.25, nucleus * 0.8);',
      '  floorCol *= 1.0 + beat * 0.1;',
      '  float ridge = texture2D(noise, vW.xz * 0.012).g;',
      '  float line = (1.0 - smoothstep(0.0, fwidth(ridge) * 2.2, abs(ridge - 0.74))) * veinAmount;',
      '  vec3 topCol = mix(colFloor * 1.2, colVein * 0.5, line);',
      '  float wave = exp(-pow(fract((vW.x + vW.z) * 0.008 - time * 0.3) * 3.0, 2.0));',
      '  topCol = mix(topCol, colVein * 0.9, line * wave);',
      '  float wFlat = fwidth(vH) * 1.2;',
      '  float isWall = smoothstep(0.5 - wFlat, 0.5 + wFlat, vH);',
      '  float shade = 1.0 - smoothstep(0.08 - wFlat, 0.08 + wFlat, vH);',
      '  vec3 col = mix(floorCol * mix(0.56, 1.0, shade), topCol, isWall);',
      '  float bevel = smoothstep(0.58 - wFlat, 0.58 + wFlat, vH) * (1.0 - smoothstep(0.74 - wFlat, 0.74 + wFlat, vH));',
      '  col = mix(col, colB * 0.42, bevel);',
      '  float ink = 1.0 - smoothstep(1.4, 2.4, abs(vH - 0.5) / max(fwidth(vH), 0.0005));',
      '  col = mix(col, vec3(0.006, 0.004, 0.005), ink);',
      '  float near = 1.0 / (1.0 + dot(vW.xz - heroPos.xz, vW.xz - heroPos.xz) * 0.0028);',
      '  col *= 0.86 + near * 0.34;',
      '  vec4 f = texture2D(fog, vW.xz / mapSize);',
      '  float seen = max(f.g, f.r * 0.34);',
      '  gl_FragColor = vec4(mix(vec3(0.009, 0.007, 0.011), col, smoothstep(0.04, 0.72, seen)), 1.0);',
      '}'
    ].join('\n')
  }));
  ground.frustumCulled = false;
  scene.add(ground);

  var fogData = null, fogTex = null;

  /* Walls become a smooth height field, so the maze looks grown rather than built. */
  gfx.buildStage = function (maze, stageIndex) {
    var st = STAGES[stageIndex], step = 3, w = maze.cols * step + 1, h = maze.rows * step + 1;
    groundU.colA.value.copy(col(st.a));
    groundU.colB.value.copy(col(st.b));
    groundU.colVein.value.copy(col(st.vein));
    groundU.colFloor.value.copy(col(st.floor));
    groundU.veinAmount.value = st.veinAmount;
    shared.rimColor.value.copy(col(st.mote)).multiplyScalar(0.35);
    motes.material.uniforms.tint.value.copy(col(st.mote));

    var heights = new Float32Array(w * h), x, y;
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        var tx = Math.min(Math.floor(x / step), maze.cols - 1), ty = Math.min(Math.floor(y / step), maze.rows - 1);
        var edge = x === w - 1 || y === h - 1 || x === 0 || y === 0;
        heights[x + y * w] = edge || maze.wall[maze.at(tx, ty)] ? 1 : 0;
      }
    }
    var blurred = new Float32Array(w * h);
    for (var pass = 0; pass < 2; pass++) {
      for (y = 0; y < h; y++) {
        for (x = 0; x < w; x++) {
          var sum = 0, n = 0;
          for (var dy = -1; dy <= 1; dy++) {
            for (var dx = -1; dx <= 1; dx++) {
              var ax = x + dx, ay = y + dy;
              if (ax >= 0 && ay >= 0 && ax < w && ay < h) { sum += heights[ax + ay * w]; n++; }
            }
          }
          blurred[x + y * w] = sum / n;
        }
      }
      heights.set(blurred);
    }
    var pos = new Float32Array(w * h * 3), hgt = new Float32Array(w * h), nor = new Float32Array(w * h * 3), cell = TILE / step;
        for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        var k = heights[x + y * w], i = x + y * w, shape = k * k * (3 - 2 * k);
        pos[i * 3] = x * cell;
        pos[i * 3 + 1] = shape * 5.5;
        pos[i * 3 + 2] = y * cell;
        hgt[i] = shape;
      }
    }
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        var l = pos[(Math.max(x - 1, 0) + y * w) * 3 + 1], r = pos[(Math.min(x + 1, w - 1) + y * w) * 3 + 1];
        var u = pos[(x + Math.max(y - 1, 0) * w) * 3 + 1], d = pos[(x + Math.min(y + 1, h - 1) * w) * 3 + 1];
        var nx = l - r, ny = cell * 2, nz = u - d, len = Math.hypot(nx, ny, nz), o = (x + y * w) * 3;
        nor[o] = nx / len; nor[o + 1] = ny / len; nor[o + 2] = nz / len;
      }
    }
    var index = new Uint32Array((w - 1) * (h - 1) * 6), q = 0;
    for (y = 0; y < h - 1; y++) {
      for (x = 0; x < w - 1; x++) {
        var a = x + y * w, b = a + 1, c = a + w, e = c + 1;
        index[q++] = a; index[q++] = c; index[q++] = b; index[q++] = b; index[q++] = c; index[q++] = e;
      }
    }
    ground.geometry.dispose();
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('hgt', new THREE.BufferAttribute(hgt, 1));
    geo.setIndex(new THREE.BufferAttribute(index, 1));
    ground.geometry = geo;

    shared.mapSize.value.set(maze.cols * TILE, maze.rows * TILE);
    fogData = new Uint8Array(maze.cols * maze.rows * 4);
    if (fogTex) { fogTex.dispose(); }
    fogTex = new THREE.DataTexture(fogData, maze.cols, maze.rows, THREE.RGBAFormat);
    fogTex.minFilter = fogTex.magFilter = THREE.LinearFilter;
    fogTex.needsUpdate = true;
    shared.fog.value = fogTex;
  };

  /* explored and visible are per-tile arrays from the game; the texture eases toward them. */
  gfx.updateFog = function (explored, visible, dt) {
    var ease = Math.min(dt * 7, 1);
    for (var i = 0; i < explored.length; i++) {
      fogData[i * 4] = explored[i] ? 255 : 0;
      var want = visible[i] ? 255 : 0;
      fogData[i * 4 + 1] += (want - fogData[i * 4 + 1]) * ease;
      fogData[i * 4 + 3] = 255;
    }
    fogTex.needsUpdate = true;
  };

  /* ---------- characters ---------- */
  var BANDS = new THREE.DataTexture(new Uint8Array([125, 125, 125, 255, 195, 195, 195, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
  BANDS.minFilter = BANDS.magFilter = THREE.NearestFilter;
  BANDS.needsUpdate = true;
  function toon(hex, emissive) {
    return new THREE.MeshToonMaterial({ color: col(hex), gradientMap: BANDS, emissive: emissive ? col(emissive) : new THREE.Color(0) });
  }
  var inkMat = shaded(new THREE.MeshBasicMaterial({ color: 0x0a0607, side: THREE.BackSide }), { ink: 0.05 });
  var inkBlob = shaded(new THREE.MeshBasicMaterial({ color: 0x0a0607, side: THREE.BackSide }), { blob: 0.14, ink: 0.05 });

  /* The sheet is projected onto the head: from the nose when frontal, through both flanks when side on, so each flank mirrors itself. */
  function faceMaterial(sheet, side) {
    return new THREE.ShaderMaterial({
      uniforms: { sheet: { value: sheet }, cell: { value: new THREE.Vector2() }, shift: { value: new THREE.Vector2() } },
      transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      vertexShader: [
        'varying vec2 vQ; varying float vFront;',
        'void main() {',
        side ? '  vQ = vec2((-position.z - 0.45) * 0.51 + 0.5, position.y * 0.51 + 0.5);' : '  vQ = vec2(position.x * 0.5, position.y * 0.5) / 0.98 + 0.5;',
        side ? '  vFront = abs(position.x);' : '  vFront = -position.z;',
        '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
        '}'
      ].join('\n'),
      fragmentShader: [
        'precision highp float; uniform sampler2D sheet; uniform vec2 cell, shift; varying vec2 vQ; varying float vFront;',
        'void main() {',
        '  if (vFront < ' + (side ? '0.22' : '0.12') + ') { discard; }',
        '  vec2 q = vec2(vQ.x, 1.0 - vQ.y) + shift;',
        '  if (q.x < 0.01 || q.x > 0.99 || q.y < 0.01 || q.y > 0.99) { discard; }',
        '  vec4 c = texture2D(sheet, (cell + q) / ' + EG.faces.GRID.toFixed(1) + ', ' + (side ? '-0.8' : '0.0') + ');',
        '  gl_FragColor = vec4(pow(c.rgb, vec3(2.2)), c.a);',
        '}'
      ].join('\n')
    });
  }

  var SPHERE = new THREE.SphereGeometry(1, 28, 20), LOW = new THREE.SphereGeometry(1, 16, 12);
  var black = shaded(new THREE.MeshBasicMaterial({ color: 0x060505 }));
  var white = shaded(toon(0xffffff));
  var capMat = shaded(toon(0xe8452c));
  var punk = shaded(toon(0x22c8b8));
  var bar = new THREE.BoxGeometry(1, 0.15, 0.13);

  var headProfile = [];
  for (var hp = 0; hp <= 22; hp++) {
    var ht = hp / 22, hy = 1.42 - ht * 3.05, hb = Math.sin(Math.PI * Math.pow(ht, 0.72));
    headProfile.push(new THREE.Vector2(Math.max(hb * 1.05, hp === 0 ? 0.001 : ht > 0.8 ? 0.16 : 0.001), hy));
  }
  var HEAD = new THREE.LatheGeometry(headProfile.reverse(), 40).rotateX(-Math.PI / 2);
  HEAD.computeVertexNormals();
  var TAIL = new THREE.CylinderGeometry(0.05, 0.36, 9, 9, 40, false).rotateX(Math.PI / 2).translate(0, 0, 4.5);

  function part(geo, mat, parent, x, y, z, sx, sy, sz) {
    var m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.scale.set(sx, sy === undefined ? sx : sy, sz === undefined ? sx : sz);
    parent.add(m);
    return m;
  }

  /* Low enough to stay under the bloom threshold: a blown-out head loses its toon bands and washes the face lines. */
  var SKIN_GLOW = 0x1e1a18;

  function makeSperm(traits) {
    traits = traits || {};
    var skinHex = traits.skin || 0xfff0e0, tailRate = { value: 15 }, tailBend = { value: 0 };
    var skin = shaded(toon(skinHex, SKIN_GLOW), { rim: 0.1 });
    var tailMat = shaded(toon(skinHex, SKIN_GLOW), { tail: true, rim: 0.12, tailRate: tailRate, tailBend: tailBend });
    var body = new THREE.Group(), head = new THREE.Group();
    body.add(head);
    var shell = new THREE.Mesh(HEAD, skin);
    shell.scale.set(1.06, 0.94, 1);
    head.add(shell);
    var shellInk = new THREE.Mesh(HEAD, inkMat);
    shellInk.scale.copy(shell.scale);
    head.add(shellInk);
    var faceMat = faceMaterial(traits.sheet || EG.faces.hero, false);
    var faceMesh = new THREE.Mesh(HEAD, faceMat);
    faceMesh.scale.copy(shell.scale);
    faceMesh.renderOrder = 2;
    head.add(faceMesh);
    var sideMat = faceMaterial(traits.sideSheet || EG.faces.heroSide, true);
    var sideMesh = new THREE.Mesh(HEAD, sideMat);
    sideMesh.scale.copy(shell.scale);
    sideMesh.renderOrder = 2;
    sideMesh.visible = false;
    head.add(sideMesh);
    var tail = new THREE.Mesh(TAIL, tailMat);
    tail.position.z = 0.9;
    tail.scale.z = D.POSE.tailLength;
    tail.frustumCulled = false;
    body.add(tail);
    var tailInk = new THREE.Mesh(TAIL, shaded(new THREE.MeshBasicMaterial({ color: 0x0a0607, side: THREE.BackSide }), { tail: true, ink: 0.07, tailRate: tailRate, tailBend: tailBend }));
    tailInk.position.z = 0.9;
    tailInk.scale.z = D.POSE.tailLength;
    tailInk.frustumCulled = false;
    body.add(tailInk);
    var frontGear = new THREE.Group(), sideGear = new THREE.Group();
    sideGear.visible = false;
    head.add(frontGear);
    head.add(sideGear);
    if (traits.moustache) {
      var mL = part(LOW, black, frontGear, -0.3, -0.04, -1.2, 0.38, 0.12, 0.1); mL.rotation.z = -0.3;
      var mR = part(LOW, black, frontGear, 0.3, -0.04, -1.2, 0.38, 0.12, 0.1); mR.rotation.z = 0.3;
      [-1, 1].forEach(function (flank) {
        var whisker = part(LOW, black, sideGear, flank * 0.74, -0.2, -1, 0.12, 0.14, 0.44);
        whisker.rotation.x = 0.3;
      });
    }
    if (traits.glasses) {
      part(bar, black, frontGear, 0, 0.36, -1.32, 1.5, 2.4, 0.4);
      part(LOW, black, frontGear, -0.46, 0.28, -1.32, 0.42, 0.32, 0.07);
      part(LOW, black, frontGear, 0.46, 0.28, -1.32, 0.42, 0.32, 0.07);
      [-1, 1].forEach(function (flank) {
        part(LOW, black, sideGear, flank, 0.24, -0.64, 0.16, 0.46, 0.48);
        var temple = part(bar, black, sideGear, flank * 1.04, 0.3, 0.02, 0.9, 1, 0.5);
        temple.rotation.y = Math.PI / 2;
      });
    }
    if (traits.cap) {
      part(SPHERE, capMat, head, 0, 0.56, -0.02, 1.08, 0.7, 1.14);
      part(LOW, capMat, head, 0, 0.8, -1.08, 0.72, 0.09, 0.54);
    }
    if (traits.mohawk) {
      for (var c = 0; c < 5; c++) {
        var spike = part(new THREE.ConeGeometry(0.22, 0.85, 8), punk, head, 0, 1.2 - Math.abs(c - 2) * 0.13, -0.72 + c * 0.36, 1, 1, 1);
        spike.rotation.x = (c - 2) * -0.22;
      }
    }
    var bow = null;
    if (traits.bow) {
      bow = new THREE.Group();
      bow.position.set(0, 1.04, -0.34);
      bow.rotation.y = 0.9;
      head.add(bow);
      var bowMat = shaded(toon(0xe8324e));
      var left = part(new THREE.ConeGeometry(0.28, 0.6, 12), bowMat, bow, -0.3, 0, 0, 1, 1, 1); left.rotation.z = -Math.PI / 2;
      var right = part(new THREE.ConeGeometry(0.28, 0.6, 12), bowMat, bow, 0.3, 0, 0, 1, 1, 1); right.rotation.z = Math.PI / 2;
      part(LOW, bowMat, bow, 0, 0, 0, 0.14);
      bow.visible = false;
    }
    var mood = '', blink = rnd(1, 4), closed = false, offset = traits.cross ? 8 : 0;
    function setCell() {
      var index = (closed && mood !== 'dead' && mood !== 'hurt' ? EG.faces.index('blink') : EG.faces.index(mood)) + offset;
      faceMat.uniforms.cell.value.set(index % EG.faces.GRID, Math.floor(index / EG.faces.GRID));
      sideMat.uniforms.cell.value.copy(faceMat.uniforms.cell.value);
    }
    return {
      bow: bow, body: body, head: head, tail: tail, tailRate: tailRate, tailBend: tailBend, mood: function () { return mood; },
      size: traits.size || 1, side: 1, roll: null, glance: 0, glanceTime: 0, lastHeading: 0,
      spring: { k: 1, v: 0, want: 1 },
      face: function (name) { if (mood !== name) { mood = name; setCell(); } },
      look: function (x, y) { faceMat.uniforms.shift.value.set(-x * 0.03, y * 0.03); },
      setSheet: function (sheet, side) { faceMat.uniforms.sheet.value = sheet; sideMat.uniforms.sheet.value = side; },
      showFront: function (front) {
        faceMesh.visible = frontGear.visible = front;
        sideMesh.visible = sideGear.visible = !front;
      },
      tick: function (dt) {
        blink -= dt;
        var now = blink < 0.13 && blink > 0;
        if (now !== closed) { closed = now; setCell(); }
        if (blink <= 0) { blink = rnd(1.6, 4.6); }
      }
    };
  }

  var qSide = new THREE.Quaternion(), qFront = new THREE.Quaternion();
  var qTilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), D.POSE.faceTilt);
  var AXIS_Y = new THREE.Vector3(0, 1, 0), AXIS_Z = new THREE.Vector3(0, 0, 1);
  function ease(rate, dt) { return 1 - Math.exp(-rate * dt); }

  /* The head rolls on its own axis to give the lens a flank, nose along the swim and never upside down; a glance swings it to face the player. */
  gfx.pose = function (sperm, x, z, heading, height, dt) {
    var P = D.POSE, spring = sperm.spring;
    sperm.body.position.set(x, height, z);
    sperm.body.rotation.y = heading;

    var cx = -P.lensBack * Math.sin(heading);
    if (Math.abs(cx) > P.flipGate) { sperm.side = cx > 0 ? 1 : -1; }
    var want = sperm.side * Math.atan2(P.lensUp, Math.abs(cx));
    sperm.roll = sperm.roll === null ? want : sperm.roll + (want - sperm.roll) * ease(P.flipRate, dt);

    sperm.glanceTime = Math.max(sperm.glanceTime - dt, 0);
    sperm.glance += ((sperm.glanceTime > 0 ? 1 : 0) - sperm.glance) * ease(P.glanceRate, dt);
    qSide.setFromAxisAngle(AXIS_Z, sperm.roll);
    qFront.setFromAxisAngle(AXIS_Y, Math.PI - heading).multiply(qTilt);
    sperm.head.quaternion.copy(qSide).slerp(qFront, sperm.glance);
    sperm.showFront(sperm.glance > 0.5);

    spring.v += (spring.want - spring.k) * P.springPull * dt;
    spring.v *= Math.exp(-P.springDrag * dt);
    spring.k = Math.min(Math.max(spring.k + spring.v * dt, P.springMin), P.springMax);
    var thin = sperm.size / Math.sqrt(spring.k);
    sperm.body.scale.set(thin, thin, sperm.size * spring.k);

    if (dt > 0) {
      var turn = heading - sperm.lastHeading;
      turn = Math.atan2(Math.sin(turn), Math.cos(turn)) / dt * -P.tailSwing;
      turn = Math.min(Math.max(turn, -P.tailMax), P.tailMax);
      sperm.tailBend.value += (turn - sperm.tailBend.value) * ease(P.tailRate, dt);
    }
    sperm.lastHeading = heading;
  };
  gfx.lookAtYou = function (sperm, seconds) { sperm.glanceTime = Math.max(sperm.glanceTime, seconds); };
  gfx.kick = function (sperm, amount) { sperm.spring.v += amount; };

  var hero = makeSperm({ bow: true, size: D.POSE.heroSize });
  hero.body.visible = false;
  scene.add(hero.body);
  gfx.hero = hero;
  gfx.setSex = function (sex) {
    hero.bow.visible = portrait.bow.visible = sex === 'X';
    var front = sex === 'X' ? EG.faces.heroX : EG.faces.hero, side = sex === 'X' ? EG.faces.heroXSide : EG.faces.heroSide;
    hero.setSheet(front, side);
    portrait.setSheet(front, side);
  };

  var ALL_TRAITS = [{ moustache: true }, { glasses: true }, { cap: true }, { mohawk: true }, { cross: true }, {}, { moustache: true, cap: true }, { cross: true, cap: true }, { glasses: true, mohawk: true }];
  var SKINS = [0xfff0e0, 0xffe0c4, 0xffd4c4, 0xf4ecdf, 0xffe6ac, 0xe6efd6];
  gfx.rivals = [];
  gfx.allies = [];
  for (var i = 0; i < D.FOES.rivals.max; i++) {
    var rival = makeSperm(Object.assign({ skin: SKINS[i % SKINS.length], size: D.POSE.rivalSize, sheet: i % 2 ? EG.faces.rival : EG.faces.rivalGreen, sideSheet: i % 2 ? EG.faces.rivalSide : EG.faces.rivalGreenSide }, ALL_TRAITS[i % ALL_TRAITS.length]));
    rival.body.visible = false;
    rival.face('neutral');
    scene.add(rival.body);
    gfx.rivals.push(rival);
  }
  for (i = 0; i < 6; i++) {
    var ally = makeSperm({ skin: 0xffac98, size: D.POSE.allySize, sheet: EG.faces.rival, sideSheet: EG.faces.rivalSide, cross: true });
    ally.body.visible = false;
    ally.face('happy');
    scene.add(ally.body);
    gfx.allies.push(ally);
  }

  /* ---------- enemies and pickups ---------- */
  var acidMat = shaded(toon(0xa4e03a, 0x1c3a00), { rim: 0.2, blob: 0.1 });
  var cellMat = shaded(toon(0xfff0ee, 0x2a1418), { rim: 0.2, blob: 0.18 });
  var villains = [];
  for (i = 0; i < 22; i++) {
    var g = new THREE.Group(), blob = new THREE.Mesh(SPHERE, acidMat);
    g.add(blob);
    g.add(new THREE.Mesh(SPHERE, inkBlob));
    var faceSide = new THREE.Group();
    faceSide.rotation.x = -0.75;
    g.add(faceSide);
    part(LOW, white, faceSide, -0.38, 0.26, 0.86, 0.34, 0.34, 0.2);
    part(LOW, white, faceSide, 0.38, 0.26, 0.86, 0.34, 0.34, 0.2);
    part(LOW, black, faceSide, -0.33, 0.22, 1.05, 0.13);
    part(LOW, black, faceSide, 0.33, 0.22, 1.05, 0.13);
    var browA = part(bar, black, faceSide, -0.38, 0.64, 0.94, 0.62, 1.5, 1); browA.rotation.z = -0.5;
    var browB = part(bar, black, faceSide, 0.38, 0.64, 0.94, 0.62, 1.5, 1); browB.rotation.z = 0.5;
    var jaw = part(new THREE.BoxGeometry(0.9, 0.24, 0.1), black, faceSide, 0, -0.3, 0.98, 1, 1, 1);
    part(new THREE.BoxGeometry(0.8, 0.1, 0.1), white, faceSide, 0, -0.26, 1.03, 1, 1, 1);
    g.visible = false;
    g.userData = { blob: blob, jaw: jaw };
    scene.add(g);
    villains.push(g);
  }
  var antibodyMat = shaded(toon(0x74a8ff, 0x0a1a4a), { rim: 0.2 });
  var antibodies = [];
  var ARM = new THREE.CylinderGeometry(0.5, 0.65, 6, 12).translate(0, 3, 0);
  for (i = 0; i < 10; i++) {
    var y = new THREE.Group(), spinning = new THREE.Group();
    y.add(spinning);
    [0, 1, 2].forEach(function (k) {
      var holder = new THREE.Group();
      holder.rotation.y = k * Math.PI * 2 / 3;
      var arm = new THREE.Group();
      arm.rotation.x = Math.PI / 2;
      arm.add(new THREE.Mesh(ARM, antibodyMat));
      part(LOW, antibodyMat, arm, 0, 6.2, 0, 1);
      holder.add(arm);
      spinning.add(holder);
    });
    part(SPHERE, antibodyMat, y, 0, 0, 0, 1.6);
    y.visible = false;
    y.userData = { spin: spinning };
    scene.add(y);
    antibodies.push(y);
  }

  function crystalHeap() {
    var box = new THREE.BoxGeometry(1, 1, 1).toNonIndexed(), count = 34, per = box.attributes.position.count;
    var pos = new Float32Array(count * per * 3), nor = new Float32Array(count * per * 3), m = new THREE.Matrix4();
    var q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), nm = new THREE.Matrix3();
    for (var a = 0; a < count; a++) {
      var t = a / count, ang = a * 2.4, rr = Math.sqrt(t) * 0.86, h = (1 - t) * 0.7 - 0.28 + rnd(-0.1, 0.1), size = rnd(0.2, 0.36) * (1.25 - t * 0.5);
      e.set(rnd(0, 3), rnd(0, 3), rnd(0, 3));
      q.setFromEuler(e);
      m.compose(v.set(Math.cos(ang) * rr, h, Math.sin(ang) * rr), q, new THREE.Vector3(size, size, size));
      nm.getNormalMatrix(m);
      for (var k = 0; k < per; k++) {
        var o = (a * per + k) * 3;
        v.fromBufferAttribute(box.attributes.position, k).applyMatrix4(m);
        pos[o] = v.x; pos[o + 1] = v.y; pos[o + 2] = v.z;
        v.fromBufferAttribute(box.attributes.normal, k).applyMatrix3(nm).normalize();
        nor[o] = v.x; nor[o + 1] = v.y; nor[o + 2] = v.z;
      }
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    return geo;
  }
  function instanced(geometry, material, count) {
    var mesh = new THREE.InstancedMesh(geometry, material, count);
    mesh.frustumCulled = false;
    mesh.count = 0;
    scene.add(mesh);
    return mesh;
  }
  var SUGAR_MAX = 420;
  var sugarMesh = instanced(crystalHeap(), shaded(new THREE.MeshPhongMaterial({ color: 0xffffff, emissive: col(0x8a8378), specular: 0xffffff, shininess: 220 }), { rim: 0.5 }), SUGAR_MAX);
  var glintMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
    uniforms: { time: shared.time }, transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending,
    vertexShader: [
      'uniform float time; varying vec2 vQ; varying float vTw;',
      'void main() {',
      '  vec4 c = viewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);',
      '  float ph = fract(instanceMatrix[3][0] * 0.37 + instanceMatrix[3][2] * 0.11);',
      '  vTw = pow(abs(sin(time * 1.7 + ph * 6.28)), 9.0);',
      '  vQ = position.xy * 2.0;',
      '  c.xy += position.xy * (3.0 + vTw * 4.0);',
      '  c.z += 4.0;',
      '  gl_Position = projectionMatrix * c;',
      '}'
    ].join('\n'),
    fragmentShader: [
      'precision highp float; varying vec2 vQ; varying float vTw;',
      'void main() {',
      '  float r = dot(vQ, vQ);',
      '  float halo = exp(-r * 6.0) * 0.26;',
      '  float star = (exp(-abs(vQ.x) * 26.0) * exp(-abs(vQ.y) * 3.4) + exp(-abs(vQ.y) * 26.0) * exp(-abs(vQ.x) * 3.4)) * vTw * 2.2;',
      '  gl_FragColor = vec4(vec3(1.0, 0.96, 0.88) * (halo + star), 1.0);',
      '}'
    ].join('\n')
  }), SUGAR_MAX);
  glintMesh.frustumCulled = false;
  glintMesh.count = 0;
  scene.add(glintMesh);

  var curtainMesh = instanced(LOW, shaded(toon(0xe0ae3c, 0x3a2400), { rim: 0.4, blob: 0.05 }), 60);
  var spitMesh = instanced(LOW, shaded(toon(0xdcf7c8, 0x3a6a24), { rim: 0.5 }), 40);
  var FOE_SPIT_MAX = 30;
  var foeSpitMesh = instanced(LOW, shaded(toon(0xa8e83c, 0x3a7a00), { rim: 0.6 }), FOE_SPIT_MAX);
  var chestMesh = instanced(new THREE.BoxGeometry(3.2, 2.4, 2.4), shaded(toon(0xffc23d, 0x5a3400), { rim: 0.5 }), 14);
  var puzzleMesh = instanced(new THREE.OctahedronGeometry(1.8), shaded(toon(0x35d0ff, 0x0a3a6a), { rim: 0.8 }), 14);

  var portals = [];
  for (i = 0; i < 2; i++) {
    var portal = new THREE.Group();
    var ring = new THREE.Mesh(new THREE.TorusGeometry(4.6, 1, 14, 44), shaded(toon(0xff6b8a, 0x4a0820), { rim: 0.6 }));
    ring.rotation.x = Math.PI / 2;
    portal.add(ring);
    var hole = new THREE.Mesh(new THREE.CircleGeometry(4.6, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.1, 0.6) }));
    hole.rotation.x = -Math.PI / 2;
    hole.position.y = 0.05;
    portal.add(hole);
    portal.visible = false;
    portal.userData = { ring: ring, hole: hole };
    scene.add(portal);
    portals.push(portal);
  }

  /* Floor warnings: a soft shape shows where it will hurt and a hot fill shows when, so the read needs no sound. */
  var TELEGRAPH_MAX = 12, TELEGRAPH_KINDS = { line: 0, cone: 1, circle: 2, puddle: 2 };
  var TELEGRAPH_HOT = new THREE.Color(1.15, 0.05, 0.03), TELEGRAPH_ACID = new THREE.Color(0.55, 1.15, 0.08);
  var telegraphBase = new THREE.ShaderMaterial({
    uniforms: { size: { value: new THREE.Vector2(1, 1) }, kind: { value: 0 }, fill: { value: 0 }, tint: { value: new THREE.Color() } },
    transparent: true, depthWrite: false,
    vertexShader: 'uniform vec2 size; varying vec2 vP; void main() { vP = vec2(position.x, position.z + 0.5) * size; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: [
      'precision highp float; uniform vec2 size; uniform float kind, fill; uniform vec3 tint; varying vec2 vP;',
      'void main() {',
      '  float d, along;',
      '  if (kind < 0.5) { d = max(abs(vP.x) - size.x * 0.5, max(-vP.y, vP.y - size.y)); along = vP.y / size.y; }',
      '  else if (kind < 1.5) {',
      '    float r = length(vP), edge = asin(min(size.x * 0.5 / size.y, 1.0));',
      '    d = max(r - size.y, (atan(abs(vP.x), vP.y) - edge) * max(r, 1.0)); along = r / size.y;',
      '  } else { float r = length(vP - vec2(0.0, size.y * 0.5)); d = r - size.y * 0.5; along = r / (size.y * 0.5); }',
      '  if (d > 0.0) { discard; }',
      '  float rim = smoothstep(-0.8, -0.45, d), hot = step(along, fill), inked = smoothstep(-0.4, -0.18, d);',
      '  vec3 c = mix(tint * (1.0 + rim * 1.1), vec3(0.012, 0.008, 0.006), inked);',
      '  gl_FragColor = vec4(c, clamp(0.24 + hot * 0.5 + rim * 0.76 + inked, 0.0, 1.0));',
      '}'
    ].join('\n')
  });
  var TELEGRAPH_PLANE = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), telegraphs = [];
  for (i = 0; i < TELEGRAPH_MAX; i++) {
    var plate = new THREE.Mesh(TELEGRAPH_PLANE, telegraphBase.clone());
    plate.renderOrder = 1;
    plate.frustumCulled = false;
    plate.visible = false;
    scene.add(plate);
    telegraphs.push(plate);
  }

  function alertTexture() {
    var c = document.createElement('canvas');
    c.width = 64; c.height = 128;
    var x = c.getContext('2d');
    x.beginPath();
    x.moveTo(12, 8); x.lineTo(52, 8); x.lineTo(42, 80); x.lineTo(22, 80); x.closePath();
    x.moveTo(45, 104); x.arc(32, 104, 13, 0, Math.PI * 2);
    x.lineJoin = 'round';
    x.lineWidth = 12;
    x.strokeStyle = '#1c0404';
    x.stroke();
    x.fillStyle = '#ff2a12';
    x.fill();
    return new THREE.CanvasTexture(c);
  }
  var ALERT_MAX = 6, ALERT_MAP = alertTexture(), alerts = [];
  for (i = 0; i < ALERT_MAX; i++) {
    var bang = new THREE.Sprite(new THREE.SpriteMaterial({ map: ALERT_MAP, depthTest: false, depthWrite: false, transparent: true }));
    bang.scale.set(3.4, 6.8, 1);
    bang.renderOrder = 4;
    bang.visible = false;
    scene.add(bang);
    alerts.push(bang);
  }

  /* The bubble that carries you home after a fall: all edge, nearly no body. */
  var bubble = new THREE.Mesh(SPHERE, new THREE.ShaderMaterial({
    uniforms: { time: shared.time }, transparent: true, depthTest: false, depthWrite: false,
    vertexShader: 'varying vec3 vN, vV; void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalMatrix * normal; vV = -mv.xyz; gl_Position = projectionMatrix * mv; }',
    fragmentShader: [
      'precision highp float; uniform float time; varying vec3 vN, vV;',
      'void main() {',
      '  float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.4);',
      '  vec3 c = mix(vec3(0.5, 0.82, 1.1), vec3(1.2, 0.7, 1.0), sin(f * 6.0 + time * 2.2) * 0.5 + 0.5);',
      '  gl_FragColor = vec4(c * (0.5 + f * 2.2), 0.08 + f * 0.8);',
      '}'
    ].join('\n')
  }));
  bubble.renderOrder = 3;
  bubble.visible = false;
  scene.add(bubble);

  var checkpoint = new THREE.Mesh(new THREE.TorusGeometry(5.4, 0.42, 10, 56), shaded(toon(0xffc94d, 0x7a4c00), { rim: 0.7 }));
  checkpoint.rotation.x = Math.PI / 2;
  checkpoint.visible = false;
  scene.add(checkpoint);

  /* The red lump with its crown; one per stage, so one mesh is enough. */
  var kingLump = new THREE.Group(), kingHeap = new THREE.Mesh(crystalHeap(), shaded(new THREE.MeshPhongMaterial({ color: col(0xe0201a), emissive: col(0x8a0c08), specular: 0xffd0c0, shininess: 120 }), { rim: 0.2 }));
  kingHeap.scale.setScalar(3.1);
  kingLump.add(kingHeap);
  var crownBand = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.26, 8, 24), checkpoint.material);
  crownBand.rotation.x = Math.PI / 2;
  crownBand.position.y = 2.9;
  kingLump.add(crownBand);
  for (var spike = 0; spike < 5; spike++) {
    var point = new THREE.Mesh(new THREE.ConeGeometry(0.46, 1.5, 6), checkpoint.material), turn = spike / 5 * Math.PI * 2;
    point.position.set(Math.cos(turn) * 1.5, 3.7, Math.sin(turn) * 1.5);
    kingLump.add(point);
  }
  kingLump.visible = false;
  scene.add(kingLump);
  var SUGAR_WHITE = new THREE.Color(0xffffff), SUGAR_GLOW = col(0x8a8378), KING_RED = col(0xe0201a), KING_GLOW = col(0x8a0c08), kingOn = false;

  var marker = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.5, 36), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 1.5, 0.9), transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  marker.rotation.x = -Math.PI / 2;
  marker.visible = false;
  scene.add(marker);

  var egg = new THREE.Group();
  var eggBody = part(SPHERE, shaded(toon(0xf2a080, 0x7a3020), { rim: 0.8, blob: 0.015 }), egg, 0, 0, 0, 6.2);
  var eggFace = new THREE.Group();
  eggFace.rotation.x = -0.8;
  egg.add(eggFace);
  part(LOW, white, eggFace, -1.9, 1.3, 5.5, 1.3, 1, 0.5);
  part(LOW, white, eggFace, 1.9, 1.3, 5.5, 1.3, 1, 0.5);
  part(LOW, black, eggFace, -1.9, 1.1, 5.95, 0.5, 0.5, 0.2);
  part(LOW, black, eggFace, 1.9, 1.1, 5.95, 0.5, 0.5, 0.2);
  egg.visible = false;
  scene.add(egg);

  var motes = new THREE.Points(new THREE.BufferGeometry(), new THREE.ShaderMaterial({
    uniforms: { time: shared.time, tint: { value: new THREE.Color() }, map: { value: SOFT }, center: { value: new THREE.Vector3() }, pixel: { value: 1 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: [
      'uniform float time, pixel; uniform vec3 center; varying float vA;',
      'void main() {',
      '  vec3 p = position * 160.0;',
      '  p.xz = mod(p.xz - center.xz + 80.0 + vec2(sin(time * 0.3 + p.y), time * 0.6), 160.0) - 80.0 + center.xz;',
      '  p.y = 3.0 + mod(position.y * 9.0 + time * 0.25, 9.0);',
      '  vec4 mv = viewMatrix * vec4(p, 1.0);',
      '  gl_Position = projectionMatrix * mv;',
      '  gl_PointSize = pixel * (70.0 + position.x * 120.0) / max(-mv.z, 1.0);',
      '  vA = 0.06;',
      '}'
    ].join('\n'),
    fragmentShader: 'precision highp float; uniform vec3 tint; uniform sampler2D map; varying float vA; void main() { gl_FragColor = vec4(tint * texture2D(map, gl_PointCoord).r * vA, 1.0); }'
  }));
  var moteSeed = new Float32Array(420 * 3);
  for (i = 0; i < moteSeed.length; i++) { moteSeed[i] = Math.random(); }
  motes.geometry.setAttribute('position', new THREE.BufferAttribute(moteSeed, 3));
  motes.frustumCulled = false;
  scene.add(motes);

  var SPARK_MAX = 320, sparkPos = new Float32Array(SPARK_MAX * 3), sparkCol = new Float32Array(SPARK_MAX * 3), sparks = [];
  var sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  sparkGeo.setAttribute('color', new THREE.BufferAttribute(sparkCol, 3));
  var sparkPoints = new THREE.Points(sparkGeo, new THREE.PointsMaterial({ size: 1.1, map: SOFT, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  sparkPoints.frustumCulled = false;
  scene.add(sparkPoints);

  var shock = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(2, 1.8, 1.5), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  shock.rotation.x = -Math.PI / 2;
  shock.visible = false;
  scene.add(shock);
  var shockAge = 1, shockReach = 7;

  /* ---------- live camera ---------- */
  var pipScene = new THREE.Scene();
  pipScene.add(new THREE.HemisphereLight(0xffffff, 0x6a4a60, 0.75));
  var pipKey = new THREE.DirectionalLight(0xffffff, 0.7);
  pipKey.position.set(-2, 3, -6);
  pipScene.add(pipKey);
  var portrait = makeSperm({ bow: true });
  pipScene.add(portrait.body);
  gfx.portrait = portrait;
  var pipA = { value: new THREE.Color() }, pipB = { value: new THREE.Color() };
  var pipBack = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms: { time: shared.time, a: pipA, b: pipB }, depthTest: false, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.0); }',
    fragmentShader: [
      'precision highp float; uniform float time; uniform vec3 a, b; varying vec2 vUv;',
      'void main() {',
      '  vec2 q = vUv - vec2(0.5, 0.45);',
      '  vec3 c = mix(b * 1.1, a * 0.5, smoothstep(0.1, 0.8, length(q)));',
      '  for (int i = 0; i < 7; i++) {',
      '    float f = float(i);',
      '    vec2 p = vec2(fract(f * 0.37 + 0.13), fract(1.0 - (time * (0.1 + f * 0.018) + f * 0.61)));',
      '    c += b * exp(-dot(vUv - p, vUv - p) * (30.0 + f * 8.0)) * 0.7;',
      '  }',
      '  gl_FragColor = vec4(c, 1.0);',
      '}'
    ].join('\n')
  }));
  pipBack.frustumCulled = false;
  pipBack.renderOrder = -1;
  pipScene.add(pipBack);
  var pipCam = new THREE.PerspectiveCamera(27, 1, 0.1, 40);
  pipCam.position.set(0.3, 0.15, -7);
  pipCam.lookAt(0, 0.05, 0);

  /* ---------- post ---------- */
  var FS = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
  var fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  var fsMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  fsMesh.frustumCulled = false;
  var fsScene = new THREE.Scene();
  fsScene.add(fsMesh);
  function pass(material, target) {
    fsMesh.material = material;
    renderer.setRenderTarget(target);
    renderer.render(fsScene, fsCam);
  }
  var brightMat = new THREE.ShaderMaterial({
    uniforms: { src: { value: null } }, depthTest: false, depthWrite: false, vertexShader: FS,
    fragmentShader: 'precision highp float; uniform sampler2D src; varying vec2 vUv; void main() { vec3 c = min(texture2D(src, vUv).rgb, vec3(12.0)); float l = max(c.r, max(c.g, c.b)); gl_FragColor = vec4(c * smoothstep(0.95, 2.1, l), 1.0); }'
  });
  var blurMat = new THREE.ShaderMaterial({
    uniforms: { src: { value: null }, dir: { value: new THREE.Vector2() } }, depthTest: false, depthWrite: false, vertexShader: FS,
    fragmentShader: 'precision highp float; uniform sampler2D src; uniform vec2 dir; varying vec2 vUv; void main() { vec3 c = texture2D(src, vUv).rgb * 0.227; c += (texture2D(src, vUv + dir * 1.385).rgb + texture2D(src, vUv - dir * 1.385).rgb) * 0.316; c += (texture2D(src, vUv + dir * 3.231).rgb + texture2D(src, vUv - dir * 3.231).rgb) * 0.07; gl_FragColor = vec4(c, 1.0); }'
  });
  var GRADE = 'vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }';
  var finalMat = new THREE.ShaderMaterial({
    uniforms: { src: { value: null }, bloomA: { value: null }, bloomB: { value: null }, time: shared.time, flash: { value: 0 }, fade: { value: 1 } },
    depthTest: false, depthWrite: false, vertexShader: FS,
    fragmentShader: [
      'precision highp float; uniform sampler2D src, bloomA, bloomB; uniform float time, flash, fade; varying vec2 vUv;',
      GRADE,
      'void main() {',
      '  vec2 q = vUv - 0.5; float r2 = dot(q, q);',
      '  vec3 c = texture2D(src, vUv).rgb;',
      '  c += texture2D(bloomA, vUv).rgb * 0.28 + texture2D(bloomB, vUv).rgb * 0.34;',
      '  c *= 1.0 - r2 * 0.9;',
      '  c = aces(c * (0.82 + flash * 0.6) * fade);',
      '  c = pow(c, vec3(1.0 / 2.2));',
      '  float n = fract(sin(dot(gl_FragCoord.xy + fract(time) * 91.0, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;',
      '  gl_FragColor = vec4(c + n * 0.02, 1.0);',
      '}'
    ].join('\n')
  });
  var pipMat = new THREE.ShaderMaterial({
    uniforms: { src: { value: null } }, depthTest: false, depthWrite: false, vertexShader: FS,
    fragmentShader: [
      'precision highp float; uniform sampler2D src; varying vec2 vUv;',
      GRADE,
      'void main() {',
      '  vec2 q = vUv - 0.5;',
      '  vec3 c = pow(aces(texture2D(src, vUv).rgb * 1.05), vec3(1.0 / 2.2));',
      '  c *= 0.975 + 0.025 * sin(gl_FragCoord.y * 1.6);',
      '  c *= 1.0 - dot(q, q) * 0.9;',
      '  gl_FragColor = vec4(c, 1.0);',
      '}'
    ].join('\n')
  });

  var targets = null, W = 1, H = 1, pixelRatio = 1;
  var FLOAT_OPTS = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, type: THREE.HalfFloatType, format: THREE.RGBAFormat, stencilBuffer: false };
  function plain(w, h) { return new THREE.WebGLRenderTarget(Math.max(w, 2), Math.max(h, 2), Object.assign({ depthBuffer: false }, FLOAT_OPTS)); }

  function allocate() {
    if (targets) { Object.keys(targets).forEach(function (k) { targets[k].dispose(); }); }
    var dw = Math.round(W * pixelRatio), dh = Math.round(H * pixelRatio), main;
    if (gfx.quality !== 'baja' && THREE.WebGLMultisampleRenderTarget && renderer.capabilities.isWebGL2) {
      main = new THREE.WebGLMultisampleRenderTarget(dw, dh, Object.assign({ depthBuffer: true }, FLOAT_OPTS));
      main.samples = gfx.quality === 'alta' ? 4 : 2;
    } else {
      main = new THREE.WebGLRenderTarget(dw, dh, Object.assign({ depthBuffer: true }, FLOAT_OPTS));
    }
    targets = {
      main: main, b1: plain(dw >> 2, dh >> 2), b2: plain(dw >> 2, dh >> 2), c1: plain(dw >> 4, dh >> 4), c2: plain(dw >> 4, dh >> 4),
      pip: new THREE.WebGLRenderTarget(360, 360, Object.assign({ depthBuffer: true }, FLOAT_OPTS))
    };
    motes.material.uniforms.pixel.value = dh / 720;
  }

  gfx.resize = function () {
    W = Math.max(host.clientWidth, 1); H = Math.max(host.clientHeight, 1);
    pixelRatio = Math.min(window.devicePixelRatio || 1, 1.75) * { alta: 1, media: 0.8, baja: 0.6 }[gfx.quality];
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.fov = W < H ? 58 : 38;
    camera.updateProjectionMatrix();
    allocate();
  };
  gfx.setQuality = function (q) { gfx.quality = q; gfx.resize(); };
  gfx.size = function () { return { w: W, h: H }; };

  /* ---------- per-frame writers ---------- */
  var mat = new THREE.Matrix4(), quat = new THREE.Quaternion(), euler = new THREE.Euler(), vec = new THREE.Vector3(), scaleV = new THREE.Vector3(), ONE = new THREE.Vector3(1, 1, 1);
  var used = {};
  gfx.begin = function () { used = { sugar: 0, glint: 0, curtain: 0, spit: 0, foeSpit: 0, villain: 0, blade: 0, chest: 0, puzzle: 0, telegraph: 0, alert: 0, king: 0 }; };
  /* While the king reigns, every sugar goes red and dances to the tick. */
  gfx.setKing = function (on) {
    kingOn = on;
    sugarMesh.material.color.copy(on ? KING_RED : SUGAR_WHITE);
    sugarMesh.material.emissive.copy(on ? KING_GLOW : SUGAR_GLOW);
  };
  gfx.kingLump = function (x, z, clock) {
    used.king = 1;
    kingLump.visible = true;
    kingLump.position.set(x, 1.8 + Math.sin(clock * 2) * 0.3, z);
    kingLump.rotation.y = clock * 0.9;
  };
  /* lit: only sugar you can see right now sparkles; remembered sugar stays still in the fog. */
  gfx.sugar = function (x, z, n, clock, lit) {
    if (used.sugar >= SUGAR_MAX) { return; }
    euler.set(0, clock * 0.6 + n, 0);
    quat.setFromEuler(euler);
    vec.set(x, 1 + Math.sin(clock * 2 + n) * 0.15 + (kingOn ? Math.abs(Math.sin(clock * Math.PI / D.KING.beat)) * 1.1 : 0), z);
    mat.compose(vec, quat, scaleV.setScalar(kingOn ? 1.5 : 1.15));
    sugarMesh.setMatrixAt(used.sugar++, mat);
    if (lit) {
      quat.identity();
      mat.compose(vec, quat, ONE);
      glintMesh.setMatrixAt(used.glint++, mat);
    }
  };
  gfx.curtain = function (x, z, wide, wobble) {
    if (used.curtain >= 60) { return; }
    quat.identity();
    mat.compose(vec.set(x + (wide ? wobble : 0), 2, z + (wide ? 0 : wobble)), quat, scaleV.set(wide ? 6 : 1.6, 3.4, wide ? 1.6 : 6));
    curtainMesh.setMatrixAt(used.curtain++, mat);
  };
  gfx.spit = function (x, z) {
    if (used.spit >= 40) { return; }
    quat.identity();
    mat.compose(vec.set(x, 2, z), quat, scaleV.setScalar(0.6));
    spitMesh.setMatrixAt(used.spit++, mat);
  };
  gfx.foeSpit = function (x, z) {
    if (used.foeSpit >= FOE_SPIT_MAX) { return; }
    quat.identity();
    mat.compose(vec.set(x, 2, z), quat, scaleV.setScalar(0.85));
    foeSpitMesh.setMatrixAt(used.foeSpit++, mat);
  };
  /* A line or cone starts at x, z and runs length along angle; a circle or puddle is centred there and length is its diameter. */
  gfx.telegraph = function (kind, x, z, angle, length, width, fill) {
    if (used.telegraph >= TELEGRAPH_MAX) { return; }
    var t = telegraphs[used.telegraph++], u = t.material.uniforms, round = kind === 'circle' || kind === 'puddle', mid = round ? 0 : length / 2;
    t.visible = true;
    t.position.set(x + Math.sin(angle) * mid, 0.6, z + Math.cos(angle) * mid);
    t.rotation.y = angle;
    t.scale.set(width, 1, length);
    u.size.value.set(width, length);
    u.kind.value = TELEGRAPH_KINDS[kind];
    u.fill.value = fill;
    u.tint.value.copy(kind === 'puddle' ? TELEGRAPH_ACID : TELEGRAPH_HOT);
  };
  gfx.alert = function (x, y, z) {
    if (used.alert >= ALERT_MAX) { return; }
    var a = alerts[used.alert++], pulse = 1 + Math.sin(shared.time.value * 18) * 0.12;
    a.visible = true;
    a.position.set(x, y, z);
    a.scale.set(3.4 * pulse, 6.8 * pulse, 1);
  };
  gfx.chest = function (x, z, clock) {
    if (used.chest >= 14) { return; }
    euler.set(0, Math.sin(clock) * 0.2, 0);
    quat.setFromEuler(euler);
    mat.compose(vec.set(x, 1.4, z), quat, ONE);
    chestMesh.setMatrixAt(used.chest++, mat);
  };
  gfx.puzzle = function (x, z, clock) {
    if (used.puzzle >= 14) { return; }
    euler.set(0, clock * 1.4, 0);
    quat.setFromEuler(euler);
    mat.compose(vec.set(x, 3 + Math.sin(clock * 2) * 0.4, z), quat, ONE);
    puzzleMesh.setMatrixAt(used.puzzle++, mat);
  };
  /* tense swells the body before it strikes and sags it afterwards: 1 is about to go, negative is spent. */
  gfx.villain = function (kind, x, z, r, n, clock, tense) {
    if (used.villain >= villains.length) { return; }
    var v = villains[used.villain++];
    v.visible = true;
    v.position.set(x, r * 0.8, z);
    var wob = 1 + Math.sin(clock * 3 + n) * 0.06, swell = 1 + (tense || 0) * 0.35;
    v.scale.set(r * wob * swell, r / wob * swell, r * swell);
    v.userData.blob.material = kind === 'cell' ? cellMat : acidMat;
    v.userData.jaw.scale.y = 1 + Math.sin(clock * 9 + n) * 0.5;
  };
  gfx.antibody = function (x, z, turn) {
    if (used.blade >= antibodies.length) { return; }
    var a = antibodies[used.blade++];
    a.visible = true;
    a.position.set(x, 2.4, z);
    a.userData.spin.rotation.y = turn;
  };
  gfx.end = function () {
    sugarMesh.count = used.sugar;
    glintMesh.count = used.glint;
    curtainMesh.count = used.curtain; spitMesh.count = used.spit; chestMesh.count = used.chest; puzzleMesh.count = used.puzzle; foeSpitMesh.count = used.foeSpit;
    [sugarMesh, glintMesh, curtainMesh, spitMesh, chestMesh, puzzleMesh, foeSpitMesh].forEach(function (m) { m.instanceMatrix.needsUpdate = true; });
    for (var i = used.villain; i < villains.length; i++) { villains[i].visible = false; }
    for (i = used.blade; i < antibodies.length; i++) { antibodies[i].visible = false; }
    for (i = used.telegraph; i < TELEGRAPH_MAX; i++) { telegraphs[i].visible = false; }
    for (i = used.alert; i < ALERT_MAX; i++) { alerts[i].visible = false; }
    if (!used.king) { kingLump.visible = false; }
  };
  /* The race freezes during the egg: nothing may stay painted as if it were about to hit. */
  gfx.quiet = function () {
    kingLump.visible = false;
    telegraphs.forEach(function (t) { t.visible = false; });
    alerts.forEach(function (a) { a.visible = false; });
    foeSpitMesh.count = 0;
  };
  gfx.setBubble = function (on, x, y, z, scale) {
    bubble.visible = on;
    if (on) {
      bubble.position.set(x, y, z);
      bubble.scale.setScalar(scale);
    }
  };
  /* Pass nothing to take it away. */
  gfx.setCheckpoint = function (x, z) {
    checkpoint.visible = x !== undefined;
    if (checkpoint.visible) { checkpoint.position.set(x, 0.7, z); }
  };
  gfx.setPortal = function (index, on, x, z, golden) {
    portals[index].visible = on;
    if (on) {
      portals[index].position.set(x, 0.3, z);
      portals[index].userData.hole.material.color.set(golden ? 0xffffff : 0xff9a60).multiplyScalar(golden ? 3 : 1.5);
    }
  };
  gfx.setEgg = function (on, x, z) {
    egg.visible = on;
    if (on) { egg.position.set(x, 6, z); }
  };
  gfx.eggShake = function (amount, clock) {
    egg.position.x += rnd(-amount, amount) * 0.2;
    eggBody.scale.setScalar(6.2 + Math.sin(clock * 9) * 0.14);
  };
  gfx.setMarker = function (on, x, z) {
    marker.visible = on;
    if (on) { marker.position.set(x, 0.4, z); }
  };
  gfx.burst = function (x, y, z, count, hex, power) {
    var c = col(hex).multiplyScalar(3);
    for (var n = 0; n < count && sparks.length < SPARK_MAX; n++) {
      var v = new THREE.Vector3(rnd(-1, 1), rnd(0, 1), rnd(-1, 1)).normalize().multiplyScalar(rnd(0.3, 1) * power);
      sparks.push({ x: x, y: y, z: z, v: v, life: rnd(0.35, 0.8), age: 0, c: c });
    }
  };
  gfx.shockAt = function (x, z, reach) { shockAge = 0; shockReach = reach || 7; shock.visible = true; shock.position.set(x, 0.5, z); };
  /* Pass out to reuse an object on paths that run every frame. */
  gfx.project = function (x, y, z, out) {
    out = out || {};
    vec.set(x, y, z).project(camera);
    out.x = (vec.x + 1) / 2 * W;
    out.y = (1 - vec.y) / 2 * H;
    return out;
  };
  /* Screen point to the floor plane, for click to move. */
  gfx.groundAt = function (px, py) {
    vec.set(px / W * 2 - 1, 1 - py / H * 2, 0.5).unproject(camera).sub(camera.position).normalize();
    var t = -camera.position.y / vec.y;
    return { x: camera.position.x + vec.x * t, z: camera.position.z + vec.z * t };
  };

  function updateSparks(dt) {
    var live = [];
    sparks.forEach(function (p) {
      p.age += dt;
      if (p.age > p.life) { return; }
      p.x += p.v.x * dt; p.y += p.v.y * dt; p.z += p.v.z * dt;
      p.v.multiplyScalar(0.955);
      live.push(p);
    });
    sparks = live;
    for (var n = 0; n < SPARK_MAX; n++) {
      var q = sparks[n], f = q ? 1 - q.age / q.life : 0;
      sparkPos[n * 3] = q ? q.x : 0; sparkPos[n * 3 + 1] = q ? q.y : 0; sparkPos[n * 3 + 2] = q ? q.z : 0;
      sparkCol[n * 3] = q ? q.c.r * f : 0; sparkCol[n * 3 + 1] = q ? q.c.g * f : 0; sparkCol[n * 3 + 2] = q ? q.c.b * f : 0;
    }
    sparkGeo.attributes.position.needsUpdate = true;
    sparkGeo.attributes.color.needsUpdate = true;
  }

  /* view: { stage, time, dt, real, beat, camera, flash, fade, hero:{x,z}, pip } */
  gfx.render = function (view, pipBox) {
    shared.time.value = view.time;
    shared.beat.value = view.beat;
    camera.position.set(view.camera.x, view.camera.y, view.camera.z);
    camera.lookAt(view.camera.lx, 0, view.camera.lz);
    camera.updateMatrixWorld();
    shared.heroPos.value.set(view.hero.x, 0, view.hero.z);
    motes.material.uniforms.center.value.copy(shared.heroPos.value);
    var st = STAGES[view.stage];
    pipA.value.copy(col(st.a));
    pipB.value.copy(col(st.b));
    portals.forEach(function (p, n) {
      p.userData.ring.scale.setScalar(1 + Math.sin(view.time * 2 + n) * 0.06 + view.beat * 0.08);
    });
    checkpoint.scale.setScalar(1 + Math.sin(view.time * 1.6) * 0.03);
    updateSparks(view.dt);
    if (shockAge < 1) {
      shockAge += view.real * 3.2;
      shock.scale.setScalar(1.4 + shockAge * (shockReach - 1.4));
      shock.material.opacity = Math.max(1 - shockAge, 0);
      shock.visible = shockAge < 1;
    }

    renderer.setRenderTarget(targets.main);
    renderer.setClearColor(new THREE.Color(0.009, 0.007, 0.011));
    renderer.clear();
    renderer.render(scene, camera);

    brightMat.uniforms.src.value = targets.main.texture;
    pass(brightMat, targets.b1);
    var u = blurMat.uniforms;
    u.src.value = targets.b1.texture; u.dir.value.set(1.4 / targets.b1.width, 0); pass(blurMat, targets.b2);
    u.src.value = targets.b2.texture; u.dir.value.set(0, 1.4 / targets.b1.height); pass(blurMat, targets.b1);
    u.src.value = targets.b1.texture; u.dir.value.set(1.4 / targets.c1.width, 0); pass(blurMat, targets.c2);
    u.src.value = targets.c2.texture; u.dir.value.set(0, 1.4 / targets.c1.height); pass(blurMat, targets.c1);

    if (pipBox) {
      portrait.body.rotation.set(view.pip.pitch, view.pip.yaw, view.pip.roll);
      portrait.body.position.set(0, view.pip.y, 0);
      portrait.look(view.pip.lookX, view.pip.lookY);
      portrait.tailRate.value = view.pip.tail;
      pipCam.position.set(0.3 + Math.sin(view.time * 1.1) * 0.12, 0.15 + Math.cos(view.time * 1.6) * 0.08, -7);
      pipCam.lookAt(0, 0.05, 0);
      renderer.setRenderTarget(targets.pip);
      renderer.setClearColor(0x000000);
      renderer.clear();
      renderer.render(pipScene, pipCam);
    }

    var f = finalMat.uniforms;
    f.src.value = targets.main.texture;
    f.bloomA.value = targets.b1.texture;
    f.bloomB.value = targets.c1.texture;
    f.flash.value = view.flash;
    f.fade.value = view.fade;
    renderer.setViewport(0, 0, W, H);
    pass(finalMat, null);

    if (pipBox) {
      renderer.setScissorTest(true);
      renderer.setViewport(pipBox.left, H - pipBox.bottom, pipBox.width, pipBox.height);
      renderer.setScissor(pipBox.left, H - pipBox.bottom, pipBox.width, pipBox.height);
      pipMat.uniforms.src.value = targets.pip.texture;
      pass(pipMat, null);
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, W, H);
    }
  };

  return gfx;
})();
