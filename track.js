/* SuperKarts 95 — pistes : spline, texture du sol, sprites de bord de piste.
   Unités monde : 1 u = 10 cm. La texture couvre WORLD x WORLD unités au 1:1. */
(function (SK) {
  'use strict';

  var WORLD = 2048;          // côté du monde = côté de la texture, en unités
  var HALFW = 60;            // demi-largeur de piste (12 m de large)
  var SPACING = 12;          // espacement des points de la ligne médiane
  var KERB = 15;             // largeur du vibreur
  SK.WORLD = WORLD; SK.HALFW = HALFW; SK.SPACING = SPACING;

  /* ---------------------------------------------------------------- pistes */
  SK.TRACKS = [
    {
      name: 'TRÉLAZÉ', country: 'France', theme: 'green', laps: 3,
      pts: [[.50,.09],[.72,.12],[.86,.26],[.80,.42],[.90,.58],[.84,.78],[.62,.90],
            [.40,.88],[.30,.72],[.42,.60],[.30,.46],[.14,.42],[.16,.22],[.32,.12]]
    },
    {
      name: 'ALPENRING', country: 'Autriche', theme: 'snow', laps: 3,
      pts: [[.50,.10],[.78,.16],[.88,.38],[.70,.46],[.78,.62],[.66,.80],[.44,.84],
            [.46,.66],[.34,.60],[.36,.40],[.20,.34],[.22,.16]]
    },
    {
      name: 'BAJA SECA', country: 'Espagne', theme: 'desert', laps: 3,
      pts: [[.50,.12],[.68,.10],[.84,.22],[.86,.44],[.74,.54],[.86,.68],[.72,.86],
            [.50,.92],[.28,.86],[.20,.68],[.34,.56],[.22,.44],[.26,.24],[.38,.14]]
    },
    {
      name: 'PORT DE NUIT', country: 'Pays-Bas', theme: 'night', laps: 3,
      pts: [[.50,.08],[.74,.14],[.82,.32],[.62,.40],[.74,.52],[.88,.66],[.70,.84],
            [.48,.88],[.30,.80],[.36,.62],[.22,.54],[.30,.38],[.18,.26],[.32,.10]]
    }
  ];

  var THEMES = {
    green:  { grass:'#4a7a2c', grass2:'#3d6624', dirt:'#8a6a3a', road:'#2b2a33',
              rim:'#1b1a22', sky1:'#2f7fc4', sky2:'#bfe4f7', haze:'#9ccbe8',
              decor:['tyre','tree','sign','bale','tyre','tree'], band:'#2a5c1e', sun:'#fff3c4' },
    snow:   { grass:'#d9e2ec', grass2:'#c3cfdd', dirt:'#9aa7b4', road:'#3a3a44',
              rim:'#24242c', sky1:'#4a6f9c', sky2:'#dfe9f3', haze:'#cdd9e6',
              decor:['pine','tyre','pine','sign','pine','bale'], band:'#b7c4d2', sun:'#ffffff' },
    desert: { grass:'#c89a4e', grass2:'#b2863f', dirt:'#9a7334', road:'#36323a',
              rim:'#241f26', sky1:'#2f84b8', sky2:'#f2d9a8', haze:'#e3c694',
              decor:['cactus','tyre','bale','sign','cactus','cone'], band:'#a8762f', sun:'#fff0bf' },
    night:  { grass:'#1f2a35', grass2:'#18212b', dirt:'#2c3340', road:'#23222c',
              rim:'#121119', sky1:'#060a16', sky2:'#192b46', haze:'#16233a',
              decor:['lamp','tyre','crate','sign','lamp','cone'], band:'#101822', sun:'#f6f2d0' }
  };
  SK.theme = function (t) { return THEMES[t.theme]; };

  /* ---------------------------------------------------- spline Catmull-Rom */
  function cr(p0, p1, p2, p3, t) {
    var t2 = t * t, t3 = t2 * t;
    return 0.5 * ((2 * p1) + (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
  }

  /** Échantillonne la spline fermée à pas constant. */
  function centerline(pts) {
    var n = pts.length, raw = [], i, j, t, p0, p1, p2, p3;
    for (i = 0; i < n; i++) {
      p0 = pts[(i - 1 + n) % n]; p1 = pts[i]; p2 = pts[(i + 1) % n]; p3 = pts[(i + 2) % n];
      for (j = 0; j < 48; j++) {
        t = j / 48;
        raw.push([cr(p0[0], p1[0], p2[0], p3[0], t) * WORLD,
                  cr(p0[1], p1[1], p2[1], p3[1], t) * WORLD]);
      }
    }
    // re-échantillonnage à distance constante
    var out = [], acc = 0, cur = raw[0].slice(), k = 0, dx, dz, d;
    out.push(cur.slice());
    for (i = 0; i < raw.length; i++) {
      var a = raw[i], b = raw[(i + 1) % raw.length];
      dx = b[0] - a[0]; dz = b[1] - a[1]; d = Math.hypot(dx, dz);
      if (d < 1e-6) continue;
      var used = 0;
      while (acc + (d - used) >= SPACING) {
        var need = SPACING - acc;
        used += need; acc = 0;
        out.push([a[0] + dx * (used / d), a[1] + dz * (used / d)]);
      }
      acc += d - used;
    }
    // ferme proprement : retire le dernier point s'il colle au premier
    if (out.length > 2 && Math.hypot(out[out.length - 1][0] - out[0][0],
        out[out.length - 1][1] - out[0][1]) < SPACING * .6) out.pop();

    var N = out.length, cx = new Float32Array(N), cz = new Float32Array(N),
        hd = new Float32Array(N), nx = new Float32Array(N), nz = new Float32Array(N);
    for (i = 0; i < N; i++) { cx[i] = out[i][0]; cz[i] = out[i][1]; }
    for (i = 0; i < N; i++) {
      var p = (i + 1) % N, m = (i - 1 + N) % N;
      var tx = cx[p] - cx[m], tz = cz[p] - cz[m], L = Math.hypot(tx, tz) || 1;
      tx /= L; tz /= L;
      hd[i] = Math.atan2(tx, tz);        // cap : 0 = +z
      nx[i] = tz; nz[i] = -tx;           // normale droite
    }
    return { cx: cx, cz: cz, hd: hd, nx: nx, nz: nz, N: N, len: N * SPACING };
  }

  /* --------------------------------------------------- texture du sol (2D) */
  function rnd(s) { s = Math.sin(s * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }

  function texture(track, cl, th) {
    var cv = document.createElement('canvas');
    cv.width = cv.height = WORLD;
    var g = cv.getContext('2d', { alpha: false });
    var i, j, a, b, s;

    g.fillStyle = th.grass; g.fillRect(0, 0, WORLD, WORLD);

    // taches de terrain : donnent du relief au hors-piste
    for (i = 0; i < 160; i++) {
      var r = 40 + rnd(i * 3.1 + track.name.length) * 150;
      g.fillStyle = rnd(i * 7.7) > .5 ? th.grass2 : th.band;
      g.globalAlpha = .55;
      g.beginPath();
      g.arc(rnd(i + 1.3) * WORLD, rnd(i + 9.4) * WORLD, r, 0, 6.2832);
      g.fill();
    }
    g.globalAlpha = 1;

    // bandes de bord de piste (herbe tondue) puis asphalte
    function ribbon(w, color) {
      g.fillStyle = color;
      for (i = 0; i < cl.N; i++) {
        var p = (i + 1) % cl.N;
        g.beginPath();
        g.moveTo(cl.cx[i] + cl.nx[i] * w, cl.cz[i] + cl.nz[i] * w);
        g.lineTo(cl.cx[p] + cl.nx[p] * w, cl.cz[p] + cl.nz[p] * w);
        g.lineTo(cl.cx[p] - cl.nx[p] * w, cl.cz[p] - cl.nz[p] * w);
        g.lineTo(cl.cx[i] - cl.nx[i] * w, cl.cz[i] - cl.nz[i] * w);
        g.closePath(); g.fill();
      }
    }
    ribbon(HALFW + KERB + 70, th.dirt);
    ribbon(HALFW + KERB, th.rim);
    ribbon(HALFW, th.road);

    // vibreurs rouge/blanc par segments de 4 points (48 u)
    var step = 4, flip = 0;
    for (i = 0; i < cl.N; i += step) {
      var col = (flip++ % 2) ? '#f2eee4' : '#d9433b';
      g.fillStyle = col;
      for (s = -1; s <= 1; s += 2) {
        g.beginPath();
        for (j = 0; j <= step; j++) {
          var k = (i + j) % cl.N;
          g.lineTo(cl.cx[k] + cl.nx[k] * s * HALFW, cl.cz[k] + cl.nz[k] * s * HALFW);
        }
        for (j = step; j >= 0; j--) {
          var k2 = (i + j) % cl.N;
          g.lineTo(cl.cx[k2] + cl.nx[k2] * s * (HALFW + KERB),
                   cl.cz[k2] + cl.nz[k2] * s * (HALFW + KERB));
        }
        g.closePath(); g.fill();
      }
    }

    // traces de gomme dans l'axe
    g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 26; g.lineCap = 'round';
    for (s = -1; s <= 1; s += 2) {
      g.beginPath();
      for (i = 0; i <= cl.N; i++) {
        var k3 = i % cl.N;
        g.lineTo(cl.cx[k3] + cl.nx[k3] * s * 20, cl.cz[k3] + cl.nz[k3] * s * 20);
      }
      g.stroke();
    }

    // ligne d'arrivée : damier sur deux rangs
    var i0 = 0, cols = 12, rows = 2;
    for (var rr = 0; rr < rows; rr++) {
      for (var cc = 0; cc < cols; cc++) {
        var k4 = (i0 + rr * 2) % cl.N, k5 = (i0 + rr * 2 + 2) % cl.N;
        var l0 = -HALFW + (cc / cols) * 2 * HALFW, l1 = -HALFW + ((cc + 1) / cols) * 2 * HALFW;
        g.fillStyle = ((rr + cc) % 2) ? '#f2eee4' : '#15131b';
        g.beginPath();
        g.moveTo(cl.cx[k4] + cl.nx[k4] * l0, cl.cz[k4] + cl.nz[k4] * l0);
        g.lineTo(cl.cx[k4] + cl.nx[k4] * l1, cl.cz[k4] + cl.nz[k4] * l1);
        g.lineTo(cl.cx[k5] + cl.nx[k5] * l1, cl.cz[k5] + cl.nz[k5] * l1);
        g.lineTo(cl.cx[k5] + cl.nx[k5] * l0, cl.cz[k5] + cl.nz[k5] * l0);
        g.closePath(); g.fill();
      }
    }

    // bruit VGA : léger tramage sur toute la surface
    var img = g.getImageData(0, 0, WORLD, WORLD), d = img.data, seed = 12345;
    for (i = 0; i < d.length; i += 4) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      var n = ((seed >> 16) & 15) - 7;
      d[i] = d[i] + n; d[i + 1] = d[i + 1] + n; d[i + 2] = d[i + 2] + n;
    }
    g.putImageData(img, 0, 0);
    return { canvas: cv, u32: new Uint32Array(img.data.buffer) };
  }

  /* ------------------------------------------------------ décor et caisses */
  function decor(track, cl, th) {
    var list = [], i, kinds = th.decor, side = 1;
    for (i = 0; i < cl.N; i += 11) {
      side = (i % 22 === 0) ? 1 : -1;
      var kind = kinds[(i / 11 | 0) % kinds.length];
      var off = HALFW + KERB + 78 + rnd(i * 1.7) * 55;
      list.push({ kind: kind,
        x: cl.cx[i] + cl.nx[i] * side * off, z: cl.cz[i] + cl.nz[i] * side * off });
      if ((i / 11 | 0) % 7 === 3) {
        var o2 = HALFW + KERB + 150;
        list.push({ kind: 'stand',
          x: cl.cx[i] + cl.nx[i] * -side * o2, z: cl.cz[i] + cl.nz[i] * -side * o2 });
      }
    }
    return list;
  }

  function boxes(cl) {
    var out = [], fr = [.16, .36, .58, .80], i, j;
    for (i = 0; i < fr.length; i++) {
      var k = Math.floor(fr[i] * cl.N) % cl.N;
      for (j = -1; j <= 1; j++) {
        out.push({ x: cl.cx[k] + cl.nx[k] * j * 34, z: cl.cz[k] + cl.nz[k] * j * 34,
                   idx: k, t: 0 });
      }
    }
    return out;
  }

  /** Construit tout l'état statique d'une piste. */
  SK.buildTrack = function (track) {
    var th = THEMES[track.theme];
    var cl = centerline(track.pts);
    var tx = texture(track, cl, th);
    return { def: track, th: th, cl: cl, tex: tx,
             decor: decor(track, cl, th), boxes: boxes(cl) };
  };

  /** Indice de ligne médiane le plus proche + écart latéral (recherche locale). */
  SK.nearest = function (cl, x, z, hint) {
    var N = cl.N, best = -1, bd = 1e18, i, k, dx, dz, d;
    if (hint == null) {
      for (i = 0; i < N; i++) {
        dx = x - cl.cx[i]; dz = z - cl.cz[i]; d = dx * dx + dz * dz;
        if (d < bd) { bd = d; best = i; }
      }
    } else {
      for (i = -48; i <= 48; i++) {
        k = (hint + i + N) % N;
        dx = x - cl.cx[k]; dz = z - cl.cz[k]; d = dx * dx + dz * dz;
        if (d < bd) { bd = d; best = k; }
      }
      if (bd > 640 * 640) return SK.nearest(cl, x, z, null);
    }
    var lat = (x - cl.cx[best]) * cl.nx[best] + (z - cl.cz[best]) * cl.nz[best];
    return { i: best, lat: lat, dist: Math.sqrt(bd) };
  };
})(window.SK = window.SK || {});
