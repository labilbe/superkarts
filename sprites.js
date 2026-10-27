/* SuperKarts 95 — fabrique de sprites : karts tournants + objets de bord de piste.
   Tout est dessiné à la main sur des canvases hors écran, une fois au chargement. */
(function (SK) {
  'use strict';

  var FRAMES = 24;           // rotations pré-calculées par kart
  var SQUASH = 0.55;         // écrasement vertical = faux point de vue bas
  SK.FRAMES = FRAMES;

  function cv(w, h) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    return g;
  }
  function shade(hex, f) {
    var n = parseInt(hex.slice(1), 16);
    var r = Math.min(255, Math.max(0, ((n >> 16) & 255) * f)) | 0;
    var g = Math.min(255, Math.max(0, ((n >> 8) & 255) * f)) | 0;
    var b = Math.min(255, Math.max(0, (n & 255) * f)) | 0;
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  /* ------------------------------------------------------------------ karts */
  function kartFrame(a, col) {
    var W = 72, H = 56, g = cv(W, H), ox = W / 2, oy = H - 12;
    var ca = Math.cos(a), sa = Math.sin(a);
    function P(x, z, lift) {
      var X = x * ca + z * sa, Z = -x * sa + z * ca;
      return [ox + X, oy - Z * SQUASH - (lift || 0)];
    }
    function poly(pts, lift, fill) {
      g.fillStyle = fill; g.beginPath();
      for (var i = 0; i < pts.length; i++) {
        var p = P(pts[i][0], pts[i][1], lift);
        if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]);
      }
      g.closePath(); g.fill();
    }
    function box(x, z, w, l, lift, h, fill, top) {
      var pts = [[x - w, z - l], [x + w, z - l], [x + w, z + l], [x - w, z + l]];
      if (h) {                                     // flancs extrudés
        poly(pts, lift, shade(fill === top ? '#000000' : fill, .6));
        poly(pts, lift + h, fill);
      } else poly(pts, lift, fill);
      if (top) poly([[x - w, z - l], [x + w, z - l], [x + w, z - l * .2], [x - w, z - l * .2]],
                    lift + (h || 0), top);
    }

    // ombre au sol
    g.fillStyle = 'rgba(0,0,0,.42)';
    g.beginPath(); g.ellipse(ox, oy + 1, 15, 6, 0, 0, 6.2832); g.fill();

    // roues : arrière large, avant fin
    box(-11.5, 9, 3.6, 5.2, 0, 5, '#1a1a20', '#2e2e38');
    box(11.5, 9, 3.6, 5.2, 0, 5, '#1a1a20', '#2e2e38');
    box(-10, -10, 2.6, 4.2, 0, 4, '#1a1a20', '#2e2e38');
    box(10, -10, 2.6, 4.2, 0, 4, '#1a1a20', '#2e2e38');

    // châssis + pontons
    poly([[-8, -13], [8, -13], [9, 12], [-9, 12]], 3, shade(col.body, .55));
    poly([[-8, -13], [8, -13], [9, 12], [-9, 12]], 7, col.body);
    poly([[-8, -13], [8, -13], [7, -6], [-7, -6]], 7.4, shade(col.body, 1.25));
    // nez
    poly([[-6, -17], [6, -17], [7, -12], [-7, -12]], 5, col.nose);
    // moteur derrière le siège
    box(5, 10, 3.4, 3.4, 7, 5, '#5a5f68', '#8e949e');
    // siège
    poly([[-5, -1], [5, -1], [4, 7], [-4, 7]], 8, shade(col.body, .7));
    // pilote : buste + casque
    poly([[-4.4, 0], [4.4, 0], [3.6, 6], [-3.6, 6]], 9, col.suit);
    var h = P(0, 2, 15.5);
    g.fillStyle = col.helmet;
    g.beginPath(); g.arc(h[0], h[1], 5.2, 0, 6.2832); g.fill();
    g.fillStyle = 'rgba(0,0,0,.35)';
    g.beginPath(); g.arc(h[0], h[1] + 1.2, 5.2, 0.2, Math.PI - 0.2); g.fill();
    // visière visible seulement de face
    if (Math.cos(a) < -0.25) {
      g.fillStyle = '#19202b';
      g.fillRect(h[0] - 4, h[1] - 1.5, 8, 3);
    }
    // volant
    poly([[-3.6, -7], [3.6, -7], [3.6, -5.6], [-3.6, -5.6]], 11, '#20242c');
    return g.canvas;
  }

  SK.makeKart = function (col) {
    var fr = [], i;
    for (i = 0; i < FRAMES; i++) fr.push(kartFrame(i / FRAMES * 6.2831853, col));
    return { frames: fr, worldH: 30, w: 72, h: 56 };
  };

  /* ------------------------------------------------------- décor de circuit */
  var DEC = {};
  function reg(kind, worldH, w, h, draw) {
    var g = cv(w, h); draw(g, w, h);
    DEC[kind] = { cv: g.canvas, worldH: worldH, w: w, h: h };
  }
  function ground(g, w, h, r) {
    g.fillStyle = 'rgba(0,0,0,.35)';
    g.beginPath(); g.ellipse(w / 2, h - 3, r, r * .32, 0, 0, 6.2832); g.fill();
  }

  SK.buildDecor = function (th) {
    DEC = {};
    reg('tyre', 14, 34, 30, function (g, w, h) {
      ground(g, w, h, 13);
      for (var i = 0; i < 3; i++) {
        var y = h - 8 - i * 7;
        g.fillStyle = '#17171d'; g.fillRect(4, y - 6, w - 8, 8);
        g.fillStyle = '#2a2a33'; g.fillRect(4, y - 7, w - 8, 2);
        g.fillStyle = i === 2 ? '#d9433b' : '#17171d'; g.fillRect(10, y - 6, w - 20, 2);
      }
    });
    reg('tree', 95, 40, 72, function (g, w, h) {
      ground(g, w, h, 11);
      g.fillStyle = '#5a3f22'; g.fillRect(w / 2 - 3, h - 22, 6, 20);
      g.fillStyle = '#2f5a1e';
      g.beginPath(); g.ellipse(w / 2, h - 38, 18, 22, 0, 0, 6.2832); g.fill();
      g.fillStyle = '#467a2a';
      g.beginPath(); g.ellipse(w / 2 - 4, h - 44, 12, 14, 0, 0, 6.2832); g.fill();
    });
    reg('pine', 110, 36, 80, function (g, w, h) {
      ground(g, w, h, 10);
      g.fillStyle = '#4a3418'; g.fillRect(w / 2 - 2, h - 14, 4, 12);
      for (var i = 0; i < 4; i++) {
        var yy = h - 14 - i * 15, ww = 16 - i * 3;
        g.fillStyle = '#1f4a2a';
        g.beginPath(); g.moveTo(w / 2, yy - 22); g.lineTo(w / 2 + ww, yy);
        g.lineTo(w / 2 - ww, yy); g.closePath(); g.fill();
        g.fillStyle = 'rgba(232,240,248,.8)';
        g.beginPath(); g.moveTo(w / 2, yy - 22); g.lineTo(w / 2 + ww * .45, yy - 8);
        g.lineTo(w / 2 - ww * .45, yy - 8); g.closePath(); g.fill();
      }
    });
    reg('cactus', 60, 34, 56, function (g, w, h) {
      ground(g, w, h, 9);
      g.fillStyle = '#3f6b36';
      g.fillRect(w / 2 - 5, h - 42, 10, 40);
      g.fillRect(w / 2 - 13, h - 30, 8, 7); g.fillRect(w / 2 - 13, h - 30, 3, 16);
      g.fillRect(w / 2 + 5, h - 36, 8, 7); g.fillRect(w / 2 + 10, h - 36, 3, 14);
      g.fillStyle = '#548747'; g.fillRect(w / 2 - 5, h - 42, 3, 40);
    });
    reg('bale', 16, 40, 28, function (g, w, h) {
      ground(g, w, h, 15);
      g.fillStyle = '#c9a85a'; g.fillRect(3, h - 20, w - 6, 18);
      g.fillStyle = '#e0c178'; g.fillRect(3, h - 20, w - 6, 3);
      g.fillStyle = 'rgba(90,70,30,.5)';
      for (var i = 1; i < 4; i++) g.fillRect(3 + i * 9, h - 20, 1, 18);
    });
    reg('sign', 34, 46, 40, function (g, w, h) {
      g.fillStyle = '#4a4a54'; g.fillRect(8, h - 14, 3, 13); g.fillRect(w - 11, h - 14, 3, 13);
      g.fillStyle = '#15131b'; g.fillRect(4, 4, w - 8, h - 18);
      g.fillStyle = '#ffb01f'; g.fillRect(6, 6, w - 12, h - 22);
      g.fillStyle = '#15131b';
      for (var i = 0; i < 3; i++) {
        g.beginPath(); g.moveTo(9 + i * 11, 9); g.lineTo(17 + i * 11, h / 2 - 1);
        g.lineTo(9 + i * 11, h - 18); g.closePath(); g.fill();
      }
    });
    reg('cone', 9, 20, 20, function (g, w, h) {
      ground(g, w, h, 8);
      g.fillStyle = '#e06a1f';
      g.beginPath(); g.moveTo(w / 2, 2); g.lineTo(w / 2 + 7, h - 3);
      g.lineTo(w / 2 - 7, h - 3); g.closePath(); g.fill();
      g.fillStyle = '#f2eee4'; g.fillRect(w / 2 - 5, h - 11, 10, 3);
    });
    reg('crate', 20, 32, 30, function (g, w, h) {
      ground(g, w, h, 12);
      g.fillStyle = '#6b4a24'; g.fillRect(3, h - 22, w - 6, 20);
      g.fillStyle = '#845c2d'; g.fillRect(3, h - 22, w - 6, 3);
      g.strokeStyle = '#3d2a14'; g.lineWidth = 2;
      g.strokeRect(4, h - 21, w - 8, 18);
      g.beginPath(); g.moveTo(4, h - 21); g.lineTo(w - 4, h - 3); g.stroke();
    });
    reg('lamp', 90, 30, 76, function (g, w, h) {
      g.fillStyle = '#2b2f38'; g.fillRect(w / 2 - 2, 14, 4, h - 16);
      g.fillRect(w / 2 - 2, 12, 14, 4);
      g.fillStyle = '#ffd98a'; g.fillRect(w / 2 + 8, 15, 8, 5);
      g.fillStyle = 'rgba(255,217,138,.22)';
      g.beginPath(); g.moveTo(w / 2 + 12, 20); g.lineTo(w, h); g.lineTo(2, h); g.closePath(); g.fill();
    });
    reg('stand', 130, 120, 70, function (g, w, h) {
      g.fillStyle = '#3a3440'; g.fillRect(0, h - 26, w, 25);
      for (var r = 0; r < 5; r++) {
        var y = h - 28 - r * 8;
        g.fillStyle = r % 2 ? '#4a4454' : '#56506a';
        g.fillRect(r * 3, y, w - r * 6, 7);
        for (var i = 0; i < 16; i++) {
          if ((i * 7 + r * 3) % 5 === 0) continue;
          g.fillStyle = ['#d9433b', '#ffb01f', '#43d9e8', '#f2eee4', '#e0387e'][(i + r) % 5];
          g.fillRect(r * 3 + 4 + i * ((w - r * 6 - 8) / 16), y - 4, 4, 5);
        }
      }
      g.fillStyle = '#15131b'; g.fillRect(0, 0, w, 6);
      g.fillStyle = th.sun; g.fillRect(0, 5, w, 2);
    });
    reg('box', 26, 34, 34, function (g, w, h) {
      g.fillStyle = 'rgba(0,0,0,.3)';
      g.beginPath(); g.ellipse(w / 2, h - 2, 11, 4, 0, 0, 6.2832); g.fill();
      g.fillStyle = '#ffb01f'; g.fillRect(4, 4, w - 8, h - 12);
      g.fillStyle = '#ffd983'; g.fillRect(4, 4, w - 8, 4);
      g.fillStyle = '#92590a'; g.fillRect(4, h - 12, w - 8, 3);
      g.fillStyle = '#15131b'; g.font = 'bold 17px monospace'; g.textAlign = 'center';
      g.fillText('?', w / 2, h - 13);
    });
    reg('oil', 4, 44, 20, function (g, w, h) {
      g.fillStyle = 'rgba(14,12,20,.85)';
      g.beginPath(); g.ellipse(w / 2, h / 2, 20, 8, 0, 0, 6.2832); g.fill();
      g.fillStyle = 'rgba(120,90,180,.35)';
      g.beginPath(); g.ellipse(w / 2 - 4, h / 2 - 1, 9, 3, 0, 0, 6.2832); g.fill();
    });
    reg('rocket', 14, 28, 20, function (g, w, h) {
      g.fillStyle = '#d9433b'; g.fillRect(6, 7, 16, 7);
      g.fillStyle = '#f2eee4'; g.fillRect(18, 8, 5, 5);
      g.fillStyle = '#ffb01f';
      g.beginPath(); g.moveTo(6, 7); g.lineTo(6, 14); g.lineTo(0, 10.5); g.closePath(); g.fill();
    });
    return DEC;
  };
  SK.decor = function (kind) { return DEC[kind]; };
})(window.SK = window.SK || {});
