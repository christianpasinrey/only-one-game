/* Seeded cave generation: pure data, no graphics. Chambers joined by winding tunnels, then grown organic. */
EG.maze = (function () {
  'use strict';

  function random(seed) {
    var state = seed >>> 0 || 1;
    return function () {
      state ^= state << 13; state >>>= 0;
      state ^= state >>> 17;
      state ^= state << 5; state >>>= 0;
      return state / 4294967296;
    };
  }
  function shuffle(list, rnd) {
    for (var i = list.length - 1; i > 0; i--) {
      var k = Math.floor(rnd() * (i + 1)), t = list[i];
      list[i] = list[k]; list[k] = t;
    }
    return list;
  }
  var DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  function build(cols, rows, seed, options) {
    var rnd = random(seed), wall = new Uint8Array(cols * rows).fill(1);
    function at(x, y) { return x + y * cols; }
    function inside(x, y) { return x > 2 && y > 2 && x < cols - 3 && y < rows - 3; }
    function isOpen(x, y) { return x >= 0 && y >= 0 && x < cols && y < rows && !wall[at(x, y)]; }
    function range(a, b) { return a + rnd() * (b - a); }
    function disc(cx, cy, radius) {
      var r = Math.ceil(radius);
      for (var y = -r; y <= r; y++) {
        for (var x = -r; x <= r; x++) {
          var px = Math.round(cx) + x, py = Math.round(cy) + y;
          if (inside(px, py) && x * x + y * y <= radius * radius) { wall[at(px, py)] = 0; }
        }
      }
    }
    /* A chamber is a ragged blob: its radius wobbles around the circle. */
    function chamber(cx, cy, radius) {
      var a = range(0, 6.28), b = range(0, 6.28), steps = 26;
      disc(cx, cy, radius * 0.7);
      for (var i = 0; i < steps; i++) {
        var ang = i / steps * 6.283, wob = radius * (0.72 + 0.28 * Math.sin(ang * 3 + a) + 0.16 * Math.sin(ang * 5 + b));
        disc(cx + Math.cos(ang) * wob * 0.62, cy + Math.sin(ang) * wob * 0.62, radius * 0.42);
      }
    }
    /* A tunnel wanders towards its goal and breathes: sometimes a squeeze, sometimes a wide belly. */
    function tunnel(ax, ay, bx, by, wide) {
      var x = ax, y = ay, heading = Math.atan2(by - ay, bx - ax), phase = range(0, 6.28), guard = 0;
      while (Math.hypot(bx - x, by - y) > 2 && guard++ < 400) {
        var wanted = Math.atan2(by - y, bx - x), diff = Math.atan2(Math.sin(wanted - heading), Math.cos(wanted - heading));
        heading += diff * 0.22 + range(-0.42, 0.42);
        x += Math.cos(heading) * 1.3;
        y += Math.sin(heading) * 1.3;
        phase += 0.2;
        disc(x, y, wide * (0.86 + 0.26 * Math.sin(phase)));
      }
    }

    var nodes = [], spanX = 24, spanY = 22, gx, gy;
    for (gy = 0; gy * spanY + 8 < rows; gy++) {
      for (gx = 0; gx * spanX + 8 < cols; gx++) {
        if (rnd() < 0.8) {
          nodes.push({ x: 7 + gx * spanX + range(-2.5, 2.5) + spanX / 2 - 7, y: 7 + gy * spanY + range(-2.5, 2.5) + spanY / 2 - 7, r: range(7.5, 11.5), degree: 0 });
        }
      }
    }
    if (nodes.length < 3) { nodes.push({ x: cols / 2, y: rows / 2, r: 6, degree: 0 }); }
    nodes.forEach(function (n) {
      n.x = Math.min(Math.max(n.x, 11), cols - 11);
      n.y = Math.min(Math.max(n.y, 11), rows - 11);
      chamber(n.x, n.y, n.r);
    });
    /* Prim over the chambers, then a few extra links so there are several ways round. */
    var joined = [nodes[0]], left = nodes.slice(1), links = [];
    while (left.length) {
      var best = null, bestD = 1e9;
      joined.forEach(function (a) {
        left.forEach(function (b) {
          var d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < bestD) { bestD = d; best = [a, b]; }
        });
      });
      links.push(best);
      joined.push(best[1]);
      left.splice(left.indexOf(best[1]), 1);
    }
    nodes.forEach(function (a) {
      nodes.forEach(function (b) {
        if (a !== b && rnd() < 0.08 && Math.hypot(a.x - b.x, a.y - b.y) < 26) { links.push([a, b]); }
      });
    });
    links.forEach(function (l) {
      l[0].degree++; l[1].degree++;
      tunnel(l[0].x, l[0].y, l[1].x, l[1].y, range(4.6, 7));
    });
    /* Blind pockets: this is where the map hides its rewards. */
    var pockets = [];
    function solidAround(px, py, radius) {
      for (var ty = -radius; ty <= radius; ty++) {
        for (var tx = -radius; tx <= radius; tx++) {
          if (!inside(px + tx, py + ty) || !wall[at(px + tx, py + ty)]) { return false; }
        }
      }
      return true;
    }
    for (var tries = 0; tries < 500 && pockets.length < 12; tries++) {
      var px = Math.round(range(5, cols - 5)), py = Math.round(range(5, rows - 5));
      if (!solidAround(px, py, 4)) { continue; }
      var near = nodes.slice().sort(function (a, b) { return Math.hypot(a.x - px, a.y - py) - Math.hypot(b.x - px, b.y - py); })[0];
      tunnel(near.x, near.y, px, py, range(2.6, 3.2));
      chamber(px, py, range(4, 5.2));
      pockets.push([px, py]);
    }

    /* Two growth passes melt straight lines into something that looks alive. */
    for (var pass = 0; pass < 2; pass++) {
      var next = wall.slice(), x, y;
      for (y = 1; y < rows - 1; y++) {
        for (x = 1; x < cols - 1; x++) {
          var count = 0;
          for (var dy = -1; dy <= 1; dy++) { for (var dx = -1; dx <= 1; dx++) { count += wall[at(x + dx, y + dy)]; } }
          next[at(x, y)] = count >= 5 ? 1 : 0;
        }
      }
      wall = next;
    }

    function distanceFrom(sx, sy) {
      var dist = new Int32Array(cols * rows).fill(-1), queue = [[sx, sy]];
      dist[at(sx, sy)] = 0;
      for (var i = 0; i < queue.length; i++) {
        var q = queue[i];
        DIRS.forEach(function (v) {
          var ax = q[0] + v[0], ay = q[1] + v[1];
          if (isOpen(ax, ay) && dist[at(ax, ay)] < 0) {
            dist[at(ax, ay)] = dist[at(q[0], q[1])] + 1;
            queue.push([ax, ay]);
          }
        });
      }
      return dist;
    }
    /* How many tiles each open tile sits from the nearest wall: placement reads this instead of guessing. */
    function clearance() {
      var clear = new Uint8Array(cols * rows), queue = new Int32Array(cols * rows), head = 0, tail = 0, n;
      for (n = 0; n < cols * rows; n++) {
        if (wall[n]) { queue[tail++] = n; }
      }
      while (head < tail) {
        var cell = queue[head++], cx = cell % cols, cy = (cell - cx) / cols;
        for (var d = 0; d < 4; d++) {
          var ax = cx + DIRS[d][0], ay = cy + DIRS[d][1];
          if (isOpen(ax, ay) && !clear[at(ax, ay)]) {
            clear[at(ax, ay)] = Math.min(clear[cell] + 1, 255);
            queue[tail++] = at(ax, ay);
          }
        }
      }
      return clear;
    }
    function nearestOpen(t) {
      for (var r = 0; r < 12; r++) {
        for (var y = -r; y <= r; y++) {
          for (var x = -r; x <= r; x++) {
            if (isOpen(t[0] + x, t[1] + y)) { return [t[0] + x, t[1] + y]; }
          }
        }
      }
      return t;
    }

    var start = nearestOpen([Math.round(nodes[0].x), Math.round(nodes[0].y)]), fromStart = distanceFrom(start[0], start[1]);
    var floors = [], far = start, top = 0;
    for (y = 0; y < rows; y++) {
      for (x = 0; x < cols; x++) {
        if (wall[at(x, y)]) { continue; }
        if (fromStart[at(x, y)] < 0) { wall[at(x, y)] = 1; continue; }
        floors.push([x, y]);
      }
    }
    nodes.forEach(function (n) {
      var t = nearestOpen([Math.round(n.x), Math.round(n.y)]);
      if (fromStart[at(t[0], t[1])] > top) { top = fromStart[at(t[0], t[1])]; far = t; }
    });
    var hiding = shuffle(pockets.map(nearestOpen).filter(function (t) { return fromStart[at(t[0], t[1])] > 14; }), rnd);
    /* Open caves can leave few pockets: fill up with tucked-away nooks along the walls. */
    shuffle(floors.slice(), rnd).forEach(function (t) {
      if (hiding.length >= 9 || fromStart[at(t[0], t[1])] < 30) { return; }
      var walls = 0;
      for (var ny = -1; ny <= 1; ny++) { for (var nx = -1; nx <= 1; nx++) { walls += wall[at(t[0] + nx, t[1] + ny)]; } }
      var apart = hiding.every(function (h) { return Math.hypot(h[0] - t[0], h[1] - t[1]) > 16; });
      if (walls >= 3 && apart) { hiding.push(t); }
    });
    var second = null;
    if (options.twoExits) {
      var rest = nodes.map(function (n) { return nearestOpen([Math.round(n.x), Math.round(n.y)]); }).filter(function (t) { return Math.hypot(t[0] - far[0], t[1] - far[1]) > 22; })
        .sort(function (a, b) { return fromStart[at(b[0], b[1])] - fromStart[at(a[0], a[1])]; });
      second = rest[0] || null;
    }
    var rooms = nodes.filter(function (n) { return n.r > 8.5; }).map(function (n) { return nearestOpen([Math.round(n.x), Math.round(n.y)]); });
    return {
      cols: cols, rows: rows, wall: wall, floors: shuffle(floors, rnd), deadEnds: hiding, rooms: shuffle(rooms, rnd),
      start: start, fromStart: fromStart, exit: far, exit2: second, toExit: distanceFrom(far[0], far[1]), clear: clearance(), rnd: rnd, isOpen: isOpen, at: at
    };
  }

  return { build: build, DIRS: DIRS };
})();
