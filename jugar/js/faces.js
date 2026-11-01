/* The expression sheet: faces are drawn, not modelled. Style: gross-out cartoon, bulging eyes and bad teeth. */
EG.faces = (function () {
  'use strict';
  var GRID = 4, CELL = 512, SIDE_CELL = 256;
  var INK = '#120c0b', SKIN = '#f6e7d4', GUM = '#7a1c2c';
  var MOODS = ['neutral', 'happy', 'smug', 'scared', 'hurt', 'dead', 'angry', 'blink'];

  function stroke(ctx, width, draw) {
    ctx.strokeStyle = INK; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); draw(); ctx.stroke();
  }

  /* A bulging ball with a tiny pupil, a heavy lid and a bag underneath: that is the whole joke. */
  function eye(ctx, cx, cy, r, o) {
    var lid = o.lid || 0, look = o.look || [0, 0], pupil = o.pupil || 0.2, line = o.line || 9;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(o.tilt || 0);
    ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.3);
    ctx.fillStyle = '#fffef6'; ctx.fill();
    ctx.save();
    ctx.clip();
    if (o.veins) {
      ctx.strokeStyle = 'rgba(200,30,40,.8)'; ctx.lineWidth = 3;
      for (var v = 0; v < 7; v++) {
        var a = v * 0.9 + 0.3;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        ctx.lineTo(Math.cos(a + 0.25) * r * 0.6, Math.sin(a + 0.25) * r * 0.6);
        ctx.lineTo(Math.cos(a - 0.1) * r * 0.42, Math.sin(a - 0.1) * r * 0.42);
        ctx.stroke();
      }
    }
    ctx.fillStyle = INK;
    ctx.beginPath(); ctx.arc(look[0] * r * 0.5, look[1] * r * 0.5, r * pupil, 0, 6.3); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(look[0] * r * 0.5 - r * pupil * 0.35, look[1] * r * 0.5 - r * pupil * 0.35, r * pupil * 0.3, 0, 6.3); ctx.fill();
    if (lid > 0) {
      var edge = -r + lid * r * 2;
      ctx.fillStyle = SKIN;
      ctx.fillRect(-r - 4, -r - 4, r * 2 + 8, edge + r + 4);
      stroke(ctx, line, function () { ctx.moveTo(-r, edge); ctx.lineTo(r, edge + (o.lidSlope || 0)); });
    }
    ctx.restore();
    stroke(ctx, line, function () { ctx.arc(0, 0, r, 0, 6.3); });
    if (o.lash) {
      [-0.7, -0.15, 0.4].forEach(function (a) {
        var ang = -Math.PI / 2 + a;
        stroke(ctx, 7, function () {
          ctx.moveTo(Math.cos(ang) * r, Math.sin(ang) * r);
          ctx.lineTo(Math.cos(ang) * (r + 30), Math.sin(ang) * (r + 30));
        });
      });
    }
    ctx.restore();
    if (o.bare) { return; }
    stroke(ctx, 5, function () { ctx.moveTo(cx - r * 0.7, cy + r + 13); ctx.quadraticCurveTo(cx, cy + r + 27, cx + r * 0.7, cy + r + 11); });
  }

  function shut(ctx, cx, cy, r) {
    stroke(ctx, 12, function () { ctx.moveTo(cx - r, cy); ctx.quadraticCurveTo(cx, cy + 14, cx + r, cy - 4); });
  }
  function squeezed(ctx, cx, cy, side) {
    stroke(ctx, 13, function () { ctx.moveTo(cx - 54 * side, cy - 36); ctx.lineTo(cx + 42 * side, cy); ctx.lineTo(cx - 54 * side, cy + 34); });
  }
  function crossed(ctx, cx, cy) {
    stroke(ctx, 17, function () {
      ctx.moveTo(cx - 52, cy - 52); ctx.lineTo(cx + 52, cy + 52);
      ctx.moveTo(cx + 52, cy - 52); ctx.lineTo(cx - 52, cy + 52);
    });
  }
  /* Eyebrows are slabs: they carry most of the expression. */
  function brow(ctx, cx, cy, width, angle, weight) {
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(angle);
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.moveTo(-width, weight * 0.2);
    ctx.quadraticCurveTo(0, -weight * 1.1, width, -weight * 0.2);
    ctx.lineTo(width, weight * 0.5);
    ctx.quadraticCurveTo(0, weight * 0.4, -width, weight);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function teethRow(ctx, x0, x1, y, h, gaps) {
    var count = Math.round((x1 - x0) / 34), w = (x1 - x0) / count;
    for (var i = 0; i < count; i++) {
      if (gaps.indexOf(i) >= 0) { continue; }
      ctx.fillStyle = i % 3 === 2 ? '#f2e2a6' : '#fff8e6';
      ctx.fillRect(x0 + i * w + 1, y, w - 2, h - (i % 2) * 5);
      ctx.strokeStyle = INK; ctx.lineWidth = 3.5;
      ctx.strokeRect(x0 + i * w + 1, y, w - 2, h - (i % 2) * 5);
    }
  }

  function bigMouth(ctx, y, w, h, o) {
    o = o || {};
    function shape() {
      ctx.beginPath();
      ctx.moveTo(-w, y + (o.skew || 0));
      ctx.quadraticCurveTo(0, y + 8, w, y - (o.skew || 0));
      ctx.bezierCurveTo(w * 0.86, y + h * 1.15, -w * 0.86, y + h * 1.15, -w, y + (o.skew || 0));
      ctx.closePath();
    }
    shape();
    ctx.fillStyle = GUM; ctx.fill();
    ctx.save();
    ctx.clip();
    if (o.tongue) {
      ctx.fillStyle = '#ef5f70';
      ctx.beginPath(); ctx.ellipse(0, y + h * 0.95, w * 0.6, h * 0.5, 0, 0, 6.3); ctx.fill();
      stroke(ctx, 4, function () { ctx.moveTo(0, y + h * 0.6); ctx.lineTo(0, y + h); });
    }
    teethRow(ctx, -w, w, y - 2, h * 0.32, o.gaps || []);
    if (o.lower) { teethRow(ctx, -w * 0.8, w * 0.8, y + h * 0.66, h * 0.26, [1]); }
    ctx.restore();
    ctx.lineWidth = 9; ctx.strokeStyle = INK; ctx.lineJoin = 'round';
    shape(); ctx.stroke();
  }

  function grit(ctx, y, w, h) {
    ctx.fillStyle = '#fff8e6';
    ctx.fillRect(-w, y, w * 2, h);
    ctx.strokeStyle = INK; ctx.lineWidth = 8;
    ctx.strokeRect(-w, y, w * 2, h);
    ctx.lineWidth = 4;
    for (var x = -w + 26; x < w; x += 26) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + h); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(-w, y + h / 2); ctx.lineTo(w, y + h / 2); ctx.stroke();
  }

  function sweat(ctx, x, y, size) {
    ctx.fillStyle = '#9fd8ff'; ctx.strokeStyle = INK; ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x, y - size);
    ctx.bezierCurveTo(x + size * 0.9, y + size * 0.2, x + size * 0.5, y + size * 0.8, x, y + size * 0.8);
    ctx.bezierCurveTo(x - size * 0.5, y + size * 0.8, x - size * 0.9, y + size * 0.2, x, y - size);
    ctx.fill(); ctx.stroke();
  }

  function stubble(ctx) {
    ctx.fillStyle = 'rgba(18,12,11,.42)';
    for (var i = 0; i < 46; i++) {
      var a = 0.25 + (i / 46) * 2.64, r = 176 + (i * 37 % 34);
      ctx.beginPath(); ctx.arc(Math.cos(a) * r, Math.sin(a) * r * 0.86 + 6, 2.6, 0, 6.3); ctx.fill();
    }
  }

  function draw(ctx, mood, style) {
    var lash = style.lash, shift = style.cross ? 0.5 : 0;
    var L = -96, R = 104, Y = -46;
    function look(x, y) { return [[x + shift, y], [x - shift, y]]; }
    if (!lash) { stubble(ctx); }
    if (mood === 'neutral') {
      var n = look(0.25, 0.1);
      eye(ctx, L, Y, 84, { lid: 0.36, lash: lash, look: n[0] });
      eye(ctx, R, Y + 8, 64, { lid: 0.22, lash: lash, look: n[1] });
      brow(ctx, L, -150, 86, 0.1, 22); brow(ctx, R, -130, 70, -0.1, 22);
      bigMouth(ctx, 92, 92, 46, { skew: 12, gaps: [2] });
    } else if (mood === 'happy') {
      var h = look(0.1, -0.1);
      eye(ctx, L, Y, 90, { lash: lash, look: h[0], pupil: 0.16 });
      eye(ctx, R, Y - 4, 76, { lash: lash, look: h[1], pupil: 0.14 });
      brow(ctx, L, -168, 80, -0.12, 20); brow(ctx, R, -158, 70, 0.14, 20);
      bigMouth(ctx, 66, 150, 118, { tongue: true, gaps: [3, 6], lower: true });
    } else if (mood === 'smug') {
      var s = look(0.7, 0);
      eye(ctx, L, Y, 80, { lid: 0.56, lash: lash, look: s[0], lidSlope: 12 });
      eye(ctx, R, Y, 72, { lid: 0.3, lash: lash, look: s[1] });
      brow(ctx, L, -92, 86, 0.2, 24); brow(ctx, R, -170, 74, -0.3, 22);
      bigMouth(ctx, 92, 106, 44, { skew: 26, gaps: [4] });
    } else if (mood === 'scared') {
      var p = look(0, 0.1);
      eye(ctx, L, Y, 100, { lash: lash, look: p[0], pupil: 0.1, veins: true });
      eye(ctx, R, Y + 6, 86, { lash: lash, look: p[1], pupil: 0.09, veins: true });
      brow(ctx, L, -182, 72, -0.4, 16); brow(ctx, R, -172, 62, 0.42, 16);
      grit(ctx, 96, 104, 62);
      sweat(ctx, 226, -116, 52);
      sweat(ctx, -222, 6, 34);
    } else if (mood === 'hurt') {
      squeezed(ctx, L, Y, 1);
      eye(ctx, R, Y, 78, { lash: lash, look: [-0.5, 0.4], pupil: 0.14, veins: true });
      brow(ctx, L, -128, 78, 0.42, 24); brow(ctx, R, -158, 70, -0.46, 22);
      bigMouth(ctx, 86, 112, 86, { skew: -22, gaps: [1, 4, 5], tongue: true });
      sweat(ctx, 216, -124, 40);
    } else if (mood === 'dead') {
      crossed(ctx, L, Y); crossed(ctx, R, Y);
      bigMouth(ctx, 84, 96, 66, { gaps: [1, 3], skew: 8 });
      ctx.fillStyle = '#ef5f70'; ctx.strokeStyle = INK; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.moveTo(-22, 116); ctx.quadraticCurveTo(-26, 224, 36, 214); ctx.quadraticCurveTo(74, 204, 52, 116); ctx.closePath(); ctx.fill(); ctx.stroke();
    } else if (mood === 'angry') {
      var a = look(-0.05, 0.1);
      eye(ctx, L, Y, 80, { lid: 0.34, lash: lash, look: a[0], pupil: 0.14, veins: true, lidSlope: 34 });
      eye(ctx, R, Y, 72, { lid: 0.34, lash: lash, look: a[1], pupil: 0.14, veins: true, lidSlope: -34 });
      brow(ctx, -92, -128, 100, 0.46, 34); brow(ctx, 96, -128, 96, -0.46, 34);
      grit(ctx, 90, 126, 72);
    } else {
      shut(ctx, L, Y, 78); shut(ctx, R, Y, 62);
      brow(ctx, L, -128, 86, 0.1, 22); brow(ctx, R, -116, 70, -0.1, 22);
      bigMouth(ctx, 92, 92, 46, { skew: 12, gaps: [2] });
    }
  }

  function jawStubble(ctx) {
    ctx.fillStyle = 'rgba(18,12,11,.42)';
    for (var i = 0; i < 30; i++) {
      var a = 0.62 + (i / 30) * 1.3, r = 190 + (i * 37 % 34);
      ctx.beginPath(); ctx.arc(Math.cos(a) * r * 1.02 - 6, Math.sin(a) * r + 10, 2.6, 0, 6.3); ctx.fill();
    }
  }

  /* The same gross-out face turned ninety degrees: nose towards +x, one huge eye, the mouth on the snout. Heads are small on screen, so everything is drawn bold. */
  function drawSide(ctx, mood, style) {
    var EX = 50, EY = -62, MX = 92, BOLD = 1.3, LINE = 17, lash = style.lash;
    function gaze(x, y) { return style.cross ? [0.98, 0.32] : [x, y]; }
    function lid(amount) { return style.cross ? Math.max(amount, 0.46) : amount; }
    function bold(x, y, paint) {
      ctx.save(); ctx.translate(x, y); ctx.scale(BOLD, BOLD);
      paint();
      ctx.restore();
    }
    function bigEye(y, r, o) {
      o.lash = lash; o.line = LINE; o.bare = true;
      eye(ctx, EX, y, r, o);
    }
    function mouth(y, w, h, o) { bold(MX, y, function () { bigMouth(ctx, 0, w, h, o); }); }
    function clench(y, w, h) { bold(MX, y, function () { grit(ctx, 0, w, h); }); }
    if (!lash) { jawStubble(ctx); }
    if (mood === 'neutral') {
      bigEye(EY, 128, { lid: lid(0.34), look: gaze(0.66, 0.12), pupil: 0.27 });
      brow(ctx, EX, -196, 112, 0.14, 30);
      mouth(102, 66, 46, { skew: 10, gaps: [2] });
    } else if (mood === 'happy') {
      bigEye(EY - 8, 132, { look: gaze(0.55, -0.1), pupil: 0.24 });
      brow(ctx, EX, -214, 104, -0.04, 26);
      mouth(84, 84, 74, { tongue: true, gaps: [3], lower: true });
    } else if (mood === 'smug') {
      bigEye(EY, 126, { lid: lid(0.5), look: gaze(0.86, 0.45), pupil: 0.27, lidSlope: 14 });
      brow(ctx, EX, -150, 112, 0.18, 32);
      mouth(106, 76, 40, { skew: -20, gaps: [3] });
    } else if (mood === 'scared') {
      bigEye(EY - 6, 136, { look: gaze(0.3, 0.1), pupil: 0.14, veins: true });
      brow(ctx, EX - 8, -220, 92, -0.3, 22);
      clench(104, 62, 44);
      sweat(ctx, -128, -128, 50);
      sweat(ctx, -150, 26, 32);
    } else if (mood === 'hurt') {
      bold(EX + 6, EY, function () { squeezed(ctx, 0, 0, 1); });
      brow(ctx, EX, -172, 104, 0.42, 30);
      mouth(98, 72, 62, { skew: -16, gaps: [1, 3], tongue: true });
      sweat(ctx, -116, -132, 44);
    } else if (mood === 'dead') {
      bold(EX, EY, function () { ctx.scale(1.3, 1.3); crossed(ctx, 0, 0); });
      mouth(100, 66, 48, { gaps: [1, 3], skew: 8 });
      bold(MX, 100, function () {
        ctx.fillStyle = '#ef5f70'; ctx.strokeStyle = INK; ctx.lineWidth = 8;
        ctx.beginPath(); ctx.moveTo(4, 22); ctx.quadraticCurveTo(0, 88, 40, 84); ctx.quadraticCurveTo(66, 78, 50, 22); ctx.closePath(); ctx.fill(); ctx.stroke();
      });
    } else if (mood === 'angry') {
      bigEye(EY, 124, { lid: lid(0.34), look: gaze(0.76, 0.14), pupil: 0.2, veins: true, lidSlope: 46 });
      brow(ctx, EX, -158, 124, 0.46, 42);
      clench(98, 66, 50);
    } else {
      bold(EX, EY, function () { ctx.scale(1.3, 1.3); shut(ctx, 0, 0, 74); });
      brow(ctx, EX, -176, 112, 0.14, 30);
      mouth(102, 66, 46, { skew: 10, gaps: [2] });
    }
  }

  /* Same sixteen cells either way: plain faces first, the cross-eyed row after them. */
  function bake(paint, style, cell) {
    var c = document.createElement('canvas');
    c.width = c.height = GRID * cell;
    var ctx = c.getContext('2d'), zoom = cell / CELL;
    function put(index, mood, cross) {
      ctx.save();
      ctx.translate((index % GRID + 0.5) * cell, (Math.floor(index / GRID) + 0.5) * cell);
      ctx.scale(zoom, zoom);
      paint(ctx, mood, Object.assign({}, style, { cross: cross }));
      ctx.restore();
    }
    MOODS.forEach(function (mood, i) {
      put(i, mood, false);
      put(i + 8, mood, true);
    });
    var tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = 8;
    tex.flipY = false;
    return tex;
  }
  function sheet(style) { return bake(draw, style, CELL); }
  function sheetSide(style) { return bake(drawSide, style, SIDE_CELL); }

  var plain = sheet({ lash: false }), lashes = sheet({ lash: true });
  var plainSide = sheetSide({ lash: false }), lashesSide = sheetSide({ lash: true });
  return {
    GRID: GRID,
    index: function (mood) { return Math.max(MOODS.indexOf(mood), 0); },
    hero: plain, heroX: lashes, rival: plain, rivalGreen: lashes,
    heroSide: plainSide, heroXSide: lashesSide, rivalSide: plainSide, rivalGreenSide: lashesSide
  };
})();
