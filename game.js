/* SuperKarts 95 — pilotes, physique, IA, armes, déroulé de course, son, interface. */
(function (SK) {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var HALFW = SK.HALFW, KERB = 15, RUNOFF = 70;        // bitume, vibreur, dégagement
  var WALL = HALFW + KERB + RUNOFF;
  var PTS = [10, 8, 6, 5, 4, 3, 2, 1];

  /* ---------------------------------------------------------------- pilotes */
  var DRIVERS = [
    { name: 'MARCO',   top: 268, acc: 1.00, grip: 0.92, skill: 0.985,
      col: { body: '#d9433b', nose: '#f2eee4', suit: '#2a2633', helmet: '#ffb01f' } },
    { name: 'SIRKKA',  top: 262, acc: 1.08, grip: 0.96, skill: 0.980,
      col: { body: '#2f6fd0', nose: '#ffb01f', suit: '#1b2130', helmet: '#f2eee4' } },
    { name: 'DIEGO',   top: 274, acc: 0.92, grip: 0.88, skill: 0.975,
      col: { body: '#ffc11f', nose: '#2a2633', suit: '#3a3018', helmet: '#d9433b' } },
    { name: 'AKIRA',   top: 264, acc: 1.04, grip: 0.94, skill: 0.982,
      col: { body: '#3ba34a', nose: '#f2eee4', suit: '#1d2a1e', helmet: '#43d9e8' } },
    { name: 'BRIGITTE',top: 259, acc: 1.12, grip: 0.98, skill: 0.978,
      col: { body: '#e0387e', nose: '#f2eee4', suit: '#2b1a24', helmet: '#ffb01f' } },
    { name: 'KOWALSKI',top: 271, acc: 0.95, grip: 0.90, skill: 0.972,
      col: { body: '#e07820', nose: '#2a2633', suit: '#30210f', helmet: '#f2eee4' } },
    { name: 'NOOR',    top: 266, acc: 1.02, grip: 0.95, skill: 0.983,
      col: { body: '#43d9e8', nose: '#15131b', suit: '#16303a', helmet: '#e0387e' } },
    { name: 'HANS',    top: 261, acc: 1.06, grip: 0.93, skill: 0.976,
      col: { body: '#e8e4da', nose: '#d9433b', suit: '#2a2633', helmet: '#2f6fd0' } }
  ];
  var ITEMS = {
    turbo:  { g: '↑', nm: 'TURBO' },
    oil:    { g: '●', nm: 'HUILE' },
    rocket: { g: '➜', nm: 'ROQUETTE' },
    shield: { g: '✦', nm: 'BOUCLIER' }
  };

  /* ------------------------------------------------------------------- outil */
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function angDiff(a, b) {
    var d = (a - b) % 6.2831853;
    if (d > Math.PI) d -= 6.2831853; else if (d < -Math.PI) d += 6.2831853;
    return d;
  }
  function fmt(t) {
    if (!isFinite(t) || t <= 0) return '--:--.--';
    var m = Math.floor(t / 60), s = t - m * 60;
    return m + ':' + (s < 10 ? '0' : '') + s.toFixed(2);
  }

  /* --------------------------------------------------------------------- son */
  var Audio_ = {
    on: true, ctx: null, eng: null,
    init: function () {
      if (this.ctx) return;
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { this.on = false; return; }
      this.ctx = new AC();
      var c = this.ctx;
      // moteur : deux dents de scie désaccordées dans un passe-bas
      var g = c.createGain(); g.gain.value = 0; g.connect(c.destination);
      var lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1100;
      lp.connect(g);
      var o1 = c.createOscillator(); o1.type = 'sawtooth';
      var o2 = c.createOscillator(); o2.type = 'square'; o2.detune.value = -14;
      var g2 = c.createGain(); g2.gain.value = .35; o2.connect(g2); g2.connect(lp);
      o1.connect(lp); o1.start(); o2.start();
      // bruit de dérapage / herbe
      var len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      var ns = c.createBufferSource(); ns.buffer = buf; ns.loop = true;
      var nf = c.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 1600; nf.Q.value = .8;
      var ng = c.createGain(); ng.gain.value = 0;
      ns.connect(nf); nf.connect(ng); ng.connect(c.destination); ns.start();
      this.eng = { g: g, o1: o1, o2: o2, lp: lp, ng: ng, nf: nf };
    },
    engine: function (rpm, load) {
      if (!this.ctx || !this.on) return;
      var e = this.eng, t = this.ctx.currentTime;
      e.o1.frequency.setTargetAtTime(52 + rpm * 190, t, .04);
      e.o2.frequency.setTargetAtTime(26 + rpm * 95, t, .04);
      e.lp.frequency.setTargetAtTime(500 + rpm * 2200, t, .05);
      e.g.gain.setTargetAtTime(0.045 + rpm * 0.05, t, .08);
      e.ng.gain.setTargetAtTime(load * 0.085, t, .05);
      e.nf.frequency.setTargetAtTime(700 + load * 2400, t, .05);
    },
    quiet: function () { if (this.eng) { this.eng.g.gain.value = 0; this.eng.ng.gain.value = 0; } },
    blip: function (f, dur, type, vol) {
      if (!this.ctx || !this.on) return;
      var c = this.ctx, o = c.createOscillator(), g = c.createGain();
      o.type = type || 'square'; o.frequency.value = f;
      g.gain.value = vol || .12;
      g.gain.exponentialRampToValueAtTime(.0001, c.currentTime + dur);
      o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + dur);
    },
    bang: function () {
      if (!this.ctx || !this.on) return;
      var c = this.ctx, len = c.sampleRate * .4;
      var buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      var s = c.createBufferSource(); s.buffer = buf;
      var g = c.createGain(); g.gain.value = .3;
      var f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
      s.connect(f); f.connect(g); g.connect(c.destination); s.start();
    },
    jingle: function (win) {
      var n = win ? [523, 659, 784, 1047] : [392, 349, 294], i;
      for (i = 0; i < n.length; i++) {
        (function (f, k) { setTimeout(function () { Audio_.blip(f, .34, 'square', .11); }, k * 150); })(n[i], i);
      }
    }
  };

  /* ------------------------------------------------------------------- input */
  var keys = {};
  var MAP = {
    ArrowUp: 'gas', KeyW: 'gas', KeyZ: 'gas',
    ArrowDown: 'brake', KeyS: 'brake',
    ArrowLeft: 'left', KeyA: 'left', KeyQ: 'left',
    ArrowRight: 'right', KeyD: 'right',
    Space: 'drift', ShiftLeft: 'fire', ShiftRight: 'fire',
    ControlLeft: 'fire', ControlRight: 'fire'
  };
  addEventListener('keydown', function (e) {
    if (e.code === 'KeyP') { G.togglePause(); e.preventDefault(); return; }
    if (e.code === 'KeyM') { Audio_.on = !Audio_.on; if (!Audio_.on) Audio_.quiet(); return; }
    var k = MAP[e.code];
    if (k) { keys[k] = 1; e.preventDefault(); }
  });
  addEventListener('keyup', function (e) { var k = MAP[e.code]; if (k) keys[k] = 0; });
  addEventListener('blur', function () { keys = {}; });

  (function touchpad() {
    var pad = $('pad');
    if (matchMedia('(pointer:coarse)').matches) document.body.classList.add('touch');
    pad.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    Array.prototype.forEach.call(pad.querySelectorAll('button'), function (b) {
      var k = b.dataset.k;
      function dn(e) {
        e.preventDefault();
        if (k === 'pause') { G.togglePause(); return; }
        keys[k] = 1;
      }
      function up(e) { e.preventDefault(); keys[k] = 0; }
      b.addEventListener('pointerdown', dn);
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      b.addEventListener('pointerleave', up);
    });
  })();

  /* -------------------------------------------------------------------- kart */
  function Kart(d, human) {
    this.d = d; this.col = d.col; this.name = d.name; this.human = human;
    this.spr = SK.makeKart(d.col);
    this.x = 0; this.z = 0; this.a = 0; this.v = 0; this.slip = 0;
    this.idx = 0; this.s = 0; this.lap = 0; this.prog = 0;
    this.spin = 0; this.boost = 0; this.shield = 0; this.item = null;
    this.off = false; this.lapT = 0; this.best = Infinity; this.laps = [];
    this.finish = 0; this.pos = 1; this.line = 0; this.bias = 0;
    this.gas = 0; this.steer = 0; this.hand = false;
  }

  /* -------------------------------------------------------------------- jeu */
  var G = {
    st: 'menu',            // menu | count | race | over | pause
    track: null, karts: [], me: null, t: 0, count: 0,
    driver: 0, trackIdx: 0, cup: null, oils: [], rockets: [],
    flashT: 0, shake: 0, R: null, mode: 'single',

    boot: function () {
      this.R = SK.Renderer($('view'));
      this.buildMenu();
      this.cache = {};
      this.drawIdle();
      requestAnimationFrame(this.loop.bind(this));
    },

    /* ---------------------------------------------------------- menu */
    buildMenu: function () {
      var kg = $('kgrid'), tg = $('tgrid'), self = this, i;
      DRIVERS.forEach(function (d, i) {
        var b = document.createElement('button');
        b.className = 'k'; b.type = 'button';
        b.setAttribute('aria-pressed', i === self.driver ? 'true' : 'false');
        function bars(v, n) {
          var s = '', k;
          for (k = 0; k < 5; k++) s += k < Math.round(v * 5) ? '▮' : '▯';
          return s;
        }
        b.innerHTML = '<span class="chip" style="background:' + d.col.body + '"></span>' +
          '<span class="nm">' + d.name + '</span>' +
          '<span class="st">' + bars((d.top - 252) / 26) + ' ' + bars((d.acc - .88) / .28) +
          ' ' + bars((d.grip - .84) / .18) + '</span>';
        b.title = d.name + ' — vitesse / accélération / tenue de route';
        b.addEventListener('click', function () {
          self.driver = i;
          Array.prototype.forEach.call(kg.children, function (c, j) {
            c.setAttribute('aria-pressed', j === i ? 'true' : 'false');
          });
          Audio_.init(); Audio_.blip(880, .06, 'square', .07);
        });
        kg.appendChild(b);
      });
      SK.TRACKS.forEach(function (t, i) {
        var b = document.createElement('button');
        b.className = 'trk'; b.type = 'button';
        b.setAttribute('aria-pressed', i === self.trackIdx ? 'true' : 'false');
        var km = (SK.estimateLen(t) / 10000).toFixed(2);
        b.innerHTML = '<span class="no">' + (i + 1) + '</span>' +
          '<span><span class="tn">' + t.name + '</span> <span class="cy">' + t.country + '</span></span>' +
          '<span class="dl">' + km + ' km &middot; ' + t.laps + ' tours</span>';
        b.addEventListener('click', function () {
          self.trackIdx = i;
          Array.prototype.forEach.call(tg.children, function (c, j) {
            c.setAttribute('aria-pressed', j === i ? 'true' : 'false');
          });
          Audio_.init(); Audio_.blip(660, .06, 'square', .07);
          if (self.st === 'menu') self.drawIdle();      // aperçu du circuit choisi
        });
        tg.appendChild(b);
      });

      $('b-race').onclick = function () { self.mode = 'single'; self.cup = null; self.start(self.trackIdx); };
      $('b-cup').onclick = function () {
        self.mode = 'cup';
        self.cup = { round: 0, pts: DRIVERS.map(function () { return 0; }) };
        self.start(0);
      };
      $('b-help').onclick = function () { self.pane('p-pause'); $('pz-title').textContent = 'Commandes'; $('b-resume').style.display = 'none'; $('b-restart').style.display = 'none'; };
      $('b-resume').onclick = function () { self.togglePause(); };
      $('b-restart').onclick = function () { self.start(self.trackIdx); };
      $('b-quit').onclick = function () { self.toMenu(); };
      $('b-menu').onclick = function () { self.toMenu(); };
      $('b-next').onclick = function () {
        if (self.mode === 'cup' && self.cup.round < SK.TRACKS.length - 1) {
          self.cup.round++; self.start(self.cup.round);
        } else self.toMenu();
      };
    },
    pane: function (id) {
      ['p-title', 'p-res', 'p-pause'].forEach(function (p) {
        $(p).classList.toggle('off', p !== id);
      });
      $('ovl').classList.remove('off');
      $('hud').classList.add('off');
    },
    toMenu: function () {
      this.st = 'menu'; Audio_.quiet();
      $('b-resume').style.display = ''; $('b-restart').style.display = '';
      this.pane('p-title');
      this.drawIdle();
    },
    drawIdle: function () {
      // vue fixe sur la piste sélectionnée : l'écran n'est jamais vide
      var tr = this.getTrack(this.trackIdx), cl = tr.cl, R = this.R;
      var i = Math.floor(cl.N * .12);
      R.cam.x = cl.cx[i] - Math.sin(cl.hd[i]) * 90;
      R.cam.z = cl.cz[i] - Math.cos(cl.hd[i]) * 90;
      R.cam.a = cl.hd[i];
      R.begin(tr, R.H * 0.42);
      this.pushDecor(tr);
      R.end(tr, 0);
    },
    getTrack: function (i) {
      var def = SK.TRACKS[i];
      if (!this.cache) this.cache = {};
      if (!this.cache[def.name]) this.cache[def.name] = SK.buildTrack(def);
      SK.buildDecor(this.cache[def.name].th);
      return this.cache[def.name];
    },

    /* --------------------------------------------------------- départ */
    start: function (ti) {
      this.trackIdx = ti;
      var tr = this.getTrack(ti), cl = tr.cl, self = this;
      this.track = tr;
      Audio_.init();

      var order = DRIVERS.slice();
      // grille : le joueur part 4e, les autres dans un ordre mêlé stable
      var ai = DRIVERS.filter(function (d, i) { return i !== self.driver; });
      for (var i = ai.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1)), t = ai[i]; ai[i] = ai[j]; ai[j] = t;
      }
      var grid = ai.slice(0, 3).concat([DRIVERS[this.driver]]).concat(ai.slice(3));

      this.karts = grid.map(function (d, i) {
        var k = new Kart(d, d === DRIVERS[self.driver]);
        var row = i >> 1, lat = (i & 1) ? 26 : -26;
        var back = 90 + row * 58;
        var gi = ((cl.N - Math.round(back / SK.SPACING)) % cl.N + cl.N) % cl.N;
        k.idx = gi; k.x = cl.cx[gi] + cl.nx[gi] * lat; k.z = cl.cz[gi] + cl.nz[gi] * lat;
        k.a = cl.hd[gi]; k.s = gi * SK.SPACING; k.prog = k.s;
        k.line = lat * .5 + (Math.random() - .5) * 18;
        k.pos = i + 1;
        return k;
      });
      this.me = this.karts.filter(function (k) { return k.human; })[0];
      this.oils = []; this.rockets = [];
      tr.boxes.forEach(function (b) { b.t = 0; });
      this.t = 0; this.count = 3.6; this.st = 'count';
      this.flash('3', '');
      this.beeped = 4;
      $('ovl').classList.add('off');
      $('hud').classList.remove('off');
      $('h-lap').textContent = '1/' + tr.def.laps;
      $('h-best').textContent = '--:--.--';
    },

    togglePause: function () {
      if (this.st === 'race') { this.st = 'pause'; Audio_.quiet(); this.pane('p-pause'); $('pz-title').textContent = 'Pause'; }
      else if (this.st === 'pause') { this.st = 'race'; $('ovl').classList.add('off'); $('hud').classList.remove('off'); }
      else if (this.st === 'menu') { /* rien */ }
    },

    flash: function (big, small) {
      $('h-flash-b').textContent = big;
      $('h-flash-s').textContent = small || '';
      $('h-flash').style.display = '';
      this.flashT = 1.1;
    },

    /* -------------------------------------------------------- physique */
    drive: function (k, dt) {
      var tr = this.track, cl = tr.cl;
      var top = k.d.top * (k.off ? 0.62 : 1) * (k.boost > 0 ? 1.45 : 1);
      var acc = 300 * k.d.acc * (k.boost > 0 ? 1.7 : 1);

      if (k.spin > 0) {
        k.spin -= dt; k.a += dt * 11; k.v -= k.v * dt * 2.2;
        k.slip *= .9;
      } else {
        if (k.gas > 0) k.v += acc * dt * clamp(1 - k.v / top, 0, 1) * (k.hand ? .45 : 1);
        else if (k.gas < 0) k.v -= 430 * dt;
        else k.v -= 110 * dt;
        if (k.v > top) k.v -= 340 * dt;
        if (k.v < -90) k.v = -90;
        if (k.v < 0 && k.gas >= 0) k.v += 160 * dt;

        var sp = clamp(Math.abs(k.v) / 90, 0, 1);
        var rate = 2.05 * k.d.grip * sp * (k.hand ? 1.42 : 1) * (k.off ? .82 : 1);
        k.a += k.steer * rate * dt * (k.v < 0 ? -1 : 1);

        var tgt = k.hand ? -k.steer * 0.46 * sp : -k.steer * 0.10 * sp;
        k.slip += (tgt - k.slip) * (1 - Math.exp(-dt * 7));
        // gommage en courbe : tourner coûte de la vitesse, déraper un peu moins
        k.v -= Math.abs(k.steer) * (Math.abs(k.v) / k.d.top) * (k.hand ? 34 : 62) * dt;
      }
      k.boost = Math.max(0, k.boost - dt);
      k.shield = Math.max(0, k.shield - dt);

      var dir = k.a + k.slip;
      k.x += Math.sin(dir) * k.v * dt;
      k.z += Math.cos(dir) * k.v * dt;

      // position sur la piste, herbe, rails
      var n = SK.nearest(cl, k.x, k.z, k.idx);
      var prevIdx = k.idx;
      k.idx = n.i; k.lat = n.lat;
      k.off = Math.abs(n.lat) > HALFW + KERB * .5;
      if (Math.abs(n.lat) > WALL) {
        var sgn = n.lat > 0 ? 1 : -1;
        k.x = cl.cx[n.i] + cl.nx[n.i] * WALL * sgn;
        k.z = cl.cz[n.i] + cl.nz[n.i] * WALL * sgn;
        k.v *= .55; k.slip *= .3;
        if (k.human) { this.shake = .25; Audio_.bang(); }
      }
      // avancement continu + comptage des tours
      var fwd = (k.x - cl.cx[n.i]) * Math.sin(cl.hd[n.i]) + (k.z - cl.cz[n.i]) * Math.cos(cl.hd[n.i]);
      k.s = n.i * SK.SPACING + clamp(fwd, -SK.SPACING, SK.SPACING);
      if (prevIdx > cl.N * .75 && n.i < cl.N * .25) this.crossLine(k, 1);
      else if (prevIdx < cl.N * .25 && n.i > cl.N * .75) this.crossLine(k, -1);
      k.prog = k.lap * cl.len + k.s;
    },

    crossLine: function (k, dir) {
      var laps = this.track.def.laps;
      if (dir < 0) { k.lap = Math.max(0, k.lap - 1); return; }
      k.lap++;
      if (k.lap > 1) {
        k.laps.push(k.lapT);
        if (k.lapT < k.best) k.best = k.lapT;
      }
      k.lapT = 0;
      if (k.lap > laps) {
        k.finish = this.t;
        if (k.human) this.endRace();
        return;
      }
      if (k.human) {
        $('h-lap').textContent = Math.min(laps, k.lap) + '/' + laps;
        $('h-best').textContent = fmt(k.best);
        if (k.lap === laps) { this.flash('DERNIER TOUR', ''); Audio_.blip(1180, .18, 'square', .1); }
        else if (k.lap > 1) { this.flash('TOUR ' + k.lap, fmt(k.laps[k.laps.length - 1])); Audio_.blip(920, .12, 'square', .08); }
      }
    },

    /* --------------------------------------------------------------- IA */
    think: function (k, dt) {
      var cl = this.track.cl, N = cl.N;
      var look = Math.round(9 + k.v / 11);
      var ti = (k.idx + look) % N;
      // ligne de course : se décale vers l'intérieur du virage à venir
      var curv = angDiff(cl.hd[(k.idx + 22) % N], cl.hd[(k.idx + 4) % N]);
      var want = clamp(k.line - clamp(curv * 90, -34, 34) + k.bias, -(HALFW - 16), HALFW - 16);
      var tx = cl.cx[ti] + cl.nx[ti] * want, tz = cl.cz[ti] + cl.nz[ti] * want;
      var da = angDiff(Math.atan2(tx - k.x, tz - k.z), k.a);
      k.steer = clamp(da * 2.3, -1, 1);

      var cap = k.d.top * k.d.skill / (1 + Math.abs(curv) * 0.95);
      // élastique : l'IA larguée revient, l'IA en tête se modère un peu
      var gap = (this.me.prog - k.prog) / 100;
      cap *= 1 + clamp(gap * 0.012, -0.05, 0.08);
      k.gas = k.v > cap ? (k.v > cap * 1.14 ? -1 : 0) : 1;
      k.hand = Math.abs(curv) > .55 && k.v > cap * .9;

      // évitement : petit décalage latéral si un kart bouche la trajectoire
      k.bias *= 0.94;
      for (var i = 0; i < this.karts.length; i++) {
        var o = this.karts[i];
        if (o === k) continue;
        var dp = o.prog - k.prog;
        if (dp > 8 && dp < 75 && Math.abs((o.lat || 0) - (k.lat || 0)) < 26) {
          k.bias += ((k.lat || 0) >= (o.lat || 0) ? 1 : -1) * 34 * dt * 3;
        }
      }
      k.bias = clamp(k.bias, -26, 26);

      // armes
      if (k.item && Math.random() < dt * 1.3) {
        if (k.item === 'turbo' && Math.abs(curv) < .18) this.useItem(k);
        else if (k.item === 'shield') this.useItem(k);
        else if (k.item === 'oil') {
          for (var j = 0; j < this.karts.length; j++) {
            var b = this.karts[j].prog - k.prog;
            if (b < -10 && b > -140) { this.useItem(k); break; }
          }
        } else if (k.item === 'rocket') {
          for (var m = 0; m < this.karts.length; m++) {
            var f = this.karts[m].prog - k.prog;
            if (f > 20 && f < 700) { this.useItem(k); break; }
          }
        }
      }
    },

    /* ------------------------------------------------------------ armes */
    giveItem: function (k) {
      var r = Math.random(), back = (k.pos - 1) / (this.karts.length - 1);
      if (r < .30 + back * .14) k.item = 'turbo';
      else if (r < .55) k.item = 'oil';
      else if (r < .82 + back * .08) k.item = 'rocket';
      else k.item = 'shield';
      if (k.human) {
        this.setItemHud(k.item);
        this.flash(ITEMS[k.item].g, ITEMS[k.item].nm);
        Audio_.blip(1320, .09, 'square', .09);
      }
    },
    setItemHud: function (it) {
      var el = $('h-item');
      el.textContent = it ? ITEMS[it].g : '·';
      el.classList.toggle('empty', !it);
    },
    useItem: function (k) {
      var it = k.item;
      if (!it) return;
      k.item = null;
      if (k.human) this.setItemHud(null);
      if (it === 'turbo') {
        k.boost = 3; k.v = Math.max(k.v, k.d.top * .7);
        if (k.human) Audio_.blip(240, .4, 'sawtooth', .1);
      } else if (it === 'shield') {
        k.shield = 6;
        if (k.human) Audio_.blip(700, .3, 'sine', .1);
      } else if (it === 'oil') {
        var d = k.a + Math.PI;
        this.oils.push({ x: k.x + Math.sin(d) * 46, z: k.z + Math.cos(d) * 46, t: 22 });
        if (k.human) Audio_.blip(180, .2, 'triangle', .1);
      } else if (it === 'rocket') {
        var tgt = null, bd = 1e9;
        for (var i = 0; i < this.karts.length; i++) {
          var o = this.karts[i], dp = o.prog - k.prog;
          if (o !== k && dp > 0 && dp < bd) { bd = dp; tgt = o; }
        }
        if (!tgt) tgt = this.karts[0];
        this.rockets.push({ x: k.x, z: k.z, a: k.a, tgt: tgt, from: k, t: 5 });
        if (k.human) Audio_.blip(420, .25, 'sawtooth', .1);
      }
    },
    hit: function (k, hard) {
      if (k.shield > 0) { k.shield = 0; Audio_.blip(520, .2, 'sine', .08); return; }
      k.spin = hard ? 1.5 : 1.1;
      k.v *= hard ? .3 : .55;
      k.boost = 0;
      if (k.human) { this.shake = .5; Audio_.bang(); }
    },

    updateItems: function (dt) {
      var tr = this.track, i, j, k, b, o, r;
      for (i = 0; i < tr.boxes.length; i++) {
        b = tr.boxes[i];
        if (b.t > 0) { b.t -= dt; continue; }
        for (j = 0; j < this.karts.length; j++) {
          k = this.karts[j];
          if (k.item || k.spin > 0) continue;
          if (Math.hypot(k.x - b.x, k.z - b.z) < 30) { b.t = 5; this.giveItem(k); break; }
        }
      }
      for (i = this.oils.length - 1; i >= 0; i--) {
        o = this.oils[i]; o.t -= dt;
        if (o.t <= 0) { this.oils.splice(i, 1); continue; }
        for (j = 0; j < this.karts.length; j++) {
          k = this.karts[j];
          if (k.spin > 0) continue;
          if (Math.hypot(k.x - o.x, k.z - o.z) < 24) { this.hit(k, false); }
        }
      }
      for (i = this.rockets.length - 1; i >= 0; i--) {
        r = this.rockets[i]; r.t -= dt;
        var da = angDiff(Math.atan2(r.tgt.x - r.x, r.tgt.z - r.z), r.a);
        r.a += clamp(da, -2.6 * dt, 2.6 * dt);
        r.x += Math.sin(r.a) * 430 * dt; r.z += Math.cos(r.a) * 430 * dt;
        if (Math.hypot(r.x - r.tgt.x, r.z - r.tgt.z) < 26) {
          this.hit(r.tgt, true); this.rockets.splice(i, 1); continue;
        }
        if (r.t <= 0) this.rockets.splice(i, 1);
      }
      // contacts entre karts
      for (i = 0; i < this.karts.length; i++) {
        for (j = i + 1; j < this.karts.length; j++) {
          var A = this.karts[i], B = this.karts[j];
          var dx = B.x - A.x, dz = B.z - A.z, d = Math.hypot(dx, dz);
          if (d > 0.1 && d < 26) {
            var px = dx / d * (26 - d) * .5, pz = dz / d * (26 - d) * .5;
            A.x -= px; A.z -= pz; B.x += px; B.z += pz;
            var vm = (A.v + B.v) * .5;
            A.v = A.v * .82 + vm * .18; B.v = B.v * .82 + vm * .18;
            if ((A.human || B.human) && this.shake < .1) this.shake = .12;
          }
        }
      }
    },

    standings: function () {
      var s = this.karts.slice().sort(function (a, b) {
        if (a.finish && b.finish) return a.finish - b.finish;
        if (a.finish) return -1;
        if (b.finish) return 1;
        return b.prog - a.prog;
      });
      for (var i = 0; i < s.length; i++) s[i].pos = i + 1;
      return s;
    },

    /* -------------------------------------------------------- fin de course */
    endRace: function () {
      this.st = 'over';
      var self = this, cl = this.track.cl, total = this.track.def.laps * cl.len;
      // temps estimé pour ceux qui n'ont pas fini : reste à parcourir / allure moyenne
      this.karts.forEach(function (k) {
        if (!k.finish) {
          var rest = Math.max(0, total - k.prog);
          var avg = Math.max(60, k.prog / Math.max(.5, self.t));
          k.finish = self.t + rest / avg;
        }
        if (!isFinite(k.best) && k.laps.length) k.best = Math.min.apply(null, k.laps);
        if (!isFinite(k.best)) k.best = self.t / self.track.def.laps;
      });
      var fin = this.karts.slice().sort(function (a, b) { return a.finish - b.finish; });
      var mePos = fin.indexOf(this.me) + 1;
      Audio_.quiet();
      Audio_.jingle(mePos <= 3);

      if (this.mode === 'cup') {
        fin.forEach(function (k, i) {
          var di = DRIVERS.indexOf(k.d);
          self.cup.pts[di] += PTS[i] || 0;
        });
      }
      this.showResults(fin, mePos);
    },

    showResults: function (fin, mePos) {
      var self = this, body = $('r-body'), cup = this.mode === 'cup';
      var last = cup && this.cup.round >= SK.TRACKS.length - 1;
      $('r-title').textContent = cup
        ? (last ? 'Classement final du championnat' : 'Manche ' + (this.cup.round + 1) + ' — ' + this.track.def.name)
        : this.track.def.name + ' — arrivée';
      $('r-sub').textContent = mePos === 1
        ? 'Victoire. ' + fmt(this.me.finish) + ' au total, meilleur tour en ' + fmt(this.me.best) + '.'
        : (mePos <= 3 ? 'Podium : ' + mePos + 'e place.' : mePos + 'e place — ' + fmt(this.me.finish) + '.');
      $('r-ph').textContent = cup ? 'Pts' : 'Écart';
      body.innerHTML = '';

      var rows;
      if (cup && last) {
        rows = DRIVERS.map(function (d, i) { return { d: d, p: self.cup.pts[i] }; })
          .sort(function (a, b) { return b.p - a.p; })
          .map(function (r, i) {
            var k = self.karts.filter(function (x) { return x.d === r.d; })[0];
            return { pl: i + 1, d: r.d, time: k.finish, best: k.best, extra: r.p, me: r.d === DRIVERS[self.driver] };
          });
      } else {
        rows = fin.map(function (k, i) {
          return { pl: i + 1, d: k.d, time: k.finish, best: k.best,
                   extra: cup ? (PTS[i] || 0) : (i === 0 ? '—' : '+' + (k.finish - fin[0].finish).toFixed(2)),
                   me: k.human };
        });
      }
      rows.forEach(function (r) {
        var tr = document.createElement('tr');
        if (r.me) tr.className = 'me';
        tr.innerHTML = '<td>' + r.pl + '</td>' +
          '<td><span class="dot" style="background:' + r.d.col.body + '"></span>' + r.d.name + '</td>' +
          '<td class="n">' + fmt(r.time) + '</td>' +
          '<td class="n">' + fmt(r.best) + '</td>' +
          '<td class="n">' + r.extra + '</td>';
        body.appendChild(tr);
      });
      $('b-next').querySelector('span').textContent =
        (cup && !last) ? 'Manche suivante' : 'Retour au menu';
      this.pane('p-res');
    },

    /* ------------------------------------------------------------- boucle */
    step: function (dt) {
      var self = this;
      if (this.st === 'count') {
        this.count -= dt;
        var n = Math.ceil(this.count - .6);
        if (n < this.beeped && n >= 0) {
          this.beeped = n;
          if (n > 0) { this.flash(String(n), ''); Audio_.blip(640, .12, 'square', .1); }
          else { this.flash('PARTEZ !', ''); Audio_.blip(1280, .3, 'square', .12); }
        }
        if (this.count <= 0) this.st = 'race';
        this.karts.forEach(function (k) { k.gas = 0; k.steer = 0; k.hand = false; });
        return;
      }
      if (this.st !== 'race') return;

      this.t += dt;
      var me = this.me;
      me.gas = keys.gas ? 1 : (keys.brake ? -1 : 0);
      me.steer = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
      me.hand = !!keys.drift;
      if (keys.fire) { if (me.item) this.useItem(me); keys.fire = 0; }

      this.karts.forEach(function (k) {
        if (!k.human) self.think(k, dt);
        if (!k.finish) { k.lapT += dt; self.drive(k, dt); }
      });
      this.updateItems(dt);
      this.standings();

      // son moteur + HUD
      var rpm = clamp(Math.abs(me.v) / me.d.top, 0, 1.2);
      Audio_.engine(rpm, (me.off ? .5 : 0) + (me.hand && Math.abs(me.steer) > .3 ? .5 : 0) + (me.spin > 0 ? .7 : 0));
      $('h-spd').textContent = Math.round(Math.abs(me.v) * 0.36);
      $('h-pos').textContent = me.pos + '/' + this.karts.length;
      $('h-time').textContent = fmt(this.t);
      if (this.flashT > 0) {
        this.flashT -= dt;
        if (this.flashT <= 0) $('h-flash').style.display = 'none';
      }
      this.shake = Math.max(0, this.shake - dt * 1.6);
    },

    pushDecor: function (tr) {
      var R = this.R, i, d, s;
      for (i = 0; i < tr.decor.length; i++) {
        d = tr.decor[i]; s = SK.decor(d.kind);
        if (s) R.push(d.x, d.z, s.cv, s.worldH, s.w, s.h, null);
      }
      var bx = SK.decor('box');
      for (i = 0; i < tr.boxes.length; i++) {
        if (tr.boxes[i].t > 0) continue;
        R.push(tr.boxes[i].x, tr.boxes[i].z, bx.cv, bx.worldH, bx.w, bx.h, null);
      }
    },

    draw: function () {
      var R = this.R, tr = this.track, me = this.me, i, k;
      if (!tr || this.st === 'menu') return;

      // caméra : derrière le kart, cap lissé, secousses sur impact
      var camA = me.a + me.slip * .55;
      R.cam.a += angDiff(camA, R.cam.a) * .22;
      var back = 74 + Math.abs(me.v) * .035;
      R.cam.x = me.x - Math.sin(R.cam.a) * back;
      R.cam.z = me.z - Math.cos(R.cam.a) * back;
      var hz = R.H * 0.42 + (this.shake > 0 ? (Math.random() - .5) * 10 * this.shake : 0)
             + (me.off ? Math.sin(this.t * 40) * 1.2 : 0);

      R.begin(tr, hz);
      this.pushDecor(tr);

      var oilS = SK.decor('oil'), rkS = SK.decor('rocket');
      for (i = 0; i < this.oils.length; i++) {
        R.push(this.oils[i].x, this.oils[i].z, oilS.cv, oilS.worldH, oilS.w, oilS.h, null);
      }
      for (i = 0; i < this.rockets.length; i++) {
        R.push(this.rockets[i].x, this.rockets[i].z, rkS.cv, rkS.worldH, rkS.w, rkS.h, null);
      }
      for (i = 0; i < this.karts.length; i++) {
        k = this.karts[i];
        var rel = k.a + k.slip * .6 - R.cam.a;
        var f = Math.round(rel / 6.2831853 * SK.FRAMES);
        f = ((f % SK.FRAMES) + SK.FRAMES) % SK.FRAMES;
        var tint = null;
        if (k.spin > 0) tint = { c: '#f2eee4', a: .35 + Math.sin(this.t * 30) * .2 };
        else if (k.shield > 0) tint = { c: '#43d9e8', a: .22 + Math.sin(this.t * 10) * .12 };
        else if (k.boost > 0) tint = { c: '#ffb01f', a: .25 };
        R.push(k.x, k.z, k.spr.frames[f], k.spr.worldH, k.spr.w, k.spr.h, tint);
      }
      R.end(tr, me.boost > 0 ? clamp(me.v / me.d.top, 0, 1.4) : 0);
      if (me.spin > 0) R.flash('#f2eee4', .12);
      if (this.st === 'count') R.flash('#15131b', .25);

      SK.minimap($('minimap'), tr, this.karts, me);
    },

    loop: function (now) {
      requestAnimationFrame(this.loop.bind(this));
      if (!this.last) this.last = now;
      var dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      if (this.st === 'menu' || this.st === 'pause') { this.fpsT = 0; return; }
      this.step(dt);
      this.draw();
      // compteur d'images, rafraîchi deux fois par seconde
      this.fpsN = (this.fpsN || 0) + 1; this.fpsT = (this.fpsT || 0) + dt;
      if (this.fpsT > .5) {
        $('fps').textContent = Math.round(this.fpsN / this.fpsT) + ' i/s · 360×240';
        this.fpsN = 0; this.fpsT = 0;
      }
    }
  };

  /* longueur approximative d'un circuit, pour le menu (sans construire la texture) */
  SK.estimateLen = function (def) {
    var n = def.pts.length, L = 0, i, p, q;
    for (i = 0; i < n; i++) {
      p = def.pts[i]; q = def.pts[(i + 1) % n];
      L += Math.hypot(q[0] - p[0], q[1] - p[1]) * SK.WORLD;
    }
    return L * 1.07;
  };

  SK.G = G;
  SK.keys = keys;
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', function () { G.boot(); });
  else G.boot();
})(window.SK = window.SK || {});
