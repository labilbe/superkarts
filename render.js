/* SuperKarts 95 — rendu : ciel + arrière-plan panoramique, sol en mode 7 affine,
   sprites en billboard triés par profondeur, minicarte. */
(function (SK) {
  'use strict';

  var CAMH = 34, FOCAL = 190, ZFAR = 3400, FOG0 = 560;

  function hex(h) {
    var n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  /* -------------------------------------------------- arrière-plan 360° */
  function backdrop(th, kind) {
    var W = 1440, H = 110, c = document.createElement('canvas');
    c.width = W; c.height = H;
    var g = c.getContext('2d'), i, x, y, w2;
    function rnd(s) { s = Math.sin(s * 91.3 + 7.1) * 43758.5453; return s - Math.floor(s); }

    if (kind === 'night') {
      for (i = 0; i < 90; i++) {                        // silhouettes portuaires
        x = rnd(i) * W; w2 = 18 + rnd(i + .5) * 46;
        var hh = 16 + rnd(i + 2.3) * 72;
        g.fillStyle = i % 3 ? '#0d1320' : '#111a2b';
        g.fillRect(x, H - hh, w2, hh);
        for (var k = 0; k < 24; k++) {
          if (rnd(i * 13 + k) > .68) {
            g.fillStyle = rnd(k + i) > .5 ? '#ffd98a' : '#8fd4ff';
            g.fillRect(x + 4 + (k % 4) * (w2 / 4.4), H - hh + 5 + ((k / 4) | 0) * 9, 3, 4);
          }
        }
      }
      g.fillStyle = '#0a0f1a'; g.fillRect(0, H - 10, W, 10);
    } else if (kind === 'snow') {
      for (var pass = 0; pass < 2; pass++) {
        g.fillStyle = pass ? '#6d7f96' : '#4e5e74';
        g.beginPath(); g.moveTo(0, H);
        for (x = 0; x <= W; x += 30) {
          var pk = (pass ? 46 : 80) * (0.45 + rnd(x * .11 + pass * 5) * .75);
          g.lineTo(x, H - pk);
        }
        g.lineTo(W, H); g.closePath(); g.fill();
      }
      g.fillStyle = 'rgba(234,242,250,.9)';            // neige sur les crêtes
      for (x = 0; x <= W; x += 30) {
        var pk2 = 80 * (0.45 + rnd(x * .11) * .75);
        g.beginPath(); g.moveTo(x, H - pk2);
        g.lineTo(x + 11, H - pk2 + 16); g.lineTo(x - 11, H - pk2 + 16);
        g.closePath(); g.fill();
      }
    } else if (kind === 'desert') {
      g.fillStyle = '#a2673a';
      for (i = 0; i < 26; i++) {                        // mesas
        x = rnd(i * 2.2) * W; w2 = 70 + rnd(i) * 130;
        var mh = 24 + rnd(i + 4) * 46;
        g.fillRect(x, H - mh, w2, mh);
        g.fillStyle = i % 2 ? '#b0744222' : '#8c5731';
        g.fillRect(x, H - mh, w2, 5);
        g.fillStyle = '#a2673a';
      }
      g.fillStyle = '#c8954f'; g.fillRect(0, H - 14, W, 14);
    } else {
      for (var p2 = 0; p2 < 2; p2++) {                  // collines boisées
        g.fillStyle = p2 ? '#3c6b3a' : '#2b4f31';
        g.beginPath(); g.moveTo(0, H);
        for (x = 0; x <= W; x += 24) {
          g.lineTo(x, H - (p2 ? 26 : 48) * (0.5 + rnd(x * .07 + p2 * 3) * .8));
        }
        g.lineTo(W, H); g.closePath(); g.fill();
      }
      g.fillStyle = '#2f5a35'; g.fillRect(0, H - 8, W, 8);
    }
    return c;
  }

  /* --------------------------------------------------------------- moteur */
  SK.Renderer = function (canvas) {
    var ctx = canvas.getContext('2d', { alpha: false });
    ctx.imageSmoothingEnabled = false;
    var W = canvas.width, H = canvas.height;
    var img = ctx.createImageData(W, H);
    var buf = new Uint32Array(img.data.buffer);
    var back = null, sky = null, themeKey = null;
    var cam = { x: 0, z: 0, a: 0, h: CAMH, focal: FOCAL, horizon: H * 0.42 };
    var sprites = [];

    function setTheme(track) {
      if (themeKey === track.def.name) return;
      themeKey = track.def.name;
      back = backdrop(track.th, track.def.theme);
      sky = ctx.createLinearGradient(0, 0, 0, H * 0.56);
      sky.addColorStop(0, track.th.sky1);
      sky.addColorStop(1, track.th.sky2);
    }

    /** Projette un point du sol ; renvoie null derrière la caméra. */
    function project(x, z) {
      var fx = Math.sin(cam.a), fz = Math.cos(cam.a);
      var dx = x - cam.x, dz = z - cam.z;
      var rz = dx * fx + dz * fz;
      if (rz < 14) return null;
      var rx = dx * fz - dz * fx;
      var s = cam.focal / rz;
      return { x: W / 2 + rx * s, y: cam.horizon + cam.h * s, s: s, z: rz };
    }

    function ground(track) {
      var tex = track.tex.u32, M = SK.WORLD, MASK = M - 1;
      var hz = cam.horizon | 0;
      var fx = Math.sin(cam.a), fz = Math.cos(cam.a);
      var rx = fz, rz = -fx;
      var hc = hex(track.th.haze), hr = hc[0], hg = hc[1], hb = hc[2];
      var hazePx = (255 << 24) | (hb << 16) | (hg << 8) | hr;
      var y, i, py, zz, sc, wx, wz, sx, sz, row, fog, fa, fb, c, r2, g2, b2;

      if (hz < 0) hz = 0;
      for (y = hz; y < H; y++) {
        row = y * W;
        py = y - cam.horizon;
        if (py < 0.7) py = 0.7;
        zz = cam.h * cam.focal / py;
        if (zz > ZFAR) { for (i = 0; i < W; i++) buf[row + i] = hazePx; continue; }
        sc = zz / cam.focal;
        wx = cam.x + fx * zz - rx * (W / 2) * sc;
        wz = cam.z + fz * zz - rz * (W / 2) * sc;
        sx = rx * sc; sz = rz * sc;
        fog = (zz - FOG0) / (ZFAR - FOG0);
        if (fog < 0) fog = 0; else if (fog > 1) fog = 1;
        fog *= fog * 0.92;
        fa = (fog * 256) | 0; fb = 256 - fa;
        if (fa < 4) {
          for (i = 0; i < W; i++) {
            buf[row + i] = tex[(((wz | 0) & MASK) << 11) + ((wx | 0) & MASK)];
            wx += sx; wz += sz;
          }
        } else {
          for (i = 0; i < W; i++) {
            c = tex[(((wz | 0) & MASK) << 11) + ((wx | 0) & MASK)];
            r2 = ((c & 255) * fb + hr * fa) >> 8;
            g2 = (((c >> 8) & 255) * fb + hg * fa) >> 8;
            b2 = (((c >> 16) & 255) * fb + hb * fa) >> 8;
            buf[row + i] = (255 << 24) | (b2 << 16) | (g2 << 8) | r2;
            wx += sx; wz += sz;
          }
        }
      }
      ctx.putImageData(img, 0, 0, 0, hz, W, H - hz);
    }

    function skyPass(track) {
      var hz = cam.horizon | 0;
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, hz + 1);
      // soleil / lune
      var sunA = 0.9, da = ((sunA - cam.a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      var sx = W / 2 - da * (W / 1.25);
      if (sx > -40 && sx < W + 40) {
        ctx.fillStyle = track.th.sun;
        ctx.beginPath(); ctx.arc(sx, hz - 62, track.def.theme === 'night' ? 9 : 14, 0, 6.2832);
        ctx.fill();
      }
      var bw = back.width, bh = back.height;
      var off = -((cam.a / 6.2831853) * bw) % bw;
      var by = hz - bh + 2;
      ctx.drawImage(back, off, by);
      ctx.drawImage(back, off + bw, by);
      if (off + bw * 2 < W) ctx.drawImage(back, off + bw * 2, by);
    }

    /* ------------------------------------------------------------ sprites */
    function push(x, z, cvs, worldH, w, h, tint) {
      var p = project(x, z);
      if (!p || p.z > ZFAR * .9) return;
      var dh = worldH * p.s, dw = dh * (w / h);
      if (p.x + dw / 2 < 0 || p.x - dw / 2 > W) return;
      sprites.push({ p: p, cvs: cvs, dw: dw, dh: dh, tint: tint });
    }

    // canvas d'appoint : sert à teinter un sprite sans peindre son fond transparent
    var sc = document.createElement('canvas'), scg = sc.getContext('2d');
    function tinted(cvs, color, a) {
      if (sc.width !== cvs.width || sc.height !== cvs.height) {
        sc.width = cvs.width; sc.height = cvs.height;
      } else scg.clearRect(0, 0, sc.width, sc.height);
      scg.globalAlpha = 1; scg.globalCompositeOperation = 'source-over';
      scg.drawImage(cvs, 0, 0);
      scg.globalCompositeOperation = 'source-atop';
      scg.globalAlpha = a; scg.fillStyle = color;
      scg.fillRect(0, 0, sc.width, sc.height);
      scg.globalCompositeOperation = 'source-over';
      return sc;
    }

    function drawSprites() {
      sprites.sort(function (a, b) { return b.p.z - a.p.z; });
      var i, s, f, src;
      for (i = 0; i < sprites.length; i++) {
        s = sprites[i];
        f = (s.p.z - FOG0) / (ZFAR - FOG0);
        if (f < 0) f = 0; else if (f > 1) f = 1;
        ctx.globalAlpha = 1 - f * f * 0.9;             // les sprites se dissolvent dans la brume
        src = s.tint ? tinted(s.cvs, s.tint.c, s.tint.a) : s.cvs;
        ctx.drawImage(src, 0, 0, s.cvs.width, s.cvs.height,
          Math.round(s.p.x - s.dw / 2), Math.round(s.p.y - s.dh),
          Math.max(1, Math.round(s.dw)), Math.max(1, Math.round(s.dh)));
      }
      ctx.globalAlpha = 1;
      sprites.length = 0;
    }

    /* -------------------------------------------------------- effets plein écran */
    function speedlines(k) {
      var n = 14, i, a, r0, r1;
      ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1;
      ctx.beginPath();
      for (i = 0; i < n; i++) {
        a = (i / n) * 6.2832 + (performance.now() / 400);
        r0 = 70 + (i % 3) * 14; r1 = r0 + 40 * k;
        ctx.moveTo(W / 2 + Math.cos(a) * r0, H / 2 + Math.sin(a) * r0 * .7);
        ctx.lineTo(W / 2 + Math.cos(a) * r1, H / 2 + Math.sin(a) * r1 * .7);
      }
      ctx.stroke();
    }

    return {
      ctx: ctx, W: W, H: H, cam: cam,
      setTheme: setTheme, project: project, push: push,
      begin: function (track, horizon) {
        setTheme(track);
        cam.horizon = horizon;
        skyPass(track);
        ground(track);
      },
      end: function (track, boost) {
        drawSprites();
        if (boost > 0) speedlines(boost);
      },
      flash: function (color, a) {
        ctx.globalAlpha = a; ctx.fillStyle = color;
        ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
      }
    };
  };

  /* ------------------------------------------------------------- minicarte */
  SK.minimap = function (mc, track, karts, me) {
    var g = mc.getContext('2d'), W = mc.width, H = mc.height, cl = track.cl, i;
    g.clearRect(0, 0, W, H);
    var pad = 8, s = (W - pad * 2) / SK.WORLD;
    function X(x) { return pad + x * s; }
    function Y(z) { return pad + z * s; }
    g.strokeStyle = 'rgba(242,238,228,.5)'; g.lineWidth = 5; g.lineJoin = 'round';
    g.beginPath();
    for (i = 0; i <= cl.N; i += 2) {
      var k = i % cl.N;
      if (i) g.lineTo(X(cl.cx[k]), Y(cl.cz[k])); else g.moveTo(X(cl.cx[k]), Y(cl.cz[k]));
    }
    g.closePath(); g.stroke();
    g.strokeStyle = 'rgba(255,176,31,.85)'; g.lineWidth = 2;
    g.beginPath();
    g.moveTo(X(cl.cx[0] + cl.nx[0] * SK.HALFW), Y(cl.cz[0] + cl.nz[0] * SK.HALFW));
    g.lineTo(X(cl.cx[0] - cl.nx[0] * SK.HALFW), Y(cl.cz[0] - cl.nz[0] * SK.HALFW));
    g.stroke();
    for (i = 0; i < karts.length; i++) {
      var kt = karts[i], r = kt === me ? 4.5 : 3;
      g.fillStyle = kt === me ? '#ffb01f' : kt.col.body;
      g.beginPath(); g.arc(X(kt.x), Y(kt.z), r, 0, 6.2832); g.fill();
      if (kt === me) { g.strokeStyle = '#15131b'; g.lineWidth = 1.5; g.stroke(); }
    }
  };
})(window.SK = window.SK || {});
