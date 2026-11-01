/* The hype cut: lights on, millions; lights off, insults; fewer each time, then only one. */
EG.intro = (function () {
  'use strict';
  var D = EG.data, audio = EG.audio;
  var canvas = document.getElementById('intro'), ctx = canvas.getContext('2d');
  var LENGTH = 19.6, TAGLINE_AT = 16.1, TITLE_AT = 17, W = 1, H = 1, swarm = [], raf = 0, started = 0, done = null, fired = {};

  /* Time ranges with the room lit, and how many swimmers each cut shows. */
  var LIT = [
    { from: 0.8, to: 2.6, count: 1500, size: 0.5, label: '300.000.000' },
    { from: 6, to: 7.4, count: 170, size: 1.1, label: '12.480.331' },
    { from: 10.8, to: 12, count: 11, size: 2.8, label: '1.204' },
    { from: 14.2, to: 15.8, count: 1, size: 7.4, label: '1' }
  ];
  /* Lines land one every `step` seconds and stay up until the lights return, so each one can be read. */
  var DARK = [
    { from: 2.6, to: 6, step: 0.85, lines: ['¡APARTA, PAQUETE!', '¡HIJO DE LA GRAN PUTA!', '¡TU SITIO ERA UN KLEENEX!'] },
    { from: 7.4, to: 10.8, step: 0.85, lines: ['¡COMEMIERDA!', '¡TE VA A ADELANTAR TU PRIMA!', '¡NACISTE DE UNA PAJA TRISTE!'] },
    { from: 12, to: 14.2, step: 0.9, lines: ['¡PALMA YA!', '¡NI DE COÑA LLEGAS!'] }
  ];

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function seed() {
    swarm = [];
    for (var i = 0; i < 1500; i++) {
      swarm.push({ x: Math.random(), y: Math.random(), speed: 0.18 + Math.random() * 0.3, ph: Math.random() * 6.3, cell: Math.floor(Math.random() * 3) });
    }
  }

  function swimmer(x, y, size, t, ph, sheet, mood) {
    ctx.strokeStyle = '#fff3e4'; ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(size * 2.4, 1);
    ctx.beginPath(); ctx.moveTo(x, y);
    var steps = size > 2 ? 40 : 7;
    for (var i = 1; i <= steps; i++) {
      var k = i / steps;
      ctx.lineTo(x - k * size * 48, y + Math.sin(t * 16 + k * 8 + ph) * size * 7 * k);
    }
    ctx.stroke();
    var r = size * 12;
    ctx.fillStyle = '#fff3e4';
    ctx.beginPath(); ctx.ellipse(x, y, r * 1.1, r, 0, 0, 6.3); ctx.fill();
    if (size > 0.9) {
      var image = sheet.image, cell = image.width / EG.faces.GRID, index = EG.faces.index(mood);
      ctx.lineWidth = Math.max(size * 1.1, 1); ctx.strokeStyle = '#120c0b';
      ctx.beginPath(); ctx.ellipse(x, y, r * 1.1, r, 0, 0, 6.3); ctx.stroke();
      ctx.drawImage(image, index % EG.faces.GRID * cell, Math.floor(index / EG.faces.GRID) * cell, cell, cell, x - r * 1.05, y - r * 1.05, r * 2.1, r * 2.1);
    }
  }

  function bigText(text, x, y, size, colour, rotate) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(rotate || 0);
    ctx.font = 'italic 800 ' + size + 'px "Barlow Condensed", Impact, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = colour;
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }

  function draw(t) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    var unit = Math.min(W / 16, H / 9), i, cut, base = Math.min(W, H);
    LIT.forEach(function (c) {
      if (t < c.from || t >= c.to) { return; }
      cut = c;
    });
    if (cut) {
      var flick = t - cut.from < 0.14 ? (Math.floor(t * 60) % 2 ? 0.25 : 1) : 1;
      var glow = ctx.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, Math.max(W, H) * 0.7);
      glow.addColorStop(0, cut.count === 1 ? 'rgb(120,62,22)' : 'rgb(92,16,34)');
      glow.addColorStop(1, 'rgb(14,4,10)');
      ctx.fillStyle = glow;
      ctx.globalAlpha = flick;
      ctx.fillRect(0, 0, W, H);
      var size = cut.size * base / 720;
      if (cut.count === 1) {
        var push = (t - cut.from) / (cut.to - cut.from);
        var beam = ctx.createRadialGradient(W / 2, H / 2, 20, W / 2, H / 2, base * 0.62);
        beam.addColorStop(0, 'rgba(255,214,130,.65)');
        beam.addColorStop(1, 'rgba(255,214,130,0)');
        ctx.fillStyle = beam;
        ctx.fillRect(0, 0, W, H);
        swimmer(W * 0.58, H * 0.5, size * (1 + push * 0.16), t * 0.5, 0, EG.faces.hero, 'smug');
      } else {
        for (i = 0; i < cut.count; i++) {
          var s = swarm[i], px = ((s.x + t * s.speed) % 1.2 - 0.1) * W;
          var py = cut.count < 20 ? H * (0.14 + (i / cut.count) * 0.76) : s.y * H;
          swimmer(px, py + Math.sin(t * 2 + s.ph) * 6, size, t, s.ph, i % 2 ? EG.faces.rival : EG.faces.rivalGreen, 'angry');
        }
      }
      bigText(cut.label, W / 2, H - unit * 1.1, unit * (cut.count === 1 ? 1.5 : 1.1), '#ffc94d');
      ctx.globalAlpha = 1;
    }
    DARK.forEach(function (d) {
      if (t < d.from || t >= d.to) { return; }
      d.lines.forEach(function (line, n) {
        if (t < d.from + n * d.step) { return; }
        var pop = Math.min((t - d.from - n * d.step) * 8, 1);
        var y = H * (0.28 + n * 0.22), tilt = (n % 2 ? 1 : -1) * 0.05;
        bigText(line, W / 2 + (n % 2 ? 1 : -1) * W * 0.06, y, unit * 1.05 * (1.5 - pop * 0.5), n % 2 ? '#ff5f3f' : '#fbf1e3', tilt);
      });
    });
    if (t >= TAGLINE_AT) {
      var fade = Math.min((t - TAGLINE_AT) * 2.4, 1);
      ctx.globalAlpha = fade;
      bigText('De 300 millones, solo llega uno.', W / 2, H * 0.32, unit * 0.9, '#fbf1e3');
      if (t >= TITLE_AT) {
        var hit = Math.min((t - TITLE_AT) * 9, 1);
        bigText('ONLY ONE', W / 2, H * 0.56, unit * 2.9 * (1.5 - hit * 0.5), '#ffc94d');
        bigText('Sometimes more, but not this time', W / 2, H * 0.74, unit * 0.62, '#ff5f3f');
      }
      ctx.globalAlpha = 1;
    }
  }

  /* Sound hits: a clack for each light, a low rising drone underneath. */
  function cues(t) {
    function once(key, at, fn) { if (t >= at && !fired[key]) { fired[key] = 1; fn(); } }
    LIT.forEach(function (c, i) {
      once('on' + i, c.from, function () { audio.tone(70 + i * 16, 0.5, 'sawtooth', 0.2, 42); audio.hiss(0.16, 2600, 1, 1.2); });
      once('off' + i, c.to, function () { audio.tone(110, 0.1, 'square', 0.1, 50); });
    });
    DARK.forEach(function (d, i) {
      d.lines.forEach(function (line, n) {
        once('line' + i + n, d.from + n * d.step, function () { audio.tone(190 + n * 40, 0.08, 'square', 0.08); });
      });
    });
    once('title', TITLE_AT, function () { audio.fanfare(); audio.tone(55, 1.2, 'sawtooth', 0.22, 110); });
    once('beat1', 0.1, function () { audio.beat(true); });
    once('beat2', 12.3, function () { audio.beat(true); });
  }

  function finish() {
    cancelAnimationFrame(raf);
    canvas.hidden = true;
    window.removeEventListener('resize', resize);
    var cb = done;
    done = null;
    if (cb) { cb(); }
  }
  function loop(now) {
    var t = (now - started) / 1000;
    if (t >= LENGTH) { finish(); return; }
    draw(t);
    cues(t);
    raf = requestAnimationFrame(loop);
  }

  return {
    playing: function () { return !canvas.hidden; },
    skip: function () { if (!canvas.hidden) { finish(); } },
    play: function (callback) {
      canvas.hidden = false;
      done = callback;
      fired = {};
      resize();
      if (!swarm.length) { seed(); }
      window.addEventListener('resize', resize);
      started = performance.now();
      raf = requestAnimationFrame(loop);
    },
    still: function (t) {
      canvas.hidden = false;
      resize();
      if (!swarm.length) { seed(); }
      cancelAnimationFrame(raf);
      draw(t);
    }
  };
})();
