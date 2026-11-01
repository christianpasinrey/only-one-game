/* All sound is synthesised after the first gesture, so there is nothing to download. */
EG.audio = (function () {
  var ctx = null, master, sfx, ambience, droneOsc = [], droneFilter, noiseBuffer;
  var volumes = { master: 0.8, sfx: 0.8, ambience: 0.6 };
  var SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];

  function unlock() {
    if (ctx) {
      if (ctx.state === 'suspended') { ctx.resume(); }
      return;
    }
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) { return; }
    ctx = new Ctx();
    master = ctx.createGain();
    sfx = ctx.createGain();
    ambience = ctx.createGain();
    sfx.connect(master);
    ambience.connect(master);
    master.connect(ctx.destination);
    var length = ctx.sampleRate * 3;
    noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
    var data = noiseBuffer.getChannelData(0), last = 0;
    for (var i = 0; i < length; i++) {
      last = (last + 0.04 * (Math.random() * 2 - 1)) / 1.04;
      data[i] = last * 3.2;
    }
    droneFilter = ctx.createBiquadFilter();
    droneFilter.type = 'lowpass';
    droneFilter.frequency.value = 260;
    droneFilter.connect(ambience);
    [0.5, 1, 1.005].forEach(function (mult) {
      var osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = mult === 1 ? 'sawtooth' : 'triangle';
      osc.frequency.value = 55 * mult;
      gain.gain.value = 0.05;
      osc.connect(gain);
      gain.connect(droneFilter);
      osc.start();
      droneOsc.push({ osc: osc, mult: mult });
    });
    var wash = ctx.createBufferSource(), band = ctx.createBiquadFilter(), washGain = ctx.createGain();
    wash.buffer = noiseBuffer; wash.loop = true;
    band.type = 'lowpass'; band.frequency.value = 480;
    washGain.gain.value = 0.11;
    wash.connect(band); band.connect(washGain); washGain.connect(ambience);
    wash.start();
    apply();
  }

  function apply() {
    if (!ctx) { return; }
    master.gain.setTargetAtTime(volumes.master, ctx.currentTime, 0.02);
    sfx.gain.setTargetAtTime(volumes.sfx, ctx.currentTime, 0.02);
    ambience.gain.setTargetAtTime(volumes.ambience, ctx.currentTime, 0.02);
  }

  function tone(freq, length, type, gain, slide, target) {
    if (!ctx) { return; }
    var osc = ctx.createOscillator(), g = ctx.createGain(), now = ctx.currentTime;
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slide) { osc.frequency.exponentialRampToValueAtTime(slide, now + length); }
    g.gain.setValueAtTime(gain, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + length);
    osc.connect(g);
    g.connect(target || sfx);
    osc.start(now);
    osc.stop(now + length + 0.02);
  }

  function hiss(length, freq, q, gain, slideTo) {
    if (!ctx) { return; }
    var src = ctx.createBufferSource(), band = ctx.createBiquadFilter(), g = ctx.createGain(), now = ctx.currentTime;
    src.buffer = noiseBuffer;
    band.type = 'bandpass';
    band.frequency.setValueAtTime(freq, now);
    if (slideTo) { band.frequency.exponentialRampToValueAtTime(slideTo, now + length); }
    band.Q.value = q;
    g.gain.setValueAtTime(gain, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + length);
    src.connect(band); band.connect(g); g.connect(sfx);
    src.start(now, Math.random() * 2, length + 0.05);
  }

  return {
    unlock: unlock,
    tone: tone,
    hiss: hiss,
    setVolume: function (key, value) { volumes[key] = value; apply(); },
    sugar: function (n) {
      var note = 523 * Math.pow(2, SCALE[Math.min(n, SCALE.length - 1)] / 12);
      tone(note, 0.12, 'triangle', 0.1);
      tone(note * 2, 0.08, 'sine', 0.04);
      hiss(0.09, 5200, 1.2, 0.5);
    },
    fanfare: function () {
      [523, 659, 784, 1047, 1319].forEach(function (freq, i) {
        setTimeout(function () { tone(freq, 0.24, 'square', 0.05); tone(freq / 2, 0.24, 'triangle', 0.07); }, i * 70);
      });
    },
    stage: function () {
      tone(98, 1.1, 'sawtooth', 0.14, 196);
      tone(147, 1.1, 'triangle', 0.1, 294);
      hiss(1.2, 300, 0.8, 1.2, 2600);
    },
    beat: function (strong) {
      tone(58, 0.17, 'sine', strong ? 0.3 : 0.18, 36, ambience || sfx);
      setTimeout(function () { tone(48, 0.13, 'sine', strong ? 0.2 : 0.12, 32, ambience || sfx); }, 170);
    },
    spit: function () { tone(520, 0.12, 'sawtooth', 0.06, 110); hiss(0.14, 1400, 1, 0.8, 500); },
    bump: function () { tone(150, 0.26, 'sawtooth', 0.09, 50); hiss(0.2, 300, 1, 0.8); },
    warn: function () {
      tone(880, 0.09, 'square', 0.05);
      setTimeout(function () { tone(1175, 0.11, 'square', 0.05); }, 90);
    },
    lunge: function () { hiss(0.3, 900, 0.9, 0.9, 2600); tone(220, 0.22, 'sawtooth', 0.05, 520); },
    heart: function () {
      tone(660, 0.12, 'triangle', 0.1);
      setTimeout(function () { tone(990, 0.2, 'triangle', 0.1); }, 90);
    },
    lifeLost: function () {
      [440, 370, 294, 196].forEach(function (freq, i) {
        setTimeout(function () { tone(freq, 0.22, 'square', 0.05, freq * 0.8); }, i * 110);
      });
    },
    checkpoint: function () {
      [392, 523, 659, 784].forEach(function (freq, i) {
        setTimeout(function () { tone(freq, 0.3, 'triangle', 0.1); tone(freq * 2, 0.2, 'sine', 0.04); }, i * 90);
      });
    },
    king: function () {
      [392, 494, 587, 784, 988].forEach(function (freq, i) {
        setTimeout(function () { tone(freq, 0.26, 'sawtooth', 0.05); tone(freq / 2, 0.26, 'square', 0.04); }, i * 107);
      });
    },
    kingTick: function () { tone(1760, 0.04, 'square', 0.03); hiss(0.04, 7000, 2, 0.5); },
    boon: function () { tone(660, 0.1, 'square', 0.05, 1320); hiss(0.12, 3000, 1, 0.5, 6000); },
    guardHit: function () { tone(120, 0.3, 'sawtooth', 0.12, 40); hiss(0.25, 800, 0.8, 1, 200); },
    ui: function () { tone(440, 0.06, 'triangle', 0.08); },
    nope: function () { tone(150, 0.12, 'square', 0.05); },
    buy: function () {
      tone(523, 0.1, 'triangle', 0.12);
      setTimeout(function () { tone(784, 0.17, 'triangle', 0.12); }, 80);
    },
    drone: function (hz, sprinting) {
      if (!ctx) { return; }
      droneOsc.forEach(function (d) { d.osc.frequency.setTargetAtTime(hz * d.mult, ctx.currentTime, 1.2); });
      droneFilter.frequency.setTargetAtTime(sprinting ? 520 : 260, ctx.currentTime, 0.4);
    }
  };
})();
