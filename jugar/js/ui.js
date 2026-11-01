/* Everything the player touches: screens, HUD, keyboard, mouse and gamepad. */
EG.ui = (function () {
  'use strict';
  var D = EG.data, gfx = EG.gfx, audio = EG.audio, game = EG.game, HUD = D.HUD, BUBBLE = HUD.bubble, POP = HUD.pop, TOAST = HUD.toast;
  var $ = function (id) { return document.getElementById(id); };
  var stage = $('stage'), stack = [], ui = {};
  var pointer = { x: 0, y: 0, active: false, down: false }, keys = {};
  var pad = { x: 0, y: 0, sprint: false, held: {}, repeat: 0 };
  var callTime = 0, shownHearts = -1, shownMax = -1, shownLives = -1, shownShare = -1, shownBoon = '';
  var settings = { master: 0.8, sfx: 0.8, ambience: 0.6, shake: true, invert: false, quality: 'alta' };
  var touchFirst = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  if (touchFirst) { settings.quality = 'media'; }
  try {
    var stored = window.localStorage.getItem(D.SETTINGS_KEY);
    if (stored) { settings = Object.assign(settings, JSON.parse(stored)); }
  } catch (e) { /* defaults are fine */ }
  function persistSettings() {
    try { window.localStorage.setItem(D.SETTINGS_KEY, JSON.stringify(settings)); } catch (e) { /* idem */ }
  }
  ui.settings = function () { return settings; };

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function inGame() { return game.phase() === 'race' || game.phase() === 'egg'; }
  /* The broadcast stays on air while the bubble floats you home, though you cannot play. */
  function onAir() { return inGame() || game.phase() === 'down'; }
  /* A test or a death has to be answered: no key backs out of them. */
  function locked() { return top() === 'puzzle' || top() === 'obit' || top() === 'litter'; }

  /* ---------- screens ---------- */
  function show(id) {
    ['title', 'pause', 'shop', 'settings', 'controls', 'confirm', 'pick', 'puzzle', 'obit', 'litter'].forEach(function (name) { $(name).hidden = name !== id; });
    document.body.classList.toggle('in-menu', !!id);
    if (id) { focusFirst(id); }
  }
  function top() { return stack[stack.length - 1]; }
  /* A menu opening under a held thumb must not leave the hero swimming. */
  var finger = { id: null, x: 0, y: 0, ox: 0, oy: 0, born: 0, slid: false, sprint: false }, stick = $('stick');
  function releaseFinger() {
    finger.id = null;
    finger.x = finger.y = 0;
    finger.sprint = false;
    stick.hidden = true;
  }
  function focusFirst(id) {
    if (id === 'shop') { drawShop(); }
    var first = $(id).querySelector('.nav:not([hidden])');
    if (first) { first.focus({ preventScroll: false }); }
  }
  function open(id) {
    releaseFinger();
    stack.push(id);
    keys = {}; pointer.down = false;
    show(id);
    audio.ui();
  }
  function back() {
    if (top() === 'title') { return; }
    stack.pop();
    show(top() || null);
    audio.ui();
    if (!stack.length) { stage.focus(); game.persist(); }
  }
  ui.blocking = function () { return stack.length > 0 || !$('ending').hidden || EG.intro.playing(); };

  function drawTitle() {
    var going = game.save().stage > 0 || game.save().sugar > 0 || game.save().won > 0;
    $('btnPlay').textContent = going ? 'Seguir nadando' : 'Salir a nadar';
    $('btnReset').hidden = !going;
  }

  function drawName() {
    var her = game.save().sex === 'X';
    $('strapName').textContent = her ? 'LA ELEGIDA' : 'EL ELEGIDO';
  }

  function play() {
    audio.unlock();
    if (!game.save().sex) { open('pick'); return; }
    drawName();
    if (!game.save().intro) {
      game.save().intro = true;
      show(null);
      EG.intro.play(play);
      return;
    }
    stack = [];
    show(null);
    game.start();
    if (document.body.classList.contains('touch') && !settings.touchTold) {
      settings.touchTold = true;
      persistSettings();
      setTimeout(function () { ui.toast('Arrastra el dedo para nadar', 'O toca un punto y vas solo'); }, 4800);
    }
    stage.focus();
    $('hud').hidden = false;
    $('minimap').hidden = false;
  }
  function toTitle() {
    game.persist();
    game.toTitle();
    clearToasts();
    ui.mash(false);
    stack = ['title'];
    drawTitle();
    $('hud').hidden = true;
    $('minimap').hidden = true;
    show('title');
  }

  /* ---------- menus navigation ---------- */
  function navItems() {
    return Array.prototype.slice.call($(top()).querySelectorAll('.nav')).filter(function (el) { return !el.hidden && el.offsetParent !== null; });
  }
  function moveFocus(dx, dy) {
    var items = navItems(), at = document.activeElement;
    if (items.indexOf(at) < 0) { if (items[0]) { items[0].focus(); } return; }
    if (at.type === 'range' && dx) { stepRange(at, dx); return; }
    var a = at.getBoundingClientRect(), ax = a.left + a.width / 2, ay = a.top + a.height / 2, best = null, bestCost = 1e9;
    items.forEach(function (el) {
      if (el === at) { return; }
      var b = el.getBoundingClientRect(), bx = b.left + b.width / 2, by = b.top + b.height / 2;
      var main = (bx - ax) * dx + (by - ay) * dy;
      if (main <= 4) { return; }
      var side = Math.abs((bx - ax) * dy) + Math.abs((by - ay) * dx);
      var cost = main + side * 2.5;
      if (cost < bestCost) { bestCost = cost; best = el; }
    });
    if (best) { best.focus(); audio.tone(620, 0.03, 'triangle', 0.04); }
  }
  function stepRange(el, dir) {
    el.value = clamp(+el.value + dir * 5, 0, 100);
    el.dispatchEvent(new Event('input'));
    audio.tone(500 + +el.value * 4, 0.05, 'triangle', 0.05);
  }

  /* ---------- upgrades ---------- */
  /* What stays with you from one run to the next, said in one line. */
  function legacyLine(save) {
    var medals = game.medalCount(), trait = game.inherited(), parts = ['Medallas ' + medals + ' de ' + D.STAGES.length * D.MEDALS.cuts.length + ' (+' + Math.round(medals * D.MEDALS.perMedal * 100) + ' % de ATP)'];
    if (save.won) { parts.push('Genes +' + Math.round(save.won * D.LITTER.genes * 100) + ' % de ATP'); }
    if (trait.name) { parts.push(game.voice(trait.name) + ': ' + trait.desc); }
    return parts.join(' · ');
  }
  function drawShop() {
    var save = game.save(), html = '', keep = document.activeElement ? document.activeElement.getAttribute('data-id') : null;
    D.UPGRADES.forEach(function (u) {
      if (save.seen < u.seen) { return; }
      var lv = game.level(u.id), done = lv >= u.max, price = game.cost(u), can = !done && save.atp >= price;
      var bar = '<i style="width:' + (lv / u.max * 100) + '%"></i>';
      html += '<button type="button" class="card nav' + (can ? ' ready' : '') + '" data-id="' + u.id + '" aria-disabled="' + (can ? 'false' : 'true') + '">' +
        '<b>' + u.name + '</b><em>' + lv + '/' + u.max + '</em><span>' + u.desc + '</span>' +
        '<strong>' + (done ? 'Al máximo' : game.fmt(price) + ' ATP') + '</strong><u>' + bar + '</u></button>';
    });
    $('cards').innerHTML = html;
    $('bank').textContent = game.fmt(save.atp);
    $('shopRank').textContent = 'Puesto ' + game.fmtInt(game.rank());
    $('shopNote').textContent = (game.progress() * 18).toLocaleString('es-ES', { maximumFractionDigits: 1 }) + ' cm de 18. La carrera te espera.';
    $('shopLine').textContent = legacyLine(save);
    $('trophyTitle').textContent = 'Logros: ' + game.fmtInt(game.unlocked());
    var box = $('trophies');
    box.textContent = '';
    Object.keys(D.MARKS).forEach(function (k) {
      var need = game.target(k), tier = save.marks[k] || 0, card = document.createElement('div');
      card.className = 'trophy';
      card.innerHTML = '<b></b><span></span><em></em><u><i></i></u>';
      card.children[0].textContent = game.markTitle(k, tier);
      card.children[1].textContent = game.markText(k, need);
      card.children[2].textContent = (tier ? 'Nivel ' + tier + ' · ' : '') + game.fmtInt(save[k]) + ' / ' + game.fmtInt(need);
      card.querySelector('i').style.width = clamp(save[k] / need * 100, 0, 100) + '%';
      box.appendChild(card);
    });
    if (keep) {
      var again = $('cards').querySelector('[data-id="' + keep + '"]');
      if (again) { again.focus({ preventScroll: true }); }
    }
  }
  $('cards').addEventListener('click', function (e) {
    var card = e.target.closest('.card');
    if (!card) { return; }
    audio.unlock();
    var id = card.getAttribute('data-id');
    if (game.buy(id)) {
      drawShop();
      var again = $('cards').querySelector('[data-id="' + id + '"]');
      if (again) { again.classList.add('bought'); again.focus(); }
      $('spitBtn').hidden = game.level('escupir') < 1;
    }
  });

  /* ---------- settings ---------- */
  var QUALITY = { alta: 'Alta', media: 'Media', baja: 'Baja' };
  function drawSettings() {
    $('volMaster').value = settings.master * 100;
    $('volSfx').value = settings.sfx * 100;
    $('volAmb').value = settings.ambience * 100;
    $('optShake').textContent = 'Temblor de pantalla: ' + (settings.shake ? 'sí' : 'no');
    $('optInvert').textContent = 'Invertir eje vertical: ' + (settings.invert ? 'sí' : 'no');
    $('optQuality').textContent = 'Calidad gráfica: ' + QUALITY[settings.quality];
  }
  function bindVolume(id, key, audioKey) {
    $(id).addEventListener('input', function () {
      settings[key] = $(id).value / 100;
      audio.setVolume(audioKey, settings[key]);
      persistSettings();
    });
  }
  bindVolume('volMaster', 'master', 'master');
  bindVolume('volSfx', 'sfx', 'sfx');
  bindVolume('volAmb', 'ambience', 'ambience');
  function toggle(key) { settings[key] = !settings[key]; persistSettings(); drawSettings(); audio.ui(); }
  $('optShake').addEventListener('click', function () { toggle('shake'); });
  $('optInvert').addEventListener('click', function () { toggle('invert'); });
  $('optQuality').addEventListener('click', function () {
    settings.quality = { alta: 'media', media: 'baja', baja: 'alta' }[settings.quality];
    gfx.setQuality(settings.quality);
    persistSettings(); drawSettings(); audio.ui();
  });

  /* ---------- controls diagrams, drawn as schematics ---------- */
  function keyCap(x, y, w, label, on) {
    return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="34" rx="5" class="' + (on ? 'key on' : 'key') + '"/>' +
      '<text x="' + (x + w / 2) + '" y="' + (y + 22) + '" class="cap' + (on ? ' on' : '') + '">' + label + '</text>';
  }
  function keyboardSvg() {
    var rows = [
      [['Esc', 42, 1], ['1', 34], ['2', 34], ['3', 34], ['4', 34], ['5', 34], ['6', 34], ['7', 34], ['8', 34], ['9', 34], ['0', 34]],
      [['Tab', 54, 1], ['Q', 34], ['W', 34, 1], ['E', 34, 1], ['R', 34], ['T', 34], ['Y', 34], ['U', 34], ['I', 34], ['O', 34], ['P', 34]],
      [['Bloq', 62], ['A', 34, 1], ['S', 34, 1], ['D', 34, 1], ['F', 34, 1], ['G', 34], ['H', 34], ['J', 34], ['K', 34], ['L', 34], ['Ñ', 34]],
      [['Mayús', 84, 1], ['Z', 34], ['X', 34], ['C', 34], ['V', 34], ['B', 34], ['N', 34], ['M', 34]],
      [['Ctrl', 54], ['Alt', 44], ['Espacio', 190, 1], ['Alt', 44], ['Ctrl', 54]]
    ];
    var out = '';
    rows.forEach(function (row, r) {
      var x = 10, y = 10 + r * 40;
      row.forEach(function (k) { out += keyCap(x, y, k[1], k[0], k[2]); x += k[1] + 6; });
    });
    out += keyCap(452, 170, 34, '←', 1) + keyCap(492, 170, 34, '↓', 1) + keyCap(532, 170, 34, '→', 1) + keyCap(492, 130, 34, '↑', 1);
    out += '<rect x="520" y="24" width="48" height="76" rx="23" class="key"/><path d="M544 24v30M520 54h48" class="line"/><rect x="520" y="26" width="24" height="28" class="mousebtn"/>';
    return '<svg viewBox="0 0 590 216" role="img" aria-label="Esquema de teclado y ratón con las teclas del juego resaltadas">' + out + '</svg>';
  }
  function controllerSvg() {
    var body = 'M196 96C158 96 128 108 112 142C84 200 52 300 64 350C72 384 112 392 140 366C168 338 196 304 230 292L410 292C444 304 472 338 500 366C528 392 568 384 576 350C588 300 556 200 528 142C512 108 482 96 444 96C418 90 392 100 372 106L268 106C248 100 222 90 196 96Z';
    function label(x1, y1, x2, y2, text, side) {
      return '<path d="M' + x1 + ' ' + y1 + 'L' + x2 + ' ' + y2 + '" class="lead"/><text x="' + (x2 + (side < 0 ? -6 : 6)) + '" y="' + (y2 + 5) + '" text-anchor="' + (side < 0 ? 'end' : 'start') + '" class="tag">' + text + '</text>';
    }
    return '<svg viewBox="-130 0 960 410" role="img" aria-label="Esquema de mando con los botones del juego señalados">' +
      '<rect x="150" y="62" width="104" height="26" rx="12" class="pad"/><rect x="386" y="62" width="104" height="26" rx="12" class="pad"/>' +
      '<rect x="160" y="44" width="72" height="24" rx="11" class="pad"/><rect x="408" y="44" width="72" height="24" rx="11" class="pad"/>' +
      '<path d="' + body + '" class="shell"/>' +
      '<circle cx="196" cy="168" r="33" class="well"/><circle cx="196" cy="168" r="21" class="stick"/>' +
      '<circle cx="388" cy="236" r="30" class="well"/><circle cx="388" cy="236" r="19" class="stick off"/>' +
      '<path d="M242 208h24v22h22v24h-22v22h-24v-22h-22v-24h22z" class="dpad"/>' +
      '<rect x="288" y="156" width="20" height="14" rx="6" class="mini off"/><rect x="334" y="156" width="20" height="14" rx="6" class="mini"/>' +
      '<circle cx="320" cy="128" r="15" class="mini off"/>' +
      '<circle cx="450" cy="134" r="15" fill="#d9b320"/><text x="450" y="139" class="face">Y</text>' +
      '<circle cx="482" cy="164" r="15" fill="#c9423a"/><text x="482" y="169" class="face">B</text>' +
      '<circle cx="450" cy="194" r="15" fill="#3f9d4c"/><text x="450" y="199" class="face">A</text>' +
      '<circle cx="418" cy="164" r="15" fill="#3a6fc9"/><text x="418" y="169" class="face">X</text>' +
      label(160, 74, 60, 40, 'LB: mejoras', -1) +
      label(196, 168, 40, 150, 'Stick: nadar', -1) +
      label(242, 242, 60, 262, 'Cruceta: menús', -1) +
      label(444, 56, 560, 26, 'RT: esprintar', 1) +
      label(490, 74, 600, 74, 'RB: lefazo', 1) +
      label(434, 164, 620, 130, 'X: lefazo', 1) +
      label(497, 164, 620, 176, 'B: volver', 1) +
      label(465, 194, 620, 222, 'A: esprintar / aceptar', 1) +
      label(344, 170, 620, 288, 'Menú: pausa', 1) +
      '</svg>';
  }
  $('keyboardMap').innerHTML = keyboardSvg();
  $('padMap').innerHTML = controllerSvg();

  /* ---------- HUD ---------- */
  ui.call = function (text) {
    var el = $('call');
    el.textContent = text;
    el.classList.remove('on');
    void el.offsetWidth;
    el.classList.add('on');
    callTime = 5;
  };
  /* The class says it is on screen, so the timer stays right under reduced motion, where no animation ever ends. */
  function replay(el, seconds) {
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
    clearTimeout(el.showTimer);
    el.showTimer = setTimeout(function () { el.classList.remove('show'); readZones(); }, seconds * 1000);
    readZones();
  }
  ui.banner = function (title, sub) {
    var el = $('banner');
    el.textContent = game.voice(title);
    var small = document.createElement('small');
    small.textContent = game.voice(sub);
    el.appendChild(small);
    replay(el, HUD.bannerTime);
  };
  function medalText(m) {
    var share = Math.floor(m.share * 100) + ' % del azúcar';
    if (!m.got) { return 'Sin medalla · ' + share; }
    return 'Medalla de ' + D.MEDALS.names[m.got - 1] + ' · ' + share + (m.pay ? ' · +' + game.fmt(m.pay) + ' ATP' : '');
  }
  ui.stageCard = function (index, opts) {
    var st = D.STAGES[index], lead = opts && opts.checkpoint ? 'Checkpoint · ' : opts && opts.retry ? 'De vuelta · ' : '';
    $('stageNum').textContent = lead + 'Tramo ' + (index + 1) + ' de ' + D.STAGES.length;
    $('stageName').textContent = st.name;
    $('stageLine').textContent = '«' + st.line + '»';
    $('stageMedal').hidden = !(opts && opts.medal);
    if (opts && opts.medal) { $('stageMedal').textContent = medalText(opts.medal); }
    $('zone').textContent = st.name;
    $('banner').classList.remove('show');
    replay($('stageCard'), HUD.cardTime);
  };

  /* ---------- text over the world ---------- */
  var HUD_ZONES = '.score > div, .tools, #pip, #minimap, .bars, #toasts, #guardBar, #banner.show, #stageCard.show, #sprintTouch, #spitTouch';
  var safe = { l: 0, t: 0, r: 0, b: 0 }, zones = [], zoneCount = 0, zoneTime = 0;
  var anchor = { x: 0, y: 0 }, heroAt = { x: 0, y: 0 }, heroZone = { l: 0, t: 0, r: 0, b: 0 };

  /* Layout reads are not free: zones are read twice a second and when something changes, never per frame. */
  function readZones() {
    var found = document.querySelectorAll(HUD_ZONES), pad = HUD.zonePad;
    safe.l = safe.t = HUD.margin;
    safe.r = window.innerWidth - HUD.margin;
    safe.b = window.innerHeight - HUD.margin;
    zoneCount = 0;
    for (var i = 0; i < found.length; i++) {
      var rect = found[i].getBoundingClientRect();
      if (!rect.width || !rect.height) { continue; }
      var z = zones[zoneCount] || (zones[zoneCount] = { l: 0, t: 0, r: 0, b: 0 });
      z.l = rect.left - pad; z.t = rect.top - pad; z.r = rect.right + pad; z.b = rect.bottom + pad;
      zoneCount += 1;
    }
  }
  function overlaps(z, x, y, w, h) { return x < z.r && x + w > z.l && y < z.b && y + h > z.t; }
  /* a and b are single zones; more is a list of things that each carry a zone. */
  function isFree(x, y, w, h, a, b, more) {
    var i;
    for (i = 0; i < zoneCount; i++) {
      if (overlaps(zones[i], x, y, w, h)) { return false; }
    }
    for (i = 0; more && i < more.length; i++) {
      if (overlaps(more[i].zone, x, y, w, h)) { return false; }
    }
    return !(a && overlaps(a, x, y, w, h)) && !(b && overlaps(b, x, y, w, h));
  }
  var edgeX = [], edgeY = [];
  function addEdges(z, count, w, h) {
    edgeX[count] = z.l - w; edgeX[count + 1] = z.r;
    edgeY[count] = z.t - h; edgeY[count + 1] = z.b;
    return count + 2;
  }
  /* Keeps a box on screen and off the scoreboard; a, b and more are extra things to avoid.
     Pushing one zone at a time can bounce between two of them for ever, so it looks at every spot flush with an edge and takes the nearest free one. */
  function pushOut(box, a, b, more) {
    var w = box.w, h = box.h, x0 = clamp(box.x, safe.l, safe.r - w), y0 = clamp(box.y, safe.t, safe.b - h), n;
    box.x = x0; box.y = y0;
    if (isFree(x0, y0, w, h, a, b, more)) { return; }
    var count = 1, best = 1e12;
    edgeX[0] = x0; edgeY[0] = y0;
    for (n = 0; n < zoneCount; n++) { count = addEdges(zones[n], count, w, h); }
    for (n = 0; more && n < more.length; n++) { count = addEdges(more[n].zone, count, w, h); }
    if (a) { count = addEdges(a, count, w, h); }
    if (b) { count = addEdges(b, count, w, h); }
    for (var i = 0; i < count; i++) {
      var x = edgeX[i];
      if (x < safe.l || x + w > safe.r) { continue; }
      for (var j = 0; j < count; j++) {
        var y = edgeY[j], d = (x - x0) * (x - x0) + (y - y0) * (y - y0);
        if (d < best && y >= safe.t && y + h <= safe.b && isFree(x, y, w, h, a, b, more)) {
          best = d; box.x = x; box.y = y;
        }
      }
    }
  }

  /* ---------- pops ---------- */
  var pops = [], popLane = 0, runningSum = null, popBox = { x: 0, y: 0, w: 0, h: 0 };
  /* Reduced motion switches the animation off, and a pop that stays put takes up no climb. */
  var popClimb = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : POP.rise;
  function dropPop(p) {
    p.el.remove();
    if (runningSum === p) { runningSum = null; }
  }
  /* Bubbles last longer, so a pop steps round them. Unplaced ones have no spot yet: they will step round the pop instead. */
  var bubblesUp = [];
  function placedBubbles() {
    bubblesUp.length = 0;
    bubbles.forEach(function (s) { if (s.owner && s.placed) { bubblesUp.push(s); } });
    return bubblesUp;
  }
  /* Every pop climbs at the same steady pace, so two that start apart stay apart: where the other one is right now is all that matters. */
  function popsClash(p, o, x, y) {
    var top = o.y - popClimb * Math.min((performance.now() - o.born) / 1000 / POP.life, 1);
    return o !== p && x < o.x + o.w && x + p.w > o.x && y < top + o.h && y + p.h > top;
  }
  function clearOfPops(p, x, y) {
    return !pops.some(function (o) { return popsClash(p, o, x, y); });
  }
  /* A full screen: the news wins and whatever is in its way goes early. */
  function evictPops(p, x, y) {
    for (var i = pops.length - 1; i >= 0; i--) {
      if (popsClash(p, pops[i], x, y)) { dropPop(pops[i]); pops.splice(i, 1); }
    }
  }
  /* The box is the pop's whole climb, with room for the swell it starts on. It walks a grid out from its lane and takes the nearest free spot; with none left it makes one. */
  function seatPop(p, at) {
    var box = popBox, speech = placedBubbles(), z = p.zone, best = 1e12;
    var roomX = p.el.offsetWidth * POP.swell + POP.gap, roomY = p.el.offsetHeight * POP.swell + POP.gap;
    p.w = box.w = p.el.offsetWidth + 2 * roomX;
    p.h = p.el.offsetHeight + 2 * roomY;
    box.h = p.h + popClimb;
    var x0 = clamp(at.x - p.w / 2, safe.l, safe.r - box.w), y0 = clamp(at.y - popClimb - p.lane * POP.lane, safe.t, safe.b - box.h), rows = Math.ceil(window.innerHeight / POP.lane);
    box.x = x0; box.y = y0;
    z.l = z.t = z.r = z.b = -1;
    for (var row = -rows; row <= rows; row++) {
      var y = y0 + row * POP.lane;
      if (y < safe.t || y + box.h > safe.b) { continue; }
      for (var col = -POP.columns; col <= POP.columns; col++) {
        var x = clamp(x0 + col * p.w, safe.l, safe.r - box.w), d = (x - x0) * (x - x0) + (y - y0) * (y - y0);
        if (d < best && isFree(x, y, box.w, box.h, null, null, speech) && clearOfPops(p, x, y + popClimb)) {
          best = d; box.x = x; box.y = y;
        }
      }
    }
    if (best === 1e12) { evictPops(p, box.x, box.y + popClimb); }
    p.x = box.x;
    p.y = box.y + popClimb;
    z.l = box.x; z.t = box.y; z.r = box.x + box.w; z.b = box.y + box.h;
    p.el.style.left = (p.x + p.w / 2) + 'px';
    p.el.style.top = (p.y + roomY) + 'px';
  }
  function addPop(at, text, color, size, lane) {
    if (pops.length >= POP.max) { dropPop(pops.shift()); }
    var el = document.createElement('div'), p = { el: el, born: performance.now(), lane: lane, sum: 0, open: 0, x: 0, y: 0, w: 0, h: 0, zone: { l: -1, t: -1, r: -1, b: -1 } };
    el.className = 'pop';
    el.textContent = text;
    el.style.color = color;
    el.style.fontSize = size + 'px';
    document.body.appendChild(el);
    seatPop(p, at);
    pops.push(p);
    return p;
  }
  ui.pop = function (at, text, color, size) {
    popLane = popLane % (POP.lanes - 1) + 1;
    addPop(at, text, color, size, popLane);
  };
  /* Sugar comes in bursts: eaten close together it adds up in one number instead of a pile of them. Lane 0 is kept for it. */
  ui.popSum = function (at, value, color, size) {
    var p = runningSum && runningSum.open > 0 ? runningSum : null;
    if (p) {
      p.sum += value;
      p.born = performance.now();
      p.el.textContent = '+' + game.fmt(p.sum);
      p.el.style.fontSize = size + 'px';
      seatPop(p, at);
      p.el.getAnimations().forEach(function (a) { a.currentTime = 0; });
    } else {
      p = runningSum = addPop(at, '+' + game.fmt(value), color, size, 0);
      p.sum = value;
    }
    p.open = POP.merge;
  };
  function updatePops(dt) {
    var now = performance.now();
    for (var i = pops.length - 1; i >= 0; i--) {
      pops[i].open -= dt;
      if ((now - pops[i].born) / 1000 >= POP.life) { dropPop(pops[i]); pops.splice(i, 1); }
    }
  }

  /* ---------- toasts ---------- */
  var toasts = [];
  ui.toast = function (title, sub) {
    var el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = '<b></b><span></span>';
    el.children[0].textContent = game.voice(title);
    el.children[1].textContent = game.voice(sub);
    $('toasts').appendChild(el);
    toasts.push({ el: el, t: TOAST.life });
    var limit = window.innerWidth <= TOAST.phone ? TOAST.phoneMax : TOAST.max;
    while (toasts.length > limit) { toasts.shift().el.remove(); }
    readZones();
  };
  function updateToasts(dt) {
    for (var i = toasts.length - 1; i >= 0; i--) {
      toasts[i].t -= dt;
      if (toasts[i].t <= TOAST.fade) { toasts[i].el.classList.add('out'); }
      if (toasts[i].t <= 0) { toasts[i].el.remove(); toasts.splice(i, 1); }
    }
  }
  function clearToasts() {
    toasts.forEach(function (it) { it.el.remove(); });
    toasts.length = 0;
  }

  /* ---------- speech bubbles ---------- */
  var bubbles = Array.prototype.map.call(document.querySelectorAll('.bubble'), function (el) {
    return { el: el, name: el.children[0], text: el.children[1], tail: el.children[2], owner: null, prio: 0, t: 0, age: 0, w: 0, h: 0, x: 0, y: 0, shownX: 0, shownY: 0, lost: false, off: false, placed: false, box: { x: 0, y: 0, w: 0, h: 0 }, zone: { l: 0, t: 0, r: 0, b: 0 } };
  });
  function closeBubble(s) {
    s.owner = null;
    s.t = 0;
    s.el.hidden = true;
  }
  function slotFor(owner, prio) {
    var i, spare = null, room = window.innerWidth <= TOAST.phone ? BUBBLE.phoneMax : bubbles.length;
    for (i = 0; i < room; i++) {
      if (bubbles[i].owner === owner) { return bubbles[i]; }
      if (!bubbles[i].owner && !spare) { spare = bubbles[i]; }
    }
    if (spare) { return spare; }
    for (i = 0; i < room; i++) {
      if (bubbles[i].prio < prio && (!spare || bubbles[i].t < spare.t)) { spare = bubbles[i]; }
    }
    return spare;
  }
  /* One bubble per speaker. With no room left the more urgent line takes over, and an equal or lesser one stays unsaid. */
  ui.bubble = function (text, owner, prio) {
    var level = prio || 1, s = slotFor(owner, level);
    if (!s) { return false; }
    s.owner = owner;
    s.prio = level;
    s.t = Math.max(BUBBLE.min, BUBBLE.base + text.length * BUBBLE.perChar);
    s.age = 0;
    s.lost = s.off = s.placed = false;
    s.name.textContent = owner.state.name || '';
    s.text.textContent = text;
    s.el.classList.remove('off');
    s.el.classList.toggle('hot', level > 1);
    s.el.hidden = false;
    s.w = s.el.offsetWidth;
    s.h = s.el.offsetHeight;
    return true;
  };
  /* A speaker put back on the map elsewhere is someone new: its line goes with it. */
  ui.hush = function (owner) {
    bubbles.forEach(function (s) { if (s.owner === owner) { closeBubble(s); } });
  };
  ui.clearBubbles = function () { bubbles.forEach(closeBubble); };

  /* One rule for the tail, on screen or pinned to the edge: from the rim, straight at the speaker. */
  function aimTail(s) {
    var cx = s.w / 2, cy = s.h / 2, dx = anchor.x - s.x - cx, dy = anchor.y - s.y - cy, corner = BUBBLE.corner;
    var onSide = Math.abs(dx) * cy > Math.abs(dy) * cx, reach = onSide ? cx / (Math.abs(dx) || 1) : cy / (Math.abs(dy) || 1);
    var tx = onSide ? (dx > 0 ? s.w - 2 : 2) : clamp(cx + dx * reach, corner, s.w - corner);
    var ty = onSide ? clamp(cy + dy * reach, corner, s.h - corner) : (dy > 0 ? s.h - 2 : 2);
    s.tail.style.transform = 'translate(' + Math.round(tx) + 'px,' + Math.round(ty) + 'px) rotate(' + Math.atan2(dy, dx).toFixed(2) + 'rad)';
  }
  function placeBubble(s, avoid, dt) {
    var q = s.owner.state, box = s.box;
    if (!q) { closeBubble(s); return; }
    s.age += dt;
    s.t -= dt;
    gfx.project(q.x, BUBBLE.head, q.z, anchor);
    var off = anchor.x < 0 || anchor.y < 0 || anchor.x > window.innerWidth || anchor.y > window.innerHeight, lost = off || !s.owner.body.visible;
    if (lost && !s.lost) { s.t = Math.min(s.t, Math.max(BUBBLE.lost, BUBBLE.read - s.age)); }
    s.lost = lost;
    if (s.t <= 0) { closeBubble(s); return; }
    if (off !== s.off) { s.off = off; s.el.classList.toggle('off', off); }
    box.w = s.w; box.h = s.h;
    box.x = anchor.x - s.w / 2;
    box.y = anchor.y - BUBBLE.gap - s.h;
    if (box.y < safe.t) { box.y = anchor.y + BUBBLE.gap; }
    pushOut(box, heroZone, null, avoid);
    s.zone.l = box.x; s.zone.t = box.y; s.zone.r = box.x + box.w; s.zone.b = box.y + box.h;
    var ease = s.placed ? 1 - Math.exp(-BUBBLE.follow * dt) : 1;
    s.placed = true;
    s.x = clamp(s.x + (box.x - s.x) * ease, safe.l, safe.r - s.w);
    s.y = clamp(s.y + (box.y - s.y) * ease, safe.t, safe.b - s.h);
    var px = Math.round(s.x), py = Math.round(s.y);
    if (px !== s.shownX || py !== s.shownY) {
      s.shownX = px; s.shownY = py;
      s.el.style.transform = 'translate(' + px + 'px,' + py + 'px)';
    }
    aimTail(s);
  }
  /* Each bubble steps round the pops and the bubbles already settled this frame. */
  var inTheWay = [];
  function updateBubbles(dt, r) {
    if (!bubbles.some(function (s) { return s.owner; })) { return; }
    gfx.project(r.x, BUBBLE.head, r.z, heroAt);
    heroZone.l = heroAt.x - BUBBLE.heroBox; heroZone.r = heroAt.x + BUBBLE.heroBox;
    heroZone.t = heroAt.y - BUBBLE.heroBox; heroZone.b = heroAt.y + BUBBLE.heroBox;
    inTheWay.length = 0;
    for (var i = 0; i < pops.length; i++) { inTheWay.push(pops[i]); }
    for (i = 0; i < bubbles.length; i++) {
      if (!bubbles[i].owner) { continue; }
      placeBubble(bubbles[i], inTheWay, dt);
      if (bubbles[i].owner) { inTheWay.push(bubbles[i]); }
    }
  }

  ui.obit = function () {
    $('obitText').textContent = game.voice(D.OBIT[Math.floor(Math.random() * D.OBIT.length)]);
    open('obit');
  };
  function retry() {
    stack = [];
    show(null);
    game.retry();
    stage.focus();
  }
  /* Pass nothing to take the bar away. */
  ui.guardBar = function (name, left) {
    var bar = $('guardBar');
    bar.hidden = name === undefined;
    if (!bar.hidden) {
      $('guardName').textContent = name;
      $('guardHp').style.transform = 'scaleX(' + clamp(left, 0, 1) + ')';
    }
    readZones();
  };
  /* The trip is over: three inherited traits to pick from, and no way out but through one of them. */
  ui.litter = function () {
    var box = $('litterPick'), pool = D.TRAITS.slice(), won = game.save().won;
    box.textContent = '';
    $('litterText').textContent = 'Llevas ' + won + (won === 1 ? ' llegada' : ' llegadas') + '. Tus genes dan +' + Math.round(won * D.LITTER.genes * 100) + ' % de ATP. Conservas mejoras, medallas y logros, y el cuerpo ya te conoce: avisa menos antes de pegar.';
    for (var n = 0; n < D.LITTER.choices; n++) {
      var trait = pool.splice(Math.floor(Math.random() * pool.length), 1)[0], b = document.createElement('button');
      b.type = 'button';
      b.className = 'chromo nav';
      b.setAttribute('data-id', trait.id);
      b.innerHTML = '<strong></strong><span></span>';
      b.children[0].textContent = game.voice(trait.name);
      b.children[1].textContent = trait.desc;
      box.appendChild(b);
    }
    stack = [];
    open('litter');
  };
  $('litterPick').addEventListener('click', function (e) {
    var card = e.target.closest('.chromo');
    if (!card) { return; }
    audio.unlock();
    game.prestige(card.getAttribute('data-id'));
    stack = ['title'];
    drawTitle();
    drawName();
    show('title');
    audio.ui();
  });
  ui.mash = function (on) { $('mash').hidden = !on; };
  ui.mashValue = function (v) { $('eggBar').style.transform = 'scaleX(' + v + ')'; };
  ui.ending = function () {
    $('hud').hidden = true;
    $('minimap').hidden = true;
    $('ending').hidden = false;
    audio.tone(261, 2.4, 'sine', 0.14); audio.tone(392, 2.4, 'sine', 0.1); audio.tone(523, 2.4, 'sine', 0.08);
    var n = 0, text = $('endText'), save = game.save();
    ui.clearBubbles();
    clearToasts();
    (function next() {
      text.textContent = game.voice(D.ENDING[n]);
      if (n === 2) { $('ending').classList.add('dim'); }
      n += 1;
      if (n < D.ENDING.length) { setTimeout(next, 2600); }
      else {
        $('endNote').textContent = 'Te has comido ' + game.fmtInt(save.sugar) + ' azúcares y dejado atrás a ' + game.fmtInt(save.passed) + ' cabrones. Nadie te eligió. Te lo curraste.';
        $('restart').hidden = false;
        $('restart').focus();
      }
    })();
  };
  /* ---------- side rooms ---------- */
  var simon = null;
  var ARROWS = [{ m: [0, -1], t: '↑' }, { m: [0, 1], t: '↓' }, { m: [-1, 0], t: '←' }, { m: [1, 0], t: '→' }];
  function finishPuzzle(won) {
    simon = null;
    stack.pop();
    show(top() || null);
    stage.focus();
    game.puzzleDone(won);
  }
  function drawSeq(lit) {
    var box = $('puzzleSeq');
    box.textContent = '';
    simon.seq.forEach(function (a, i) {
      var cell = document.createElement('span');
      cell.textContent = simon.showing && i !== lit ? '' : i < simon.at || simon.showing ? a.t : '';
      if (i === lit || (!simon.showing && i < simon.at)) { cell.className = 'on'; }
      box.appendChild(cell);
    });
  }
  function simonPress(move) {
    if (simon.showing || simon.at >= simon.seq.length) { return; }
    var want = simon.seq[simon.at];
    if (want.m[0] === move[0] && want.m[1] === move[1]) {
      simon.at += 1;
      audio.tone(520 + simon.at * 70, 0.1, 'triangle', 0.1);
      drawSeq(-1);
      if (simon.at >= simon.seq.length) { setTimeout(function () { finishPuzzle(true); }, 350); }
    } else {
      audio.nope();
      finishPuzzle(false);
    }
  }
  function puzzlePad(pressed) {
    if (!simon) { return; }
    [[12, ARROWS[0]], [13, ARROWS[1]], [14, ARROWS[2]], [15, ARROWS[3]]].forEach(function (pair) {
      var now = pressed(pair[0]), was = pad.held['p' + pair[0]];
      pad.held['p' + pair[0]] = now;
      if (now && !was) { simonPress(pair[1].m); }
    });
  }
  ui.puzzle = function (kind) {
    $('puzzleOptions').textContent = '';
    $('puzzleSeq').textContent = '';
    $('simonPad').hidden = true;
    if (kind === 'simon') {
      $('puzzleTitle').textContent = 'Control de esfínter';
      $('puzzleText').textContent = document.body.classList.contains('touch') ? 'Memoriza la secuencia y repítela con las flechas. Sin cagarla.' : 'Memoriza la secuencia y repítela con WASD, flechas o cruceta. Sin cagarla.';
      $('simonPad').hidden = false;
      var seq = [];
      for (var i = 0; i < 5; i++) { seq.push(ARROWS[Math.floor(Math.random() * 4)]); }
      simon = { seq: seq, at: 0, showing: true };
      open('puzzle');
      var step = 0;
      (function reveal() {
        if (!simon) { return; }
        if (step >= seq.length) { simon.showing = false; drawSeq(-1); return; }
        drawSeq(step);
        audio.tone(420 + step * 60, 0.14, 'triangle', 0.1);
        step += 1;
        setTimeout(reveal, 620);
      })();
      return;
    }
    var q = D.QUIZ[Math.floor(Math.random() * D.QUIZ.length)];
    $('puzzleTitle').textContent = 'Examen sorpresa';
    $('puzzleText').textContent = q.q;
    q.a.forEach(function (text, index) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'nav item';
      b.textContent = text;
      b.addEventListener('click', function () { finishPuzzle(index === q.ok); });
      $('puzzleOptions').appendChild(b);
    });
    open('puzzle');
  };

  /* ---------- map ---------- */
  var mapTimer = 0, mapCtx = $('minimap').getContext('2d');
  function drawMap() {
    var r = game.run(), c = $('minimap');
    if (!r || c.hidden) { return; }
    var m = r.maze, size = Math.min(c.width / m.cols, c.height / m.rows), ox = (c.width - m.cols * size) / 2, oy = (c.height - m.rows * size) / 2;
    mapCtx.clearRect(0, 0, c.width, c.height);
    for (var y = 0; y < m.rows; y++) {
      for (var x = 0; x < m.cols; x++) {
        if (!r.explored[m.at(x, y)]) { continue; }
        mapCtx.fillStyle = m.wall[m.at(x, y)] ? 'rgba(251,241,227,.16)' : 'rgba(251,241,227,.58)';
        mapCtx.fillRect(ox + x * size, oy + y * size, size + 0.5, size + 0.5);
      }
    }
    function dot(tx, ty, colour, radius) {
      mapCtx.fillStyle = colour;
      mapCtx.beginPath();
      mapCtx.arc(ox + (tx + 0.5) * size, oy + (ty + 0.5) * size, radius, 0, 6.3);
      mapCtx.fill();
    }
    [m.exit, m.exit2].forEach(function (t) { if (t && r.explored[m.at(t[0], t[1])]) { dot(t[0], t[1], '#ff5f7f', 4); } });
    r.chests.forEach(function (it) {
      if (it.alive && r.explored[m.at(Math.floor(it.x / D.TILE), Math.floor(it.z / D.TILE))]) { dot(it.x / D.TILE - 0.5, it.z / D.TILE - 0.5, '#ffc94d', 3); }
    });
    r.puzzles.forEach(function (it) {
      if (it.alive && r.explored[m.at(Math.floor(it.x / D.TILE), Math.floor(it.z / D.TILE))]) { dot(it.x / D.TILE - 0.5, it.z / D.TILE - 0.5, '#35d0ff', 3); }
    });
    if (r.crown && r.crown.alive && r.explored[m.at(Math.floor(r.crown.x / D.TILE), Math.floor(r.crown.z / D.TILE))]) { dot(r.crown.x / D.TILE - 0.5, r.crown.z / D.TILE - 0.5, '#ff4a3a', 3.5); }
    dot(r.x / D.TILE - 0.5, r.z / D.TILE - 0.5, '#ffffff', 3.5);
  }

  ui.pipBox = function () {
    if (stack.length || !onAir()) { return null; }
    return $('pipView').getBoundingClientRect();
  };
  function drawVitals(r, save) {
    if (r.hearts === shownHearts && r.maxHearts === shownMax && save.lives === shownLives) { return; }
    shownHearts = r.hearts; shownMax = r.maxHearts; shownLives = save.lives;
    var html = '';
    for (var n = 0; n < r.maxHearts; n++) { html += '<i' + (n < r.hearts ? '' : ' class="off"') + '>♥&#xFE0E;</i>'; }
    $('hearts').innerHTML = html;
    $('lives').textContent = '×' + Math.max(save.lives, 0);
    $('vitals').setAttribute('aria-label', r.hearts + ' de ' + r.maxHearts + ' corazones, ' + Math.max(save.lives, 0) + ' vidas');
  }
  /* How much of this stage's sugar you have eaten and how far the next medal is. */
  function drawMedalTrack(r) {
    var share = r.sugarTotal ? r.eaten / r.sugarTotal : 0, pct = Math.floor(share * 100), M = D.MEDALS;
    if (pct === shownShare) { return; }
    shownShare = pct;
    var next = 0;
    while (next < M.cuts.length && share >= M.cuts[next]) { next += 1; }
    $('medal').textContent = 'Azúcar ' + pct + ' %' + (next < M.cuts.length ? ' · ' + M.names[next] + ' al ' + Math.round(M.cuts[next] * 100) + ' %' : ' · ¡oro!');
  }
  function drawBoon(r) {
    var label = r.boon ? r.boon.spec.name + ' ' + Math.ceil(r.boon.t) : '';
    if (label === shownBoon) { return; }
    shownBoon = label;
    $('boon').hidden = !label;
    $('boon').textContent = label;
  }
  ui.hud = function (dt) {
    var r = game.run(), save = game.save();
    $('runAtp').textContent = game.fmt(save.atp);
    if (!r) { return; }
    drawVitals(r, save);
    $('rank').textContent = game.fmtInt(game.rank());
    $('combo').textContent = r.king > 0 ? 'REY ×' + D.KING.mult + (r.mult > 1 ? ' · x' + r.mult : '') : r.mult > 1 ? 'x' + r.mult + ' · ' + r.combo + ' seguidos' : '';
    $('combo').classList.toggle('king', r.king > 0);
    drawMedalTrack(r);
    drawBoon(r);
    $('marks').textContent = 'Logros: ' + game.fmtInt(game.unlocked());
    $('energy').style.transform = 'scaleX(' + clamp(r.energy / r.st.energy, 0, 1) + ')';
    $('energyBar').classList.toggle('low', r.energy < r.st.energy * 0.22);
    $('cm').textContent = (game.progress() * 18).toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' / 18 cm';
    $('moodLabel').textContent = game.voice(D.MOODS[gfx.hero.mood()] || '');
    $('spitBtn').hidden = game.level('escupir') < 1;
    $('spitTouch').hidden = $('spitBtn').hidden;
    if (stack[stack.length - 1] === 'shop') { $('bank').textContent = game.fmt(save.atp); }
    updateBubbles(dt, r);
    updateToasts(dt);
  };

  /* ---------- input ---------- */
  /* The whole screen is the stick: it appears under the thumb and follows it. A quick tap walks to that spot instead. */
  function useTouch() {
    if (document.body.classList.contains('touch')) { return; }
    document.body.classList.add('touch');
    $('menuBtn').textContent = 'Mejoras';
    $('pauseBtn').textContent = 'Pausa';
    readZones();
  }
  function placeStick(px, py) {
    stick.style.transform = 'translate(' + px + 'px,' + py + 'px)';
  }
  function fingerDown(e) {
    finger.id = e.pointerId;
    finger.ox = e.clientX; finger.oy = e.clientY;
    finger.born = performance.now();
    finger.slid = false;
    stage.setPointerCapture(e.pointerId);
  }
  function fingerMove(e) {
    if (e.pointerId !== finger.id) { return; }
    var R = D.TOUCH.stick, dx = e.clientX - finger.ox, dy = e.clientY - finger.oy, len = Math.hypot(dx, dy);
    if (!finger.slid) {
      if (len < D.TOUCH.slip) { return; }
      finger.slid = true;
      stick.hidden = false;
      placeStick(finger.ox, finger.oy);
    }
    if (len > R) {
      finger.ox += dx / len * (len - R); finger.oy += dy / len * (len - R);
      dx = e.clientX - finger.ox; dy = e.clientY - finger.oy; len = R;
      placeStick(finger.ox, finger.oy);
    }
    finger.x = dx / R; finger.y = -dy / R;
    stick.firstElementChild.style.transform = 'translate(' + dx.toFixed(0) + 'px,' + dy.toFixed(0) + 'px)';
  }
  function fingerUp(e) {
    if (e.pointerId !== finger.id) { return; }
    if (e.type === 'pointerup' && !finger.slid && (performance.now() - finger.born) / 1000 < D.TOUCH.tap) { game.clickTo(e.clientX, e.clientY); }
    finger.id = null;
    finger.x = finger.y = 0;
    stick.hidden = true;
    stick.firstElementChild.style.transform = '';
  }
  stage.addEventListener('pointermove', fingerMove);
  stage.addEventListener('pointerup', fingerUp);
  stage.addEventListener('pointercancel', fingerUp);
  function holdSprint(on, e) {
    if (e.cancelable) { e.preventDefault(); }
    finger.sprint = on;
    $('sprintTouch').classList.toggle('held', on);
    if (on) { audio.unlock(); game.hitEgg(); }
  }
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (type) {
    $('sprintTouch').addEventListener(type, function (e) { holdSprint(false, e); });
  });
  $('sprintTouch').addEventListener('pointerdown', function (e) { holdSprint(true, e); });
  $('spitTouch').addEventListener('pointerdown', function (e) {
    e.preventDefault();
    audio.unlock();
    game.spit(true);
    $('spitTouch').classList.add('held');
    setTimeout(function () { $('spitTouch').classList.remove('held'); }, 120);
  });
  Array.prototype.forEach.call(document.querySelectorAll('#simonPad button'), function (b, i) {
    b.addEventListener('click', function () { if (simon) { simonPress(ARROWS[i].m); } });
  });
  window.addEventListener('pointerdown', function (e) { if (e.pointerType === 'touch') { useTouch(); } }, true);
  if (touchFirst) { useTouch(); }

  ui.input = function () {
    var x = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + pad.x + finger.x;
    var y = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) + pad.y + finger.y;
    if (settings.invert) { y = -y; }
    var len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    return { x: x, y: y, sprint: keys.Space || keys.ShiftLeft || keys.ShiftRight || pad.sprint || finger.sprint };
  };

  function pollPad(dt) {
    var list = [];
    try { list = navigator.getGamepads ? navigator.getGamepads() : []; } catch (e) { list = []; }
    var gp = null;
    for (var n = 0; n < list.length; n++) { if (list[n] && list[n].connected) { gp = list[n]; break; } }
    pad.x = 0; pad.y = 0; pad.sprint = false;
    if (!gp) { return; }
    var dead = function (v) { return Math.abs(v) < 0.16 ? 0 : (v - Math.sign(v) * 0.16) / 0.84; };
    var pressed = function (i) { return !!(gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.4)); };
    var edge = function (i) {
      var now = pressed(i), was = pad.held[i];
      pad.held[i] = now;
      return now && !was;
    };
    var a = edge(0), b = edge(1), x = edge(2), lb = edge(4), rb = edge(5), start = edge(9);
    if (EG.intro.playing()) { if (a || start) { EG.intro.skip(); } return; }
    if (stack.length) {
      var mx = dead(gp.axes[0] || 0) + (pressed(15) ? 1 : 0) - (pressed(14) ? 1 : 0);
      var my = dead(gp.axes[1] || 0) + (pressed(13) ? 1 : 0) - (pressed(12) ? 1 : 0);
      pad.repeat -= dt;
      if ((Math.abs(mx) > 0.4 || Math.abs(my) > 0.4) && pad.repeat <= 0) {
        pad.repeat = 0.19;
        if (Math.abs(mx) > Math.abs(my)) { moveFocus(mx > 0 ? 1 : -1, 0); } else { moveFocus(0, my > 0 ? 1 : -1); }
      }
      if (Math.abs(mx) <= 0.4 && Math.abs(my) <= 0.4) { pad.repeat = 0; }
      if (a && document.activeElement && document.activeElement.click) { audio.unlock(); document.activeElement.click(); }
      if (b && !locked()) { back(); }
      if (start && top() === 'pause') { back(); }
      if (lb && top() === 'shop') { back(); } else if (lb && top() === 'obit') { open('shop'); }
      if (top() === 'puzzle') { puzzlePad(pressed); }
      return;
    }
    if (!$('ending').hidden) {
      if (a && !$('restart').hidden) { $('restart').click(); }
      return;
    }
    pad.x = dead(gp.axes[0] || 0);
    pad.y = -dead(gp.axes[1] || 0);
    pad.sprint = pressed(7) || pressed(0);
    if (a) { game.hitEgg(); }
    if (rb || x) { game.spit(); }
    if (start) { open('pause'); }
    if (lb) { open('shop'); }
  }

  ui.tick = function (dt) {
    pollPad(dt);
    mapTimer += dt;
    if (mapTimer > 0.2) { mapTimer = 0; drawMap(); }
    if (callTime > 0) { callTime -= dt; if (callTime <= 0) { $('call').classList.remove('on'); } }
    updatePops(dt);
    zoneTime -= dt;
    if (zoneTime <= 0) { zoneTime = HUD.zoneEvery; readZones(); }
  };

  $('intro').addEventListener('pointerdown', function () { EG.intro.skip(); });
  stage.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  stage.addEventListener('pointerdown', function (e) {
    audio.unlock();
    if (e.button === 2) { game.spit(); return; }
    game.hitEgg();
    if (e.pointerType === 'touch') {
      if (finger.id === null) { fingerDown(e); }
      return;
    }
    game.clickTo(e.clientX, e.clientY);
  });

  var GAME_KEYS = ['Space', 'ShiftLeft', 'ShiftRight', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'];
  var MOVES = { ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0], ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1] };
  window.addEventListener('keydown', function (e) {
    audio.unlock();
    if (EG.intro.playing()) { e.preventDefault(); EG.intro.skip(); return; }
    if (e.code === 'Tab') {
      e.preventDefault();
      if (e.repeat) { return; }
      if (top() === 'shop') { back(); } else if (top() === 'obit' || (!stack.length && inGame())) { open('shop'); }
      return;
    }
    if (e.code === 'Escape') {
      e.preventDefault();
      if (e.repeat) { return; }
      if (locked()) { return; }
      if (stack.length) { back(); } else if (inGame()) { open('pause'); }
      return;
    }
    if (top() === 'puzzle' && MOVES[e.code] && simon) {
      e.preventDefault();
      if (!e.repeat) { simonPress(MOVES[e.code]); }
      return;
    }
    if (stack.length) {
      if (MOVES[e.code]) { e.preventDefault(); moveFocus(MOVES[e.code][0], MOVES[e.code][1]); }
      /* A key still held from the swim must not reach the button a menu just focused: only a new press counts. */
      if (e.repeat && (e.code === 'Space' || e.key === 'Enter')) { e.preventDefault(); }
      return;
    }
    if (e.code === 'KeyF' || e.code === 'KeyE') { if (!e.repeat) { game.spit(); } return; }
    if (GAME_KEYS.indexOf(e.code) >= 0) {
      if (inGame()) { e.preventDefault(); }
      if (!keys[e.code] && e.code === 'Space') { game.hitEgg(); }
      keys[e.code] = true;
    }
  });
  window.addEventListener('keyup', function (e) { keys[e.code] = false; });
  window.addEventListener('pagehide', function () { game.persist(); });
  window.addEventListener('resize', function () { gfx.resize(); readZones(); });

  function click(id, fn) { $(id).addEventListener('click', fn); }
  click('btnPlay', play);
  click('pickX', function () { game.setSex('X'); play(); });
  click('pickY', function () { game.setSex('Y'); play(); });
  click('btnControls', function () { open('controls'); });
  click('btnIntro', function () { audio.unlock(); show(null); EG.intro.play(function () { show('title'); }); });
  click('btnSettings', function () { drawSettings(); open('settings'); });
  click('btnReset', function () { open('confirm'); });
  click('resume', back);
  click('pauseShop', function () { open('shop'); });
  click('pauseControls', function () { open('controls'); });
  click('pauseSettings', function () { drawSettings(); open('settings'); });
  click('pauseQuit', toTitle);
  click('swim', back);
  click('settingsBack', back);
  click('controlsBack', back);
  click('confirmNo', back);
  click('obitRetry', retry);
  click('obitShop', function () { open('shop'); });
  click('confirmYes', function () { game.reset(); stack = ['title']; drawTitle(); drawName(); show('title'); });
  click('restart', function () {
    $('ending').hidden = true;
    $('ending').classList.remove('dim');
    $('restart').hidden = true;
    $('endNote').textContent = '';
    ui.litter();
  });
  click('menuBtn', function () { audio.unlock(); if (!stack.length) { open('shop'); } });
  click('pauseBtn', function () { audio.unlock(); if (!stack.length) { open('pause'); } });
  click('spitBtn', function () { audio.unlock(); game.spit(); });

  ui.boot = function () {
    gfx.quality = settings.quality;
    audio.setVolume('master', settings.master);
    audio.setVolume('sfx', settings.sfx);
    audio.setVolume('ambience', settings.ambience);
    game.boot();
    stack = ['title'];
    drawTitle();
    drawName();
    $('hud').hidden = true;
    show('title');
    /* Coming from the button on the landing page: no second menu in the way. */
    var launched = false;
    try { launched = window.sessionStorage.getItem('only-one-go') === '1'; window.sessionStorage.removeItem('only-one-go'); } catch (e) { /* no storage: the title screen is fine */ }
    if (launched) { play(); }
  };
  ui.debug = { open: open, back: back, play: play, bubbles: bubbles, toasts: toasts, pops: pops };

  return ui;
})();

EG.ui.boot();
