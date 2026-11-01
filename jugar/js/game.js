/* Rules of the swim: mazes, fog of war, free movement and rewards. Screens and input live in ui.js. */
EG.game = (function () {
  'use strict';
  var D = EG.data, gfx = EG.gfx, audio = EG.audio, STAGES = D.STAGES, TILE = D.TILE, FOES = D.FOES, LIVES = D.LIVES, HUD = D.HUD, PLACE = D.PLACE, KING = D.KING, GUARD = D.GUARD, LITTER = D.LITTER;
  var game = {}, RADIUS = 1.5, TRAITS = {}, NO_TRAIT = {};
  D.TRAITS.forEach(function (t) { TRAITS[t.id] = t; });

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(list) { return list[Math.floor(Math.random() * list.length)]; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function damp(rate, dt) { return 1 - Math.exp(-rate * dt); }
  game.fmtInt = function (n) { return Math.round(n).toLocaleString('es-ES'); };
  game.fmt = function (n) {
    if (n < 10000) { return Math.round(n).toLocaleString('es-ES'); }
    if (n < 1e6) { return (n / 1e3).toLocaleString('es-ES', { maximumFractionDigits: 1 }) + ' mil'; }
    return (n / 1e6).toLocaleString('es-ES', { maximumFractionDigits: 2 }) + ' M';
  };

  function fresh() {
    return {
      atp: 0, stage: 0, seed: Math.floor(Math.random() * 1e9) + 1, seen: 0, levels: {}, marks: {},
      sugar: 0, passed: 0, spat: 0, burst: 0, streak: 0, map: 0, chest: 0, puzzle: 0, acid: 0, moco: 0, aspa: 0, back: 0, bought: 0, cm: 0, won: 0,
      lives: 3, wipes: {}, medals: {}, loot: 0, boons: 0, trait: null, medal: 0, king: 0, guard: 0
    };
  }
  var save = fresh();
  try {
    var stored = window.localStorage.getItem(D.SAVE_KEY);
    if (stored) { save = Object.assign(save, JSON.parse(stored)); }
  } catch (e) { /* the game plays fine without a save */ }
  game.persist = function () {
    try { window.localStorage.setItem(D.SAVE_KEY, JSON.stringify(save)); } catch (e) { /* idem */ }
  };
  game.save = function () { return save; };

  function level(id) { return save.levels[id] || 0; }
  game.level = level;
  game.cost = function (u) { return Math.ceil(u.base * Math.pow(u.grow, level(u.id))); };
  function medalCount() {
    var total = 0;
    for (var stage in save.medals) { total += save.medals[stage]; }
    return total;
  }
  game.medalCount = medalCount;
  function inherited() { return TRAITS[save.trait] || NO_TRAIT; }
  game.inherited = inherited;
  function stats() {
    var trait = inherited();
    return {
      speed: D.BASE_SPEED * (1 + 0.1 * level('flagelo')) * (trait.speed || 1),
      energy: 12 * (1 + 0.18 * level('mito')),
      sugar: (1 + 0.25 * level('azucar')) * (1 + D.MEDALS.perMedal * medalCount()) * (1 + LITTER.genes * save.won) * (trait.sugar || 1),
      magnet: 3 + 1.1 * level('iman'),
      vision: 3.2 + 0.55 * level('vista'),
      spits: level('escupir'),
      spitWait: Math.max(1.3 - level('escupir') * 0.12, 0.35),
      maxMult: 5 + 2 * level('racha'),
      hearts: 3 + level('membrana') + (trait.hearts || 0),
      lives: 3 + level('vidas') + (trait.lives || 0),
      acidGrace: 0.15 + 0.1 * level('capa'),
      sprintCost: 2 / (1 + 0.16 * level('sprint')),
      mucus: Math.min(0.4 + 0.1 * level('enzima'), 0.96),
      passive: 0.5 * level('casa') * (1 + level('casa') * 0.25),
      allies: level('aliado'),
      smell: level('olfato') > 0,
      punch: 3.2 + level('acrosoma') * 2.6
    };
  }
  game.stats = stats;

  var run = null, phase = 'title', cheers = [], cheerGap = 0, clock = 0;
  var trauma = 0, flash = 0, punch = 0, beat = 0, heartTimer = 0, saveTimer = 0, bubbleGap = 0, callGap = 0, hitstop = 0, sightTimer = 0, shakeAfter = 0;
  game.run = function () { return run; };
  game.phase = function () { return phase; };
  function earn(amount) { save.atp += amount; }
  game.earn = earn;

  function totalLevels() { return D.UPGRADES.reduce(function (sum, u) { return sum + level(u.id); }, 0); }
  game.target = function (kind) {
    return Math.round(D.MARKS[kind].base * Math.pow(1.55, save.marks[kind] || 0) * (1 + 0.06 * totalLevels()));
  };
  game.markTitle = function (kind, tier) {
    var list = D.MARKS[kind].titles, last = list.length - 1;
    return tier <= last ? list[tier] : list[last] + ' ×' + (tier - last + 1);
  };
  game.markText = function (kind, count) {
    var mark = D.MARKS[kind];
    return (count === 1 && mark.one ? mark.one : mark.text).replace('{n}', game.fmtInt(count));
  };
  game.unlocked = function () {
    return Object.keys(save.marks).reduce(function (sum, k) { return sum + save.marks[k]; }, 0);
  };
  function reach(kind, value) {
    save[kind] = Math.max(save[kind], value);
    var need = game.target(kind);
    if (save[kind] < need || !run) { return; }
    save.marks[kind] = (save.marks[kind] || 0) + 1;
    var reward = need * run.st.sugar * D.MARKS[kind].pay;
    earn(reward);
    run.energy = run.st.energy;
    cheers.push({ title: game.markTitle(kind, save.marks[kind] - 1), sub: game.markText(kind, need) + ' · +' + game.fmt(reward) + ' ATP' });
  }
  function bump(kind) { reach(kind, save[kind] + 1); }

  game.voice = function (text) {
    if (save.sex !== 'X') { return text; }
    return D.FEMININE.reduce(function (out, pair) { return out.split(pair[0]).join(pair[1]); }, text);
  };
  game.setSex = function (sex) { save.sex = sex; gfx.setSex(sex); insultDeck = []; game.persist(); };
  /* A deck, not a dice: with this many mouths nothing repeats until they have said it all. */
  var insultDeck = [];
  game.insult = function () {
    if (!insultDeck.length) {
      var own = D['INSULTS_' + (save.sex || 'Y')];
      insultDeck = D.INSULTS.concat(own, own);
    }
    return insultDeck.splice(Math.floor(Math.random() * insultDeck.length), 1)[0];
  };

  function say(key, name) {
    if (callGap > 0 && key !== 'egg') { return; }
    var line = pick(D.CALLS[key]);
    EG.ui.call(name ? line.replace('{n}', name) : game.voice(line));
    callGap = 4.5;
  }
  function shake(amount) { trauma = Math.min(Math.max(trauma, amount), 1); }

  function celebrate(title, sub) {
    EG.ui.banner(title, sub);
    hitstop = 0.1; flash = 0.8; punch = 1;
    shake(0.4);
    gfx.burst(run.x, 2, run.z, 70, 0xffd98a, 20);
    audio.fanfare();
  }

  function tileOf(v) { return Math.floor(v / TILE); }
  function centre(t) { return (t + 0.5) * TILE; }
  function solidAt(x, z, radius) {
    var m = run.maze, cx = tileOf(x), cz = tileOf(z);
    for (var ty = cz - 1; ty <= cz + 1; ty++) {
      for (var tx = cx - 1; tx <= cx + 1; tx++) {
        if (m.isOpen(tx, ty)) { continue; }
        var nx = clamp(x, tx * TILE, (tx + 1) * TILE), nz = clamp(z, ty * TILE, (ty + 1) * TILE);
        if ((x - nx) * (x - nx) + (z - nz) * (z - nz) < radius * radius) { return true; }
      }
    }
    return false;
  }
  /* Each axis moves on its own, so walls let you slide along them instead of sticking. */
  function moveBody(o, dx, dz, radius) {
    if (!solidAt(o.x + dx, o.z, radius)) { o.x += dx; } else { o.vx = 0; }
    if (!solidAt(o.x, o.z + dz, radius)) { o.z += dz; } else { o.vz = 0; }
  }

  function placeRival(o, first) {
    var r = run, q = o.state, m = r.maze, list = m.floors, t = list[Math.floor(Math.random() * list.length)];
    for (var tries = 0; tries < 20 && !first; tries++) {
      t = list[Math.floor(Math.random() * list.length)];
      if (!r.visible[m.at(t[0], t[1])]) { break; }
    }
    q.x = centre(t[0]); q.z = centre(t[1]); q.heading = 0;
    q.rate = rnd(0.45, 0.8); q.down = 0; q.talk = 0; q.heckle = 0; q.next = null; q.passed = false;
    q.mode = 'idle'; q.t = 0; q.aim = 0; q.gloat = 0; q.stalk = 0; q.hunting = false;
    q.lane = rnd(-PLACE.lane, PLACE.lane);
    q.laneRest = 0;
    q.mean = Math.random() < FOES.mean[r.stage];
    q.cool = rnd(FOES.cool[0], FOES.cool[1]);
    q.lookWait = rnd(D.POSE.rivalEvery[0], D.POSE.rivalEvery[1]);
    o.size = D.POSE.rivalSize;
    o.body.rotation.set(0, 0, 0);
    o.face('neutral');
    EG.ui.hush(o);
  }

  /* The floor is handed out in order of importance, so nothing lands on anything else and nothing ends up inside a wall. */
  function furnish(r, st) {
    var m = r.maze, index = r.stage, P = PLACE, taken = new Uint8Array(m.cols * m.rows), n, t;
    function reserve(tile, radius) {
      for (var dy = -radius; dy <= radius; dy++) {
        for (var dx = -radius; dx <= radius; dx++) {
          if (dx * dx + dy * dy <= radius * radius && m.isOpen(tile[0] + dx, tile[1] + dy)) { taken[m.at(tile[0] + dx, tile[1] + dy)] = 1; }
        }
      }
    }
    function fits(tile) {
      return m.isOpen(tile[0], tile[1]) && m.clear[m.at(tile[0], tile[1])] >= P.minClear && !taken[m.at(tile[0], tile[1])];
    }
    function spotNear(tile) {
      var best = null, bestD = 1e9;
      for (var dy = -P.search; dy <= P.search; dy++) {
        for (var dx = -P.search; dx <= P.search; dx++) {
          var d = dx * dx + dy * dy, near = [tile[0] + dx, tile[1] + dy];
          if (d < bestD && d <= P.search * P.search && fits(near)) { best = near; bestD = d; }
        }
      }
      return best;
    }
    function far(tile) { return m.fromStart[m.at(tile[0], tile[1])] > P.farFromStart; }

    reserve(m.start, P.start);
    reserve(m.exit, P.exit);
    if (m.exit2) { reserve(m.exit2, P.exit); }

    var nook = 0;
    function nextNook() {
      while (nook < m.deadEnds.length) {
        var spot = spotNear(m.deadEnds[nook++]);
        if (spot) { return spot; }
      }
      return null;
    }
    for (n = 0; n < st.chests && (t = nextNook()); n++) {
      reserve(t, P.chest);
      r.chests.push({ x: centre(t[0]), z: centre(t[1]), alive: true });
    }
    for (n = 0; n < st.puzzles && (t = nextNook()); n++) {
      reserve(t, P.puzzle);
      r.puzzles.push({ x: centre(t[0]), z: centre(t[1]), alive: true, kind: n % 2 ? 'simon' : 'quiz' });
    }

    function addHazard(kind, tile) {
      var it = { kind: kind, x: centre(tile[0]), z: centre(tile[1]), alive: true, r: rnd(1.8, 2.5), vx: 0, vz: 0, mode: 'idle', t: 0, aim: 0 };
      if (kind === 'patrol') {
        var dir = EG.maze.DIRS.filter(function (v) { return m.isOpen(tile[0] + v[0], tile[1] + v[1]); })[0] || [1, 0];
        it.vx = dir[0] * FOES.patrol.speed; it.vz = dir[1] * FOES.patrol.speed;
      }
      if (kind === 'spin') {
        it.rate = (Math.random() < 0.5 ? -1 : 1) * rnd(0.8, 1.3) * (1 + index * FOES.arms.climb);
        it.ring = rnd(2, FOES.ring.every); it.charge = 0;
      }
      if (kind === 'cell') { it.chased = 0; it.rest = 0; }
      if (kind === 'acid') { it.soak = 0; it.t = rnd(0, FOES.acid.rest + FOES.acid.warn + FOES.acid.on); }
      r.hazards.push(it);
    }
    var spots = m.floors.filter(far), spot = 0;
    function nextSpot() {
      while (spot < spots.length) {
        var tile = spots[spot++];
        if (fits(tile)) { return tile; }
      }
      return null;
    }
    var halls = m.rooms.filter(far), hall = 0, spins = st.hazards.spin || 0;
    for (n = 0; n < spins; n++) {
      t = null;
      while (!t && hall < halls.length) { t = spotNear(halls[hall++]); }
      t = t || nextSpot();
      if (!t) { break; }
      reserve(t, P.spin);
      addHazard('spin', t);
    }
    Object.keys(st.hazards).forEach(function (kind) {
      if (kind === 'spin' || kind === 'curtain') { return; }
      for (var k = 0; k < st.hazards[kind]; k++) {
        var tile = nextSpot();
        if (!tile) { return; }
        reserve(tile, P.hazard);
        addHazard(kind, tile);
      }
    });
    /* The red lump sits beside the danger furthest from the start: greed has to walk past it. */
    function depth(it) { return m.fromStart[m.at(tileOf(it.x), tileOf(it.z))]; }
    var deepest = r.hazards.slice().sort(function (a, b) { return depth(b) - depth(a); }), crown = null;
    for (n = 0; n < deepest.length && !crown; n++) { crown = spotNear([tileOf(deepest[n].x), tileOf(deepest[n].z)]); }
    crown = crown || nextSpot();
    if (crown) {
      reserve(crown, P.king);
      r.crown = { x: centre(crown[0]), z: centre(crown[1]), alive: true };
    }
    hangCurtains(r, st.hazards.curtain || 0, far, taken, reserve);

    m.floors.forEach(function (tile) {
      if (m.fromStart[m.at(tile[0], tile[1])] > P.sugarFrom && m.rnd() < st.sugar / 7 * P.sugarFill && fits(tile)) {
        reserve(tile, P.sugar);
        r.sugar.push({ x: centre(tile[0]), z: centre(tile[1]), alive: true });
      }
    });
    r.sugarTotal = r.sugar.length;
  }

  /* How far the passage runs across the way out, from tile t along one axis. */
  function passage(m, t, ax, az) {
    var steps = 0;
    while (m.isOpen(t[0] + ax * (steps + 1), t[1] + az * (steps + 1))) { steps += 1; }
    return steps;
  }
  /* Mucus is a door, not a blob: a row across a narrow spot, wall to wall, square to the way out. A spit opens a gap in it. */
  function hangCurtains(r, wanted, far, taken, reserve) {
    var m = r.maze, P = PLACE, rows = [], widest = P.rowMax * P.rowGap, hung = 0;
    if (!wanted) { return; }
    m.floors.forEach(function (t) {
      var clear = m.clear[m.at(t[0], t[1])], here = m.toExit[m.at(t[0], t[1])], along = null;
      if (clear < P.minClear || !far(t)) { return; }
      EG.maze.DIRS.forEach(function (v) {
        if (m.isOpen(t[0] + v[0], t[1] + v[1]) && m.toExit[m.at(t[0] + v[0], t[1] + v[1])] < here) { along = v; }
      });
      if (!along) { return; }
      var ax = Math.abs(along[1]), az = Math.abs(along[0]), back = passage(m, t, -ax, -az), ahead = passage(m, t, ax, az), width = (back + ahead + 1) * TILE;
      if (width >= P.rowMin && width <= widest && Math.abs(back - ahead) <= 1) { rows.push({ t: t, ax: ax, az: az, back: back, width: width }); }
    });
    rows.sort(function (a, b) { return a.width - b.width; });
    var placed = [];
    rows.forEach(function (row) {
      if (hung >= wanted) { return; }
      var t = row.t, x0 = (t[0] - row.ax * row.back) * TILE, z0 = (t[1] - row.az * row.back) * TILE, count = Math.min(Math.ceil(row.width / P.rowGap), P.rowMax), step = row.width / count, i;
      var clashes = placed.some(function (o) { return Math.hypot(o[0] - t[0], o[1] - t[1]) < P.rowsApart; });
      for (i = -row.back; !clashes && i <= row.width / TILE - row.back - 1; i++) {
        clashes = !!taken[m.at(t[0] + row.ax * i, t[1] + row.az * i)];
      }
      if (clashes) { return; }
      placed.push(t);
      for (i = 0; i < count; i++) {
        var offset = (i + 0.5) * step, x = row.ax ? x0 + offset : centre(t[0]), z = row.az ? z0 + offset : centre(t[1]);
        var tile = [tileOf(x), tileOf(z)];
        r.curtains.push({ kind: 'curtain', x: x, z: z, alive: true, r: 2, vx: 0, vz: 0, mode: 'idle', t: 0, aim: 0, wide: !!row.ax });
        reserve(tile, PLACE.curtain);
        hung += 1;
      }
    });
  }

  /* opts.retry rebuilds the same cave with its sugar back and keeps what you mapped; opts.checkpoint is a stage earned. */
  function enterStage(index, opts) {
    opts = opts || {};
    var previous = run;
    var st = STAGES[index], maze = EG.maze.build(st.size[0] * D.CAVE_SCALE, st.size[1] * D.CAVE_SCALE, save.seed + index * 7919, { twoExits: st.twoExits });
    var base = stats(), keep = run && !opts.retry ? Math.min(run.energy, base.energy) : base.energy;
    var extraHearts = (save.wipes[index] || 0) >= LIVES.helpAfter ? LIVES.helpHearts : 0;
    /* You come in side-on, nose towards the way out: facing down the screen would stand the tail up under the stage card. */
    var towardsExit = maze.exit[0] >= maze.start[0] ? 1 : -1;
    var r = {
      st: base, stage: index, maze: maze, x: centre(maze.start[0]), z: centre(maze.start[1]), vx: 0, vz: 0, dirX: towardsExit, dirZ: 0, heading: -towardsExit * Math.PI / 2, energy: keep, tired: false, sprint: 0, slow: 1,
      combo: 0, comboTime: 0, mult: 1, allies: base.allies, spits: [], spitCool: 0, hurt: 0, gulp: 0, path: null,
      idle: 0, idleLooked: false, lookWait: rnd(D.POSE.heroEvery[0], D.POSE.heroEvery[1]),
      explored: new Uint8Array(maze.cols * maze.rows), visible: new Uint8Array(maze.cols * maze.rows), discovered: 0, openable: maze.floors.length,
      sugar: [], hazards: [], curtains: [], chests: [], puzzles: [], eggHp: 100, eggTime: 11, won: false, lowSaid: false, tiredSaid: false,
      hearts: base.hearts + extraHearts, maxHearts: base.hearts + extraHearts, safe: LIVES.respawnSafe, kx: 0, kz: 0, ghost: false, downTime: 0, hy: LIVES.rideHeight, floatFrom: null, floatTime: 1,
      respawn: { x: centre(maze.start[0]), z: centre(maze.start[1]) }, foeSpits: [], attacking: 0, lonely: 0,
      toHero: new Int32Array(maze.cols * maze.rows), heroQueue: new Int32Array(maze.cols * maze.rows), chartTime: 0,
      eaten: 0, sugarTotal: 0, crown: null, king: 0, kingBeat: 0, boon: null, guard: null, sealGap: 0, crowdTime: 0
    };
    if (opts.retry) {
      r.explored.set(previous.explored);
      r.discovered = previous.discovered;
    }
    run = r;
    tuneFoes(r);
    furnish(r, st);
    gfx.buildStage(maze, index);
    r.goodExit = opts.retry ? previous.goodExit : Math.random() < 0.5 ? 0 : 1;
    gfx.setPortal(0, true, centre(maze.exit[0]), centre(maze.exit[1]), base.smell && !!maze.exit2 && r.goodExit === 0);
    gfx.setPortal(1, !!maze.exit2, maze.exit2 ? centre(maze.exit2[0]) : 0, maze.exit2 ? centre(maze.exit2[1]) : 0, base.smell && r.goodExit === 1);
    gfx.setEgg(false);
    gfx.setMarker(false);
    gfx.setBubble(false);
    gfx.setCheckpoint(r.respawn.x, r.respawn.z);
    gfx.setKing(false);
    gfx.hero.body.visible = true;
    gfx.rivals.forEach(function (o, n) {
      o.state = { name: rivalName(n, st), nameOut: false, sperm: o, spitter: index >= FOES.spit.from && n % FOES.spit.every === 0, boss: false, rest: 0 };
      placeRival(o, true);
    });
    EG.ui.guardBar();
    if (st.guard) { postGuard(r, st.guard); }
    save.stage = index;
    updateSight(r, true);
    EG.ui.clearBubbles();
    EG.ui.stageCard(index, opts);
    cheerGap = Math.max(cheerGap, HUD.cardGap);
    bubbleGap = Math.max(bubbleGap, HUD.cardGap);
    if (opts.retry && extraHearts) { callGap = 0; say('help'); }
    audio.stage();
    audio.drone(st.drone);
    flash = Math.max(flash, 0.5);
    game.persist();
  }

  /* The guard takes the first rival's body and its own name, so nobody appears twice. */
  function rivalName(n, st) {
    var name = n < D.NAMED.length ? D.NAMED[n] : null;
    if (!st.guard) { return name; }
    if (n === 0) { return st.guard.name; }
    return name === st.guard.name ? D.NAMED[0] : name;
  }
  function postGuard(r, spec) {
    var m = r.maze, best = m.exit, roomiest = -1, o = gfx.rivals[0], q = o.state;
    m.floors.forEach(function (t) {
      var at = m.at(t[0], t[1]);
      if (m.toExit[at] === GUARD.post && m.clear[at] > roomiest) { roomiest = m.clear[at]; best = t; }
    });
    r.guard = { name: spec.name, hp: spec.hp, max: spec.hp, moves: spec.moves, lines: spec.lines, turn: 0, fighting: false, hinted: false, x: centre(best[0]), z: centre(best[1]) };
    q.boss = true;
    q.x = r.guard.x; q.z = r.guard.z; q.next = null;
    q.heading = Math.atan2(-(r.x - q.x), -(r.z - q.z));
    o.size = GUARD.size;
  }

  game.start = function () {
    gfx.hero.body.visible = true;
    gfx.hero.face('smug');
    gfx.portrait.face('smug');
    gfx.lookAtYou(gfx.hero, D.POSE.heroGlance);
    gfx.rivals.forEach(function (o) { o.body.visible = false; });
    run = null;
    if (save.lives < 1) { save.lives = stats().lives; }
    enterStage(save.stage);
    phase = 'race';
    say('start');
  };
  function clearActors() {
    gfx.rivals.forEach(function (o) { o.body.visible = false; o.state = null; });
    gfx.allies.forEach(function (a) { a.body.visible = false; });
    gfx.begin(); gfx.end();
    gfx.setMarker(false);
    gfx.setBubble(false);
    gfx.setCheckpoint();
    gfx.setKing(false);
    EG.ui.guardBar();
  }
  function leaveRun() {
    run = null;
    phase = 'title';
    EG.ui.clearBubbles();
    clearActors();
    prepareTitle();
  }
  game.toTitle = function () {
    game.persist();
    leaveRun();
  };
  game.reset = function () {
    save = fresh();
    leaveRun();
    game.persist();
  };
  /* A new litter keeps everything you earned: only the trip starts over, with the inherited trait you picked. */
  game.prestige = function (traitId) {
    save.trait = traitId;
    save.stage = 0;
    save.wipes = {};
    save.lives = stats().lives;
    leaveRun();
    game.persist();
  };

  game.buy = function (id) {
    var u = D.UPGRADES.filter(function (x) { return x.id === id; })[0], price = game.cost(u);
    if (save.atp < price || level(id) >= u.max) { audio.nope(); return false; }
    save.atp -= price;
    save.levels[id] = level(id) + 1;
    audio.buy();
    if (run) {
      var keep = run.energy / run.st.energy;
      run.st = stats();
      run.energy = run.st.energy * keep;
      run.allies = Math.max(run.allies, run.st.allies);
      if (id === 'membrana') { run.hearts += 1; run.maxHearts += 1; }
      tuneFoes(run);
      reach('bought', save.bought + 1);
    } else { save.bought += 1; }
    if (id === 'vidas') { save.lives += 1; }
    game.persist();
    return true;
  };

  /* A thumb cannot aim and swim at once: the nearest rival in sight and in range takes the spit. */
  function nearestTarget(r) {
    var best = null, bestD = D.TOUCH.aim;
    gfx.rivals.forEach(function (o) {
      var q = o.state;
      if (!q || !o.body.visible || q.down > 0) { return; }
      var d = Math.hypot(q.x - r.x, q.z - r.z);
      if (d < bestD) { bestD = d; best = q; }
    });
    return best;
  }
  game.spit = function (assisted) {
    var r = run;
    if (!r || phase !== 'race' || r.st.spits < 1 || r.spitCool > 0) { return; }
    r.spitCool = r.st.spitWait;
    var target = assisted ? nearestTarget(r) : null;
    var n = r.st.spits, base = target ? Math.atan2(target.x - r.x, target.z - r.z) : Math.atan2(r.dirX, r.dirZ);
    for (var i = 0; i < n && r.spits.length < 40; i++) {
      var a = base + (i - (n - 1) / 2) * 0.16;
      r.spits.push({ x: r.x, z: r.z, vx: Math.sin(a) * 62, vz: Math.cos(a) * 62, life: 0.75 });
    }
    punch = Math.max(punch, 0.6);
    audio.spit();
  };

  game.hitEgg = function () {
    if (phase !== 'egg') { return; }
    run.eggHp -= run.st.punch;
    shake(0.25);
    punch = 1;
    gfx.burst(run.x, 3, run.z, 16, 0xffe6be, 11);
    audio.tone(200 + (100 - run.eggHp) * 8, 0.09, 'square', 0.08);
  };

  /* Click to move, MOBA style: a breadth-first path over the tiles to the clicked spot. */
  game.clickTo = function (px, py) {
    var r = run;
    if (!r || phase !== 'race') { return; }
    var at = gfx.groundAt(px, py), m = r.maze, tx = tileOf(at.x), tz = tileOf(at.z);
    if (!m.isOpen(tx, tz)) {
      var best = null, bestD = 1e9;
      for (var dy = -5; dy <= 5; dy++) {
        for (var dx = -5; dx <= 5; dx++) {
          if (m.isOpen(tx + dx, tz + dy)) {
            var d = Math.hypot(centre(tx + dx) - at.x, centre(tz + dy) - at.z);
            if (d < bestD) { bestD = d; best = [tx + dx, tz + dy]; }
          }
        }
      }
      if (!best) { return; }
      tx = best[0]; tz = best[1];
    }
    var start = [tileOf(r.x), tileOf(r.z)], prev = {}, queue = [start];
    prev[m.at(start[0], start[1])] = -1;
    for (var i = 0; i < queue.length; i++) {
      var cur = queue[i];
      if (cur[0] === tx && cur[1] === tz) { break; }
      EG.maze.DIRS.forEach(function (v) {
        var ax = cur[0] + v[0], ay = cur[1] + v[1];
        if (m.isOpen(ax, ay) && prev[m.at(ax, ay)] === undefined) {
          prev[m.at(ax, ay)] = m.at(cur[0], cur[1]);
          queue.push([ax, ay]);
        }
      });
    }
    if (prev[m.at(tx, tz)] === undefined) { return; }
    var path = [], k = m.at(tx, tz);
    while (k !== -1) {
      path.unshift([centre(k % m.cols), centre(Math.floor(k / m.cols))]);
      k = prev[k];
    }
    path = path.filter(function (node, i) { return i % 3 === 2 || i === path.length - 1; });
    if (!path.length) { path = [[centre(tx), centre(tz)]]; }
    r.path = path;
    gfx.setMarker(true, centre(tx), centre(tz));
  };

  /* Line of sight over the tile grid: the fog only lifts where you can really see. */
  function updateSight(r, quiet) {
    var m = r.maze, range = r.st.vision * 14, rays = 200;
    r.visible.fill(0);
    for (var i = 0; i < rays; i++) {
      var a = i / rays * Math.PI * 2, sx = Math.sin(a), cz = Math.cos(a);
      for (var d = 0; d < range; d += 2) {
        var tx = tileOf(r.x + sx * d), tz = tileOf(r.z + cz * d);
        if (tx < 0 || tz < 0 || tx >= m.cols || tz >= m.rows) { break; }
        var idx = m.at(tx, tz);
        r.visible[idx] = 1;
        if (!r.explored[idx]) {
          r.explored[idx] = 1;
          if (!m.wall[idx]) {
            r.discovered += 1;
            if (!quiet) { bump('map'); }
          }
        }
        if (m.wall[idx]) { break; }
      }
    }
  }
  function seen(r, x, z) { return r.visible[r.maze.at(tileOf(x), tileOf(z))]; }
  function known(r, x, z) { return r.explored[r.maze.at(tileOf(x), tileOf(z))]; }

  function steer(r, dt, input) {
    var ix = input.x, iy = input.y, st = r.st;
    if (ix || iy) {
      if (r.path) { r.path = null; gfx.setMarker(false); }
    } else if (r.path) {
      var next = r.path[0], dx = next[0] - r.x, dz = next[1] - r.z, d = Math.hypot(dx, dz);
      if (d < (r.path.length > 1 ? 2.6 : 1.2)) {
        r.path.shift();
        if (!r.path.length) { r.path = null; gfx.setMarker(false); }
      } else { ix = dx / d; iy = -dz / d; }
    }
    var moving = !!(ix || iy);
    var want = st.speed * r.slow * (1 + 0.65 * r.sprint) * (r.tired ? 0.5 : 1) * (r.boon && r.boon.spec.speed || 1);
    var grip = damp(moving ? 12 : 9, dt);
    r.vx += (ix * want - r.vx) * grip;
    r.vz += (-iy * want - r.vz) * grip;
    if (moving) {
      var len = Math.hypot(ix, iy);
      r.dirX = ix / len; r.dirZ = -iy / len;
    }
    moveBody(r, (r.vx + r.kx) * dt, (r.vz + r.kz) * dt, RADIUS);
    var settle = damp(5, dt);
    r.kx -= r.kx * settle; r.kz -= r.kz * settle;
    if (Math.hypot(r.vx, r.vz) > 1) {
      var diff = Math.atan2(-r.vx, -r.vz) - r.heading;
      r.heading += Math.atan2(Math.sin(diff), Math.cos(diff)) * damp(11, dt);
    }
    return moving;
  }

  function updateWorld(dt) {
    gfx.begin();
    updateSugar(dt);
    run.attacking = countAttackers(run);
    updateHazards(dt);
    updateCurtains();
    updateRivals(dt);
    updateFoeSpits(dt);
    updateSpits(dt);
    updatePickups();
    gfx.end();
  }

  function updateRace(dt) {
    var r = run, st = r.st, input = EG.ui.input();
    if (r.energy <= 0) { r.tired = true; }
    if (r.tired && r.energy > st.energy * 0.14) { r.tired = false; }
    var sprinting = input.sprint && !r.tired;
    r.sprint += ((sprinting ? 1 : 0) - r.sprint) * damp(sprinting ? 6 : 4, dt);
    r.slow += (1 - r.slow) * damp(1.8, dt);
    var moving = steer(r, dt, input);
    if (moving) { r.energy = Math.max(r.energy - dt * 0.34 * (1 + (st.sprintCost - 1) * r.sprint), 0); }
    if (r.tired) {
      r.energy += dt * 0.7;
      if (!r.tiredSaid) { r.tiredSaid = true; say('tired'); }
    } else { r.tiredSaid = false; }
    r.comboTime -= dt;
    if (r.comboTime <= 0 && r.combo) { r.combo = 0; r.mult = 1; }
    if (r.hurt > 0) { r.hurt -= dt; }
    if (r.gulp > 0) { r.gulp -= dt; }
    if (r.safe > 0) { r.safe = Math.max(r.safe - dt, 0); }
    if (r.sealGap > 0) { r.sealGap -= dt; }
    tickPowers(r, dt);

    sightTimer += dt;
    if (sightTimer > 0.1) { sightTimer = 0; updateSight(r); }
    gfx.updateFog(r.explored, r.visible, dt);
    updateWorld(dt);

    if (r.energy < st.energy * 0.22 && !r.lowSaid) { r.lowSaid = true; say('low'); }
    if (r.energy > st.energy * 0.4) { r.lowSaid = false; }
    var progress = game.progress();
    save.seen = Math.max(save.seen, progress);
    reach('cm', Math.floor(progress * 18));
    if (phase === 'race') { checkExits(r); }
  }

  function checkExits(r) {
    var m = r.maze, near = function (t) { return t && Math.hypot(r.x - centre(t[0]), r.z - centre(t[1])) < 4.6; };
    if (!near(m.exit) && !near(m.exit2)) { return; }
    if (r.guard && r.guard.hp > 0) {
      sealedDoor(r, centre(m.exit[0]), centre(m.exit[1]));
      return;
    }
    if (r.stage < STAGES.length - 1) {
      finishStage(r);
      return;
    }
    var door = near(m.exit) ? m.exit : m.exit2;
    if (r.goodExit === (door === m.exit ? 0 : 1)) {
      var doorX = centre(door[0]), doorZ = centre(door[1]), side = solidAt(doorX, doorZ + D.EGG_GAP, RADIUS) ? -1 : 1;
      phase = 'egg';
      r.eggHp = 100; r.eggTime = 11;
      r.path = null; gfx.setMarker(false);
      r.vx = r.vz = 0;
      r.eggX = doorX; r.eggZ = doorZ + side * D.EGG_GAP;
      r.heading = side > 0 ? 0 : Math.PI;
      calmFoes(r);
      gfx.quiet();
      gfx.setEgg(true, doorX, doorZ);
      EG.ui.mash(true);
      say('egg');
      shake(0.7);
      audio.tone(520, 0.5, 'square', 0.1, 1040);
    } else {
      var prize = 200 * r.st.sugar;
      earn(prize);
      celebrate('TROMPA VACÍA', 'Aquí no hay nadie, gilipollas. +' + game.fmt(prize) + ' ATP y de vuelta');
      r.x = centre(m.start[0]); r.z = centre(m.start[1]); r.vx = r.vz = 0; r.path = null; gfx.setMarker(false);
    }
  }

  /* The guard is still up: the door throws you back. */
  function sealedDoor(r, doorX, doorZ) {
    var dx = r.x - doorX, dz = r.z - doorZ, d = Math.hypot(dx, dz) || 1;
    r.kx = dx / d * GUARD.sealKick; r.kz = dz / d * GUARD.sealKick;
    r.path = null;
    gfx.setMarker(false);
    if (r.sealGap > 0) { return; }
    r.sealGap = GUARD.sealGap;
    audio.nope();
    say('sealed');
    EG.ui.pop(gfx.project(r.x, 4, r.z), '¡Cerrado, papeles!', '#ff8a6a', 34);
  }

  /* A medal is the best share of a stage's sugar you ever ate; only what you improve pays. */
  function awardMedal(r) {
    var M = D.MEDALS, share = r.sugarTotal ? r.eaten / r.sugarTotal : 0, got = 0, had = save.medals[r.stage] || 0;
    M.cuts.forEach(function (cut) { if (share >= cut) { got += 1; } });
    var gained = Math.max(got - had, 0), pay = gained * (M.pay + M.payPerStage * r.stage) * r.st.sugar;
    save.medals[r.stage] = Math.max(got, had);
    earn(pay);
    for (var n = 0; n < gained; n++) { bump('medal'); }
    return { got: got, share: share, pay: pay };
  }

  /* Every stage you clear is a checkpoint: lives top up, hearts refill and the save moves on. */
  function finishStage(r) {
    var medal = awardMedal(r);
    save.wipes[r.stage] = 0;
    save.lives = Math.min(save.lives + 1, r.st.lives);
    audio.checkpoint();
    enterStage(r.stage + 1, { checkpoint: true, medal: medal });
    callGap = 0;
    say('checkpoint');
  }

  function collectSugar(r, it) {
    var st = r.st;
    it.alive = false;
    r.combo += 1; r.comboTime = 3.4; r.gulp = 0.25;
    if (!it.bonus) { r.eaten += 1; }
    bump('sugar');
    reach('streak', r.combo);
    r.mult = Math.min(1 + Math.floor(r.combo / 4), st.maxMult);
    var value = st.sugar * r.mult * (r.king > 0 ? KING.mult : 1);
    if (r.king > 0) { r.king = Math.min(r.king + KING.perSugar, KING.cap); }
    earn(value);
    r.energy = Math.min(st.energy, r.energy + 0.5);
    audio.sugar(r.combo);
    gfx.kick(gfx.hero, D.POSE.gulpKick);
    gfx.burst(r.x, 2, r.z, 18 + r.mult * 3, 0xfff6e6, 12);
    gfx.shockAt(r.x, r.z);
    EG.ui.popSum(gfx.project(r.x, 4, r.z), value, '#ffe39a', 24 + Math.min(r.mult, 12) * 3);
    punch = Math.max(punch, 0.75);
    if (r.combo % 12 === 0) { say('combo'); gfx.lookAtYou(gfx.hero, D.POSE.heroGlance); }
  }

  function updateSugar(dt) {
    var r = run, st = r.st;
    r.sugar.forEach(function (it, n) {
      if (!it.alive) { return; }
      var dx = r.x - it.x, dz = r.z - it.z, dist = Math.hypot(dx, dz);
      if (!r.ghost && !it.pulled && dist < st.magnet && seen(r, it.x, it.z)) { it.pulled = true; it.flight = 0; }
      if (it.pulled && !r.ghost) {
        it.flight += dt;
        var pull = damp(7 + it.flight * 40, dt);
        it.x += dx * pull; it.z += dz * pull;
        if (dist < 1.8) { collectSugar(r, it); return; }
      }
      if (known(r, it.x, it.z)) { gfx.sugar(it.x, it.z, n, clock, !!seen(r, it.x, it.z)); }
    });
  }

  function updatePickups() {
    var r = run;
    r.chests.forEach(function (c) {
      if (!c.alive) { return; }
      if (known(r, c.x, c.z)) { gfx.chest(c.x, c.z, clock); }
      if (!r.ghost && Math.hypot(r.x - c.x, r.z - c.z) < 3.4) {
        c.alive = false;
        openChest(r, c);
      }
    });
    if (r.crown && r.crown.alive) {
      if (known(r, r.crown.x, r.crown.z)) { gfx.kingLump(r.crown.x, r.crown.z, clock); }
      if (!r.ghost && Math.hypot(r.x - r.crown.x, r.z - r.crown.z) < KING.reach) { crownKing(r); }
    }
    r.puzzles.forEach(function (p) {
      if (!p.alive) { return; }
      if (known(r, p.x, p.z)) { gfx.puzzle(p.x, p.z, clock); }
      if (!r.ghost && Math.hypot(r.x - p.x, r.z - p.z) < 3.4) {
        p.alive = false;
        r.path = null; gfx.setMarker(false);
        say('secret');
        EG.ui.puzzle(p.kind);
      }
    });
  }

  /* Rigged at first, a fruit machine afterwards. */
  function lootFactor() {
    var L = D.LOOT, factor = save.loot < L.fixed.length ? L.fixed[save.loot] : pick(L.then);
    save.loot += 1;
    return factor;
  }
  function openChest(r, c) {
    var factor = lootFactor(), prize = (25 + r.stage * 30) * r.st.sugar * factor;
    earn(prize);
    r.energy = r.st.energy;
    bump('chest');
    gfx.lookAtYou(gfx.hero, D.POSE.heroGlance);
    gfx.burst(c.x, 3, c.z, 50, 0xffc94d, 18);
    EG.ui.pop(gfx.project(c.x, 5, c.z), (factor > 1 ? '¡BOTÍN ×' + factor + '! +' : '¡BOTÍN! +') + game.fmt(prize), '#ffc94d', 34);
    if (factor >= D.LOOT.jackpot) {
      callGap = 0;
      say('jackpot');
      celebrate('¡JACKPOT!', '×' + factor + ': +' + game.fmt(prize) + ' ATP. Esto no lo declares');
    } else {
      say('chest');
      audio.fanfare();
    }
    grantBoon(r);
    gainHeart(r);
  }
  function grantBoon(r) {
    var spec = D.BOONS[save.boons % D.BOONS.length];
    save.boons += 1;
    r.boon = { spec: spec, t: spec.time, spark: 0 };
    audio.boon();
    EG.ui.toast(spec.name, spec.text);
  }
  function shrinker(r) { return r.boon && r.boon.spec.shrink ? r.boon.spec : null; }

  function crownKing(r) {
    r.crown.alive = false;
    r.king = KING.time;
    r.kingBeat = 0;
    bump('king');
    callGap = 0;
    say('king');
    gfx.setKing(true);
    gfx.burst(r.crown.x, 3, r.crown.z, 60, 0xff4a3a, 20);
    gfx.lookAtYou(gfx.hero, D.POSE.heroGlance);
    EG.ui.pop(gfx.project(r.crown.x, 5, r.crown.z), '¡TERRÓN REY!', '#ff6a50', 40);
    shake(0.3);
    audio.king();
  }
  function endPowers(r) {
    r.boon = null;
    r.king = 0;
    gfx.setKing(false);
  }
  function tickPowers(r, dt) {
    if (r.boon) {
      r.boon.t -= dt;
      r.boon.spark -= dt;
      if (r.boon.t <= 0) { r.boon = null; }
      else if (r.boon.spark <= 0) {
        r.boon.spark = 0.12;
        gfx.burst(r.x, 2, r.z, 3, r.boon.spec.color, 7);
      }
    }
    if (r.king > 0) {
      r.king -= dt;
      r.kingBeat -= dt;
      if (r.king <= 0) { r.king = 0; gfx.setKing(false); }
      else if (r.kingBeat <= 0) {
        r.kingBeat += KING.beat;
        audio.kingTick();
      }
    }
  }

  game.puzzleDone = function (won) {
    var r = run;
    if (won) {
      var prize = (60 + r.stage * 70) * r.st.sugar;
      earn(prize);
      r.energy = r.st.energy;
      bump('puzzle');
      callGap = 0;
      say('win');
      celebrate('¡PRUEBA SUPERADA!', '+' + game.fmt(prize) + ' ATP y energía a tope');
      gainHeart(r);
    } else {
      callGap = 0;
      say('lose');
    }
  };

  function gainHeart(r) {
    if (r.hearts >= r.maxHearts) { return; }
    r.hearts += 1;
    audio.heart();
    EG.ui.pop(gfx.project(r.x, 5, r.z), '+1 ♥', '#ff7a8a', 30);
  }

  /* The only way anything hurts you. True when the blow reached you; a kamikaze taking it for you does not count. */
  function hit(hearts, key, fromX, fromZ, kick) {
    var r = run, L = LIVES;
    if (phase !== 'race' || r.safe > 0 || r.ghost || (r.boon && r.boon.spec.shield)) { return false; }
    audio.bump();
    if (r.allies > 0) {
      var pay = L.allyPay * r.st.sugar;
      r.allies -= 1;
      r.safe = L.allySafe;
      earn(pay);
      EG.ui.pop(gfx.project(r.x, 4, r.z), '¡SACRIFICIO! +' + game.fmt(pay), '#ff8a6a', 30);
      say('ally');
      return false;
    }
    r.hearts = Math.max(r.hearts - hearts, 0);
    r.combo = 0; r.comboTime = 0; r.mult = 1;
    r.safe = L.hitSafe;
    r.hurt = L.hurtTime;
    hitstop = L.hitstop;
    shakeAfter = L.shake;
    gfx.kick(gfx.hero, L.hitKick);
    gfx.lookAtYou(gfx.hero, D.POSE.heroGlance);
    var dx = r.x - fromX, dz = r.z - fromZ, d = Math.hypot(dx, dz);
    if (d < 0.01) { dx = -r.dirX; dz = -r.dirZ; d = 1; }
    r.kx = dx / d * kick; r.kz = dz / d * kick;
    if (r.hearts <= 0) { loseLife(); } else { say(key); }
    return true;
  }

  /* Attackers stop, the floor stops warning, cells go back to sleep. */
  function calmFoes(r) {
    r.foeSpits.length = 0;
    r.attacking = 0;
    gfx.rivals.forEach(function (o) {
      var q = o.state;
      if (q && q.mode !== 'idle') {
        q.mode = 'idle'; q.next = null;
        q.cool = rnd(FOES.cool[0], FOES.cool[1]);
      }
    });
    r.hazards.forEach(function (it) {
      it.mode = 'idle';
      if (it.kind === 'cell') { it.awake = false; it.rest = 0; it.chased = 0; }
      if (it.kind === 'spin') { it.charge = 0; it.ring = FOES.ring.every; }
    });
  }

  function loseLife() {
    var r = run;
    save.lives -= 1;
    phase = 'down';
    r.ghost = true;
    r.downTime = 0;
    r.floatFrom = null;
    r.vx = r.vz = r.kx = r.kz = 0;
    r.path = null;
    gfx.setMarker(false);
    calmFoes(r);
    endPowers(r);
    audio.lifeLost();
    callGap = 0;
    say(save.lives > 0 ? 'life' : 'wipe');
    game.persist();
  }

  function comeBack(r) {
    r.ghost = false;
    r.hurt = 0;
    r.hearts = r.maxHearts;
    r.safe = LIVES.respawnSafe;
    r.hy = LIVES.rideHeight;
    r.energy = Math.max(r.energy, r.st.energy * LIVES.respawnEnergy);
    r.lonely = 0;
    phase = 'race';
    calmFoes(r);
    guardGoesHome(r);
    updateSight(r, true);
    gfx.setBubble(false);
    callGap = 0;
    say('respawn');
  }

  function wipe(r) {
    save.lives = r.st.lives;
    save.wipes[r.stage] = (save.wipes[r.stage] || 0) + 1;
    game.persist();
    gfx.setBubble(false);
    EG.ui.obit();
  }

  /* Rayman's bubble: blow up where you fell, then float in a straight line to the last checkpoint. */
  function updateDown(dt) {
    var r = run, L = LIVES;
    r.downTime += dt;
    var grow = Math.min(r.downTime / L.inflate, 1), size = L.bubbleSize * (grow + Math.sin(grow * Math.PI) * 0.25);
    if (save.lives < 1) {
      if (r.downTime > L.inflate + L.wipeWait) { wipe(r); return; }
    } else if (r.downTime > L.inflate) {
      if (!r.floatFrom) {
        r.floatFrom = { x: r.x, z: r.z };
        r.floatTime = clamp(Math.hypot(r.respawn.x - r.x, r.respawn.z - r.z) / L.floatRate, L.floatMin, L.floatMax);
      }
      var t = Math.min((r.downTime - L.inflate) / r.floatTime, 1), eased = t * t * (3 - 2 * t);
      r.x = r.floatFrom.x + (r.respawn.x - r.floatFrom.x) * eased;
      r.z = r.floatFrom.z + (r.respawn.z - r.floatFrom.z) * eased;
      r.hy = L.rideHeight + Math.sin(t * Math.PI) * (L.floatTop - L.rideHeight);
      if (t >= 1) { comeBack(r); }
    }
    if (r.ghost) { gfx.setBubble(true, r.x, r.hy, r.z, size); }
    gfx.updateFog(r.explored, r.visible, dt);
    updateWorld(dt);
  }

  /* Windup, strike and recovery are shared by everything that attacks; a spec says how long, what shape and what a touch does. */
  function aimAt(a) { a.aim = Math.atan2(run.x - a.x, run.z - a.z); }
  function canAttack() {
    var r = run;
    return !r.ghost && r.safe <= 0 && r.attacking < FOES.maxAttackers[r.stage] + (save.won >= LITTER.extraFrom ? 1 : 0);
  }
  function countAttackers(r) {
    var count = 0, i, m;
    for (i = 0; i < gfx.rivals.length; i++) {
      m = gfx.rivals[i].state ? gfx.rivals[i].state.mode : null;
      if (m === 'windup' || m === 'strike') { count += 1; }
    }
    for (i = 0; i < r.hazards.length; i++) {
      m = r.hazards[i].alive ? r.hazards[i].mode : null;
      if (m === 'windup' || m === 'strike') { count += 1; }
    }
    return count;
  }
  function turnTo(q, dx, dz, dt) {
    var veer = Math.atan2(-dx, -dz) - q.heading;
    q.heading += Math.atan2(Math.sin(veer), Math.cos(veer)) * damp(10, dt);
  }
  function startAttack(a, spec) {
    a.mode = 'windup'; a.t = 0; a.spec = spec;
    aimAt(a);
    run.attacking += 1;
    audio.warn();
    if (a.sperm) {
      a.sperm.face('angry');
      gfx.lookAtYou(a.sperm, D.POSE.rivalGlance);
      gfx.kick(a.sperm, FOES.windupKick);
    }
  }
  function stepAttack(a, spec, dt) {
    var r = run;
    a.t += dt;
    if (a.mode === 'windup') {
      if (a.t < spec.windup - FOES.aimLock) { aimAt(a); }
      if (a.sperm) { turnTo(a, Math.sin(a.aim), Math.cos(a.aim), dt); }
      gfx.telegraph(spec.shape, a.x, a.z, a.aim, spec.length, spec.width, Math.min(a.t / spec.windup, 1));
      gfx.alert(a.x, FOES.alertHeight, a.z);
      if (a.t >= spec.windup) {
        a.mode = spec.time ? 'strike' : 'recover';
        a.t = 0;
        spec.onStrike(a, spec);
      }
      return;
    }
    if (a.mode === 'strike') {
      var nx = a.x + Math.sin(a.aim) * spec.speed * dt, nz = a.z + Math.cos(a.aim) * spec.speed * dt;
      if (solidAt(nx, nz, 1.6) || a.t >= spec.time) { a.mode = 'recover'; a.t = 0; return; }
      a.x = nx; a.z = nz;
      if (Math.hypot(a.x - r.x, a.z - r.z) < spec.reach) {
        a.mode = 'recover'; a.t = 0;
        spec.onTouch(a);
      }
      return;
    }
    if (a.t >= spec.recover) {
      a.mode = 'idle'; a.t = 0;
      if (spec.onDone) { spec.onDone(a); }
    }
  }
  function tenseOf(it, spec) {
    if (it.mode === 'windup') { return it.t / spec.windup; }
    return it.mode === 'recover' ? -0.25 : 0;
  }

  function fireCone(a, spec) {
    var r = run, n = spec.shots;
    for (var i = 0; i < n && r.foeSpits.length < FOES.spitMax; i++) {
      var ang = a.aim + (n > 1 ? (i / (n - 1) * 2 - 1) * spec.spread : 0);
      r.foeSpits.push({ x: a.x, z: a.z, vx: Math.sin(ang) * spec.speed, vz: Math.cos(ang) * spec.speed, life: spec.life });
    }
    audio.spit();
  }
  function rivalLunges(q) {
    audio.lunge();
    gfx.kick(q.sperm, FOES.lungeKick);
  }
  function rivalRams(q) {
    if (!hit(FOES.strong[run.stage], 'rammed', q.x, q.z, FOES.ramKick)) { return; }
    q.gloat = FOES.gloat;
    gfx.lookAtYou(q.sperm, FOES.gloat);
    EG.ui.pop(gfx.project(run.x, 4, run.z), '¡EMBESTIDA!', '#ff8a6a', 40);
  }
  function rivalRests(q) {
    q.next = null;
    q.cool = rnd(FOES.cool[0], FOES.cool[1]);
  }
  function cellLands(it) {
    if (!hit(1, 'back', it.x, it.z, FOES.cell.kick)) { return; }
    bump('back');
    EG.ui.pop(gfx.project(run.x, 4, run.z), '¡PA TRÁS!', '#ff8a6a', 42);
  }
  var LUNGE = { shape: 'line', windup: 1, time: FOES.lungeTime, speed: 44, length: 24, width: FOES.hitRadius * 2, reach: FOES.hitRadius, recover: FOES.recover, onStrike: rivalLunges, onTouch: rivalRams, onDone: rivalRests };
  var POUNCE = { shape: 'line', windup: FOES.cell.windup, time: FOES.cell.time, speed: 38, length: 15, width: FOES.cell.reach * 2, reach: FOES.cell.reach, recover: FOES.cell.after, onStrike: function () { audio.lunge(); }, onTouch: cellLands };
  var GOB = { shape: 'cone', windup: 1, time: 0, speed: FOES.spit.speed, life: FOES.spit.life, length: FOES.spit.speed * FOES.spit.life, width: 8, shots: 1, spread: FOES.spit.spread, recover: FOES.recover, onStrike: fireCone, onDone: rivalRests };
  var DROPS = { shape: 'cone', windup: FOES.patrol.windup, time: 0, speed: FOES.patrol.dropSpeed, life: FOES.patrol.life, length: FOES.patrol.dropSpeed * FOES.patrol.life, width: 2 * FOES.patrol.dropSpeed * FOES.patrol.life * Math.sin(FOES.patrol.half), shots: FOES.patrol.drops, spread: FOES.patrol.half, recover: FOES.patrol.rest, onStrike: fireCone };

  /* A guard fights with the same moves, but its recovery is the opening and a ring is one more thing it can do. */
  var BOSS_LUNGE = Object.assign({}, LUNGE, { recover: GUARD.open, onDone: guardRests, reach: GUARD.touch, width: GUARD.touch * 2 });
  var BOSS_GOB = Object.assign({}, GOB, { recover: GUARD.open, onDone: guardRests, shots: GUARD.shots, spread: FOES.spit.fan });
  var BOSS_RING = { shape: 'circle', windup: FOES.ring.windup, time: 0, length: FOES.ring.radius * 2, width: FOES.ring.radius * 2, recover: GUARD.open, onStrike: guardRing, onDone: guardRests };
  var BOSS_MOVES = { lunge: BOSS_LUNGE, gob: BOSS_GOB, ring: BOSS_RING };

  /* Every game you finish, the body warns you a little later. */
  function windupFor(base) { return Math.max(base / (1 + LITTER.heat * save.won), LITTER.minWindup); }

  /* The numbers that depend on the stage or on how fast you have become. */
  function tuneFoes(r) {
    var s = r.stage, S = FOES.spit, lunge = clamp(r.st.speed * FOES.lungeRate, FOES.lungeMin, FOES.lungeMax);
    LUNGE.windup = GOB.windup = BOSS_LUNGE.windup = BOSS_GOB.windup = windupFor(FOES.windup[s]);
    POUNCE.windup = windupFor(FOES.cell.windup);
    DROPS.windup = windupFor(FOES.patrol.windup);
    BOSS_RING.windup = windupFor(FOES.ring.windup);
    LUNGE.speed = BOSS_LUNGE.speed = lunge;
    LUNGE.length = BOSS_LUNGE.length = lunge * LUNGE.time;
    POUNCE.speed = FOES.cell.pounce * r.st.speed;
    POUNCE.length = POUNCE.speed * POUNCE.time;
    GOB.shots = S.shots[s];
    GOB.spread = GOB.shots > 1 ? S.fan : S.spread;
    GOB.width = 2 * GOB.length * Math.sin(GOB.spread);
    BOSS_GOB.width = 2 * BOSS_GOB.length * Math.sin(BOSS_GOB.spread);
  }

  function updateSpin(it, dist, visible, dt) {
    var r = run, A = FOES.arms, R = FOES.ring, turn = clock * it.rate, nearest = 1e9;
    for (var a = 0; a < 3; a++) {
      var ang = turn + a * Math.PI * 2 / 3, ax = Math.sin(ang), az = Math.cos(ang);
      var along = clamp((r.x - it.x) * ax + (r.z - it.z) * az, 0, A.reach);
      nearest = Math.min(nearest, Math.hypot(r.x - it.x - ax * along, r.z - it.z - az * along));
    }
    if (nearest < A.width && hit(1, 'spin', it.x, it.z, A.kick)) {
      bump('aspa');
      EG.ui.pop(gfx.project(r.x, 4, r.z), '¡HOSTIÓN!', '#a9c8ff', 40);
    }
    if (it.charge > 0) {
      it.charge -= dt;
      gfx.telegraph('circle', it.x, it.z, 0, R.radius * 2, R.radius * 2, 1 - it.charge / BOSS_RING.windup);
      gfx.alert(it.x, FOES.alertHeight, it.z);
      if (it.charge <= 0) {
        it.ring = R.every;
        gfx.shockAt(it.x, it.z, R.radius);
        gfx.burst(it.x, 2, it.z, 40, 0xa9c8ff, 26);
        audio.bump();
        if (dist < R.radius && hit(1, 'spin', it.x, it.z, R.kick)) { bump('aspa'); }
      }
    } else if (r.stage >= R.from && !r.ghost && visible) {
      it.ring -= dt;
      if (it.ring <= 0) { it.charge = BOSS_RING.windup; audio.warn(); }
    }
    if (visible) { gfx.antibody(it.x, it.z, turn); }
  }

  /* A cell hunts until it tires, pounces when it is close and survives the hit: only a spit bursts it. */
  function updateCell(it, dist, visible, dt, n) {
    var r = run, st = r.st, C = FOES.cell, small = shrinker(r), radius = small ? it.r * small.cell : it.r;
    if (small && !r.ghost && dist < radius + 1.2) { burstFoe(it); return; }
    if (it.mode !== 'idle') {
      if (it.mode === 'windup' && !visible) { it.mode = 'idle'; } else { stepAttack(it, POUNCE, dt); }
    } else if (it.rest > 0) {
      it.rest -= dt;
    } else {
      if (dist < C.wake && visible && !r.ghost) { it.awake = true; }
      if (dist > C.sleep) { it.awake = false; }
      if (it.awake && !r.ghost) {
        it.chased += dt;
        if (it.chased > C.tire) {
          it.chased = 0; it.rest = C.rest;
        } else {
          var speed = Math.max(C.minChase, C.chase * st.speed), d = dist || 1;
          moveBody(it, (r.x - it.x) / d * speed * dt, (r.z - it.z) / d * speed * dt, it.r * 0.7);
          if (dist < C.gap && visible && canAttack()) { startAttack(it, POUNCE); }
        }
      }
      if (it.mode === 'idle' && dist < it.r + 1.2 && r.safe <= 0) {
        cellLands(it);
        it.mode = 'recover'; it.t = 0;
      }
    }
    if (visible) { gfx.villain('cell', it.x, it.z, radius, n, clock, it.rest > 0 ? -0.25 : tenseOf(it, POUNCE)); }
  }

  function updatePatrol(it, dist, visible, dt, n) {
    var r = run, P = FOES.patrol;
    if (it.mode !== 'idle') {
      if (it.mode === 'windup' && !visible) { it.mode = 'idle'; } else { stepAttack(it, DROPS, dt); }
    } else {
      var nx = it.x + it.vx * dt, nz = it.z + it.vz * dt;
      if (solidAt(nx, nz, it.r * 0.9)) { it.vx = -it.vx; it.vz = -it.vz; } else { it.x = nx; it.z = nz; }
      if (dist < P.gap && visible && canAttack()) { startAttack(it, DROPS); }
    }
    if (dist < it.r + 0.9 && hit(1, 'acid', it.x, it.z, P.kick)) { gfx.burst(r.x, 2, r.z, 12, 0xa8e83c, 8); }
    if (visible) { gfx.villain('patrol', it.x, it.z, it.r, n, clock, tenseOf(it, DROPS)); }
  }

  /* A puddle breathes: quiet, a circle fills as a warning, then it burns anyone still inside. */
  function updateAcid(it, dist, visible, dt, n) {
    var r = run, A = FOES.acid, radius = it.r * A.radius, cycle = A.rest + A.warn + A.on;
    it.t = (it.t + dt) % cycle;
    var warning = it.t - A.rest, burning = warning - A.warn, tense = -0.3;
    if (burning >= 0) {
      tense = 0.35;
      var inside = dist < radius && !r.ghost;
      it.soak = inside ? it.soak + dt : 0;
      if (visible) { gfx.telegraph('puddle', it.x, it.z, 0, radius * 2, radius * 2, 1); }
      if (inside) {
        gfx.burst(r.x, 2, r.z, 1, 0xa8e83c, 4);
        if (!it.touched) { it.touched = true; bump('acid'); }
      }
      if (it.soak > r.st.acidGrace) {
        it.soak = 0;
        hit(1, 'acid', it.x, it.z, A.kick);
      }
    } else {
      it.soak = 0;
      if (warning >= 0) {
        tense = warning / A.warn * 0.35;
        if (visible) { gfx.telegraph('circle', it.x, it.z, 0, radius * 2, radius * 2, warning / A.warn); }
      }
    }
    if (visible) { gfx.villain('acid', it.x, it.z, it.r, n, clock, tense); }
  }

  var HAZARDS = { spin: updateSpin, cell: updateCell, patrol: updatePatrol, acid: updateAcid };
  function updateHazards(dt) {
    var r = run;
    for (var n = 0; n < r.hazards.length; n++) {
      var it = r.hazards[n];
      if (it.alive) { HAZARDS[it.kind](it, Math.hypot(it.x - r.x, it.z - r.z), seen(r, it.x, it.z), dt, n); }
    }
  }

  /* Enemy spit shares one list, so a cap of drops is a cap on the screen. */
  function updateFoeSpits(dt) {
    var r = run, list = r.foeSpits, kept = 0;
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      p.life -= dt;
      p.x += p.vx * dt; p.z += p.vz * dt;
      if (p.life <= 0 || solidAt(p.x, p.z, 0.3)) { continue; }
      if (Math.hypot(p.x - r.x, p.z - r.z) < FOES.spitRadius && hit(1, 'acid', p.x, p.z, FOES.patrol.kick)) {
        if (r.ghost) { return; }
        continue;
      }
      list[kept++] = p;
      gfx.foeSpit(p.x, p.z);
    }
    list.length = kept;
  }

  function updateCurtains() {
    var r = run, st = r.st;
    r.curtains.forEach(function (it, n) {
      if (!it.alive) { return; }
      if (!r.ghost && Math.hypot(it.x - r.x, it.z - r.z) < 6.5) {
        r.slow = Math.min(r.slow, 1 - (1 - st.mucus) * 1.1 + 0.02);
        say('mucus');
        if (!it.touched) { it.touched = true; bump('moco'); }
      }
      if (known(r, it.x, it.z)) { gfx.curtain(it.x, it.z, it.wide, Math.sin(clock + n) * 0.3); }
    });
  }

  function rivalLimit(r) { return Math.min(FOES.rivals.max, FOES.rivals.base + Math.round(r.stage * FOES.rivals.perStage)); }

  /* Walking distance to the hero over the tiles, on arrays kept for it: a straight line would pin a hunter against the first wall. */
  function chartHero(r) {
    var m = r.maze, dist = r.toHero, queue = r.heroQueue, head = 0, tail = 0, start = m.at(tileOf(r.x), tileOf(r.z));
    dist.fill(-1);
    dist[start] = 0;
    queue[tail++] = start;
    while (head < tail) {
      var at = queue[head++], x = at % m.cols, y = (at - x) / m.cols;
      for (var i = 0; i < 4; i++) {
        var ax = x + EG.maze.DIRS[i][0], ay = y + EG.maze.DIRS[i][1];
        if (m.isOpen(ax, ay) && dist[m.at(ax, ay)] < 0) {
          dist[m.at(ax, ay)] = dist[at] + 1;
          queue[tail++] = m.at(ax, ay);
        }
      }
    }
  }

  function nextTile(q, field) {
    var m = run.maze, tx = tileOf(q.x), tz = tileOf(q.z), here = field[m.at(tx, tz)], best = null;
    for (var i = 0; i < 4; i++) {
      var ax = tx + EG.maze.DIRS[i][0], az = tz + EG.maze.DIRS[i][1];
      if (m.isOpen(ax, az) && field[m.at(ax, az)] >= 0 && field[m.at(ax, az)] < here) {
        here = field[m.at(ax, az)];
        best = [centre(ax), centre(az)];
      }
    }
    return best;
  }

  /* Rivals walk a flow field towards the exit, so they really race you through the maze; a mean one with its nerve back walks the one that leads to you. */
  function swimRival(o, gap, visible, dt) {
    var r = run, q = o.state, speed = r.st.speed * q.rate * (inherited().rivals || 1);
    q.stalk = Math.max(q.stalk - dt, 0);
    q.laneRest = Math.max(q.laneRest - dt, 0);
    q.heckle = gap < FOES.heckleGap ? 0 : Math.max(q.heckle - dt, 0);
    var stalking = q.mean && q.cool <= 0 && (q.stalk > 0 || (visible && gap < FOES.hunt));
    var hunting = !r.ghost && (stalking || q.heckle > 0);
    if (hunting !== q.hunting) { q.hunting = hunting; q.next = null; }
    if (!q.next || Math.hypot(q.next[0] - q.x, q.next[1] - q.z) < 1.2) {
      q.next = nextTile(q, hunting ? r.toHero : r.maze.toExit);
      if (!q.next) {
        if (!hunting) { placeRival(o); return; }
        q.next = [r.x, r.z];
      } else if (!hunting && q.laneRest <= 0) { keepLane(q); }
    }
    var dx = q.next[0] - q.x, dz = q.next[1] - q.z, d = Math.hypot(dx, dz) || 1, stepX = dx / d * speed * dt, stepZ = dz / d * speed * dt;
    if (q.laneRest <= 0 && solidAt(q.x + stepX, q.z + stepZ, PLACE.laneGuard)) {
      q.laneRest = PLACE.laneBack;
      q.next = null;
      return;
    }
    q.x += stepX; q.z += stepZ;
    turnTo(q, dx, dz, dt);
    keepApart(q, dt);
  }

  /* A racer holds its own side of the passage, as long as that side does not take it further from the exit. */
  function keepLane(q) {
    var m = run.maze, nx = tileOf(q.next[0]), nz = tileOf(q.next[1]), sx = nx - tileOf(q.x), sz = nz - tileOf(q.z);
    if (m.clear[m.at(nx, nz)] < PLACE.minClear) { return; }
    var x = q.next[0] - sz * q.lane, z = q.next[1] + sx * q.lane;
    if (solidAt(x, z, 1.6) || m.toExit[m.at(tileOf(x), tileOf(z))] > m.toExit[m.at(nx, nz)]) { return; }
    q.next[0] = x;
    q.next[1] = z;
  }
  function keepApart(q, dt) {
    var limit = rivalLimit(run);
    for (var i = 0; i < limit; i++) {
      var p = gfx.rivals[i].state;
      if (!p || p === q || p.mode !== 'idle' || p.down > 0) { continue; }
      var dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz);
      if (d > 0.01 && d < PLACE.repel) {
        var push = (PLACE.repel - d) * PLACE.repelRate * dt / d;
        moveBody(q, dx * push, dz * push, 1.6);
      }
    }
  }

  function taunt(o, priority, line) {
    bubbleGap = FOES.tauntGap / (inherited().taunts || 1);
    o.state.talk = rnd(FOES.talk[0], FOES.talk[1]);
    if (!EG.ui.bubble(line || game.insult(), o, priority)) { return; }
    gfx.lookAtYou(o, D.POSE.rivalGlance);
    audio.tone(240, 0.1, 'square', 0.03, 180);
  }

  function rivalPicksFight(o, gap) {
    var q = o.state, S = FOES.spit;
    if (q.mode !== 'idle' || !q.mean || q.cool > 0 || !canAttack()) { return; }
    if (q.spitter && gap >= S.gapMin && gap <= S.gapMax) { startAttack(q, GOB); }
    else if (gap < FOES.gap) { startAttack(q, LUNGE); }
    else { return; }
    if (bubbleGap <= 0) { taunt(o, 2); }
  }

  function rivalFace(o, q, gap) {
    if (q.mode === 'recover') { o.face(q.gloat > 0 ? 'happy' : 'hurt'); return; }
    if (q.mode !== 'idle') { o.face('angry'); return; }
    o.face(gap < D.POSE.angryRange ? 'angry' : 'neutral');
  }

  /* The way to the guard's door runs past the guard: it waits until you see it, then the fight starts and that spot becomes the checkpoint. */
  function openFight(r, o) {
    var g = r.guard, q = o.state;
    g.fighting = true;
    r.respawn.x = r.x; r.respawn.z = r.z;
    gfx.setCheckpoint(r.x, r.z);
    q.rest = GUARD.rest;
    EG.ui.guardBar(g.name, 1);
    taunt(o, 2, game.voice(pick(g.lines)));
    callGap = 0;
    say('guard', g.name);
    shake(0.3);
  }
  function guardNear(r, q) {
    var steps = r.toHero[r.maze.at(tileOf(q.x), tileOf(q.z))];
    return steps >= 0 && steps * TILE < GUARD.fight;
  }
  function guardStalks(q, gap, dt) {
    var r = run, speed = r.st.speed * GUARD.chase;
    if (gap < GUARD.hold) {
      q.next = null;
      turnTo(q, r.x - q.x, r.z - q.z, dt);
      return;
    }
    if (!q.next || Math.hypot(q.next[0] - q.x, q.next[1] - q.z) < 1.2) { q.next = nextTile(q, r.toHero) || [r.x, r.z]; }
    var dx = q.next[0] - q.x, dz = q.next[1] - q.z, d = Math.hypot(dx, dz) || 1;
    moveBody(q, dx / d * speed * dt, dz / d * speed * dt, 1.6);
    turnTo(q, dx, dz, dt);
  }
  /* Moves come in the order the stage lists them; a ring needs you close, so far away it turns into a lunge. */
  function guardAttacks(o, gap) {
    var g = run.guard, q = o.state, move = g.moves[g.turn % g.moves.length];
    g.turn += 1;
    startAttack(q, BOSS_MOVES[move === 'ring' && gap > GUARD.ringRange ? 'lunge' : move]);
    if (bubbleGap <= 0) { taunt(o, 2, game.voice(pick(g.lines))); }
  }
  function guardRests(q) { q.rest = GUARD.rest; q.next = null; }
  function guardRing(q) {
    var R = FOES.ring;
    gfx.shockAt(q.x, q.z, R.radius);
    gfx.burst(q.x, 2, q.z, 40, 0xff8a6a, 26);
    audio.bump();
    if (Math.hypot(q.x - run.x, q.z - run.z) < R.radius) { hit(FOES.strong[run.stage], 'rammed', q.x, q.z, R.kick); }
  }
  /* Only while it catches its breath: a spit or a sprint takes one bar off, and it shakes it off at once. */
  function hurtGuard(o) {
    var r = run, g = r.guard, q = o.state;
    g.hp -= 1;
    q.mode = 'idle'; q.t = 0; q.next = null; q.rest = GUARD.stagger;
    gfx.kick(o, FOES.windupKick);
    gfx.burst(q.x, 3, q.z, 40, 0xff8a6a, 18);
    hitstop = LIVES.hitstop;
    shakeAfter = 0.4;
    audio.guardHit();
    EG.ui.guardBar(g.name, g.hp / g.max);
    if (g.hp <= 0) { beatGuard(o); return; }
    EG.ui.pop(gfx.project(q.x, 6, q.z), '¡TOMA! ' + g.hp + ' de ' + g.max, '#ffc94d', 34);
  }
  function beatGuard(o) {
    var r = run, g = r.guard, q = o.state, prize = (GUARD.pay + GUARD.payPerStage * r.stage) * r.st.sugar, m = r.maze;
    q.boss = false;
    q.name = null;
    q.nameOut = true;
    q.down = 2.4;
    o.face('dead');
    earn(prize);
    bump('guard');
    grantBoon(r);
    EG.ui.guardBar();
    gfx.setPortal(0, true, centre(m.exit[0]), centre(m.exit[1]), true);
    callGap = 0;
    say('guardDown');
    celebrate('¡' + g.name.toUpperCase() + ' FUERA!', '+' + game.fmt(prize) + ' ATP. La salida está abierta');
  }
  function guardGoesHome(r) {
    if (!r.guard || r.guard.hp <= 0) { return; }
    var q = gfx.rivals[0].state;
    q.x = r.guard.x; q.z = r.guard.z;
    q.next = null;
    q.rest = GUARD.rest;
  }
  function updateGuard(o, dt) {
    var r = run, q = o.state, g = r.guard, gap = Math.hypot(q.x - r.x, q.z - r.z), visible = seen(r, q.x, q.z);
    if (q.gloat > 0) { q.gloat -= dt; }
    if (!g.fighting) {
      if (visible && !r.ghost && guardNear(r, q)) { openFight(r, o); }
    } else if (q.mode !== 'idle') {
      stepAttack(q, q.spec, dt);
    } else if (!r.ghost) {
      q.rest -= dt;
      guardStalks(q, gap, dt);
      if (q.rest <= 0 && gap < GUARD.engage && canAttack()) { guardAttacks(o, gap); }
    }
    visible = seen(r, q.x, q.z);
    o.body.visible = !!visible;
    if (!visible) { return; }
    gap = Math.hypot(q.x - r.x, q.z - r.z);
    gfx.pose(o, q.x, q.z, q.heading, 2, dt);
    o.tick(dt);
    rivalFace(o, q, gap);
    if (q.mode === 'recover' && !g.hinted) {
      g.hinted = true;
      EG.ui.toast(GUARD.hint[0], GUARD.hint[1]);
    }
    if (r.ghost || !g.fighting || gap >= GUARD.touch) { return; }
    if (q.mode === 'recover') {
      if (r.sprint > 0.5) {
        var d = gap || 1;
        r.kx = (r.x - q.x) / d * GUARD.bounce; r.kz = (r.z - q.z) / d * GUARD.bounce;
        r.safe = Math.max(r.safe, GUARD.afterHit);
        hurtGuard(o);
      }
    } else if (q.mode !== 'strike') {
      rivalRams(q);
    }
  }
  /* A spit always lands; it only hurts in the opening. */
  function spitGuard(o) {
    var q = o.state;
    if (run.guard.fighting && q.mode === 'recover') { hurtGuard(o); return; }
    EG.ui.pop(gfx.project(q.x, 6, q.z), '¡Ni cosquillas!', '#fbf1e3', 26);
  }

  function updateRival(o, dt) {
    var r = run, q = o.state;
    if (q.boss) { updateGuard(o, dt); return; }
    var gap = Math.hypot(q.x - r.x, q.z - r.z), wasVisible = seen(r, q.x, q.z), small = wasVisible ? shrinker(r) : null;
    q.cool -= dt;
    q.talk -= dt;
    if (q.gloat > 0) { q.gloat -= dt; }
    if (q.down <= 0) {
      o.size = small ? small.size : D.POSE.rivalSize;
      if (small && !r.ghost && gap < 3) { knockDown(o, true); }
    }
    if (q.down > 0) {
      q.down -= dt;
      o.body.rotation.z += dt * 12;
      if (q.down <= 0) { placeRival(o); }
    } else if (q.mode === 'idle') {
      swimRival(o, gap, wasVisible, dt);
    } else {
      stepAttack(q, q.spec, dt);
    }
    var visible = seen(r, q.x, q.z);
    o.body.visible = !!visible;
    if (!visible) {
      if (q.mode === 'windup') { q.mode = 'idle'; rivalRests(q); }
      return;
    }
    gap = Math.hypot(q.x - r.x, q.z - r.z);
    gfx.pose(o, q.x, q.z, q.heading, 2, dt);
    o.tick(dt);
    if (q.down > 0) { return; }
    rivalFace(o, q, gap);
    q.lookWait -= dt;
    if (q.lookWait <= 0 && gap < D.POSE.rivalLookRange) {
      q.lookWait = rnd(D.POSE.rivalEvery[0], D.POSE.rivalEvery[1]);
      gfx.lookAtYou(o, D.POSE.rivalGlance);
    }
    if (r.ghost) { return; }
    var open = q.mode === 'idle' || q.mode === 'recover';
    if (open && gap < 3) {
      if (q.mode === 'recover' && r.sprint > 0.5) { knockDown(o, true); return; }
      if (!q.passed) {
        q.passed = true;
        bump('passed');
        earn(2 * r.st.sugar);
        audio.tone(520 + rnd(0, 180), 0.07, 'triangle', 0.07, 900);
        EG.ui.pop(gfx.project(q.x, 4, q.z), q.name ? '¡' + q.name + ' fuera!' : '¡ADELANTADO!', '#fbf1e3', q.name ? 30 : 24);
        if (q.name && !q.nameOut) { q.nameOut = true; say('pass', q.name); earn(12 * r.st.sugar); }
      }
    }
    rivalPicksFight(o, gap);
    if (gap < FOES.tauntRange * (inherited().taunts || 1) && q.talk <= 0 && bubbleGap <= 0) { taunt(o, 1); }
  }

  /* Nobody near for a while: send a mean one round from up ahead, so a quiet patch never lasts. */
  function directRivals(dt) {
    var r = run, m = r.maze, limit = rivalLimit(r), i, q, alone = true;
    r.chartTime -= dt;
    if (r.chartTime <= 0 && !r.ghost) {
      r.chartTime = FOES.chartEvery;
      chartHero(r);
    }
    for (i = 0; i < limit && alone; i++) {
      q = gfx.rivals[i].state;
      if (q && q.down <= 0 && Math.hypot(q.x - r.x, q.z - r.z) < FOES.nearby) { alone = false; }
    }
    r.lonely = alone ? r.lonely + dt : 0;
    if (r.ghost || r.lonely < FOES.director[r.stage]) { return; }
    r.lonely = 0;
    var ahead = m.toExit[m.at(tileOf(r.x), tileOf(r.z))];
    for (var tries = 0; tries < FOES.directorTries; tries++) {
      var t = pick(m.floors), x = centre(t[0]), z = centre(t[1]), tile = m.at(t[0], t[1]), d = r.toHero[tile] * TILE;
      if (d < FOES.directorMin || d > FOES.directorMax || r.visible[tile] || m.toExit[tile] >= ahead) { continue; }
      for (i = 0; i < limit; i++) {
        q = gfx.rivals[i].state;
        if (q && !q.boss && q.down <= 0 && q.mode === 'idle' && !gfx.rivals[i].body.visible) {
          q.x = x; q.z = z; q.next = null; q.hunting = false; q.mean = true; q.cool = 0; q.stalk = FOES.stalk; q.talk = 0;
          EG.ui.hush(gfx.rivals[i]);
          return;
        }
      }
      return;
    }
  }

  /* The cave is huge and the race is not: a rival far away and out of sight is sent to come and have a word. */
  function gatherCrowd(dt) {
    var r = run, m = r.maze, limit = rivalLimit(r), near = 0, spare = null, i, q;
    r.crowdTime -= dt;
    if (r.crowdTime > 0 || r.ghost) { return; }
    r.crowdTime = FOES.crowdEvery;
    for (i = 0; i < limit; i++) {
      q = gfx.rivals[i].state;
      if (!q || q.boss || q.down > 0) { continue; }
      if (Math.hypot(q.x - r.x, q.z - r.z) < FOES.nearby) { near += 1; }
      else if (q.mode === 'idle' && !gfx.rivals[i].body.visible) { spare = gfx.rivals[i]; }
    }
    if (near >= FOES.crowd[r.stage] || !spare) { return; }
    for (var tries = 0; tries < FOES.directorTries; tries++) {
      var t = pick(m.floors), tile = m.at(t[0], t[1]), d = r.toHero[tile] * TILE;
      if (d < FOES.directorMin || d > FOES.directorMax || r.visible[tile]) { continue; }
      q = spare.state;
      q.x = centre(t[0]); q.z = centre(t[1]); q.next = null; q.hunting = false; q.heckle = FOES.heckle; q.talk = 0;
      EG.ui.hush(spare);
      return;
    }
  }

  function updateRivals(dt) {
    var limit = rivalLimit(run);
    directRivals(dt);
    gatherCrowd(dt);
    for (var n = 0; n < gfx.rivals.length; n++) {
      var o = gfx.rivals[n];
      if (!o.state) { continue; }
      if (n >= limit) { o.body.visible = false; continue; }
      updateRival(o, dt);
    }
  }

  /* A spit does it from afar; a sprint into one still catching its breath does it by hand. */
  function knockDown(o, bySprint) {
    var r = run, q = o.state;
    q.down = 2.4;
    q.mode = 'idle';
    o.face('dead');
    gfx.burst(q.x, 2, q.z, 30, 0xd9f7c8, 15);
    EG.ui.pop(gfx.project(q.x, 4, q.z), '¡DERRIBADO!', '#d9f7c8', 34);
    shake(0.3);
    audio.bump();
    earn(6 * r.st.sugar);
    say('down');
    if (!bySprint) { bump('spat'); }
    if (!q.passed) { q.passed = true; bump('passed'); }
    for (var n = 0; n < FOES.bonusSugar; n++) {
      var x = q.x + rnd(-3, 3), z = q.z + rnd(-3, 3), blocked = solidAt(x, z, 0.8);
      r.sugar.push({ x: blocked ? q.x : x, z: blocked ? q.z : z, alive: true, bonus: true });
    }
  }

  function burstFoe(it) {
    var r = run;
    it.alive = false;
    bump('burst');
    gfx.burst(it.x, 2, it.z, 40, it.kind === 'curtain' ? 0xe0ae3c : 0xffd4da, 16);
    earn(30 * r.st.sugar);
    EG.ui.pop(gfx.project(it.x, 4, it.z), '¡REVENTADO! +' + game.fmt(30 * r.st.sugar), '#ff8a6a', 32);
    shake(0.4);
    audio.bump();
  }

  function updateSpits(dt) {
    var r = run, live = [];
    r.spitCool = Math.max(r.spitCool - dt, 0);
    r.spits.forEach(function (p) {
      p.life -= dt;
      p.x += p.vx * dt; p.z += p.vz * dt;
      var hit = solidAt(p.x, p.z, 0.3);
      gfx.rivals.forEach(function (o) {
        var q = o.state;
        if (hit || !q || !o.body.visible || q.down > 0) { return; }
        if (Math.hypot(q.x - p.x, q.z - p.z) < (q.boss ? GUARD.touch : 2.6)) {
          hit = true;
          if (q.boss) { spitGuard(o); } else { knockDown(o); }
        }
      });
      r.hazards.concat(r.curtains).forEach(function (it) {
        if (hit || !it.alive || it.kind === 'acid' || it.kind === 'patrol') { return; }
        if (Math.hypot(it.x - p.x, it.z - p.z) < (it.kind === 'curtain' ? 7 : 3.4)) {
          hit = true;
          burstFoe(it);
        }
      });
      if (hit || p.life <= 0) { return; }
      live.push(p);
      gfx.spit(p.x, p.z);
    });
    r.spits = live;
  }

  function updateEgg(dt) {
    var r = run;
    r.eggTime -= dt;
    r.eggHp = Math.min(100, r.eggHp + dt * 3);
    r.x += (r.eggX - r.x) * damp(8, dt);
    r.z += (r.eggZ - r.z) * damp(8, dt);
    EG.ui.mashValue(clamp(1 - r.eggHp / 100, 0, 1));
    gfx.eggShake(0.1 + trauma * 0.5, clock);
    if (r.eggHp <= 0 && !r.won) {
      r.won = true;
      phase = 'ending';
      awardMedal(r);
      bump('won');
      save.stage = 0;
      save.seed += 1;
      save.wipes = {};
      save.lives = stats().lives;
      game.persist();
      EG.ui.mash(false);
      EG.ui.ending();
    } else if (r.eggTime <= 0) {
      EG.ui.mash(false);
      gfx.setEgg(false);
      phase = 'race';
      celebrate('¡REBOTADO!', 'La membrana aguanta. Sube el Acrosoma y otra vez, coño');
      loseLife();
    }
  }

  /* Stopped or nearly stopped, the hero remembers there is someone watching. */
  function heroGlances(r, dt) {
    var P = D.POSE, h = gfx.hero, calm = Math.hypot(r.vx, r.vz) < P.idleSpeed;
    r.idle = calm ? r.idle + dt : 0;
    if (!calm) { r.idleLooked = false; }
    if (r.idle > P.idleLook && !r.idleLooked) { r.idleLooked = true; gfx.lookAtYou(h, P.heroGlance); }
    r.lookWait -= dt;
    if (calm && r.lookWait <= 0) {
      r.lookWait = rnd(P.heroEvery[0], P.heroEvery[1]);
      gfx.lookAtYou(h, P.heroGlance);
    }
  }

  function heroPose(dt) {
    var r = run, h = gfx.hero;
    heroGlances(r, dt);
    h.size = D.POSE.heroSize;
    h.spring.want = 1 + D.POSE.sprintStretch * r.sprint;
    gfx.pose(h, r.x, r.z, r.heading, r.hy, dt);
    h.body.visible = r.safe <= 0 || r.ghost || Math.floor(clock * LIVES.blinkRate * 2) % 2 === 0;
    h.head.scale.setScalar(1 + punch * 0.3);
    h.tailRate.value = 10 + r.sprint * 14 + Math.min(Math.hypot(r.vx, r.vz), 20) * 0.4;
    var mood = r.ghost ? 'scared' : r.hurt > 0 ? 'hurt' : r.tired ? 'dead' : r.energy < r.st.energy * 0.22 ? 'scared' : r.gulp > 0 || r.mult >= 3 ? 'happy' : r.sprint > 0.5 ? 'angry' : r.idle > D.POSE.idleLook ? 'smug' : 'neutral';
    h.face(mood); gfx.portrait.face(mood);
    h.tick(dt); gfx.portrait.tick(dt);
    h.look(clamp(r.vx * 0.016, -0.4, 0.4), clamp(-r.vz * 0.016, -0.3, 0.3));
    gfx.allies.forEach(function (a, n) {
      a.body.visible = n < r.allies;
      if (a.body.visible) {
        var ang = clock * 2.1 + n * 6.283 / Math.max(r.allies, 1);
        gfx.pose(a, r.x + Math.cos(ang) * 4, r.z + Math.sin(ang) * 4, Math.PI - ang, 2, dt);
        a.tick(dt);
      }
    });
  }

  var camX = 0, camZ = 0;
  var view = { stage: 0, time: 0, dt: 0, real: 0, beat: 0, camera: {}, flash: 0, fade: 1, hero: { x: 0, z: 0 }, pip: { yaw: 0, pitch: 0, roll: 0, y: 0, lookX: 0, lookY: 0, tail: 13 } };

  function prepareTitle() {
    var maze = EG.maze.build(84, 60, 4242, {});
    gfx.buildStage(maze, 0);
    var open = new Uint8Array(maze.cols * maze.rows).fill(1);
    gfx.updateFog(open, open, 1);
    gfx.hero.body.visible = true;
    gfx.setPortal(0, false, 0, 0); gfx.setPortal(1, false, 0, 0);
    gfx.setEgg(false);
    camX = maze.cols * TILE / 2; camZ = maze.rows * TILE / 2;
  }

  function titlePose(dt) {
    var h = gfx.hero;
    h.size = D.POSE.titleSize;
    h.spring.want = 1;
    h.glance = 1;
    h.glanceTime = 1;
    gfx.pose(h, camX + 11, camZ + 1, Math.PI + Math.sin(clock * 0.5) * 0.3, 7, dt);
    h.head.scale.setScalar(1);
    h.face('smug');
    h.tick(dt);
    h.tailRate.value = 9;
  }

  var lastFrame = 0, smoothDt = 1 / 60;

  function frame(now) {
    var raw = Math.min((now - lastFrame) / 1000 || 0, 0.1);
    lastFrame = now;
    smoothDt += (Math.min(raw, 0.05) - smoothDt) * 0.25;
    var real = smoothDt;
    EG.ui.tick(real);
    var paused = EG.ui.blocking() && phase !== 'title';
    var dt = paused ? 0 : real;
    if (hitstop > 0 && !paused) {
      hitstop -= real; dt *= 0.2;
      if (hitstop <= 0 && shakeAfter) { shake(shakeAfter); shakeAfter = 0; }
    }
    if (!paused) { clock += real; }
    trauma = Math.max(trauma - real * 1.5, 0);
    flash = Math.max(flash - real * 2, 0);
    punch = Math.max(punch - real * 5, 0);
    if (callGap > 0) { callGap -= real; }
    if (bubbleGap > 0) { bubbleGap -= real; }
    if (phase === 'race' || phase === 'egg') {
      var income = stats().passive;
      if (income > 0) { earn(income * real); }
    }
    if (!paused) {
      if (phase === 'race') { updateRace(dt); }
      else if (phase === 'down') { updateDown(dt); }
      else if (phase === 'egg') { updateEgg(dt); }
      if (cheerGap > 0) { cheerGap -= real; }
      if (cheers.length && cheerGap <= 0 && phase === 'race') {
        var cheer = cheers.shift();
        cheerGap = HUD.cheerGap;
        EG.ui.toast(cheer.title, cheer.sub);
        audio.tone(880, 0.12, 'triangle', 0.08, 1320);
      }
    }
    if (phase === 'title') { titlePose(real); }
    else if (run && phase !== 'ending') { heroPose(dt); }
    heartTimer += paused ? 0 : real;
    var low = run && (run.energy < run.st.energy * 0.22 || run.hearts === 1);
    if (heartTimer > (low ? 0.5 : 0.86)) {
      heartTimer = 0;
      beat = 1;
      if (!paused) { audio.beat(low); }
    }
    beat = Math.max(beat - real * 3.4, 0);
    saveTimer += real;
    if (run && saveTimer > 5) { saveTimer = 0; game.persist(); }

    var wobble = EG.ui.settings().shake ? trauma * trauma * 1.2 : 0;
    if (run) {
      camX += (run.x + run.vx * 0.22 - camX) * damp(5, real);
      camZ += (run.z + run.vz * 0.22 - camZ) * damp(5, real);
    }
    view.camera.x = camX + Math.sin(clock * 47) * wobble;
    view.camera.y = run ? 112 : 70;
    view.camera.z = camZ + (run ? 62 : 40) + Math.cos(clock * 53) * wobble;
    view.camera.lx = camX; view.camera.lz = camZ;
    view.stage = run ? run.stage : 0;
    view.time = clock; view.dt = dt; view.real = real; view.beat = beat; view.flash = flash;
    view.fade = phase === 'ending' ? 0.2 : 1;
    view.hero.x = run ? run.x : camX; view.hero.z = run ? run.z : camZ;
    if (run) {
      view.pip.yaw = Math.sin(clock * 1.3) * 0.16 - clamp(run.vx * 0.02, -0.5, 0.5);
      view.pip.pitch = Math.sin(clock * 1.9) * 0.05 + clamp(run.vz * 0.01, -0.3, 0.3);
      view.pip.roll = Math.sin(clock * 1.1) * 0.03;
      view.pip.y = Math.sin(clock * 5.5) * 0.06 + punch * 0.12;
      view.pip.lookX = clamp(run.vx * 0.016, -0.4, 0.4);
      view.pip.lookY = clamp(-run.vz * 0.016, -0.3, 0.3);
      view.pip.tail = 10 + run.sprint * 12;
    }
    gfx.render(view, EG.ui.pipBox());
    EG.ui.hud(dt);
    requestAnimationFrame(frame);
  }

  /* Console hooks for checking the game by hand; the other builders extend this. */
  game.debug = {
    warp: function (stage) { if (run) { enterStage(clamp(stage, 0, STAGES.length - 1)); } },
    tp: function (x, z) { if (run) { run.x = x; run.z = z; run.vx = run.vz = 0; run.path = null; camX = x; camZ = z; } },
    atp: function (amount) { earn(amount); },
    hurt: function (hearts) { if (run) { run.safe = 0; hit(hearts, 'back', run.x + 1, run.z, 30); } },
    lives: function (amount) { save.lives = amount; },
    cheer: function (title, sub) { cheers.push({ title: title, sub: sub }); },
    attack: function (actor, name) { startAttack(actor, { lunge: LUNGE, pounce: POUNCE, gob: GOB, drops: DROPS }[name]); },
    boon: function (index) { if (run) { save.boons = index; grantBoon(run); } },
    finish: function () { if (run) { finishStage(run); } },
    win: function () { if (run) { run.eggX = run.x; run.eggZ = run.z; run.eggTime = 11; run.eggHp = -1; phase = 'egg'; } },
    state: function () {
      return { phase: phase, stage: run ? run.stage : save.stage, x: run && run.x, z: run && run.z, heading: run && run.heading, atp: save.atp, hearts: run && run.hearts, maxHearts: run && run.maxHearts, lives: save.lives, safe: run && run.safe, ghost: run && run.ghost, attacking: run && run.attacking, foeSpits: run && run.foeSpits.length, hero: { side: gfx.hero.side, roll: gfx.hero.roll, glance: gfx.hero.glance, k: gfx.hero.spring.k } };
    }
  };

  /* Back to the start of the same stage after the obituary: same cave, sugar back, map kept, nothing else lost. */
  game.retry = function () {
    enterStage(run.stage, { retry: true });
    phase = 'race';
  };

  game.boot = function () {
    gfx.resize();
    if (save.sex) { gfx.setSex(save.sex); }
    prepareTitle();
    requestAnimationFrame(frame);
  };

  game.progress = function () {
    var r = run;
    return clamp(r ? (r.stage + r.discovered / r.openable) / STAGES.length : save.stage / STAGES.length, 0, 1);
  };
  game.rank = function () {
    return Math.max(1, Math.round(D.RIVALS_TOTAL * Math.exp(-Math.log(D.RIVALS_TOTAL) * Math.pow(game.progress(), 1.15))));
  };

  return game;
})();
